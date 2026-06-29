import { getOrderId } from "@/components/erp/OperationalJobCard";

function normalizeItems(order, department) {
  if (department === "polarizados") {
    return order?.windows || order?.items || [];
  }
  return order?.accessories || order?.items || [];
}

/**
 * Expande órdenes con varios productos en tarjetas de un producto cada una.
 */
export function expandOrdersToItemCards(orders = [], department = "instalaciones") {
  if (department === "polarizados") {
    return (orders || []).map((order) => ({
      ...order,
      cardKey: getOrderId(order, department),
      itemIndex: 0,
      displayItem: normalizeItems(order, department)[0] || null,
      displayItems: normalizeItems(order, department),
      isItemSplit: false,
    }));
  }

  const cards = [];
  for (const order of orders || []) {
    const items = normalizeItems(order, department);
    if (items.length <= 1) {
      const item = items[0] || null;
      cards.push({
        ...order,
        cardKey: getOrderId(order, department),
        itemIndex: 0,
        displayItem: item,
        displayItems: item ? [item] : [],
        isItemSplit: false,
      });
      continue;
    }

    items.forEach((item, itemIndex) => {
      const orderId = getOrderId(order, department);
      cards.push({
        ...order,
        cardKey: `${orderId}__item_${itemIndex}`,
        itemIndex,
        displayItem: item,
        displayItems: [item],
        isItemSplit: true,
        splitLabel: `${itemIndex + 1}/${items.length}`,
      });
    });
  }
  return cards;
}