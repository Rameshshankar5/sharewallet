/**
 * Turning expenses into "who owes whom".
 *
 * An expense can have several payers and several people splitting it, so there
 * is no single creditor. We reduce each expense to a set of person-to-person
 * debts:
 *
 *   1. net[p] = (what p paid) - (what p owes).   Positive = p is owed money.
 *   2. Greedily match the biggest creditor against the biggest debtor until
 *      everyone nets to zero.
 *
 * Step 2 produces the fewest possible edges, and sorting by amount-then-uid
 * makes it deterministic, so re-opening an expense never shows a different
 * breakdown than the one that was saved.
 */

import type { CentMap } from './split';

export interface Edge {
  /** Owes money. */
  from: string;
  /** Is owed money. */
  to: string;
  /** Always positive. */
  amount: number;
}

export function pairwiseFromExpense(payers: CentMap, splits: CentMap): Edge[] {
  const net = new Map<string, number>();
  const bump = (id: string, delta: number) => net.set(id, (net.get(id) || 0) + delta);

  for (const id in payers) bump(id, payers[id] || 0);
  for (const id in splits) bump(id, -(splits[id] || 0));

  const creditors: { id: string; amt: number }[] = [];
  const debtors: { id: string; amt: number }[] = [];
  net.forEach((amt, id) => {
    if (amt > 0) creditors.push({ id, amt });
    else if (amt < 0) debtors.push({ id, amt: -amt });
  });

  const byAmountThenId = (a: { id: string; amt: number }, b: { id: string; amt: number }) =>
    (b.amt - a.amt) || a.id.localeCompare(b.id);
  creditors.sort(byAmountThenId);
  debtors.sort(byAmountThenId);

  const edges: Edge[] = [];
  let ci = 0;
  let di = 0;
  while (ci < creditors.length && di < debtors.length) {
    const take = Math.min(creditors[ci].amt, debtors[di].amt);
    if (take > 0) edges.push({ from: debtors[di].id, to: creditors[ci].id, amount: take });
    creditors[ci].amt -= take;
    debtors[di].amt -= take;
    if (creditors[ci].amt === 0) ci++;
    if (debtors[di].amt === 0) di++;
  }

  return edges;
}

/**
 * Net position between every pair of people, keyed "uidA|uidB" with uidA < uidB.
 * The stored value is what B owes A (so positive means A is owed).
 */
export type PairKey = string;

export function pairKey(a: string, b: string): PairKey {
  return a < b ? `${a}|${b}` : `${b}|${a}`;
}

export class Ledger {
  private pairs = new Map<PairKey, number>();

  add(edge: Edge) {
    if (edge.from === edge.to || edge.amount === 0) return;
    const key = pairKey(edge.from, edge.to);
    // Stored relative to the lexicographically smaller uid.
    const signed = edge.to < edge.from ? edge.amount : -edge.amount;
    this.pairs.set(key, (this.pairs.get(key) || 0) + signed);
  }

  /** Positive => `other` owes `me`. Negative => `me` owes `other`. */
  between(me: string, other: string): number {
    const key = pairKey(me, other);
    const stored = this.pairs.get(key) || 0;
    return me < other ? stored : -stored;
  }

  /** Every person `me` has a non-zero balance with. */
  counterpartiesFor(me: string): { uid: string; amount: number }[] {
    const out: { uid: string; amount: number }[] = [];
    this.pairs.forEach((value, key) => {
      if (value === 0) return;
      const [a, b] = key.split('|');
      if (a !== me && b !== me) return;
      const other = a === me ? b : a;
      out.push({ uid: other, amount: this.between(me, other) });
    });
    return out.sort((x, y) => (y.amount - x.amount) || x.uid.localeCompare(y.uid));
  }

  /** Net across everyone: positive means you are owed overall. */
  netFor(me: string): number {
    return this.counterpartiesFor(me).reduce((sum, r) => sum + r.amount, 0);
  }
}

export interface LedgerSource {
  payers: CentMap;
  splits: CentMap;
}

export interface SettlementSource {
  fromUid: string;
  toUid: string;
  amount: number;
}

/**
 * Build a ledger from expenses + settlements.
 *
 * A settlement is cash moving the opposite way to a debt: if Kasun hands Nimal
 * Rs 500, Kasun's debt to Nimal shrinks by 500, which is the same as Nimal
 * owing Kasun 500 inside the ledger.
 */
export function buildLedger(expenses: LedgerSource[], settlements: SettlementSource[]): Ledger {
  const ledger = new Ledger();
  for (const e of expenses) {
    for (const edge of pairwiseFromExpense(e.payers, e.splits)) ledger.add(edge);
  }
  for (const s of settlements) {
    if (s.amount <= 0) continue;
    ledger.add({ from: s.toUid, to: s.fromUid, amount: s.amount });
  }
  return ledger;
}

/**
 * Reduce a set of balances to the smallest number of payments that clears them.
 * Used by "settle up" to suggest who should pay whom inside a room.
 */
export function simplify(balances: Record<string, number>): Edge[] {
  const creditors: { id: string; amt: number }[] = [];
  const debtors: { id: string; amt: number }[] = [];
  for (const id in balances) {
    const amt = balances[id];
    if (amt > 0) creditors.push({ id, amt });
    else if (amt < 0) debtors.push({ id, amt: -amt });
  }
  const cmp = (a: { id: string; amt: number }, b: { id: string; amt: number }) =>
    (b.amt - a.amt) || a.id.localeCompare(b.id);
  creditors.sort(cmp);
  debtors.sort(cmp);

  const out: Edge[] = [];
  let ci = 0;
  let di = 0;
  while (ci < creditors.length && di < debtors.length) {
    const take = Math.min(creditors[ci].amt, debtors[di].amt);
    if (take > 0) out.push({ from: debtors[di].id, to: creditors[ci].id, amount: take });
    creditors[ci].amt -= take;
    debtors[di].amt -= take;
    if (creditors[ci].amt === 0) ci++;
    if (debtors[di].amt === 0) di++;
  }
  return out;
}
