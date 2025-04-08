const { query } = require('./db');
const logger = require('./logger');

class JobTracker {
  static async startJob(jobName) {
    try {
      const result = await query(
        'INSERT INTO job_executions (job_name, status, start_time) VALUES ($1, $2, $3) RETURNING id',
        [jobName, 'running', new Date()]
      );
      return result.rows[0].id;
    } catch (error) {
      logger.error('Error starting job tracking', { jobName, error });
      throw error;
    }
  }

  static async completeJob(jobId, status = 'completed', error = null) {
    try {
      await query(
        'UPDATE job_executions SET status = $1, end_time = $2, error_message = $3 WHERE id = $4',
        [status, new Date(), error, jobId]
      );
    } catch (error) {
      logger.error('Error completing job tracking', { jobId, error });
      throw error;
    }
  }

  static async getJobStatus(jobName) {
    try {
      const result = await query(
        'SELECT * FROM job_executions WHERE job_name = $1 ORDER BY start_time DESC LIMIT 1',
        [jobName]
      );
      return result.rows[0];
    } catch (error) {
      logger.error('Error getting job status', { jobName, error });
      throw error;
    }
  }
}

module.exports = JobTracker; 