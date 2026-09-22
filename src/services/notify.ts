import {
  expenseMessages, settlementMessages, isExpoPushToken,
  type Recipient,
} from '../lib/pushMessages';
import { sendPushMessages } from './push';
import type { Expense, Settlement, UserProfile } from '../types';

/**
 * Turning a saved row into notifications for the people it affects.
 *
 * Every function here is fire-and-forget on purpose. The write has already
 * committed by the time these run, and a notification that failed to send must
 * never surface as a save that failed.
 */

function recipientsFor(
  expense: Pick<Expense, 'participantIds' | 'payers' | 'splits'>,
  usersById: Record<string, UserProfile>,
  exclude: string,
): Recipient[] {
  return expense.participantIds
    // Never notify whoever made the change about their own change.
    .filter((uid) => uid !== exclude)
    .map((uid) => {
      const tokens = (usersById[uid]?.pushTokens ?? []).filter(isExpoPushToken);
      return {
        uid,
        tokens,
        share: expense.splits[uid] ?? 0,
        paid: expense.payers[uid] ?? 0,
      };
    })
    .filter((r) => r.tokens.length > 0);
}

export function notifyExpense(
  expense: Pick<Expense, 'participantIds' | 'payers' | 'splits' | 'description' | 'roomId'>,
  expenseId: string,
  kind: 'created' | 'updated',
  actor: UserProfile,
  usersById: Record<string, UserProfile>,
  roomNameOf: (roomId: string | null) => string | null,
): void {
  const recipients = recipientsFor(expense, usersById, actor.uid);
  if (recipients.length === 0) return;

  void sendPushMessages(expenseMessages({
    expenseId,
    description: expense.description,
    actorName: actor.displayName,
    roomName: expense.roomId ? roomNameOf(expense.roomId) : null,
    kind,
  }, recipients));
}

export function notifySettlement(
  settlement: Pick<Settlement, 'fromUid' | 'toUid' | 'amount' | 'roomId'>,
  settlementId: string,
  actor: UserProfile,
  usersById: Record<string, UserProfile>,
  roomNameOf: (roomId: string | null) => string | null,
): void {
  // The person who received the money is the one who wants to know. Whoever
  // recorded it already knows — they just typed it in.
  const receiver = settlement.toUid === actor.uid ? settlement.fromUid : settlement.toUid;
  if (receiver === actor.uid) return;

  const tokens = (usersById[receiver]?.pushTokens ?? []).filter(isExpoPushToken);
  if (tokens.length === 0) return;

  void sendPushMessages(settlementMessages({
    settlementId,
    payerName: actor.displayName,
    amount: settlement.amount,
    roomName: settlement.roomId ? roomNameOf(settlement.roomId) : null,
  }, tokens));
}
