const express = require("express");
const cors = require("cors");
const cron = require("node-cron");

require("dotenv").config();

const { fetchAndProcessInspiraJobVacancies } = require("./util/etl-inspira");
const { fetchAndProcessWfpJobVacancies } = require("./util/etl-wfp");
const { fetchAndProcessUnhcrJobVacancies } = require("./util/etl-unhcr");
const { fetchAndProcessImfJobVacancies } = require("./util/etl-imf");
const { fetchAndProcessUndpJobVacancies } = require("./util/etl-undp");
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
    console.log("All tasks completed successfully.");
  } catch (error) {
    console.error("Error running scheduled tasks:", error);
  }
});

cron.schedule("0 0 * * *", () => {
  console.log("Running scheduled tasks...", new Date());
  fetchAndProcessJobVacancies();
  removeDuplicateJobVacancies();
});

cron.schedule("0 23 * * *", () => {
  fetchAndProcessWfpJobVacancies();
  removeDuplicateJobVacancies();
});

cron.schedule("0 22 * * *", () => {
  fetchAndProcessUnhcrJobVacancies();
  removeDuplicateJobVacancies();
});
cron.schedule("0 21 * * *", () => {
  fetchAndProcessImfJobVacancies();
  removeDuplicateJobVacancies();
});
cron.schedule("0 20 * * *", () => {
  //fetchAndProcessUndpJobVacancies();
});
