import { CohereClient } from "cohere-ai";

const cohere = new CohereClient({
  token: process.env.COHERE_API_KEY,
});

// Function to extract first JSON array/object from text
function extractJSON(text) {
  const jsonMatch = text.match(/(\{[\s\S]*\}|\[[\s\S]*\])/);
  if (!jsonMatch) throw new Error("No JSON found in AI response");
  return JSON.parse(jsonMatch[0]);
}

export const compareOrdersAI = async (internalOrders, externalOrders) => {
  const prompt = `
You are a strict JSON-only assistant. Compare two sets of order data: INTERNAL (our system) and EXTERNAL (MYOB).

Your goal: find and return ONLY the fields where the values are different between the two datasets.

Ignore any order_number or ID fields — they are static and should NOT be used for matching. Just compare field-by-field values between the first internal and the first external record.

Compare these exact columns:
- paymentStatus
- fulfillmentStatus
- total (number)
- customerEmail
- billingAddress.address1
- billingAddress.city
- billingAddress.province
- billingAddress.country
- billingAddress.phone
- line_data.count (number of line items)
- line_data.total (sum of line item prices)

Return ONLY a single JSON object in the following format:
{
  "issue": <true|false>,            // true if any field differs
  "differences": {                  // include only fields that differ (omit identical fields)
     "<field_path>": { "internal": <value>, "external": <value> },
     ...
  }
}

Field path examples: "paymentStatus", "billingAddress.city", "line_data.total"

If there are NO differences at all, return:
{
  "issue": false,
  "message": "No differences"
}

Now compare field values between:

INTERNAL ORDER DATA:
${JSON.stringify(internalOrders, null, 2)}

EXTERNAL (MYOB) ORDER DATA:
${JSON.stringify(externalOrders, null, 2)}

Only output valid JSON (no prose). Ensure numeric fields are numbers, not strings.`;

  try {
    const response = await cohere.chat({
      model: "command-a-03-2025",
      message: prompt,
    });

    const rawText = response.text;
    const parsed = extractJSON(rawText);
    return parsed;
  } catch (err) {
    console.error("Cohere AI error:", err);
    throw err;
  }
};
