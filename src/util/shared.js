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
      console.log('No matching department found, returning default id 208');
      return 208; // default to UN
    }
  } catch (error) {
    console.error('Error fetching or saving data:', error);
    return 208; // return default id in case of error
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
      DELETE FROM job_vacancies a
      USING job_vacancies b
      WHERE a.id < b.id
      AND a.job_id = b.job_id
      AND a.language = b.language
      AND a.category_code = b.category_code
      AND a.job_title = b.job_title
      AND a.job_code_title = b.job_code_title
      AND a.job_description = b.job_description
      AND a.job_family_code = b.job_family_code
      AND a.job_level = b.job_level
      AND a.duty_station = b.duty_station
      AND a.recruitment_type = b.recruitment_type
      AND a.start_date = b.start_date
      AND a.end_date = b.end_date
      AND a.dept = b.dept
      AND a.total_count = b.total_count
      AND a.jn = b.jn
      AND a.jf = b.jf
      AND a.jc = b.jc
      AND a.jl = b.jl
      AND a.data_source = b.data_source;
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

module.exports = { getOrganizationId , removeDuplicateJobVacancies};