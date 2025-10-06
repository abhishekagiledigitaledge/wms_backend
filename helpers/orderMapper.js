// helpers/orderMapper.js

export function mapRexOrder(rexOrder) {
  return {
    externalId: rexOrder.id.toString(),
    source: "rex",
    orderNumber: rexOrder.order_number,
    customerName: `${rexOrder.customer?.first_name || ""} ${rexOrder.customer?.last_name || ""}`.trim(),
    customerEmail: rexOrder.customer?.email || null,
    customerPhone: rexOrder.customer?.mobile || rexOrder.customer?.phone || null,
    customerAddress: rexOrder.billing_address
      ? `${rexOrder.billing_address.address_line1 || ""} ${rexOrder.billing_address.suburb || ""}`.trim()
      : null,
    status: "unknown",
    paymentStatus: null,
    fulfillmentStatus: null,
    outlet: rexOrder.outlet?.name || null,
    subtotal: null,
    tax: null,
    shippingFee: rexOrder.freight_total || 0,
    discount: null,
    totalAmount: rexOrder.order_total || 0,
    currency: "AUD",
    createdAt: new Date(rexOrder.created_on),
    updatedAt: new Date(rexOrder.modified_on),
    fulfilledAt: rexOrder.fulfilled_in_full_on ? new Date(rexOrder.fulfilled_in_full_on) : null,
    extraData: rexOrder,
  };
}

export function mapShopifyOrder(shopifyOrder) {
  return {
    externalId: shopifyOrder.id.toString(),
    source: "shopify",
    orderNumber: shopifyOrder.order_number.toString(),
    customerName: `${shopifyOrder.customer?.first_name || ""} ${shopifyOrder.customer?.last_name || ""}`.trim(),
    customerEmail: shopifyOrder.customer?.email || shopifyOrder.email || null,
    customerPhone: shopifyOrder.customer?.phone || shopifyOrder.phone || null,
    customerAddress: shopifyOrder.billing_address
      ? `${shopifyOrder.billing_address.address1 || ""} ${shopifyOrder.billing_address.city || ""}`.trim()
      : null,
    status: shopifyOrder.financial_status || "unknown",
    paymentStatus: shopifyOrder.financial_status || null,
    fulfillmentStatus: shopifyOrder.fulfillment_status || null,
    outlet: shopifyOrder.shipping_address?.city || null,
    subtotal: parseFloat(shopifyOrder.subtotal_price) || 0,
    tax: parseFloat(shopifyOrder.total_tax) || 0,
    shippingFee: shopifyOrder.total_shipping_price_set?.shop_money?.amount
      ? parseFloat(shopifyOrder.total_shipping_price_set.shop_money.amount)
      : 0,
    discount: parseFloat(shopifyOrder.total_discounts) || 0,
    totalAmount: parseFloat(shopifyOrder.total_price) || 0,
    currency: shopifyOrder.currency || "AUD",
    createdAt: new Date(shopifyOrder.created_at),
    updatedAt: new Date(shopifyOrder.updated_at),
    fulfilledAt: shopifyOrder.processed_at ? new Date(shopifyOrder.processed_at) : null,
    extraData: shopifyOrder,
  };
}
