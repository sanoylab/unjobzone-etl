const express = require('express');
const router = express.Router();
const { pool } = require('../util/db');
const logger = require('../util/logger');
const cron = require('node-cron');

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

        // Get ETL execution history
        const etlHistory = await pool.query(`
            SELECT 
                job_name,
                status,
                start_time,
                end_time,
                error_message
            FROM job_executions
            ORDER BY start_time DESC
            LIMIT 10
        `);
        logger.info(`Retrieved ${etlHistory.rows.length} ETL execution records`);

        // Calculate next ETL runs
        const now = new Date();
        const nextRuns = {
            'UNHCR Jobs': getNextRunTime('0 0,12 * * *'),
            'WFP Jobs': getNextRunTime('15 0,12 * * *'),
            'IMF Jobs': getNextRunTime('30 0,12 * * *'),
            'INSPIRA Jobs': getNextRunTime('45 0,12 * * *'),
            'UNDP Jobs': getNextRunTime('0 1,13 * * *')
        };

        // Get job statistics by organization
        const orgStats = await pool.query(`
            SELECT 
                data_source,
                COUNT(*) as total_jobs,
                SUM(CASE WHEN status = 'active' THEN 1 ELSE 0 END) as active_jobs,
                SUM(CASE WHEN status = 'closed' THEN 1 ELSE 0 END) as closed_jobs,
                MIN(created) as first_job_date,
                MAX(updated_at) as last_update
            FROM job_vacancies
            GROUP BY data_source
            ORDER BY total_jobs DESC
        `);

        // Get recent job additions
        const recentAdditions = await pool.query(`
            SELECT 
                job_title,
                data_source,
                created,
                status
            FROM job_vacancies
            ORDER BY created DESC
            LIMIT 5
        `);

        // Render the status page with the data
        res.render('status', {
            title: 'UN Job Zone ETL Status Dashboard',
            jobStats: jobStats.rows,
            recentUpdates: recentUpdates.rows,
            etlHistory: etlHistory.rows,
            nextRuns,
            orgStats: orgStats.rows,
            recentAdditions: recentAdditions.rows,
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

// Helper function to calculate next run time
function getNextRunTime(cronExpression) {
    const schedule = cron.parse(cronExpression);
    const nextDate = schedule.next();
    return {
        nextRun: nextDate.toISOString(),
        timeUntilNextRun: Math.floor((nextDate - new Date()) / 1000 / 60) // in minutes
    };
}

module.exports = router; 