require("dotenv").config();

const pool = require("./db");
const logger = require("./logger");
const JobTracker = require("./job-tracker");

async function fetchAndProcessWorldBankJobVacancies() {
  const startTime = new Date();
  console.log("\n" + "=".repeat(80));
  console.log("🏦 Starting World Bank Jobs ETL Process");
  console.log(`⏰ Start Time: ${startTime.toISOString()}`);
  console.log("=".repeat(80) + "\n");

  const client = await pool.connect();
  let newJobs = 0;
  let updatedJobs = 0;
  let closedJobs = 0;
  let totalProcessed = 0;

  try {
    const jobTracker = new JobTracker(client);
    await jobTracker.initializeRun("World Bank");

    const response = await fetch(
      "https://www.worldbank.org/en/about/careers/search?api=true&format=json&rows=1000"
    );
    const data = await response.json();

    if (!data || !data.response || !data.response.docs) {
      throw new Error("Invalid response format from World Bank API");
    }

    const jobs = data.response.docs;
    console.log(`📊 Processing ${jobs.length} World Bank job vacancies...\n`);

    for (const job of jobs) {
      totalProcessed++;
      const jobData = {
        job_id: job.id.toString(),
        title: job.title,
        organization_id: 7, // World Bank
        grade: job.grade || "",
        duty_station: job.location || "",
        posting_url: `https://worldbank.org/en/about/careers/search?api=true&format=json&rows=1000${job.id}`,
        opening_date: job.opendate ? new Date(job.opendate) : null,
        closing_date: job.closedate ? new Date(job.closedate) : null,
        status: "active"
      };

      // Check if job exists and if it needs updating
      const existingJob = await client.query(
        "SELECT job_id, title, grade, duty_station, closing_date FROM job_vacancies WHERE job_id = $1 AND organization_id = 7",
        [jobData.job_id]
      );

      if (existingJob.rows.length === 0) {
        await client.query(
          `INSERT INTO job_vacancies 
          (job_id, title, organization_id, grade, duty_station, posting_url, opening_date, closing_date, status, created_at, updated_at)
          VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, NOW(), NOW())`,
          [
            jobData.job_id,
            jobData.title,
            jobData.organization_id,
            jobData.grade,
            jobData.duty_station,
            jobData.posting_url,
            jobData.opening_date,
            jobData.closing_date,
            jobData.status
          ]
        );
        newJobs++;
        console.log(`✨ New job added: ${jobData.title}`);
      } else {
        const existing = existingJob.rows[0];
        if (
          existing.title !== jobData.title ||
          existing.grade !== jobData.grade ||
          existing.duty_station !== jobData.duty_station ||
          existing.closing_date?.toISOString() !== jobData.closing_date?.toISOString()
        ) {
          await client.query(
            `UPDATE job_vacancies 
            SET title = $2, grade = $3, duty_station = $4, closing_date = $5, updated_at = NOW()
            WHERE job_id = $1 AND organization_id = 7`,
            [
              jobData.job_id,
              jobData.title,
              jobData.grade,
              jobData.duty_station,
              jobData.closing_date
            ]
          );
          updatedJobs++;
          console.log(`📝 Updated job: ${jobData.title}`);
        }
      }

      // Show progress
      if (totalProcessed % 10 === 0) {
        console.log(`⏳ Processed ${totalProcessed}/${jobs.length} jobs...`);
      }
    }

    // Mark jobs as closed if they have expired
    const result = await client.query(
      `UPDATE job_vacancies 
       SET status = 'closed',
           notes = 'Job has expired',
           updated_at = NOW()
       WHERE organization_id = 7 
       AND end_date < NOW()
       AND status = 'active'
       RETURNING job_id`
    );
    closedJobs = result.rowCount;

    await jobTracker.completeRun("World Bank", {
      total_processed: totalProcessed,
      new_jobs: newJobs,
      updated_jobs: updatedJobs,
      closed_jobs: closedJobs
    });

    const endTime = new Date();
    const duration = (endTime - startTime) / 1000;

    console.log("\n" + "=".repeat(80));
    console.log("📊 World Bank Jobs ETL Process Summary");
    console.log("=".repeat(80));
    console.log(`✨ New jobs added: ${newJobs}`);
    console.log(`📝 Jobs updated: ${updatedJobs}`);
    console.log(`🔒 Jobs closed: ${closedJobs}`);
    console.log(`📦 Total jobs processed: ${totalProcessed}`);
    console.log(`⏱️ Duration: ${duration.toFixed(2)} seconds`);
    console.log(`⏰ End Time: ${endTime.toISOString()}`);
    console.log("=".repeat(80) + "\n");

  } catch (error) {
    console.error("❌ Error in World Bank ETL process:", error);
    logger.error("Error in World Bank ETL process", { error });
    throw error;
  } finally {
    client.release();
  }
}

module.exports = {
  fetchAndProcessWorldBankJobVacancies
};