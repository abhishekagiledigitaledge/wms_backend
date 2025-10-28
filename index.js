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
import "./cronJob.js";
import crypto from "crypto";

dotenv.config();

const app = express();
const PORT = process.env.PORT || 4000;

// Set up web-push
webpush.setVapidDetails(
  "mailto:test@example.com",
  process.env.VAPID_PUBLIC_KEY,
  process.env.VAPID_PRIVATE_KEY
);

// Shopify raw body chahiye verify ke liye
app.use("/webhooks/orders/create", express.raw({ type: "application/json" }));

app.post("/webhooks/orders/create", async (req, res) => {
  try {
    const hmacHeader = req.get("X-Shopify-Hmac-Sha256");
    const body = req.body;
    const generatedHash = crypto
      .createHmac("sha256", process.env.SHOPIFY_WEBHOOK_SECRET)
      .update(body, "utf8")
      .digest("base64");
    let orderData;

    if (generatedHash !== hmacHeader) {
      console.log("⚠️ Verification failed");
      console.log("Expected:", generatedHash);
      console.log("Received:", hmacHeader);
      console.log("🧪 Using static test data instead...");

      // 🧩 Static test order data
      orderData = {
        id: 999999,
        name: "#TEST_ORDER_001",
        email: "testuser@example.com",
        total_price: "49.99",
        currency: "USD",
        line_items: [{ title: "Test Product", quantity: 1, price: "49.99" }],
        customer: { first_name: "Static", last_name: "Tester" },
      };
    } else {
      orderData = JSON.parse(body.toString("utf8"));
    }

    // ✅ Get subscriptions for that store
    const subscriptions = await prisma.pushSubscription.findMany();

    console.log("🆕 New Order Received:", orderData);

    for (const sub of subscriptions) {
      try {
        await webpush.sendNotification(
          sub.subscription,
          JSON.stringify({
            title: "🛍️ New Shopify Order!",
            body: `A new order has been placed in your store.`,
            data: {
              url: "http://zcwscgs04ksksc8c44sk48c0.62.72.57.193.sslip.io/orders",
            },
          })
        );
      } catch (err) {
        console.error("Push error:", err);
      }
    }

    res.status(200).send("ok");
  } catch (err) {
    console.error(err);
    res.status(500).send("Error");
  }
});

// ===========================================

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
  const existing = await prisma.pushSubscription.findFirst({
    where: {
      storeId: 1,
      subscription: subscription,
    },
  });

  if (existing) {
    return res.status(200).json({ message: "Subscription already exists" });
  }

  await prisma.pushSubscription.create({
    data: {
      storeId: 1,
      subscription: subscription,
    },
  });

  res.status(201).json({ message: "Subscription saved" });
});

// Cron job: runs every 5 hr
cron.schedule(
  "0 */5 * * *",
  async () => {
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
  },
  {
    timezone: "Asia/Kolkata",
  }
);
// ======================================

app.listen(PORT, () => {
  console.log(`Server running at http://localhost:${PORT}`);
});
