import express from "express";
import dotenv from "dotenv";
import orderRoutes from "./routes/orderRoutes.js";
import outletsRoutes from "./routes/outletsRoutes.js";
import userRoutes from "./routes/userRoutes.js";
import authRoutes from "./routes/authRoutes.js";
import {
  fetchAndSaveRexOrders,
  fetchAndSaveShopifyOrders,
} from "./services/orderService.js";
import { fetchAndSaveStores } from "./services/storeService.js";
import { fetchAndSaveProducts } from "./services/productService.js";
import prisma from "./prismaClient.js";
import webpush from "web-push";
import cron from "node-cron";

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

app.get("/health", (req, res) => {
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

// Manual trigger

app.get("/fetch-stores", async (req, res) => {
  await fetchAndSaveStores();
  res.send("Stores fetched and saved!");
});

app.get("/fetch-products", async (req, res) => {
  await fetchAndSaveProducts();
  res.send("Products fetched!");
});

// -----------------------------------------------

// ================================================

app.post("/api/save-subscription", async (req, res) => {
  const subscription = req.body;
  console.log(subscription, "subscription");
  // Save subscription in DB (store_id or user_id associated)
  await prisma.pushSubscription.create({
    data: {
      storeId: 1,
      subscription: subscription,
    },
  });

  res.status(201).json({ message: "Subscription saved" });
});

// Set up web-push
webpush.setVapidDetails(
  "mailto:test@example.com",
  process.env.VAPID_PUBLIC_KEY,
  process.env.VAPID_PRIVATE_KEY
);

// Cron job: runs every 1 minute
cron.schedule("0 */5 * * *", async () => {
  try {
    const lowStockProducts = await prisma.$queryRaw`
      SELECT * FROM "storeProducts"
      WHERE "stock" < "minQty"
      AND "storeId" = 1
    `;

    if (lowStockProducts.length > 0) {
      for (const p of lowStockProducts) {
        console.log(
          `Store ${p.storeId} - Product ${p.productId} stock is low!`
        );

        // ✅ Get subscriptions for that store
        const subscriptions = await prisma.pushSubscription.findMany({
          where: { storeId: p.storeId },
        });

        // ✅ Loop over store subscriptions
        for (const sub of subscriptions) {
          await webpush
            .sendNotification(
              sub.subscription,
              JSON.stringify({
                title: "Low Stock Alert",
                body: `Product ${p.productId} at Store ${p.storeId} is below min quantity!`,
              })
            )
            .catch((err) => console.error("Push error:", err));
        }
      }
    }
  } catch (err) {
    console.error("Error checking low stock:", err);
  }
});

app.listen(PORT, () => {
  console.log(`Server running at http://localhost:${PORT}`);
});
