require("dotenv").config();

const { pool } = require("./db");
const { getOrganizationId } = require("./shared");
const url = 'https://careers.un.org/api/public/opening/jo/list/filteredV2/en';

async function fetchAndProcessInspiraJobVacancies() {
    console.log("\n" + "=".repeat(80));
    console.log("🌐 UN SECRETARIAT JOB VACANCIES ETL PROCESS");
    console.log("=".repeat(80));
    console.log("⏱️  Started at:", new Date().toLocaleString());
    console.log("-".repeat(80));

    let page = 0;
    const itemsPerPage = 10;
    let totalPages = 1;
    let newJobs = 0;
    let updatedJobs = 0;
    let closedJobs = 0;
    let processedJobs = 0;
    let ghostJobs = 0;

    try {
        const currentDate = new Date();
        
        // Get all active job IDs for this source before processing
        const activeJobs = await pool.query(
            'SELECT job_id FROM job_vacancies WHERE data_source = $1 AND status = $2',
            ['inspira', 'active']
        );
        const activeJobIds = new Set(activeJobs.rows.map(row => row.job_id));
        const seenJobIds = new Set();

        while (page < totalPages) {
            const payload = {
                filterConfig: {
                    keyword: ""
                },
                pagination: {
                    page: page,
                    itemPerPage: itemsPerPage,
                    sortBy: "startDate",
                    sortDirection: -1
                }
            };

            const response = await fetch(url, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(payload)
            });

            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }

            const data = await response.json();
            totalPages = Math.ceil(data.data.count / 10);

            // Process each job
            for (const job of data.data.list) {
                processedJobs++;
                const {
                    jobId,
                    language,
                    categoryCode,
                    jobTitle,
                    jobCodeTitle,
                    jobDescription,
                    jobFamilyCode,
                    jobLevel,
                    dutyStation,
                    recruitmentType,
                    startDate,
                    endDate,
                    dept,
                    totalCount,
                    jn,
                    jf,
                    jc,
                    jl
                } = job;

                // Mark this job as seen
                seenJobIds.add(jobId);

                const orgId = await getOrganizationId(dept?.name);
                const applyLink = `https://careers.un.org/jobSearchDescription/${jobId}?language=en`;

                // Progress indicator
                process.stdout.write(`\r📋 Processing jobs: ${processedJobs}/${data.data.count}`);

                // Check if job already exists
                const existingJob = await pool.query(
                    'SELECT id, job_title, end_date FROM job_vacancies WHERE job_id = $1 AND data_source = $2',
                    [jobId, 'inspira']
                );

                if (existingJob.rows.length === 0) {
                    // New job - insert it
                    await pool.query(`
                        INSERT INTO job_vacancies (
                            job_id, language, category_code, job_title, job_code_title, job_description,
                            job_family_code, job_level, duty_station, recruitment_type, start_date, end_date, dept,
                            total_count, jn, jf, jc, jl, created, data_source, organization_id, apply_link, status
                        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, $20, $21, $22, $23)
                    `, [
                        jobId, language, categoryCode, jobTitle, jobCodeTitle, jobDescription,
                        jobFamilyCode, jobLevel, dutyStation[0]?.description || '', recruitmentType,
                        new Date(startDate), new Date(endDate), dept?.name || '', totalCount,
                        jn?.name || '', jf?.Name || '', jc?.name || '', jl?.name || '',
                        new Date(), 'inspira', orgId, applyLink, 'active'
                    ]);
                    newJobs++;
                    console.log(`\n✨ New job added: ${jobTitle} (${dutyStation[0]?.description || 'No location'})`);
                } else {
                    // Existing job - update if changed
                    const existingEndDate = new Date(existingJob.rows[0].end_date);
                    const newEndDate = new Date(endDate);

                    if (existingEndDate.getTime() !== newEndDate.getTime() || 
                        existingJob.rows[0].job_title !== jobTitle) {
                        
                        await pool.query(`
                            UPDATE job_vacancies 
                            SET job_title = $1, job_description = $2, end_date = $3, 
                                duty_station = $4, last_updated = $5
                            WHERE job_id = $6 AND data_source = $7
                        `, [
                            jobTitle, jobDescription, new Date(endDate),
                            dutyStation[0]?.description || '', new Date(),
                            jobId, 'inspira'
                        ]);
                        updatedJobs++;
                        console.log(`\n🔄 Updated job: ${jobTitle} (${dutyStation[0]?.description || 'No location'})`);
                    }
                }
            }

            page++;
        }

        // Find and mark jobs that no longer appear in the API
        for (const jobId of activeJobIds) {
            if (!seenJobIds.has(jobId)) {
                await pool.query(`
                    UPDATE job_vacancies 
                    SET status = 'closed', last_updated = $1, 
                        notes = CASE 
                            WHEN notes IS NULL THEN 'Job no longer available in API'
                            ELSE notes || '; Job no longer available in API'
                        END
                    WHERE job_id = $2 AND data_source = $3 AND status = 'active'
                `, [new Date(), jobId, 'inspira']);
                ghostJobs++;
                console.log(`\n👻 Ghost job closed: ${jobId}`);
            }
        }

        // Mark jobs as closed based on end date
        const closedJobsResult = await pool.query(`
            UPDATE job_vacancies 
            SET status = 'closed', last_updated = $1,
                notes = CASE 
                    WHEN notes IS NULL THEN 'Job expired based on end date'
                    ELSE notes || '; Job expired based on end date'
                END
            WHERE data_source = 'inspira' 
            AND status = 'active'
            AND end_date < $2
            RETURNING id
        `, [new Date(), currentDate]);

        closedJobs = closedJobsResult.rowCount;

        // Final summary
        console.log("\n" + "-".repeat(80));
        console.log("📊 ETL PROCESS SUMMARY");
        console.log("-".repeat(80));
        console.log(`✨ New jobs added:     ${newJobs}`);
        console.log(`🔄 Jobs updated:      ${updatedJobs}`);
        console.log(`🔒 Jobs closed:       ${closedJobs}`);
        console.log(`👻 Ghost jobs:        ${ghostJobs}`);
        console.log(`📋 Total processed:   ${processedJobs}`);
        console.log("-".repeat(80));
        console.log("⏱️  Completed at:", new Date().toLocaleString());
        console.log("=".repeat(80) + "\n");

    } catch (error) {
        console.error("\n❌ Error in ETL process:", error);
        console.log("=".repeat(80) + "\n");
        throw error;
    }
}

module.exports = { fetchAndProcessInspiraJobVacancies };