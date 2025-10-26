// services/storeService.js
import axios from "axios";
import prisma from "../prismaClient.js";

const API_KEY = process.env.API_KEY;

export const fetchAndSaveStores = async () => {
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

    // Step 2: Fetch outlets
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

    const outlets = outletsRes?.data?.data; // assuming this is an array

    // Step 3: Save/update stores in DB
    for (const outlet of outlets) {
      const address = outlet.address
        ? `${outlet.address.address_line1 || ""} ${outlet.address.address_line2 || ""} ${outlet.address.suburb || ""} ${outlet.address.state || ""} ${outlet.address.postcode || ""}`.trim()
        : null;

      await prisma.store.upsert({
        where: { id: outlet.id },
        update: {
          name: outlet.name,
          address: address,
        },
        create: {
          id: outlet.id,
          name: outlet.name,
          address: address,
        },
      });
    }

    console.log("Stores fetched and saved successfully!");
  } catch (error) {
    console.error("Error fetching/saving stores:", error.response?.data || error.message);
  }
};
