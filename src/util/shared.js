require("dotenv").config();

const { pool } = require("./db");

async function getOrganizationId(dept) {
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
    const res = await pool.query(query, values);
    if (res.rows.length > 0) {
      return res.rows[0].id;
    } else {
      console.log('No matching department found, returning default id 128');
      return 128; // default to UN
    }
  } catch (error) {
    console.error('Error fetching organization id:', error);
    return 128; // return default id in case of error
  }
}

module.exports = { getOrganizationId };