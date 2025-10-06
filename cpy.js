const { GoogleGenerativeAI } = require("@google/generative-ai");

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });

async function compareOrdersAI(internalOrders, externalOrders) {
  const prompt = `
You are an assistant comparing retail orders from two systems.

Internal Orders:
${JSON.stringify(internalOrders, null, 2)}

External Orders:
${JSON.stringify(externalOrders, null, 2)}

Return a JSON array of results.
If an order has differences, include them like:
[
  {
    "order_number": "21-00000001",
    "issue": true,
    "differences": {
      "order_status": {
        "internal": "Cancelled",
        "external": "Completed"
      }
    }
  }
]

If an order has no differences, include:
[
  {
    "order_number": "21-00000002",
    "issue": false,
    "message": "No issues"
  }
]
`;

  try {
    const response = await model.generateContent(prompt);

    const rawText = response.response.text();
    console.log("Raw Gemini Response:", rawText);

    // Remove code block markers if present
    const cleanedText = rawText.replace(/```json|```/g, "").trim();

    // Parse JSON safely
    const parsed = JSON.parse(cleanedText);

    return parsed;
  } catch (err) {
    console.error("Gemini AI error:", err);
    throw err;
  }
}

module.exports = { compareOrdersAI };
