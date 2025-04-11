require("dotenv").config();

const { Client } = require("pg");
const { credentials } = require("./db");
const { getOrganizationId } = require("./shared");
const logger = require("./logger");

const url = "https://imf.wd5.myworkdayjobs.com/wday/cxs/imf/IMF/jobs";

async function fetchAndProcessImfJobVacancies() {
  const startTime = new Date();
  console.log("\n" + "=".repeat(80));
  console.log("🌐 IMF (INTERNATIONAL MONETARY FUND) ETL PROCESS");
  console.log(`⏰ Start Time: ${startTime.toISOString()}`);
  console.log("=".repeat(80) + "\n");

  let newJobs = 0;
  let updatedJobs = 0;
  let totalProcessed = 0;
  const client = new Client(credentials);
  const currentJobIds = new Set();

  try {
    await client.connect();
    console.log("✅ Database connection established");

    // Get existing active jobs
    const existingJobs = await client.query(
      'SELECT job_id, job_title, end_date FROM job_vacancies WHERE data_source = $1 AND status = $2',
      ['imf', 'active']
    );
    const existingJobMap = new Map(existingJobs.rows.map(row => [row.job_id, row]));
    console.log(`📊 Found ${existingJobs.rows.length} existing active jobs`);

    let page = 0;
    const itemsPerPage = 20;
    let totalPages = 1;

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
          totalProcessed++;
          const jobDetailAPI = `https://imf.wd5.myworkdayjobs.com/wday/cxs/imf/IMF${job.externalPath}`;

          try {
            const responseDetail = await fetch(jobDetailAPI);
            const jobDetail = await responseDetail.json();

            const startDate = jobDetail.jobPostingInfo.startDate
              ? new Date(jobDetail.jobPostingInfo.startDate)
              : null;
            const endDate = jobDetail.jobPostingInfo.endDate
              ? new Date(jobDetail.jobPostingInfo.endDate)
              : null;

            const orgId = await getOrganizationId("IMF");
            const jobId = jobDetail.jobPostingInfo.id;
            const existingJob = existingJobMap.get(jobId);

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
                "imf",
                orgId,
                "https://imf.wd5.myworkdayjobs.com/en-US/IMF/details/" + jobDetail.jobPostingInfo.jobPostingId,
                "active"
              ]);
              newJobs++;
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
                'imf'
              ]);
              updatedJobs++;
              console.log(`📝 Updated job: ${job.title}`);
            }

            // Remove from map to track which jobs are still active
            existingJobMap.delete(jobId);

          } catch (jobError) {
            console.error(`❌ Error processing job ${job.title}:`, jobError.message);
            logger.error("Error processing individual job", {
              error: jobError,
              jobTitle: job.title,
              jobId: jobDetail?.jobPostingInfo?.id
            });
          }

          // Show progress
          if (totalProcessed % 10 === 0) {
            console.log(`⏳ Processed ${totalProcessed} jobs...`);
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
            WHERE data_source = 'imf' 
            AND end_date < NOW()
            RETURNING job_id
        )
        SELECT 
            (SELECT COUNT(*) FROM expired_jobs) as expired_count,
            (SELECT COUNT(*) FROM job_vacancies WHERE data_source = 'imf') as active_count
    `);

    const expiredCount = jobStatusUpdate.rows[0].expired_count;
    const activeCount = jobStatusUpdate.rows[0].active_count;

    const endTime = new Date();
    const duration = (endTime - startTime) / 1000;

    console.log("\n" + "=".repeat(80));
    console.log("📊 IMF Jobs ETL Process Summary");
    console.log("=".repeat(80));
    console.log(`✨ New jobs added: ${newJobs}`);
    console.log(`📝 Updated jobs: ${updatedJobs}`);
    console.log(`🗑️  Expired jobs removed: ${expiredCount}`);
    console.log(`✅ Total active jobs: ${activeCount}`);
    console.log(`⏱️ Duration: ${duration.toFixed(2)} seconds`);
    console.log(`⏰ End Time: ${endTime.toISOString()}`);
    console.log("=".repeat(80) + "\n");

  } catch (error) {
    console.error("❌ Error in IMF ETL process:", error.message);
    logger.error("Error in IMF ETL process", {
      error,
      stats: {
        totalProcessed,
        newJobs,
        updatedJobs
      }
    });
    throw error;
  } finally {
    await client.end();
    console.log("✅ Database connection closed");
  }
}

module.exports = { fetchAndProcessImfJobVacancies };