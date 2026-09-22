/**
 * What a notification says, worked out from the expense itself.
 *
 * Kept pure and away from anything native so the wording — which is the part
 * that can be quietly wrong for months — is covered by the test suite rather
 * than by installing a build and adding an expense.
 *
 * The rule throughout: say what it means for the person reading it. "Kasun
 * added Tv" makes someone open the app to find out whether it concerns them.
 * "Kasun added Tv — your share is Rs 2,500.00" has already answered that.
 */

import { formatMoney } from './money';

export interface PushMessage {
  /** Expo push token of the recipient. */
  to: string;
  title: string;
  body: string;
  /** Carried through so tapping the notification can open the right screen. */
  data: Record<string, string>;
}

export interface ExpenseNotice {
  expenseId: string;
  description: string;
  /** Who entered it. */
  actorName: string;
  /** The room it belongs to, for the one line of context that matters. */
  roomName: string | null;
  /** Whether this is a new expense or a change to one. */
  kind: 'created' | 'updated';
}

export interface Recipient {
  uid: string;
  /** Every device that person has signed in on. */
  tokens: string[];
  /** Cents they owe for this expense. */
  share: number;
  /** Cents they paid towards it. */
  paid: number;
}

/**
 * Everyone's line, for one expense.
 *
 * A person who paid the whole thing and owes nothing is told what they are
 * owed; a person who only owes is told their share. Somebody who ends up
 * neither owing nor owed is left out entirely rather than being pinged about
 * money that does not move for them.
 */
export function expenseMessages(
  notice: ExpenseNotice,
  recipients: Recipient[],
): PushMessage[] {
  const out: PushMessage[] = [];

  const where = notice.roomName ? ` in ${notice.roomName}` : '';
  const title = notice.kind === 'created'
    ? `${notice.actorName} added an expense${where}`
    : `${notice.actorName} changed an expense${where}`;

  for (const r of recipients) {
    const net = r.paid - r.share;
    if (net === 0 && r.share === 0) continue;

    const body = net > 0
      ? `${notice.description} — you are owed ${formatMoney(net)}`
      : net < 0
        ? `${notice.description} — your share is ${formatMoney(-net)}`
        // Paid exactly what they owe: nothing moves, but they are on it.
        : `${notice.description} — you are square on this`;

    for (const to of r.tokens) {
      out.push({
        to,
        title,
        body,
        data: { type: 'expense', expenseId: notice.expenseId },
      });
    }
  }

  return out;
}

export interface SettlementNotice {
  settlementId: string;
  payerName: string;
  amount: number;
  roomName: string | null;
}

/** "Kasun paid you Rs 500.00" — sent to the person who received the money. */
export function settlementMessages(
  notice: SettlementNotice,
  tokens: string[],
): PushMessage[] {
  const where = notice.roomName ? ` in ${notice.roomName}` : '';
  return tokens.map((to) => ({
    to,
    title: `${notice.payerName} recorded a payment${where}`,
    body: `${notice.payerName} paid you ${formatMoney(notice.amount)}`,
    data: { type: 'settlement', settlementId: notice.settlementId },
  }));
}

/**
 * Expo accepts at most 100 messages per request.
 *
 * A group of friends will never reach that, but a loop that silently drops
 * everything past the hundredth is the kind of bug that only shows up on the
 * one day it matters.
 */
export function chunkMessages(messages: PushMessage[], size = 100): PushMessage[][] {
  const chunks: PushMessage[][] = [];
  for (let i = 0; i < messages.length; i += size) {
    chunks.push(messages.slice(i, i + size));
  }
  return chunks;
}

/** Expo's tokens look like `ExponentPushToken[xxxxxxxx]`. */
export function isExpoPushToken(value: unknown): value is string {
  return typeof value === 'string' && /^Expo(nent)?PushToken\[.+\]$/.test(value);
}
