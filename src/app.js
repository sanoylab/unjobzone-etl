const express = require("express");
const cors = require("cors");
const cron = require("node-cron");

require("dotenv").config();

const { fetchAndProcessInspiraJobVacancies } = require("./util/etl-inspira");
const { fetchAndProcessWfpJobVacancies } = require("./util/etl-wfp");
const { fetchAndProcessUnhcrJobVacancies } = require("./util/etl-unhcr");
const { fetchAndProcessImfJobVacancies } = require("./util/etl-imf");
const { fetchAndProcessUndpJobVacancies } = require("./util/etl-undp");
const { generateJobRelatedBlogPost } = require("./util/etl-blog");
const {
  fetchAndProcessWorldBankJobVacancies,
} = require("./util/etl-worldbank");
const { removeDuplicateJobVacancies } = require("./util/shared");

const { fetchOrganizationList } = require("./util/etl-org");

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
    
    await fetchAndProcessImfJobVacancies();
    await fetchAndProcessUnhcrJobVacancies();
    await fetchAndProcessWfpJobVacancies();
    await fetchAndProcessInspiraJobVacancies();
    await fetchAndProcessUndpJobVacancies();
    await removeDuplicateJobVacancies();
    //await generateJobRelatedBlogPost();
    
    console.log("All tasks completed successfully.");
  } catch (error) {
    console.error("Error running scheduled tasks:", error);
  }
});

cron.schedule("0 0 * * *", async() => {
  console.log("Running scheduled tasks...", new Date());
  await fetchAndProcessJobVacancies();
  await removeDuplicateJobVacancies();
});

cron.schedule("0 23 * * *", async () => {
  await fetchAndProcessWfpJobVacancies();
  await removeDuplicateJobVacancies();
});

cron.schedule("0 22 * * *", async() => {
  await fetchAndProcessUnhcrJobVacancies();
  await removeDuplicateJobVacancies();
});
cron.schedule("0 21 * * *", async () => {
  await fetchAndProcessImfJobVacancies();
  await removeDuplicateJobVacancies();
});
cron.schedule("0 20 * * *", () => {
  //fetchAndProcessUndpJobVacancies();
});

cron.schedule("0 0 * * 0", async () => {
  await generateJobRelatedBlogPost();
});
