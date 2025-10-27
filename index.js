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
import bodyParser from "body-parser";


dotenv.config();

const app = express();
const PORT = process.env.PORT || 4000;

app.use("/webhooks", bodyParser.raw({ type: "*/*" }));
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

// Set up web-push
webpush.setVapidDetails(
  "mailto:test@example.com",
  process.env.VAPID_PUBLIC_KEY,
  process.env.VAPID_PRIVATE_KEY
);

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

// ===========================================
const SHOP = process.env.SHOPIFY_SHOP; // e.g. my-shop.myshopify.com
const ADMIN_TOKEN = process.env.SHOPIFY_ACCESS_TOKEN; // X-Shopify-Access-Token
const API_VERSION = process.env.SHOPIFY_API_VERSION || "2024-10";
const WEBHOOK_CALLBACK_URL = process.env.SHOPIFY_WEBHOOK_CALLBACK_URL; // public URL for webhook
const WEBHOOK_SECRET = process.env.SHOPIFY_WEBHOOK_SECRET; // for HMAC verification

if (!SHOP || !ADMIN_TOKEN || !WEBHOOK_CALLBACK_URL || !WEBHOOK_SECRET) {
  console.warn(
    "Warning: Please set SHOPIFY_SHOP, SHOPIFY_ADMIN_TOKEN, SHOPIFY_WEBHOOK_CALLBACK_URL and SHOPIFY_WEBHOOK_SECRET in your environment"
  );
}

// In-memory store for push subscriptions (replace with DB in production)
const pushSubscriptions = new Map(); // key: id (simple), value: subscription object

// Utility: verify Shopify webhook HMAC (sha256)
function verifyShopifyWebhook(req) {
  const hmacHeader = req.get("X-Shopify-Hmac-Sha256");
  if (!hmacHeader) return false;
  const body = req.body; // Buffer (raw)
  const digest = crypto
    .createHmac("sha256", WEBHOOK_SECRET)
    .update(body)
    .digest("base64");
  return crypto.timingSafeEqual(
    Buffer.from(digest, "utf8"),
    Buffer.from(hmacHeader, "utf8")
  );
}

// Endpoint to create the GraphQL webhook subscription (call once)
app.post("/create-webhook", async (req, res) => {
  try {
    const graphqlEndpoint = `https://${SHOP}/admin/api/${API_VERSION}/graphql.json`;
    const mutation = `
      mutation webhookSubscriptionCreate($topic: WebhookSubscriptionTopic!, $callbackUrl: URL!) {
        webhookSubscriptionCreate(topic: $topic, webhookSubscription: { callbackUrl: $callbackUrl, includeFields: ["id", "name", "email"], format: JSON }) {
          userErrors { field message }
          webhookSubscription { id }
        }
      }
    `;
    const variables = {
      topic: "ORDERS_CREATE",
      callbackUrl: WEBHOOK_CALLBACK_URL,
    };

    const r = await fetch(graphqlEndpoint, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Shopify-Access-Token": ADMIN_TOKEN,
      },
      body: JSON.stringify({ query: mutation, variables }),
    });
    const data = await r.json();
    return res.json(data);
  } catch (err) {
    console.error("create-webhook error", err);
    return res.status(500).json({ error: err.message });
  }
});

// Shopify will POST order creation webhooks here. Make sure the callback URL matches what you created.
app.post("/webhooks/orders_create", (req, res) => {
  try {
    if (!verifyShopifyWebhook(req)) {
      console.warn("Shopify webhook verification failed");
      return res.status(401).send("HMAC verification failed");
    }

    const bodyStr = req.body.toString("utf8");
    const order = JSON.parse(bodyStr);
    console.log(
      "Received new order webhook, id:",
      order.id || order.order_id || order?.id
    );

    // Create a payload for push
    const title = `New order #${order.order_number || order.id || "unknown"}`;
    const payload = JSON.stringify({
      title,
      body: `Customer: ${order?.customer?.first_name || ""} ${
        order?.customer?.last_name || ""
      } — Total: ${order?.total_price || order?.current_total_price || "N/A"}`,
      url: `/orders/${order.id}`,
    });

    // Send push to all subscribers
    const sendPromises = [];
    for (const [id, sub] of pushSubscriptions.entries()) {
      sendPromises.push(
        webpush.sendNotification(sub, payload).catch((err) => {
          console.error(
            "Error sending push to subscriber",
            id,
            err && err.body ? err.body : err.message
          );
          // optionally remove invalid subscriptions based on err.statusCode
        })
      );
    }

    Promise.all(sendPromises)
      .then(() => console.log("Push notifications sent"))
      .catch((err) => console.error("Error sending pushes", err));

    // Respond 200 to Shopify quickly
    res.status(200).send("OK");
  } catch (err) {
    console.error("Webhook handling error", err);
    res.status(500).send("Server error");
  }
});

// ===========================================

app.listen(PORT, () => {
  console.log(`Server running at http://localhost:${PORT}`);
});
