// services/productService.js
import axios from "axios";
import prisma from "../prismaClient.js";

const API_KEY = process.env.API_KEY;
const getRandomInt = (min, max) =>
  Math.floor(Math.random() * (max - min + 1)) + min;

export const fetchAndSaveProducts = async () => {
  try {
    // Step 1: Get access token
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

    const accessToken = tokenRes.data.access_token;

    // Step 2: Fetch all products (first page only)
    const productsRes = await axios.get(
      `https://prdinfamsapi001.azure-api.net/v2.1/products?include_inventory=true&page_number=1&page_size=50`,
      {
        headers: {
          Authorization: `Bearer ${accessToken}`,
          "x-api-key": API_KEY,
          Accept: "application/json",
        },
      }
    );

    const products = productsRes.data.data;

    // Step 3: Upsert all products once (common)
    const productMap = {}; // to store prisma product objects keyed by sku
    for (const p of products) {
      const sku = p.sku || `SKU-${p.id}`;

      const product = await prisma.product.upsert({
        where: { sku },
        update: {
          name: p.short_description || p.name,
          description: p.long_description || null,
        },
        create: {
          name: p.short_description || p.name,
          sku,
          description: p.long_description || null,
        },
      });

      productMap[sku] = product;
    }

    console.log(`Saved ${products.length} products.`);

    // Step 4: Get all stores
    const stores = await prisma.store.findMany();

    // Step 5: Upsert store-specific product data
    for (const store of stores) {
      console.log(`Assigning products to store: ${store.name} (${store.id})`);

      for (const p of products) {
        const sku = p.sku || `SKU-${p.id}`;
        const product = productMap[sku];

        // Stock calculation based on your new logic
        const minStock = p.min ?? getRandomInt(5, 20);
        const maxStock = p.max ?? getRandomInt(minStock + 10, minStock + 40);

        // Lower bound is 70% of minStock, upper bound is 120% of minStock but capped by maxStock
        const lowerBound = Math.max(0, Math.floor(minStock * 0.7));
        const upperBound = Math.min(maxStock, Math.floor(minStock * 1.2));

        // Inventory from API
        let stock =
          p.inventory?.find((inv) => inv.outlet_id == store.id)?.on_hand || 0;

        const stockVal = getRandomInt(lowerBound, upperBound);

        const price = p.price || getRandomInt(100, 1000);

        await prisma.storeProduct.upsert({
          where: {
            storeId_productId: {
              storeId: store.id,
              productId: product.id,
            },
          },
          update: {
            stock: stockVal,
            minQty: minStock,
            maxQty: maxStock,
            price,
          },
          create: {
            storeId: store.id,
            productId: product.id,
            stock: stockVal,
            minQty: minStock,
            maxQty: maxStock,
            price,
          },
        });
      }
    }

    console.log("Store products updated successfully!");
  } catch (error) {
    console.error(
      "Error fetching/saving products:",
      error.response?.data || error.message
    );
  }
};
