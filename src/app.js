const express = require("express");
const cors = require("cors");
const cron = require("node-cron");

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
const { removeDuplicateJobVacancies } = require("./util/shared");

const { fetchOrganizationList } = require("./util/etl-org");
const { postExpiringSoonJobPostsToLinkedIn, postJobNetworkPostsToLinkedIn } = require("./util/social-media");

const PORT = process.env.PORT;

const app = express();

app.use(cors());
app.use(express.json());

app.listen(PORT, async () => {
  console.log(`ETL Server is started on PORT: ${PORT}`);
  console.log("Running scheduled tasks...", new Date());
  //fetchOrganizationList()
  //fetchAndProcessWfpJobVacancies()
  try {
    
    // await fetchAndProcessImfJobVacancies();
    // await fetchAndProcessUnhcrJobVacancies();
    //  await fetchAndProcessWfpJobVacancies();
    //  await fetchAndProcessInspiraJobVacancies();
    //  await fetchAndProcessUndpJobVacancies();
    //  await removeDuplicateJobVacancies();

  //  await generateJobRelatedBlogPost();

  //postExpiringSoonJobPostsToLinkedIn();
 // postJobNetworkPostsToLinkedIn("Rule of Law, Security and Human Rights");
 //postJobNetworkPostsToLinkedIn("Political, Peace and Humanitarian");
 // postJobNetworkPostsToLinkedIn("Management and Administration");
  //postJobNetworkPostsToLinkedIn("Logistics, Transportation and Supply Chain");
 // postJobNetworkPostsToLinkedIn("Information and Telecommunication Technology");

    
    console.log("All tasks completed successfully.");
  } catch (error) {
    console.error("Error running scheduled tasks:", error);
  }
});

cron.schedule("0 1 * * *", async() => {
  console.log("Running scheduled tasks...", new Date());
  await fetchAndProcessImfJobVacancies();
  await removeDuplicateJobVacancies();
});

cron.schedule("0 2 * * *", async () => {
  await fetchAndProcessUnhcrJobVacancies();
  await removeDuplicateJobVacancies();
});

cron.schedule("0 3 * * *", async() => {
  await fetchAndProcessWfpJobVacancies();
  await removeDuplicateJobVacancies();
});
cron.schedule("0 4 * * *", async () => {
  await fetchAndProcessInspiraJobVacancies();
  await removeDuplicateJobVacancies();
});
cron.schedule("0 5 * * *", async () => {
  await fetchAndProcessUndpJobVacancies();
  await removeDuplicateJobVacancies();
});

// cron.schedule("0 0 * * 0", async () => {
//   await generateJobRelatedBlogPost();
// });


cron.schedule("0 6 * * *", async () => {
  console.log("Running postExpiringSoonJobPostsToLinkedIn...", new Date());
  try {
    await postExpiringSoonJobPostsToLinkedIn();
    console.log("Successfully posted expiring soon job posts to LinkedIn.");
  } catch (error) {
    console.error("Error posting expiring soon job posts to LinkedIn:", error);
  }
});


cron.schedule("0 7 * * *", async () => {
  console.log("Running postExpiringSoonJobPostsToLinkedIn...", new Date());
  try {
    await postJobNetworkPostsToLinkedIn("Information and Telecommunication Technology");
    console.log("Successfully posted IT job posts to LinkedIn.");
  } catch (error) {
    console.error("Error posting expiring soon job posts to LinkedIn:", error);
  }
});


cron.schedule("0 8 * * *", async () => {
  console.log("Running postExpiringSoonJobPostsToLinkedIn...", new Date());
  try {
    await postJobNetworkPostsToLinkedIn("Political, Peace and Humanitarian");
    console.log("Successfully posted Political, Peace and Humanitarian job posts to LinkedIn.");
  } catch (error) {
    console.error("Error posting expiring soon job posts to LinkedIn:", error);
  }
});

cron.schedule("0 9 * * *", async () => {
  console.log("Running postJobNetworkPostsToLinkedIn...", new Date());
  try {
    await postJobNetworkPostsToLinkedIn("Management and Administration");
    console.log("Successfully posted Management and Administration job posts to LinkedIn.");
  } catch (error) {
    console.error("Error posting expiring soon job posts to LinkedIn:", error);
  }
});

cron.schedule("0 10 * * *", async () => {
  console.log("Running postJobNetworkPostsToLinkedIn...", new Date());
  try {
    await postJobNetworkPostsToLinkedIn("Logistics, Transportation and Supply Chain");
    console.log("Successfully posted Logistics, Transportation and Supply Chain job posts to LinkedIn.");
  } catch (error) {
    console.error("Error posting expiring soon job posts to LinkedIn:", error);
  }
});
