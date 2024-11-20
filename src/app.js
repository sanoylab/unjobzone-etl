const express = require("express");
const cors = require("cors");
const cron = require('node-cron');

require("dotenv").config();

const { fetchAndProcessInspiraJobVacancies } = require("./util/etl-inspira");
const { fetchAndProcessWfpJobVacancies } = require("./util/etl-wfp");
const { fetchAndProcessUnhcrJobVacancies } = require("./util/etl-unhcr");
const { fetchAndProcessImfJobVacancies } = require("./util/etl-imf");
const { fetchAndProcessUndpJobVacancies } = require("./util/etl-undp");
const PORT = process.env.PORT;

const app = express();

app.use(cors());
app.use(express.json());

app.listen(PORT, () => {
  console.log(`ETL Server is started on PORT: ${PORT}`);
  console.log('Running scheduled tasks...', new Date());
  fetchAndProcessImfJobVacancies();
  fetchAndProcessUnhcrJobVacancies();
  fetchAndProcessWfpJobVacancies();
  fetchAndProcessInspiraJobVacancies();
  //fetchAndProcessUndpJobVacancies(); 

});

cron.schedule('0 0 * * *', () => {
    console.log('Running scheduled tasks...', new Date());
    fetchAndProcessJobVacancies();     
});

cron.schedule('0 23 * * *', () => {
  fetchAndProcessWfpJobVacancies();
});

cron.schedule('0 22 * * *', () => {
  fetchAndProcessUnhcrJobVacancies();
});
cron.schedule('0 21 * * *', () => {
  fetchAndProcessImfJobVacancies();
});
cron.schedule('0 20 * * *', () => {
  //fetchAndProcessUndpJobVacancies();
});