const express = require('express');
const router = express.Router();
const { Client } = require('pg');
const { credentials } = require('../util/db');

router.get('/', async (req, res) => {
    const client = new Client(credentials);
    try {
        await client.connect();
        
        // Get total jobs by organization and status
        const jobStats = await client.query(`
            SELECT 
                organization_id,
                data_source,
                status,
                COUNT(*) as count,
                MAX(created) as last_created,
                MAX(updated_at) as last_updated
            FROM job_vacancies
            GROUP BY organization_id, data_source, status
            ORDER BY organization_id, data_source, status
        `);

        // Get recent job updates
        const recentUpdates = await client.query(`
            SELECT 
                job_title,
                data_source,
                status,
                notes,
                updated_at
            FROM job_vacancies
            WHERE notes IS NOT NULL
            ORDER BY updated_at DESC
            LIMIT 10
        `);

        // Render the status page with the data
        res.render('status', {
            title: 'UN Job Zone ETL Status Dashboard',
            jobStats: jobStats.rows,
            recentUpdates: recentUpdates.rows,
            currentTime: new Date().toISOString()
        });

    } catch (error) {
        console.error('Error fetching ETL status:', error);
        res.status(500).render('error', {
            message: 'Error fetching ETL status',
            error: error
        });
    } finally {
        await client.end();
    }
});

module.exports = router; 