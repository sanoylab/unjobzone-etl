-- Add updated_at column to job_vacancies table
ALTER TABLE job_vacancies ADD COLUMN updated_at TIMESTAMP WITH TIME ZONE;

-- Set default value for existing records
UPDATE job_vacancies SET updated_at = created WHERE updated_at IS NULL;

-- Add trigger to automatically update updated_at
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER update_job_vacancies_updated_at
    BEFORE UPDATE ON job_vacancies
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column(); 