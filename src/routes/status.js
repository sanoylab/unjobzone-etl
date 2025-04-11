const express = require('express');
const router = express.Router();
const { pool } = require('../util/db');
const logger = require('../util/logger');

router.get('/', async (req, res) => {
    try {
        // Get total jobs by organization and status
        const jobStats = await pool.query(`
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
        logger.info(`Retrieved ${jobStats.rows.length} job statistics`);

        // Get recent job updates
        const recentUpdates = await pool.query(`
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
        logger.info(`Retrieved ${recentUpdates.rows.length} recent updates`);

        // Render the status page with the data
        res.render('status', {
            title: 'UN Job Zone ETL Status Dashboard',
            jobStats: jobStats.rows,
            recentUpdates: recentUpdates.rows,
            currentTime: new Date().toISOString()
        });
        logger.info('Status page rendered successfully');

    } catch (error) {
        logger.error('Error fetching ETL status:', {
            error: {
                message: error.message,
                stack: error.stack,
                code: error.code
            }
        });
        res.status(500).render('error', {
            message: 'Error fetching ETL status',
            error: error
        });
    }
});

module.exports = router; 