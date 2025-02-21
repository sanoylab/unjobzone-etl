require("dotenv").config();

const { Client } = require("pg");
const { credentials } = require("./db");

async function getOrganizationId(dept) {
  const client = new Client(credentials);
  await client.connect();
  
  try {
    const query = `
      SELECT id FROM organization
      WHERE code ILIKE $1
      OR name ILIKE $1
      OR short_name ILIKE $1
      OR long_name ILIKE $1
      LIMIT 1
    `;
    const values = [`%${dept}%`];
    const res = await client.query(query, values);
    if (res.rows.length > 0) {
      return res.rows[0].id;
    } else {
      console.log('No matching department found, returning default id 128');
      return 128; // default to UN
    }
  } catch (error) {
    console.error('Error fetching or saving data:', error);
    return 128; // return default id in case of error
  } finally {
    await client.end();
  }
}

async function removeDuplicateJobVacancies() {
  console.log("===========================");
  console.log('Data cleaning started...');
  console.log("===========================");
  const client = new Client(credentials);
  await client.connect();

  try {
    const query = `
      DELETE FROM job_vacancies
      WHERE id IN (
        SELECT id FROM (
          SELECT
            id,
            ROW_NUMBER() OVER (
              PARTITION BY 
                job_id,
                language,
                category_code,
                job_title,
                job_code_title,
                job_description,
                job_family_code,
                job_level,
                duty_station,
                recruitment_type,
                start_date,
                end_date,
                dept,
                total_count,
                jn,
                jf,
                jc,
                jl,
                data_source,
                organization_id,
                apply_link
              ORDER BY id
            ) AS rn
          FROM job_vacancies
        ) t
        WHERE rn > 1
      );
    `;
    await client.query(query);
    console.log('Duplicate job vacancies removed successfully.');
    console.log("============================================");

  } catch (error) {
    console.error('Error removing duplicate job vacancies:', error);
  } finally {
    await client.end();
  }
}

module.exports = { getOrganizationId, removeDuplicateJobVacancies };
module.exports = { getOrganizationId , removeDuplicateJobVacancies};