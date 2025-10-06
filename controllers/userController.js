import prisma from "../prismaClient.js";

// ✅ Create user
export const createUser = async (req, res) => {
  try {
    const { name, email, role, is_active, scopes } = req.body;

    const user = await prisma.user.create({
      data: {
        name,
        email,
        role,
        is_active: is_active ?? true,
        scopes,
      },
    });

    res.status(201).json({ success: true, user });
  } catch (error) {
    console.error("Create user error:", error);
    res.status(500).json({ success: false, message: "Error creating user" });
  }
};

// ✅ Get all users
export const getUsers = async (req, res) => {
  try {
    const users = await prisma.user.findMany();
    res.json({ success: true, users });
  } catch (error) {
    console.error("Get users error:", error);
    res.status(500).json({ success: false, message: "Error fetching users" });
  }
};

// ✅ Delete user
export const deleteUser = async (req, res) => {
  try {
    const { id } = req.params;

    await prisma.user.delete({
      where: { id: Number(id) },
    });

    res.json({ success: true, message: "User deleted successfully" });
  } catch (error) {
    console.error("Delete user error:", error);
    res.status(500).json({ success: false, message: "Error deleting user" });
  }
};