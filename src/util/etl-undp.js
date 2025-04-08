require("dotenv").config();

const { pool } = require("./db");
const { getOrganizationId } = require("./shared");

const url = 'https://estm.fa.em2.oraclecloud.com/hcmRestApi/resources/latest/recruitingCEJobRequisitions?onlyData=true&expand=all&finder=findReqs;';

async function fetchAndProcessUndpJobVacancies() {
    console.log("\n" + "=".repeat(80));
    console.log("🌐 UNDP (UNITED NATIONS DEVELOPMENT PROGRAMME) ETL PROCESS");
    console.log("=".repeat(80));
    console.log("⏱️  Started at:", new Date().toLocaleString());
    console.log("-".repeat(80));

    let page = 0;
    const itemsPerPage = 25;
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
            ['undp', 'active']
        );
        const activeJobIds = new Set(activeJobs.rows.map(row => row.job_id));
        const seenJobIds = new Set();

        while (page < totalPages) {
            try {
                const response = await fetch(`${url}offset=${page}`);

                if (!response.ok) {
                    throw new Error(`HTTP error! status: ${response.status}`);
                }

                const data = await response.json();
                totalPages = Math.ceil(data.items[0].TotalJobsCount / 25);

                // Process each job
                for (const job of data.items[0].requisitionList) {
                    processedJobs++;
                    process.stdout.write(`\r📋 Processing jobs: ${processedJobs}/${data.items[0].TotalJobsCount}`);

                    // Mark this job as seen
                    seenJobIds.add(job.Id);

                    const jobDetailAPI = `https://estm.fa.em2.oraclecloud.com/hcmRestApi/resources/latest/recruitingCEJobRequisitionDetails?expand=all&onlyData=true&finder=ById;Id=%22${job.Id}%22,siteNumber=CX_1`;
                    const responseDetail = await fetch(jobDetailAPI);
                    const jobDetail = await responseDetail.json();
                    
                    const startDate = jobDetail.items[0].ExternalPostedStartDate ? new Date(jobDetail.items[0].ExternalPostedStartDate) : null;
                    const endDate = jobDetail.items[0].ExternalPostedEndDate ? new Date(jobDetail.items[0].ExternalPostedEndDate) : null;

                    const requisitionFlexFields = jobDetail.items[0].requisitionFlexFields || [];
                    const agency = requisitionFlexFields[0]?.Value || 'UNDP';
                    const practiceArea = requisitionFlexFields[3]?.Value || '';
                    const grade = requisitionFlexFields[1]?.Value || '';

                    // Check if job already exists
                    const existingJob = await pool.query(
                        'SELECT id, job_title, end_date FROM job_vacancies WHERE job_id = $1 AND data_source = $2',
                        [job.Id, 'undp']
                    );

                    const orgId = await getOrganizationId(agency);
                    const applyLink = `https://estm.fa.em2.oraclecloud.com/hcmUI/CandidateExperience/en/sites/CX_1/job/${job.Id}`;

                    if (existingJob.rows.length === 0) {
                        // New job - insert it
                        await pool.query(`
                            INSERT INTO job_vacancies (
                                job_id, language, category_code, job_title, job_code_title, job_description,
                                job_family_code, job_level, duty_station, recruitment_type, start_date, end_date, dept,
                                total_count, jn, jf, jc, jl, created, data_source, organization_id, apply_link, status
                            ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, $20, $21, $22, $23)
                        `, [
                            job.Id, job.Language, jobDetail.items[0].Category, job.Title, job.JobFunction,
                            jobDetail.items[0].ExternalDescriptionStr, job.JobFamily, '', job.PrimaryLocation || '',
                            jobDetail.items[0].RequisitionType, startDate, endDate, agency, null,
                            practiceArea, '', '', grade, new Date(), 'undp', orgId, applyLink, 'active'
                        ]);
                        newJobs++;
                        console.log(`\n✨ New job added: ${job.Title} (${job.PrimaryLocation || 'No location'})`);
                    } else {
                        // Existing job - update if changed
                        const existingEndDate = existingJob.rows[0].end_date ? new Date(existingJob.rows[0].end_date) : null;
                        const newEndDate = endDate;

                        if ((!existingEndDate && newEndDate) || 
                            (existingEndDate && newEndDate && existingEndDate.getTime() !== newEndDate.getTime()) || 
                            existingJob.rows[0].job_title !== job.Title) {
                            
                            await pool.query(`
                                UPDATE job_vacancies 
                                SET job_title = $1, job_description = $2, end_date = $3, 
                                    duty_station = $4, last_updated = $5
                                WHERE job_id = $6 AND data_source = $7
                            `, [
                                job.Title, jobDetail.items[0].ExternalDescriptionStr, endDate,
                                job.PrimaryLocation || '', new Date(),
                                job.Id, 'undp'
                            ]);
                            updatedJobs++;
                            console.log(`\n🔄 Updated job: ${job.Title} (${job.PrimaryLocation || 'No location'})`);
                        }
                    }
                }

                page++;
            } catch (error) {
                console.error('\n❌ Error processing page:', error);
                page++; // Move to next page despite error
            }
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
                `, [new Date(), jobId, 'undp']);
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
            WHERE data_source = 'undp' 
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

module.exports = { fetchAndProcessUndpJobVacancies };