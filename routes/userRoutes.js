import express from "express";
import { createUser, deleteUser, getUsers } from "../controllers/userController.js";

const router = express.Router();

// GET /api/outlets
router.post("/", createUser);
router.get("/", getUsers);
router.delete("/:id", deleteUser);

export default router;
