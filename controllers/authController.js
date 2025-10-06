import prisma from "../prismaClient.js";
// import bcrypt from "bcrypt";
// import jwt from "jsonwebtoken";

// const JWT_SECRET = process.env.JWT_SECRET || "supersecretkey";

export const loginUser = async (req, res) => {
  try {
    const { email, password } = req.body;

    // 1️⃣ Find user by email
    const user = await prisma.user.findUnique({ where: { email } });

    if (!user) {
      return res
        .status(401)
        .json({ success: false, message: "Invalid email or password" });
    }

    // 2️⃣ Check if user is active
    if (!user.is_active) {
      return res
        .status(403)
        .json({ success: false, message: "User is inactive" });
    }

    // if (user?.password != password) {
    //   return res
    //     .status(401)
    //     .json({ success: false, message: "Invalid email or password" });
    // }

    // 3️⃣ Compare password
    // const isMatch = await bcrypt.compare(password, user.password);
    // if (!isMatch) {
    //   return res.status(401).json({ success: false, message: "Invalid email or password" });
    // }

    // // 4️⃣ Generate JWT token
    // const token = jwt.sign(
    //   { userId: user.id, email: user.email, role: user.role },
    //   JWT_SECRET,
    //   { expiresIn: "7d" }
    // );

    res.json({
      success: true,
      user: user,
    });
  } catch (err) {
    console.error("Login error:", err);
    res.status(500).json({ success: false, message: "Server error" });
  }
};
