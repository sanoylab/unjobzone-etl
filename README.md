# UN Job Zone ETL Project

An application that fetches job vacancies from various UN agencies and stores them in a PostgreSQL database. The application runs on a scheduled basis to keep the job listings up to date.

## Features

- Fetches job vacancies from multiple UN agencies:
  - UNHCR (United Nations High Commissioner for Refugees)
  - WFP (World Food Programme)
  - IMF (International Monetary Fund)
  - INSPIRA (UN Secretariat)
  - UNDP (United Nations Development Programme)
- Incremental updates to prevent data loss
- Job status tracking (active/closed)
- Detailed logging and error handling
- Automated social media posting to LinkedIn
- Scheduled ETL processes

## Prerequisites

- Node.js (v14 or higher)
- PostgreSQL (v12 or higher)
- npm or yarn

## Installation

1. Clone the repository:
```bash
git clone https://github.com/yourusername/un-job-zone-etl.git
cd un-job-zone-etl
```

2. Install dependencies:
```bash
npm install
```

3. Create a `.env` file in the root directory with the following variables:
```env
DB_HOST=your_database_host
DB_PORT=your_database_port
DB_NAME=your_database_name
DB_USER=your_database_user
DB_PASSWORD=your_database_password
LINKEDIN_CLIENT_ID=your_linkedin_client_id
LINKEDIN_CLIENT_SECRET=your_linkedin_client_secret
LINKEDIN_ACCESS_TOKEN=your_linkedin_access_token
```

4. Run database migrations:
```bash
npm run migrate
```

## Usage

### Development

Start the application in development mode:
```bash
npm run dev
```

### Production

Start the application in production mode:
```bash
npm start
```

## ETL Schedule

The application runs ETL processes on the following schedule (UTC):

### Primary Runs (Midnight UTC)
- 00:00 - UNHCR Jobs
- 00:15 - WFP Jobs
- 00:30 - IMF Jobs
- 00:45 - INSPIRA Jobs
- 01:00 - UNDP Jobs

### Backup Runs (Noon UTC)
- 12:00 - UNHCR Jobs
- 12:15 - WFP Jobs
- 12:30 - IMF Jobs
- 12:45 - INSPIRA Jobs
- 13:00 - UNDP Jobs

## Social Media Posting Schedule

### Expiring Jobs Posts
- 06:00 UTC (APAC Region)
- 14:00 UTC (Europe/Africa Region)
- 19:00 UTC (Americas Region)

### Network-Specific Posts
- 08:00 UTC - Information and Telecommunication Technology
- 10:00 UTC - Political, Peace and Humanitarian
- 12:00 UTC - Management and Administration
- 14:00 UTC - Logistics, Transportation and Supply Chain
- 16:00 UTC - Public Information and Conference Management
- 18:00 UTC - Economic, Social and Development
- 20:00 UTC - Internal Security and Safety

## Database Schema

The application uses the following main tables:

### job_vacancies
- Stores all job vacancy information
- Tracks job status (active/closed)
- Maintains job history through notes
- Includes timestamps for creation and updates

### job_tracking
- Tracks ETL process runs
- Records success/failure status
- Stores statistics about each run

## Error Handling

The application includes comprehensive error handling:
- Detailed error logging
- Graceful failure handling
- Automatic retry mechanisms
- Error notifications

## Logging

Logs are stored in the following format:
- Console output for immediate feedback
- File-based logging for historical records
- Structured logging for easy analysis

## Contributing

1. Fork the repository
2. Create your feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add some amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

## License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## Support

For support, please open an issue in the GitHub repository or contact the maintainers.

