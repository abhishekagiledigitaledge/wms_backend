import express from "express";
import dotenv from "dotenv";
import orderRoutes from "./routes/orderRoutes.js";
import outletsRoutes from "./routes/outletsRoutes.js";
import userRoutes from "./routes/userRoutes.js";
import authRoutes from "./routes/authRoutes.js";
import { fetchAndSaveRexOrders, fetchAndSaveShopifyOrders } from "./services/orderService.js";

dotenv.config();

const app = express();
const PORT = process.env.PORT || 4000;

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

app.use((req, res, next) => {
  res.header("Access-Control-Allow-Origin", "*");
  res.header(
    "Access-Control-Allow-Headers",
    "Origin, X-Requested-With, Content-Type, Accept"
  );
  res.header("Access-Control-Allow-Methods", "GET, POST, PUT, DELETE, OPTIONS");
  next();
});

app.use("/api/orders", orderRoutes);
app.use("/api/outlets", outletsRoutes);
app.use("/api/users", userRoutes);
app.use("/api/auth", authRoutes);

app.get("/new-health", (req, res) => {
  res.status(200).json({
    status: "ok",
    uptime: process.uptime(),
    timestamp: new Date(),
  });
});

// Endpoints to trigger order sync
app.get("/sync/rex", async (req, res) => {
  try {
    await fetchAndSaveRexOrders();
    res.json({ message: "REX orders synced successfully" });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to sync REX orders" });
  }
});

app.get("/sync/shopify", async (req, res) => {
  try {
    await fetchAndSaveShopifyOrders();
    res.json({ message: "Shopify orders synced successfully" });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to sync Shopify orders" });
  }
});
// =================================================

app.listen(PORT, () => {
  console.log(`Server running at http://localhost:${PORT}`);
});
