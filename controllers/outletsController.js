import axios from "axios";

const API_KEY = process.env.API_KEY; // .env variable

export const getOutlets = async (req, res) => {
  try {
    // Get access token from Retail Express
    const tokenRes = await axios.get(
      "https://api.retailexpress.com.au/v2/auth/token",
      {
        headers: {
          "x-api-key": API_KEY,
          Accept: "application/json",
          "Content-Type": "application/json",
        },
      }
    );

    const accessToken = tokenRes?.data?.access_token;

    const outletsRes = await axios.get(
      "https://prdinfamsapi001.azure-api.net/v2.1/outlets?page_number=1&page_size=20",
      {
        headers: {
          Authorization: `Bearer ${accessToken}`,
          "x-api-key": API_KEY,
          Accept: "application/json",
        },
      }
    );

    res.json(outletsRes.data);
  } catch (error) {
    console.error(
      "Error fetching outlets:",
      error.response?.data || error.message
    );
    res.status(500).json({ error: "Failed to fetch outlets" });
  }
};

export const getOutletsInventory = async (req, res) => {
  try {
    const { outletId } = req.params;

    // Get access token from Retail Express
    const tokenRes = await axios.get(
      "https://api.retailexpress.com.au/v2/auth/token",
      {
        headers: {
          "x-api-key": API_KEY,
          Accept: "application/json",
          "Content-Type": "application/json",
        },
      }
    );

    const accessToken = tokenRes?.data?.access_token;

    // Fetch products for the specific outlet
    const inventoryRes = await axios.get(
      `https://prdinfamsapi001.azure-api.net/v2.1/products?outlet_id=${outletId}`,
      {
        headers: {
          Authorization: `Bearer ${accessToken}`,
          "x-api-key": API_KEY,
          Accept: "application/json",
        },
      }
    );

    res.json(inventoryRes.data);
  } catch (error) {
    console.error(
      "Error fetching inventory for outlet:",
      error.response?.data || error.message
    );
    res.status(500).json({ error: "Failed to fetch inventory for outlet" });
  }
};

export const getProductsById = async (req, res) => {
  try {
    const outletId = req.params.id;

    // Get access token
    const tokenRes = await axios.get(
      "https://api.retailexpress.com.au/v2/auth/token",
      {
        headers: {
          "x-api-key": API_KEY,
          Accept: "application/json",
          "Content-Type": "application/json",
        },
      }
    );

    const accessToken = tokenRes?.data?.access_token;

    // Fetch products with inventory for the outlet
    const productsRes = await axios.get(
      `https://prdinfamsapi001.azure-api.net/v2.1/products?include_inventory=true&outlet_id=${outletId}&page_number=1&page_size=20`,
      {
        headers: {
          Authorization: `Bearer ${accessToken}`,
          "x-api-key": API_KEY,
          Accept: "application/json",
        },
      }
    );

    // Map the response to keep product details + inventory for the outlet
    const products = productsRes.data.data.map((p) => {
      // Find inventory entry for this outlet
      const inventoryForOutlet = p.inventory.filter(
        (inv) => inv.outlet_id == outletId
      );

      return {
        id: p.id,
        name: p.short_description || p.name,
        sell_price_inc: p.sell_price_inc,
        inventory: p,
      };
    });

    res.json({ data: products });
  } catch (error) {
    console.error(
      "Error fetching products for outlet:",
      error.response?.data || error.message
    );
    res.status(500).json({ error: "Failed to fetch products for outlet" });
  }
};