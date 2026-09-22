/**
 * Split maths. Every function here takes and returns integer cents.
 *
 * The recurring problem is remainders: Rs 10.00 across 3 people is 333.33 cents
 * each, which doesn't exist. We hand the leftover cents out one at a time in a
 * stable order so the parts always add back to exactly the total, and so the
 * same input always produces the same output (important — the split is written
 * to the audit log, and a jittery algorithm would show phantom "changes").
 */

/**
 * How a split was decided. `equal` divides evenly; `exact` means somebody
 * typed the figures. Weighted modes (shares, percentages) were removed — any
 * split they could express can be typed directly as amounts, and every extra
 * mode is another thing to explain to the people using this.
 */
export type SplitMode = 'equal' | 'exact';

export type CentMap = Record<string, number>;

/** Sum of a cent map. */
export function sumMap(map: CentMap): number {
  let total = 0;
  for (const k in map) total += map[k] || 0;
  return total;
}

/**
 * Distribute `total` across `ids` in proportion to `weights`, guaranteeing the
 * result sums to exactly `total`. Leftover cents go to the largest fractional
 * remainders first (Hamilton / largest-remainder method), ties broken by id so
 * the outcome is deterministic.
 */
export function distribute(total: number, ids: string[], weights: number[]): CentMap {
  const out: CentMap = {};
  if (ids.length === 0) return out;

  const weightTotal = weights.reduce((a, b) => a + b, 0);
  if (weightTotal <= 0) {
    // No usable weights — fall back to an even split so the UI still balances.
    return distribute(total, ids, ids.map(() => 1));
  }

  const remainders: { id: string; frac: number }[] = [];
  let assigned = 0;

  ids.forEach((id, i) => {
    const exact = (total * weights[i]) / weightTotal;
    const floored = Math.floor(exact);
    out[id] = floored;
    assigned += floored;
    remainders.push({ id, frac: exact - floored });
  });

  let leftover = total - assigned;
  remainders.sort((a, b) => (b.frac - a.frac) || a.id.localeCompare(b.id));

  // `leftover` can be negative when total is negative; step toward zero either way.
  const step = leftover >= 0 ? 1 : -1;
  let i = 0;
  while (leftover !== 0 && remainders.length > 0) {
    out[remainders[i % remainders.length].id] += step;
    leftover -= step;
    i++;
  }

  return out;
}

/** Even split across everyone selected. */
export function splitEqually(total: number, ids: string[]): CentMap {
  return distribute(total, ids, ids.map(() => 1));
}

export interface BalanceCheck {
  /** total - sum(parts). 0 means the split is valid. */
  difference: number;
  balanced: boolean;
  /** Over-allocated (people were given more than the expense total). */
  over: boolean;
}

/**
 * The guard behind the Save button: a split may not be stored unless the parts
 * add up to the expense total, in both directions (who paid, and who owes).
 */
export function checkBalance(total: number, parts: CentMap): BalanceCheck {
  const difference = total - sumMap(parts);
  return { difference, balanced: difference === 0, over: difference < 0 };
}

/**
 * Re-balance after the user hand-edits some rows. Rows the user touched are
 * locked at their typed value; the remainder is spread evenly over the rest.
 * Returns null when the locked rows already exceed the total — the caller shows
 * an error instead of silently producing negative shares.
 */
export function rebalanceUnlocked(
  total: number,
  ids: string[],
  current: CentMap,
  locked: Set<string>,
): CentMap | null {
  const lockedIds = ids.filter((id) => locked.has(id));
  const freeIds = ids.filter((id) => !locked.has(id));

  const lockedTotal = lockedIds.reduce((sum, id) => sum + (current[id] || 0), 0);
  const remaining = total - lockedTotal;

  if (freeIds.length === 0) return null;
  if (remaining < 0) return null;

  const spread = distribute(remaining, freeIds, freeIds.map(() => 1));
  const out: CentMap = {};
  lockedIds.forEach((id) => { out[id] = current[id] || 0; });
  freeIds.forEach((id) => { out[id] = spread[id]; });
  return out;
}
