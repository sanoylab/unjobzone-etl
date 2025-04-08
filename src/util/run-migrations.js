require('dotenv').config();
const fs = require('fs').promises;
const path = require('path');
const { Client } = require('pg');
const { credentials } = require('./db');

async function runMigrations() {
    const client = new Client(credentials);
    
    try {
        await client.connect();
        console.log('Connected to database');

        // Create migrations table if it doesn't exist
        await client.query(`
            CREATE TABLE IF NOT EXISTS migrations (
                id SERIAL PRIMARY KEY,
                name VARCHAR(255) NOT NULL,
                executed_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
            )
        `);

        // Get list of migration files
        const migrationsDir = path.join(__dirname, '../../migrations');
        const files = await fs.readdir(migrationsDir);
        const migrationFiles = files.filter(f => f.endsWith('.sql')).sort();

        // Get executed migrations
        const { rows: executedMigrations } = await client.query('SELECT name FROM migrations');
        const executedMigrationNames = new Set(executedMigrations.map(m => m.name));

        // Run pending migrations
        for (const file of migrationFiles) {
            if (!executedMigrationNames.has(file)) {
                console.log(`Running migration: ${file}`);
                const migrationPath = path.join(migrationsDir, file);
                const migrationSql = await fs.readFile(migrationPath, 'utf8');

                await client.query('BEGIN');
                try {
                    await client.query(migrationSql);
                    await client.query('INSERT INTO migrations (name) VALUES ($1)', [file]);
                    await client.query('COMMIT');
                    console.log(`Successfully executed migration: ${file}`);
                } catch (error) {
                    await client.query('ROLLBACK');
                    console.error(`Error executing migration ${file}:`, error);
                    throw error;
                }
            }
        }

        console.log('All migrations completed successfully');
    } catch (error) {
        console.error('Migration error:', error);
        process.exit(1);
    } finally {
        await client.end();
    }
}

runMigrations(); 