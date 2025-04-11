require("dotenv").config();

const { Client } = require("pg");
const { credentials } = require("./db");
const { getOrganizationId } = require("./shared");
const logger = require("./logger");

const url = "https://wd3.myworkdaysite.com/wday/cxs/wfp/job_openings/jobs";

async function fetchAndProcessWfpJobVacancies() {
    const startTime = new Date();
    console.log("\n" + "=".repeat(80));
    console.log("🌐 WFP (WORLD FOOD PROGRAMME) ETL Process");
    console.log(`⏰ Start Time: ${startTime.toISOString()}`);
    console.log("=".repeat(80) + "\n");

    const client = new Client(credentials);
    let totalJobs = 0;
    let processedJobs = 0;

    try {
        await client.connect();
        console.log("✅ Database connection established");

        // Get existing jobs before deletion for notes
        const existingJobs = await client.query(
            'SELECT job_id, job_title, end_date, notes FROM job_vacancies WHERE data_source = $1',
            ['wfp']
        );
        const existingJobsMap = new Map(existingJobs.rows.map(row => [row.job_id, row]));
        console.log(`📊 Found ${existingJobs.rows.length} existing jobs`);

        // Delete existing jobs but preserve their notes
        await client.query(`DELETE FROM job_vacancies WHERE data_source = 'wfp'`);
        console.log("🗑️  Cleared existing WFP jobs");

        let page = 0;
        const itemsPerPage = 20;
        let totalPages = 1;
        const currentJobIds = new Set(); // Track all jobs across pages

        while (page < totalPages) {
            const payload = {
                "appliedFacets": {},
                "limit": itemsPerPage,
                "offset": page * itemsPerPage,
                "searchText": ""
            };

            try {
                const response = await fetch(url, {
                    method: "POST",
                    headers: {
                        "Content-Type": "application/json",
                    },
                    body: JSON.stringify(payload),
                });

                if (!response.ok) {
                    throw new Error(`HTTP error! status: ${response.status}`);
                }

                const data = await response.json();

                if (totalPages === 1) {
                    totalPages = Math.ceil(data.total / itemsPerPage);
                    console.log(`📑 Total pages to process: ${totalPages}`);
                }

                // Track jobs in current page
                for (const job of data.jobPostings) {
                    currentJobIds.add(job.id);
                }

                for (const job of data.jobPostings) {
                    processedJobs++;
                    const jobDetailAPI = `https://wd3.myworkdaysite.com/wday/cxs/wfp/job_openings${job.externalPath}`;

                    try {
                        const responseDetail = await fetch(jobDetailAPI);
                        const jobDetail = await responseDetail.json();

                        const startDate = jobDetail.jobPostingInfo.startDate
                            ? new Date(jobDetail.jobPostingInfo.startDate)
                            : null;
                        const endDate = jobDetail.jobPostingInfo.endDate
                            ? new Date(jobDetail.jobPostingInfo.endDate)
                            : null;

                        const orgId = await getOrganizationId("WFP");
                        const jobId = jobDetail.jobPostingInfo.id;
                        const existingJob = existingJobsMap.get(jobId);

                        if (!existingJob) {
                            // Insert new job
                            await client.query(`
                                INSERT INTO job_vacancies (
                                    job_id, language, category_code, job_title, job_code_title, job_description,
                                    job_family_code, job_level, duty_station, recruitment_type, start_date, end_date, dept,
                                    total_count, jn, jf, jc, jl, created, data_source, organization_id, apply_link, status
                                ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, $20, $21, $22, $23)
                            `, [
                                jobId,
                                "EN",
                                job.bulletFields[0],
                                job.title,
                                jobDetail.jobPostingInfo.jobPostingId,
                                jobDetail.jobPostingInfo.jobDescription,
                                "", // jobFamilyCode
                                "", // jobLevel
                                jobDetail.jobPostingInfo.location,
                                jobDetail.jobPostingInfo.timeType,
                                startDate,
                                endDate,
                                jobDetail.hiringOrganization.name || "",
                                job.total,
                                "", // jn
                                "", // jf
                                "", // jc
                                "", // jl
                                new Date(),
                                "wfp",
                                orgId,
                                "https://wd3.myworkdaysite.com/en-US/recruiting/wfp/job_openings/details/" + jobDetail.jobPostingInfo.jobPostingId,
                                "active"
                            ]);
                            console.log(`✨ New job added: ${job.title}`);
                        } else if (
                            existingJob.job_title !== job.title ||
                            existingJob.end_date?.toISOString() !== endDate?.toISOString()
                        ) {
                            // Update existing job
                            await client.query(`
                                UPDATE job_vacancies 
                                SET job_title = $1, job_description = $2, end_date = $3, 
                                    duty_station = $4, updated_at = NOW()
                                WHERE job_id = $5 AND data_source = $6
                            `, [
                                job.title,
                                jobDetail.jobPostingInfo.jobDescription,
                                endDate,
                                jobDetail.jobPostingInfo.location,
                                jobId,
                                'wfp'
                            ]);
                            console.log(`📝 Updated job: ${job.title}`);
                        }

                        // Remove from map to track which jobs are still active
                        existingJobsMap.delete(jobId);

                    } catch (jobError) {
                        console.error(`❌ Error processing job ${job.title}:`, jobError.message);
                        logger.error("Error processing individual job", {
                            error: jobError,
                            jobTitle: job.title,
                            jobId: jobDetail?.jobPostingInfo?.id
                        });
                    }

                    // Show progress
                    if (processedJobs % 10 === 0) {
                        console.log(`⏳ Processed ${processedJobs} jobs...`);
                    }
                }

                page++;
            } catch (pageError) {
                console.error("❌ Error processing page:", pageError.message);
                logger.error("Error processing page", {
                    error: pageError,
                    page,
                    totalPages
                });
                page++; // Move to next page despite error
            }
        }

        // Update job statuses and delete expired jobs
        const jobStatusUpdate = await client.query(`
            WITH expired_jobs AS (
                DELETE FROM job_vacancies 
                WHERE data_source = 'wfp' 
                AND end_date < NOW()
                RETURNING job_id
            ),
            status_updates AS (
                UPDATE job_vacancies 
                SET status = CASE 
                    WHEN end_date < NOW() THEN 'closed'
                    ELSE 'active'
                END,
                notes = CASE 
                    WHEN end_date < NOW() THEN COALESCE(notes, '') || '; Job has expired on ' || NOW()::text
                    ELSE notes
                END,
                updated_at = NOW()
                WHERE data_source = 'wfp'
                RETURNING job_id, status
            )
            SELECT 
                (SELECT COUNT(*) FROM expired_jobs) as expired_count,
                (SELECT COUNT(*) FROM status_updates WHERE status = 'active') as active_count
        `);

        const expiredCount = jobStatusUpdate.rows[0].expired_count;
        const activeCount = jobStatusUpdate.rows[0].active_count;

        const endTime = new Date();
        const duration = (endTime - startTime) / 1000;

        console.log("\n" + "=".repeat(80));
        console.log("📊 WFP Jobs ETL Process Summary");
        console.log("=".repeat(80));
        console.log(`📦 Total jobs processed: ${processedJobs}`);
        console.log(`🗑️  Expired jobs removed: ${expiredCount}`);
        console.log(`✅ Active jobs: ${activeCount}`);
        console.log(`⏱️ Duration: ${duration.toFixed(2)} seconds`);
        console.log(`⏰ End Time: ${endTime.toISOString()}`);
        console.log("=".repeat(80) + "\n");

    } catch (error) {
        console.error("\n❌ Error in WFP ETL process:", error.message);
        logger.error("Error in WFP Jobs", {
            error: {
                message: error.message,
                stack: error.stack,
                code: error.code
            },
            stats: {
                processedJobs,
                totalJobs
            }
        });
        throw error;
    } finally {
        await client.end();
        console.log("✅ Database connection closed");
    }
}

module.exports = { fetchAndProcessWfpJobVacancies };