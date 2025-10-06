import axios from "axios";
import { compareOrdersAI } from "../compareOrders.js";
import dotenv from "dotenv";
import prisma from "../prismaClient.js";
dotenv.config();

const API_KEY = process.env.API_KEY; // .env variable

// GET /api/orders
export const getOrders = async (req, res) => {
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

    // Page query param
    let page = req.query.page ? parseInt(req.query.page, 10) : 1;
    if (isNaN(page) || page < 1) page = 1;

    const ordersUrl = `https://prdinfamsapi001.azure-api.net/v2.1/orders?page=${page}`;

    // Fetch orders
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
    console.error(error);
    res.status(500).json({ error: "Failed to fetch orders" });
  }
};

export const getShopifyOrders = async (req, res) => {
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
};

export const getCentralizedOrders = async (req, res) => {
  const { source } = req.query;

  const whereCondition =
    !source || source.toLowerCase() === "all"
      ? {}
      : { source: { equals: source, mode: "insensitive" } };

  try {
    const orders = await prisma.order.findMany({
      where: whereCondition,
      orderBy: { createdAt: "desc" },
    });

    res.status(200).json({
      success: true,
      count: orders.length,
      data: orders,
    });
  } catch (error) {
    console.error("Error fetching orders:", error);
    res.status(500).json({
      success: false,
      message: "Failed to fetch orders",
      error: error.message,
    });
  }
};

export const compareOrders = async (req, res) => {
  const { internalOrders, externalOrders } = req.body;

  if (!internalOrders) {
    return res.status(400).json({ error: "Missing data in request body." });
  }

  // If externalOrders not provided, use a static MYOB dataset for comparison
  const staticMYOB = [
    {
      order_number: "14518",
      paymentStatus: "paid",
      fulfillmentStatus: "fulfilled",
      total: 29.98,
      customerEmail: "alice@example.com",
      billingAddress: {
        address1: "123 Main St",
        city: "Sydney",
        country: "Australia",
        province: "NSW",
        phone: "+61 2 9999 9999",
      },
      line_data: [
        { sku: "STICKER-01", title: "Sticker A", price: 9.99 },
        { sku: "STICKER-02", title: "Sticker B", price: 19.99 },
      ],
    },
  ];
  const externals = externalOrders || staticMYOB;

  try {
    const comparison = await compareOrdersAI(internalOrders, externals);
    res.json({ comparison });
  } catch (error) {
    console.error("Comparison error:", error.message);
    res.status(500).json({ error: "Failed to compare orders." });
  }
};

export const getOrderDetails = async (req, res) => {
  try {
    const { id } = req.params;

    const order = await prisma.order.findUnique({
      where: {
        id: parseInt(id),
      },
    });

    if (!order) {
      return res.status(404).json({ error: "Order not found" });
    }

    res.status(200).json(order);
  } catch (error) {
    console.error(
      "Error fetching order details:",
      error.response?.data || error.message
    );
    res.status(500).json({ error: "Failed to fetch order details" });
  }
};

export const getShopifyOrderDetails = async (req, res) => {
  try {
    const { id } = req.params;

    const order = await prisma.order.findUnique({
      where: {
        id: parseInt(id),
      },
    });

    if (!order) {
      return res.status(404).json({ error: "Order not found" });
    }

    res.status(200).json(order);
  } catch (error) {
    console.error("Error fetching order details:", error.message);
    res.status(500).json({ error: "Failed to fetch order details" });
  }
};
