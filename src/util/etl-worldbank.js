require("dotenv").config();

const { Client } = require('pg');
const { credentials } = require("./db");
const { getOrganizationId } = require("./shared");

const url = 'https://us.api.csod.com/rec-job-search/external/jobs'; // Replace with your API endpoint

// Function to fetch and process job vacancies
async function fetchAndProcessWorldBankJobVacancies() {
    console.log("World Bank Job Vacancies ETL started...");

    const client = new Client(credentials);

    await client.connect();
    await client.query(`DELETE FROM job_vacancies WHERE data_source = 'worldbank'`);

    let page = 0;
    const itemsPerPage = 25; // items per page
    let totalPages = 1; // Initialize to 1 to enter the loop

    while (page < totalPages) {

        const payload = {   
            
            careerSiteId: 1,
            careerSitePageId:1,
            cities: [],
            countryCodes:[],
            cultureId: 1,
            cultureName: "en-US",
            customFieldCheckboxKeys: [],
            customFieldDropdowns: [],
            customFieldRadios: [],
            pageNumber:1,
            pageSize: 25,
            placeID: "",
            postingsWithinDays: null,
            radius: null,
            searchText: "",
            states: [],
            search: "", // empty keyword as per the payload you provided

           
        };
        try {
            const response = await fetch(url, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${process.env.WORLDBANK_API_KEY}`
                },
                body: JSON.stringify(payload)
            });
            //console.log('response', response)
          
            

            const data = await response.json();
            //console.log('data', data)

            totalPages = Math.ceil(data.data.totalCount / 25);
            //console.log('totalPages', totalPages)


           
             for (const job of data.data.requisitions) {
                 const jobDetailAPI = `https://worldbankgroup.csod.com/services/x/job-requisition/v2/requisitions/${job.requisitionId}/jobDetails?cultureId=1`;

                 const responseDetail = await fetch(jobDetailAPI, {
                    method: 'GET',
                    headers: {
                        'Content-Type': 'application/json',
                        'Authorization': `Bearer ${process.env.WORLDBANK_API_KEY}`,
                        'Accept': 'application/json; q=1.0, text/*; q=0.8, */*; q=0.1',
                        'Accept-Encoding': 'gzip, deflate, br, zstd',
                        'Accept-Language': 'en-US,en;q=0.9',
                        'Cache-Control': 'no-cache',
                        'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36',
                        'X-Requested-With': 'XMLHttpRequest'
                    }
                });
                const responseText = await responseDetail.text();
                console.log('responseText', responseText);

                  const jobDetail = await responseDetail.json();
                  console.log('jobDetail', jobDetail)
                
            //     const startDate = jobDetail.items[0].ExternalPostedStartDate ? new Date(jobDetail.items[0].ExternalPostedStartDate) : null;
            //     const endDate = jobDetail.items[0].ExternalPostedEndDate ? new Date(jobDetail.items[0].ExternalPostedEndDate) : null;

            //     const requisitionFlexFields = jobDetail.items[0].requisitionFlexFields || [];

            //     const agency = requisitionFlexFields[0] && requisitionFlexFields[0].Prompt === "Agency" ? requisitionFlexFields[0].Value : 'UNDP';
            //     const practiceArea = requisitionFlexFields[3] && requisitionFlexFields[3].Prompt === "Practice Area" ? requisitionFlexFields[3].Value : '';
            //     const grade = requisitionFlexFields[1] && requisitionFlexFields[1].Prompt === "Grade" ? requisitionFlexFields[1].Value : '';

                
            //     const query = `
            //         INSERT INTO job_vacancies (job_id, language, category_code, job_title, job_code_title, job_description,
            //             job_family_code, job_level, duty_station, recruitment_type, start_date, end_date, dept,
            //             total_count, jn, jf, jc, jl, created, data_source, organization_id, apply_link)
            //         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, $20, $21, $22)
            //         RETURNING id;
            //     `;
            //     const orgId = await getOrganizationId(agency); // Get organization id

                
            //     await client.query(query, [
            //         job.Id,
            //         job.Language,
            //         jobDetail.items[0].Category,
            //         job.Title,
            //         job.JobFunction,
            //         jobDetail.items[0].ExternalDescriptionStr,
            //         job.JobFamily,
            //         '', // job level
            //        job.PrimaryLocation || '' , // Convert duty station to JSON string
            //         jobDetail.items[0].RequisitionType,
            //         startDate, // Convert to Date object
            //         endDate, // Convert to Date object
            //         agency,
            //         null,
            //         practiceArea,
            //         '',
            //         '',
            //         grade,
            //         new Date(),
            //         'undp',
            //         orgId,
            //         "https://estm.fa.em2.oraclecloud.com/hcmUI/CandidateExperience/en/sites/CX_1/job/" + job.Id
            //     ]);
            //     console.log(job.Title); // Handle the response data here
            }

            page++; // Move to the next page
        } catch (error) {
            console.error('Error fetching or saving data:', error);
        }
    }

    await client.end(); // Close the database connection
}

module.exports = { fetchAndProcessWorldBankJobVacancies };