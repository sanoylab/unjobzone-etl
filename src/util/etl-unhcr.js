require("dotenv").config();

const { Client } = require("pg");
const { credentials } = require("./db");
const { getOrganizationId } = require("./shared");
const logger = require("./logger");

const url = "https://unhcr.wd3.myworkdayjobs.com/wday/cxs/unhcr/External/jobs";

async function fetchAndProcessUnhcrJobVacancies() {
    const startTime = new Date();
    console.log("\n" + "=".repeat(80));
    console.log("🌐 UNHCR Job Vacancies ETL Process");
    console.log(`⏰ Start Time: ${startTime.toISOString()}`);
    console.log("=".repeat(80) + "\n");

    const client = new Client(credentials);
    let totalJobs = 0;
    let processedJobs = 0;
    let currentJobIds = new Set();

    try {
        await client.connect();
        console.log("✅ Database connection established");

        // Get existing jobs before deletion for notes
        const existingJobs = await client.query(
            'SELECT job_id, job_title, end_date, notes FROM job_vacancies WHERE data_source = $1',
            ['unhcr']
        );
        const existingJobsMap = new Map(existingJobs.rows.map(row => [row.job_id, row]));
        console.log(`📊 Found ${existingJobs.rows.length} existing jobs`);

        // Delete existing jobs but preserve their notes
        await client.query(`DELETE FROM job_vacancies WHERE data_source = 'unhcr'`);
        console.log("🗑️  Cleared existing UNHCR jobs");

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
                    totalJobs = data.total;
                    console.log(`📑 Total jobs to process: ${totalJobs}`);
                }

                // Track jobs in current page
                for (const job of data.jobPostings) {
                    currentJobIds.add(job.id);
                }

                for (const job of data.jobPostings) {
                    processedJobs++;
                    const jobDetailAPI = `https://unhcr.wd3.myworkdayjobs.com/wday/cxs/unhcr/External${job.externalPath}`;

                    try {
                        const responseDetail = await fetch(jobDetailAPI);
                        const jobDetail = await responseDetail.json();

                        const startDate = jobDetail.jobPostingInfo.startDate
                            ? new Date(jobDetail.jobPostingInfo.startDate)
                            : null;
                        const endDate = jobDetail.jobPostingInfo.endDate
                            ? new Date(jobDetail.jobPostingInfo.endDate)
                            : null;

                        const orgId = await getOrganizationId("UNHCR");
                        const jobId = jobDetail.jobPostingInfo.id;
                        
                        // Check if this job existed before and had notes
                        const existingJob = existingJobsMap.get(jobId);
                        const existingNotes = existingJob?.notes || null;

                        // Prepare notes for the job
                        let notes = existingNotes;
                        if (existingJob) {
                            if (existingJob.end_date?.toISOString() !== endDate?.toISOString()) {
                                const noteAddition = `End date changed from ${existingJob.end_date?.toISOString() || 'none'} to ${endDate?.toISOString() || 'none'} on ${new Date().toISOString()}`;
                                notes = notes ? `${notes}; ${noteAddition}` : noteAddition;
                            }
                            if (existingJob.job_title !== job.title) {
                                const noteAddition = `Title changed from "${existingJob.job_title}" to "${job.title}" on ${new Date().toISOString()}`;
                                notes = notes ? `${notes}; ${noteAddition}` : noteAddition;
                            }
                        }

                        // Insert job with notes
                        const query = `
                            INSERT INTO job_vacancies (
                                job_id, language, category_code, job_title, job_code_title, job_description,
                                job_family_code, job_level, duty_station, recruitment_type, start_date, end_date, dept,
                                total_count, jn, jf, jc, jl, created, data_source, organization_id, apply_link, status, notes
                            ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, $20, $21, $22, $23, $24)
                            RETURNING id;
                        `;

                        await client.query(query, [
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
                            "unhcr",
                            orgId,
                            "https://unhcr.wd3.myworkdayjobs.com/en-US/External/details/" + jobDetail.jobPostingInfo.jobPostingId,
                            'active',
                            notes
                        ]);

                        if (existingJob) {
                            console.log(`🔄 Updated: ${job.title}`);
                        } else {
                            console.log(`✨ New job: ${job.title}`);
                        }

                        // Show progress every 10 jobs
                        if (processedJobs % 10 === 0) {
                            const progress = ((processedJobs / totalJobs) * 100).toFixed(1);
                            console.log(`