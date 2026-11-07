/**
 * Stock status — a copy of naqisni-web src/lib/stock.ts (riskLevel) so the app
 * and the website always show the same status for a product.
 * Keep the two in step until the shared Naqisni API takes this over.
 */
export type Risk = 'critical' | 'warning' | 'ordered' | 'healthy' | 'unset';

const n = (v: unknown): number | null => {
  if (v === null || v === undefined || v === '') return null;
  const x = Number(v);
  return Number.isFinite(x) ? x : null;
};

export function riskLevel(
  current: number,
  reorderPoint: number | null,
  days: number | null,
  opts: {
    reorderAt?: number | string | null;
    leadTimeDays?: number | string | null;
    orderByDate?: string | null;
    onOrder?: number | string | null;
    deliveryLate?: boolean | null;
    now?: Date;
  } = {}
): Risk {
  const reorderAt = n(opts.reorderAt);
  const ownLead = n(opts.leadTimeDays);
  const onOrder = Math.max(0, n(opts.onOrder) ?? 0);
  const position = current + onOrder;

  const belowReorder = reorderPoint !== null && position <= reorderPoint;
  const atReorderLevel = reorderAt !== null && position <= reorderAt;
  const covered = onOrder > 0 && !belowReorder && !atReorderLevel;
  const beforeDelivery = ownLead !== null && days !== null && days <= ownLead;
  if (opts.deliveryLate === true || belowReorder || (!covered && ((days !== null && days <= 2) || beforeDelivery))) {
    return 'critical';
  }

  const nearReorder = reorderPoint !== null && position <= reorderPoint * 1.5;
  const soon = new Date((opts.now ?? new Date()).getTime() + 2 * 86_400_000).toISOString().slice(0, 10);
  const orderSoon = Boolean(opts.orderByDate) && (opts.orderByDate as string) <= soon;
  if (nearReorder || atReorderLevel || orderSoon || (!covered && days !== null && days <= 7)) {
    return 'warning';
  }

  if (covered) return 'ordered';
  if (reorderPoint === null && days === null) return 'unset';
  return 'healthy';
}

export const riskOrder: Record<Risk, number> = { critical: 0, warning: 1, ordered: 2, healthy: 3, unset: 4 };

/** "12", "12.5" — no trailing zeros. */
export function qty(v: number | string | null | undefined): string {
  const x = Number(v ?? 0);
  return Number.isInteger(x) ? String(x) : x.toFixed(2).replace(/\.?0+$/, '');
}
