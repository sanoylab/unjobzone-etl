-- Add status column to track job status (active/closed)
ALTER TABLE job_vacancies ADD COLUMN IF NOT EXISTS status VARCHAR(20) DEFAULT 'active';

-- Add last_updated column to track when a job was last modified
ALTER TABLE job_vacancies ADD COLUMN IF NOT EXISTS last_updated TIMESTAMP DEFAULT CURRENT_TIMESTAMP;

-- Create index on status and data_source for better query performance
CREATE INDEX IF NOT EXISTS idx_job_vacancies_status ON job_vacancies(status);
CREATE INDEX IF NOT EXISTS idx_job_vacancies_data_source ON job_vacancies(data_source);

-- Update existing records to have 'active' status
UPDATE job_vacancies SET status = 'active' WHERE status IS NULL; 