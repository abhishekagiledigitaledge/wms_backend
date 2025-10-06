import express from "express";
import {
  getOutlets,
  getOutletsInventory,
  getProductsById,
} from "../controllers/outletsController.js";

const router = express.Router();

// GET /api/outlets
router.get("/", getOutlets);
router.get("/:outletId/inventory", getOutletsInventory);
router.get("/:id/products", getProductsById);

export default router;
