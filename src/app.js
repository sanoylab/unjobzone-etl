const express = require("express");
const cors = require("cors");
const cron = require("node-cron");
const logger = require("./util/logger");
const JobTracker = require("./util/job-tracker");
const path = require("path");

require("dotenv").config();

const { fetchAndProcessInspiraJobVacancies } = require("./util/etl-inspira");
const { fetchAndProcessWfpJobVacancies } = require("./util/etl-wfp");
const { fetchAndProcessUnhcrJobVacancies } = require("./util/etl-unhcr");
const { fetchAndProcessImfJobVacancies } = require("./util/etl-imf");
const { fetchAndProcessUndpJobVacancies } = require("./util/etl-undp");
//const { generateJobRelatedBlogPost } = require("./util/etl-blog");
const { generateJobRelatedBlogPost } = require("./util/etl-blog-deepseek");

const {
  fetchAndProcessWorldBankJobVacancies,
} = require("./util/etl-worldbank");

const { fetchOrganizationList } = require("./util/etl-org");
const { postExpiringSoonJobPostsToLinkedIn, postJobNetworkPostsToLinkedIn } = require("./util/social-media");

const app = express();

// View engine setup
app.set('views', path.join(__dirname, 'views'));
app.set('view engine', 'ejs');

// Basic middleware
app.use(cors());
app.use(express.json());

// Root route redirect to status page
app.get('/', (req, res) => {
    res.redirect('/status');
});

// Routes
const statusRouter = require('./routes/status');
app.use('/status', statusRouter);

// Error handling middleware
app.use((err, req, res, next) => {
  logger.error('Unhandled error', { error: err });
  res.status(500).json({ error: 'Internal Server Error' });
});

// Helper function to run ETL jobs with tracking
async function runETLJob(jobName, jobFunction) {
  const jobId = await JobTracker.startJob(jobName);
  try {
    await jobFunction();
    await JobTracker.completeJob(jobId);
    logger.info(`Successfully completed ${jobName}`);
  } catch (error) {
    await JobTracker.completeJob(jobId, 'failed', error.message);
    logger.error(`Error in ${jobName}`, { error });
    throw error;
  }
}

// Schedule ETL jobs with proper error handling
const scheduleETLJob = (cronExpression, jobName, jobFunction) => {
  cron.schedule(cronExpression, async () => {
    logger.info(`Running scheduled task: ${jobName}`, { timestamp: new Date() });
    try {
      await runETLJob(jobName, jobFunction);
    } catch (error) {
      logger.error(`Error in scheduled task ${jobName}`, { error });
    }
  });
};

// Schedule ETL jobs
// Primary runs at midnight UTC
cron.schedule('0 0 * * *', () => fetchAndProcessUnhcrJobVacancies());
cron.schedule('15 0 * * *', () => fetchAndProcessWfpJobVacancies());
cron.schedule('30 0 * * *', () => fetchAndProcessImfJobVacancies());
cron.schedule('45 0 * * *', () => fetchAndProcessInspiraJobVacancies());
cron.schedule('0 1 * * *', () => fetchAndProcessUndpJobVacancies());

// Backup runs at noon UTC
cron.schedule('0 12 * * *', () => fetchAndProcessUnhcrJobVacancies());
cron.schedule('15 12 * * *', () => fetchAndProcessWfpJobVacancies());
cron.schedule('30 12 * * *', () => fetchAndProcessImfJobVacancies());
cron.schedule('45 12 * * *', () => fetchAndProcessInspiraJobVacancies());
cron.schedule('0 13 * * *', () => fetchAndProcessUndpJobVacancies());

// Schedule social media posts
// Post expiring jobs at optimal times for different regions
scheduleETLJob("0 6 * * 1,3,5", "LinkedIn Expiring Posts - APAC", postExpiringSoonJobPostsToLinkedIn); // 6 AM UTC (2 PM Tokyo, 1 PM Beijing)
scheduleETLJob("0 14 * * 1,3,5", "LinkedIn Expiring Posts - Europe/Africa", postExpiringSoonJobPostsToLinkedIn); // 2 PM UTC (3 PM London, 4 PM Europe)
scheduleETLJob("0 19 * * 1,3,5", "LinkedIn Expiring Posts - Americas", postExpiringSoonJobPostsToLinkedIn); // 7 PM UTC (2 PM New York, 11 AM LA)

// Schedule network-specific posts spread throughout each day
const networkSchedules = [
    {
        network: "Information and Telecommunication Technology",
        schedule: "0 8 * * *" // 8 AM UTC - Good for Europe morning/Asia afternoon
    },
    {
        network: "Political, Peace and Humanitarian",
        schedule: "0 10 * * *" // 10 AM UTC - Europe mid-morning/Asia evening
    },
    {
        network: "Management and Administration",
        schedule: "0 12 * * *" // 12 PM UTC - Europe lunch/US East Coast morning
    },
    {
        network: "Logistics, Transportation and Supply Chain",
        schedule: "0 14 * * *" // 2 PM UTC - Europe afternoon/US East Coast morning
    },
    {
        network: "Public Information and Conference Management",
        schedule: "0 16 * * *" // 4 PM UTC - Europe end of day/US mid-day
    },
    {
        network: "Economic, Social and Development",
        schedule: "0 18 * * *" // 6 PM UTC - US East Coast afternoon
    },
    {
        network: "Internal Security and Safety",
        schedule: "0 20 * * *" // 8 PM UTC - US afternoon/Asia early morning
    }
];

networkSchedules.forEach(({ network, schedule }) => {
    scheduleETLJob(
        schedule,
        `LinkedIn ${network} Posts`,
        () => postJobNetworkPostsToLinkedIn(network)
    );
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, async () => {
  logger.info(`ETL Server started on PORT: ${PORT}`);
  logger.info("Running initial tasks...", { timestamp: new Date() });

  try {
    await runETLJob('IMF Jobs', fetchAndProcessImfJobVacancies);
    await runETLJob('UNHCR Jobs', fetchAndProcessUnhcrJobVacancies);
    await runETLJob('WFP Jobs', fetchAndProcessWfpJobVacancies);
    await runETLJob('Inspira Jobs', fetchAndProcessInspiraJobVacancies);
    await runETLJob('UNDP Jobs', fetchAndProcessUndpJobVacancies);
    logger.info("All initial tasks completed successfully");
  } catch (error) {
    logger.error("Error running initial tasks", { error });
  }
});
