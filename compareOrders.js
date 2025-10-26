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

/**
 * Compare ONLY line items.
 * Expected inputs:
 *   internalOrders: Array< { sku?: string, title?: string, price: number|string, quantity?: number|string } >
 *   externalOrders: Array< same shape as above >
 *
 * Matching priority: sku -> title.
 * Differences returned for: count, total, and per-item fields (title, price, quantity),
 * plus missing items on either side.
 */
export const compareOrdersAI = async (internalLineItems, externalLineItems) => {
  const prompt = `
You are a strict JSON-only assistant.

Task: Compare ONLY the line items between INTERNAL and EXTERNAL arrays. Do NOT consider any other fields.

Rules:
- Match items by "sku" if present; if not, match by "title".
- Treat "price" as number (coerce strings to numbers).
- Default quantity to 1 if missing.
- Compare:
  - line_items.count (number of items)
  - line_items.total (sum of price * quantity, number, 2dp)
  - Per-item fields: title, price, quantity
  - Missing/present differences (item exists on one side but not the other)

Output format (JSON ONLY):
{
  "issue": <true|false>,
  "differences": {
    // include ONLY differing fields
    "line_items.count": { "internal": <number>, "external": <number> },
    "line_items.total": { "internal": <number>, "external": <number> },
    "items[<KEY>].missing": { "internal": <true|false>, "external": <true|false> },
    "items[<KEY>].title": { "internal": <string|null>, "external": <string|null> },
    "items[<KEY>].price": { "internal": <number>, "external": <number> },
    "items[<KEY>].quantity": { "internal": <number>, "external": <number> }
  }
}

- <KEY> should be the best identifier available: prefer sku; if not, use title.
- If there are NO differences at all, return:
  { "issue": false, "message": "No differences in line items" }

INTERNAL LINE ITEMS:
${JSON.stringify(internalLineItems, null, 2)}

EXTERNAL LINE ITEMS:
${JSON.stringify(externalLineItems, null, 2)}

Only output valid JSON (no prose). Ensure all numeric fields are numbers, not strings.
  `.trim();

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
