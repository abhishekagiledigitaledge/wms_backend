// cronJob.js
import cron from "node-cron";
import { fetchAndSaveStores } from "./services/storeService.js";
import { fetchAndSaveProducts } from "./services/productService.js";

// Schedule cron job every day at 2 AM
cron.schedule("0 2 * * *", async () => {
  console.log("Running store fetch cron job...");
  await fetchAndSaveStores();
  await fetchAndSaveProducts();
}, {
  timezone: "Asia/Kolkata"
});
