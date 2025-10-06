import express from "express";
import {
  getOrders,
  getShopifyOrders,
  compareOrders,
  getOrderDetails,
  getShopifyOrderDetails,
  getCentralizedOrders,
} from "../controllers/orderController.js";

const router = express.Router();

// GET /api/orders
router.get("/", getOrders);
router.get("/shopify-orders", getShopifyOrders);
router.get("/centralized-orders", getCentralizedOrders);
router.post("/compare-orders", compareOrders);
router.get("/:id", getOrderDetails);
router.get("/shopify-orders/:id", getShopifyOrderDetails);

export default router;
