const { CohereClient } = require("cohere-ai");

const cohere = new CohereClient({
  token: process.env.COHERE_API_KEY,
});

// Function to extract first JSON array/object from text
function extractJSON(text) {
  const jsonMatch = text.match(/(\{[\s\S]*\}|\[[\s\S]*\])/);
  if (!jsonMatch) throw new Error("No JSON found in AI response");
  return JSON.parse(jsonMatch[0]);
}

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
    const response = await cohere.chat({
      model: "command-a-03-2025",
      message: prompt,
    });

    const rawText = response.text;
    // console.log("Raw Cohere Response:", rawText);

    const parsed = extractJSON(rawText); // <-- safe extraction

    return parsed;
  } catch (err) {
    console.error("Cohere AI error:", err);
    throw err;
  }
}

module.exports = { compareOrdersAI };
