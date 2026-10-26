/** GU operational helpers. Every day boundary is evaluated in Vietnam time. */
export type OrderSummary = {
  id: string;
  code: string;
  status: string;
  pickup_at: string;
  return_at: string;
  customer_name: string;
  lines: { itemId: string; name: string }[];
};

export type HandoverRisk = {
  currentOrderId: string;
  currentCode: string;
  customerName: string;
  nextOrderId: string;
  nextCode: string;
  nextPickupAt: string;
  itemNames: string[];
};

export function vnDate(date: Date): string {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: 'Asia/Ho_Chi_Minh', year: 'numeric', month: '2-digit', day: '2-digit'
  }).formatToParts(date);
  const get = (key: string) => parts.find(part => part.type === key)?.value || '';
  return `${get('year')}-${get('month')}-${get('day')}`;
}

export function vnHour(date: Date): number {
  return Number(new Intl.DateTimeFormat('en-GB', {
    timeZone: 'Asia/Ho_Chi_Minh', hour: '2-digit', hourCycle: 'h23'
  }).format(date));
}

/** An operational escalation is shown at/after 17:00 local time. */
export function findNextDayHandoverRisks(
  orders: OrderSummary[], now: Date = new Date()
): HandoverRisk[] {
  if (vnHour(now) < 17) return [];
  const tomorrow = vnDate(new Date(now.getTime() + 86_400_000));
  const arriving = orders.filter(o =>
    o.status === 'RESERVED' && vnDate(new Date(o.pickup_at)) === tomorrow
  );
  const byItem = new Map<string, OrderSummary[]>();
  for (const order of arriving) {
    for (const line of order.lines) {
      const group = byItem.get(line.itemId) || [];
      group.push(order);
      byItem.set(line.itemId, group);
    }
  }
  const results: HandoverRisk[] = [];
  for (const current of orders) {
    if (current.status !== 'PICKED_UP') continue;
    const nextOrders = new Map<string, { order: OrderSummary; items: Set<string> }>();
    for (const line of current.lines) {
      for (const next of byItem.get(line.itemId) || []) {
        if (next.id === current.id) continue;
        const entry = nextOrders.get(next.id) || { order: next, items: new Set<string>() };
        entry.items.add(line.name);
        nextOrders.set(next.id, entry);
      }
    }
    for (const { order: next, items } of nextOrders.values()) {
      results.push({
        currentOrderId: current.id, currentCode: current.code,
        customerName: current.customer_name,
        nextOrderId: next.id, nextCode: next.code,
        nextPickupAt: next.pickup_at, itemNames: [...items]
      });
    }
  }
  return results.sort((a, b) => a.nextPickupAt.localeCompare(b.nextPickupAt));
}

/** The UI can mark an item busy before the server independently checks its exclusion constraint. */
export function busyItemIds(
  orders: OrderSummary[], pickupISO: string, returnISO: string
): Set<string> {
  const start = Date.parse(pickupISO), end = Date.parse(returnISO);
  if (!Number.isFinite(start) || !Number.isFinite(end) || end <= start) return new Set();
  return new Set(orders.filter(o =>
    ['RESERVED','PICKED_UP'].includes(o.status) &&
    start < Date.parse(o.return_at) && Date.parse(o.pickup_at) < end
  ).flatMap(o => o.lines.map(line => line.itemId)));
}
