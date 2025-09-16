const express = require("express");
const axios = require("axios");
const app = express();
const PORT = process.env.PORT || 4000;
const dotenv = require("dotenv");
dotenv.config();
const { compareOrdersAI } = require("./compareOrders");

const API_KEY = process.env.API_KEY;
// console.log(API_KEY, "API_KEY");

app.use(express.json());

app.use((req, res, next) => {
  res.header("Access-Control-Allow-Origin", "*"); // In production, restrict this!
  res.header(
    "Access-Control-Allow-Headers",
    "Origin, X-Requested-With, Content-Type, Accept"
  );
  res.header("Access-Control-Allow-Methods", "GET, POST, PUT, DELETE, OPTIONS");
  next();
});
// Route to fetch orders
app.get("/api/orders", async (req, res) => {
  try {
    // Get access token from Retail Express
    const tokenRes = await axios.get(
      "https://api.retailexpress.com.au/v2/auth/token",
      {
        headers: {
          "x-api-key": API_KEY,
          Accept: "application/json",
          "Content-Type": "application/json",
        },
      }
    );

    const accessToken = tokenRes?.data?.access_token;

    // If a "page" query parameter is provided, add it to the orders API request as a query string.
    let page = req.query.page ? parseInt(req.query.page, 10) : 1;
    if (isNaN(page) || page < 1) page = 1;
    const ordersUrl = `https://prdinfamsapi001.azure-api.net/v2.1/orders?page=${page}`;

    // Fetch orders from Retail Express
    const ordersRes = await axios.get(ordersUrl, {
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "x-api-key": API_KEY,
        Accept: "application/json",
      },
    });

    const responseData = ordersRes.data;

    const currentPage = responseData?.page_number || 1;
    const pageSize = responseData?.page_size || 20;
    const totalRecords = responseData?.total_records || 0;

    const hasMore = currentPage * pageSize < totalRecords;

    res.json({
      data: responseData?.data || [],
      hasMore,
    });
  } catch (error) {
    res.status(500).json({ error });
    console.log(error, "error");
  }
});

app.get("/api/shopify-orders", async (req, res) => {
  try {
    const SHOPIFY_STORE = process.env.SHOPIFY_STORE;
    const SHOPIFY_ACCESS_TOKEN = process.env.SHOPIFY_ACCESS_TOKEN;

    // Default limit (Shopify max = 250)
    const limit = req.query.limit ? parseInt(req.query.limit, 10) : 20;

    // Handle cursor-based pagination (page_info provided by Shopify)
    const pageInfo = req.query.page_info;

    let url = `https://${SHOPIFY_STORE}.myshopify.com/admin/api/2025-01/orders.json?limit=${limit}&status=any`;

    if (pageInfo) {
      url += `&page_info=${pageInfo}`;
    }

    const response = await axios.get(url, {
      headers: {
        "X-Shopify-Access-Token": SHOPIFY_ACCESS_TOKEN,
        "Content-Type": "application/json",
      },
    });
    const orders = response.data.orders || [];

    // Shopify provides pagination info in response headers (Link header)
    const linkHeader = response.headers["link"] || "";
    let nextPage = null;
    let prevPage = null;

    if (linkHeader) {
      const links = linkHeader.split(",");
      links.forEach((link) => {
        const match = link.match(/<([^>]+)>;\s*rel="([^"]+)"/);
        if (match) {
          const url = new URL(match[1]);
          const pageInfoParam = url.searchParams.get("page_info");
          if (match[2] === "next") {
            nextPage = pageInfoParam;
          } else if (match[2] === "previous") {
            prevPage = pageInfoParam;
          }
        }
      });
    }

    res.json({
      data: orders,
      pagination: {
        nextPage,
        prevPage,
        limit,
      },
    });
  } catch (error) {
    console.error(
      "Error fetching Shopify orders:",
      error.response?.data || error.message
    );
    res.status(500).json({ error: "Failed to fetch Shopify orders" });
  }
});

app.post("/api/compare-orders", async (req, res) => {
  const { internalOrders, externalOrders } = req.body;

  if (!internalOrders || !externalOrders) {
    return res.status(400).json({ error: "Missing data in request body." });
  }

  try {
    const comparison = await compareOrdersAI(internalOrders, externalOrders);
    res.json({ comparison });
  } catch (error) {
    console.error("Comparison error:", error.message);
    res.status(500).json({ error: "Failed to compare orders." });
  }
});

app.listen(PORT, () => {
  console.log(`Server running at http://localhost:${PORT}`);
});
