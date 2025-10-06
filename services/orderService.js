// services/orderService.js
import axios from "axios";
import { mapRexOrder, mapShopifyOrder } from "../helpers/orderMapper.js";
import prisma from "../prismaClient.js";

import dotenv from "dotenv";
dotenv.config();

// Replace with your REX & Shopify API credentials
const REX_API_KEY = process.env.API_KEY;
const SHOPIFY_STORE = process.env.SHOPIFY_STORE;
const SHOPIFY_TOKEN = process.env.SHOPIFY_ACCESS_TOKEN;

export const fetchAndSaveRexOrders = async (req, res) => {
  try {
    const tokenRes = await axios.get(
      "https://api.retailexpress.com.au/v2/auth/token",
      {
        headers: {
          "x-api-key": REX_API_KEY,
          Accept: "application/json",
          "Content-Type": "application/json",
        },
      }
    );

    const accessToken = tokenRes?.data?.access_token;

    let page = 1;
    const limit = 100; // fetch 100 orders per page
    let allOrders = [];

    while (allOrders.length < 500) {
      const response = await axios.get(
        `https://prdinfamsapi001.azure-api.net/v2.1/orders?page=${page}&limit=${limit}`,
        {
          headers: {
            Authorization: `Bearer ${accessToken}`,
            "x-api-key": REX_API_KEY,
            Accept: "application/json",
          },
        }
      );

      const rexOrders = response.data.data || [];
      console.log(`Fetched page ${page}:`, rexOrders.length, "orders");

      if (rexOrders.length === 0) break; // no more orders

      allOrders.push(...rexOrders);

      if (allOrders.length >= 500) {
        allOrders = allOrders.slice(0, 500);
        break;
      }

      const totalRecords = response.data.total_records || 0;
      console.log(`Total records: ${totalRecords}`);
      if (page * limit >= totalRecords) break; // fetched all pages

      page++;
    }

    for (let rexOrder of allOrders) {
      const orderData = mapRexOrder(rexOrder);
      await prisma.order.upsert({
        where: { externalId: orderData.externalId },
        update: orderData,
        create: orderData,
      });
    }
    res.status(200).json({
      message: `Fetched ${rexOrders.length} REX orders successfully`,
      orders: rexOrders,
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Failed to fetch orders" });
  }
};

export const fetchAndSaveShopifyOrders = async (req, res) => {
  try {
    const response = await axios.get(
      `https://${SHOPIFY_STORE}.myshopify.com/admin/api/2025-01/orders.json`,
      {
        headers: {
          "X-Shopify-Access-Token": SHOPIFY_TOKEN,
          Accept: "application/json",
        },
      }
    );

    const shopifyOrders = response.data.orders;
    // console.log("Fetched Shopify Orders:", shopifyOrders.length);
    for (let shopifyOrder of shopifyOrders) {
      const orderData = mapShopifyOrder(shopifyOrder);
      await prisma.order.upsert({
        where: { externalId: orderData.externalId },
        update: orderData,
        create: orderData,
      });
    }

    res.status(200).json({
      message: `Fetched ${shopifyOrders.length} Shopify orders successfully`,
      orders: shopifyOrders,
    });
  } catch (error) {
    console.error(
      "Error fetching Shopify orders:",
      error.response?.data || error.message
    );
    res.status(500).json({ error: "Failed to fetch Shopify orders" });
  }
};
