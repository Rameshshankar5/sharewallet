/**
 * Tests for the money maths — the part of this app that must never be wrong.
 *
 * Run with:  npm test
 *
 * These cover the pure logic in src/lib (parsing, splitting, balances). They
 * need no emulator, no Firebase project and no network.
 */
const assert = require('node:assert/strict');
const { test } = require('node:test');
const { parseAmount, formatMoney, formatCents } = require('../.math-build/money');
const { splitEqually, distribute, checkBalance, sumMap, rebalanceUnlocked } = require('../.math-build/split');
const { pairwiseFromExpense, buildLedger, buildRoomLedger, simplify } = require('../.math-build/balance');

test('parseAmount handles the ways people actually type money', () => {
  assert.equal(parseAmount('1200'), 120000);
  assert.equal(parseAmount('1200.5'), 120050);
  assert.equal(parseAmount('1200.55'), 120055);
  assert.equal(parseAmount('Rs 1,200.55'), 120055);
  assert.equal(parseAmount('0.01'), 1);
  assert.equal(parseAmount(''), null);
  assert.equal(parseAmount('abc'), null);
  // Extra decimals are truncated, not rounded into a surprise cent.
  assert.equal(parseAmount('10.999'), 1099);
});

test('formatting groups digits and always shows two decimals', () => {
  assert.equal(formatCents(120055), '1,200.55');
  assert.equal(formatCents(100), '1.00');
  assert.equal(formatCents(0), '0.00');
  assert.equal(formatMoney(12345678), 'Rs 123,456.78');
  assert.equal(formatCents(-5000), '-50.00');
});

test('equal split of an indivisible amount still sums to the total', () => {
  // Rs 10.00 across 3 people = 333.33 cents each, which cannot exist.
  const parts = splitEqually(1000, ['a', 'b', 'c']);
  assert.equal(sumMap(parts), 1000);
  assert.deepEqual(Object.values(parts).sort((x, y) => y - x), [334, 333, 333]);
});

test('no float drift across many awkward splits', () => {
  for (let total = 1; total <= 2000; total++) {
    for (let n = 1; n <= 7; n++) {
      const ids = Array.from({ length: n }, (_, i) => `u${i}`);
      assert.equal(sumMap(splitEqually(total, ids)), total, `total=${total} n=${n}`);
    }
  }
});

test('the split is deterministic — same input, same output every time', () => {
  const a = splitEqually(10000, ['zed', 'amy', 'bob']);
  const b = splitEqually(10000, ['zed', 'amy', 'bob']);
  assert.deepEqual(a, b);
});

test('checkBalance is the guard behind the Save button', () => {
  assert.equal(checkBalance(1000, { a: 600, b: 400 }).balanced, true);
  const short = checkBalance(1000, { a: 600, b: 300 });
  assert.equal(short.balanced, false);
  assert.equal(short.difference, 100);
  assert.equal(short.over, false);
  const over = checkBalance(1000, { a: 600, b: 600 });
  assert.equal(over.over, true);
  assert.equal(over.difference, -200);
});

test('hand-editing one share spreads the rest over untouched rows only', () => {
  // Rs 90 three ways, then Kasun insists his share is Rs 50.
  const ids = ['kasun', 'nimal', 'sahan'];
  const current = { kasun: 5000, nimal: 3000, sahan: 3000 };
  const out = rebalanceUnlocked(9000, ids, current, new Set(['kasun']));
  assert.equal(out.kasun, 5000, 'the locked row is untouched');
  assert.equal(out.nimal + out.sahan, 4000);
  assert.equal(sumMap(out), 9000);
});

test('locked rows exceeding the total are refused, not silently negated', () => {
  const out = rebalanceUnlocked(1000, ['a', 'b'], { a: 5000, b: 0 }, new Set(['a']));
  assert.equal(out, null);
});

test('YOUR CASE: one person pays 1000, another pays 200, split three ways', () => {
  // Total Rs 1200. Kasun paid 1000, Nimal paid 200, split equally over 3.
  const payers = { kasun: 100000, nimal: 20000 };
  const splits = splitEqually(120000, ['kasun', 'nimal', 'sahan']);
  assert.equal(sumMap(payers), 120000);
  assert.equal(sumMap(splits), 120000);

  const edges = pairwiseFromExpense(payers, splits);
  // Everyone's share is Rs 400. Kasun is up 600, Nimal is down 200, Sahan down 400.
  const net = {};
  for (const e of edges) {
    net[e.from] = (net[e.from] || 0) - e.amount;
    net[e.to] = (net[e.to] || 0) + e.amount;
  }
  assert.equal(net.kasun, 60000);
  assert.equal(net.nimal, -20000);
  assert.equal(net.sahan, -40000);
  // And the debts net to zero overall.
  assert.equal(Object.values(net).reduce((a, b) => a + b, 0), 0);
});

test('a settlement cancels the debt it repays', () => {
  const expense = { payers: { a: 10000 }, splits: { a: 5000, b: 5000 } };
  let ledger = buildLedger([expense], []);
  assert.equal(ledger.between('a', 'b'), 5000, 'b owes a Rs 50');

  ledger = buildLedger([expense], [{ fromUid: 'b', toUid: 'a', amount: 5000 }]);
  assert.equal(ledger.between('a', 'b'), 0, 'paying it back clears it');
  assert.equal(ledger.counterpartiesFor('a').length, 0);
});

test('balances are symmetric — no money invented or lost', () => {
  const expenses = [
    { payers: { a: 100000, b: 20000 }, splits: splitEqually(120000, ['a', 'b', 'c']) },
    { payers: { c: 45000 }, splits: { a: 15000, c: 30000 } },
    { payers: { b: 7777 }, splits: splitEqually(7777, ['a', 'b', 'c']) },
  ];
  const ledger = buildLedger(expenses, [{ fromUid: 'a', toUid: 'b', amount: 1234 }]);
  assert.equal(ledger.between('a', 'b'), -ledger.between('b', 'a'));
  const everyone = ['a', 'b', 'c'].map((u) => ledger.netFor(u));
  assert.equal(everyone.reduce((x, y) => x + y, 0), 0, 'the group always nets to zero');
});

test('settle-up suggests the fewest payments', () => {
  // a is owed 30, b owes 10, c owes 20 -> two payments, not three.
  const payments = simplify({ a: 3000, b: -1000, c: -2000 });
  assert.equal(payments.length, 2);
  assert.equal(payments.reduce((s, p) => s + p.amount, 0), 3000);
  assert.ok(payments.every((p) => p.to === 'a'));
});

/**
 * Rooms are buckets, not separate currencies.
 *
 * The bug these cover: a room's ledger was built from that room's expenses but
 * from every payment between its members, so repaying a debt that had nothing
 * to do with the room moved the room's figure — and a room holding no expenses
 * at all could still claim you owed money.
 */
test('a room with no expenses shows no balance, whatever was repaid elsewhere', () => {
  const expenses = [
    // A direct expense between the two of them — not in any room.
    { roomId: null, deleted: false, payers: { me: 30000 }, splits: { me: 15000, thuva: 15000 } },
  ];
  const settlements = [
    // Thuva repays part of that direct debt. No room involved.
    { roomId: null, deleted: false, fromUid: 'thuva', toUid: 'me', amount: 8000 },
  ];

  const room = buildRoomLedger(expenses, settlements, 'room88');
  assert.equal(room.netFor('me'), 0, 'an empty room must be empty');

  // The overall picture still moves: 15000 owed, 8000 repaid.
  const overall = buildLedger(expenses, settlements);
  assert.equal(overall.between('me', 'thuva'), 7000);
});

test('one room never moves another room', () => {
  const expenses = [
    { roomId: 'room88', deleted: false, payers: { me: 20000 }, splits: { me: 10000, thuva: 10000 } },
    { roomId: 'room99', deleted: false, payers: { thuva: 6000 }, splits: { me: 3000, thuva: 3000 } },
  ];
  // Thuva clears room 88 only.
  const settlements = [
    { roomId: 'room88', deleted: false, fromUid: 'thuva', toUid: 'me', amount: 10000 },
  ];

  assert.equal(buildRoomLedger(expenses, settlements, 'room88').netFor('me'), 0);
  assert.equal(buildRoomLedger(expenses, settlements, 'room99').netFor('me'), -3000);

  // And the single overall number is still the sum of everything.
  assert.equal(buildLedger(expenses, settlements).between('me', 'thuva'), -3000);
});

test('a room expense counts towards your one-to-one balance like any other', () => {
  // The fan bought for room 88, split four ways, is still money between you
  // and each flatmate — it must show up in the friend ledger, not only in
  // the room. That is why the friend screen marks rows with their room
  // rather than filtering them out.
  const fan = {
    roomId: 'room88', deleted: false,
    payers: { me: 40000 },
    splits: { me: 10000, thuva: 10000, kasun: 10000, nimal: 10000 },
  };
  const dinner = {
    roomId: null, deleted: false,
    payers: { me: 5000 }, splits: { me: 2500, thuva: 2500 },
  };

  const overall = buildLedger([fan, dinner], []);
  assert.equal(overall.between('me', 'thuva'), 12500, 'fan share + dinner share');
  assert.equal(overall.between('me', 'kasun'), 10000, 'fan share only');

  // Inside the room, only the fan counts.
  assert.equal(buildRoomLedger([fan, dinner], [], 'room88').netFor('me'), 30000);
});

test('deleted expenses and payments are ignored by a room ledger', () => {
  const expenses = [
    { roomId: 'r1', deleted: true, payers: { me: 9000 }, splits: { me: 4500, thuva: 4500 } },
    { roomId: 'r1', deleted: false, payers: { me: 2000 }, splits: { me: 1000, thuva: 1000 } },
  ];
  const settlements = [
    { roomId: 'r1', deleted: true, fromUid: 'thuva', toUid: 'me', amount: 1000 },
  ];
  assert.equal(buildRoomLedger(expenses, settlements, 'r1').netFor('me'), 1000);
});

/**
 * Cloudinary URL building. Cheap to get subtly wrong, and a mangled URL shows
 * up as a broken image rather than an error anyone would notice.
 */
const {
  withTransform, avatarUrl, receiptThumbUrl, receiptFullUrl,
} = require('../.math-build/cloudinary');

const UPLOADED =
  'https://res.cloudinary.com/szpl750m/image/upload/v1737550000/receipts/abc123.jpg';

test('a transformation is inserted after /upload/', () => {
  assert.equal(
    withTransform(UPLOADED, 'f_auto,q_auto'),
    'https://res.cloudinary.com/szpl750m/image/upload/f_auto,q_auto/v1737550000/receipts/abc123.jpg',
  );
});

test('nothing is invented when there is no URL', () => {
  assert.equal(withTransform(null, 'f_auto'), null);
  assert.equal(withTransform(undefined, 'f_auto'), null);
  assert.equal(withTransform('', 'f_auto'), null);
  assert.equal(avatarUrl(null, 64), null);
  assert.equal(receiptThumbUrl(null, 80), null);
  assert.equal(receiptFullUrl(null), null);
});

test('a URL that is not a Cloudinary delivery URL is left alone', () => {
  // Older rows, or anything hand-entered, must not be silently corrupted.
  const foreign = 'https://example.com/photo.jpg';
  assert.equal(withTransform(foreign, 'f_auto'), foreign);
});

test('avatars are square, face-aware and asked for at retina size', () => {
  const url = avatarUrl(UPLOADED, 64);
  assert.ok(url.includes('c_fill'), 'square crop');
  assert.ok(url.includes('g_face'), 'keeps the face in frame');
  assert.ok(url.includes('w_192,h_192'), '64pt at 3x');
});

test('receipts are fitted, never cropped', () => {
  // A cropped receipt loses the total off the bottom, which is the one line
  // anybody opened it for.
  const thumb = receiptThumbUrl(UPLOADED, 84);
  assert.ok(thumb.includes('c_fit'));
  assert.ok(!thumb.includes('c_fill'));
  assert.ok(receiptFullUrl(UPLOADED).includes('f_auto,q_auto'));
});

/**
 * Notification wording. The part most likely to be quietly wrong for months,
 * because nobody reads their own notifications critically.
 */
const {
  expenseMessages, settlementMessages, chunkMessages, isExpoPushToken,
} = require('../.math-build/pushMessages');

const NOTICE = {
  expenseId: 'e1', description: 'Tv', actorName: 'Ramesh',
  roomName: null, kind: 'created',
};

test('a notification says what the expense means for the person reading it', () => {
  const [owes] = expenseMessages(NOTICE, [
    { uid: 'thuva', tokens: ['ExponentPushToken[a]'], share: 250000, paid: 0 },
  ]);
  assert.equal(owes.title, 'Ramesh added an expense');
  assert.equal(owes.body, 'Tv — your share is Rs 2,500.00');

  const [owed] = expenseMessages(NOTICE, [
    { uid: 'kasun', tokens: ['ExponentPushToken[b]'], share: 100000, paid: 400000 },
  ]);
  assert.equal(owed.body, 'Tv — you are owed Rs 3,000.00');
});

test('the room is named when there is one', () => {
  const [m] = expenseMessages({ ...NOTICE, roomName: '1-1-1' }, [
    { uid: 'thuva', tokens: ['ExponentPushToken[a]'], share: 100, paid: 0 },
  ]);
  assert.equal(m.title, 'Ramesh added an expense in 1-1-1');
});

test('an edit is not announced as a new expense', () => {
  const [m] = expenseMessages({ ...NOTICE, kind: 'updated' }, [
    { uid: 'thuva', tokens: ['ExponentPushToken[a]'], share: 100, paid: 0 },
  ]);
  assert.equal(m.title, 'Ramesh changed an expense');
});

test('nobody is pinged about money that does not move for them', () => {
  // Not a participant in any meaningful sense — no share, nothing paid.
  const messages = expenseMessages(NOTICE, [
    { uid: 'nimal', tokens: ['ExponentPushToken[c]'], share: 0, paid: 0 },
  ]);
  assert.equal(messages.length, 0);
});

test('one message per device, so a second phone is not left out', () => {
  const messages = expenseMessages(NOTICE, [
    { uid: 'thuva', tokens: ['ExponentPushToken[a]', 'ExponentPushToken[b]'], share: 500, paid: 0 },
  ]);
  assert.equal(messages.length, 2);
  assert.deepEqual(messages.map((m) => m.to), ['ExponentPushToken[a]', 'ExponentPushToken[b]']);
});

test('a settlement tells the receiver who paid them', () => {
  const [m] = settlementMessages(
    { settlementId: 's1', payerName: 'Thuva', amount: 50000, roomName: null },
    ['ExponentPushToken[a]'],
  );
  assert.equal(m.body, 'Thuva paid you Rs 500.00');
  assert.equal(m.data.settlementId, 's1');
});

test('sending is chunked to Expo’s limit, losing nothing', () => {
  const many = Array.from({ length: 250 }, (_, i) => ({
    to: `ExponentPushToken[${i}]`, title: 't', body: 'b', data: {},
  }));
  const chunks = chunkMessages(many);
  assert.deepEqual(chunks.map((c) => c.length), [100, 100, 50]);
  assert.equal(chunks.flat().length, 250, 'no message dropped');
});

test('only real Expo tokens are treated as sendable', () => {
  assert.ok(isExpoPushToken('ExponentPushToken[abc123]'));
  assert.ok(isExpoPushToken('ExpoPushToken[abc123]'));
  assert.ok(!isExpoPushToken('abc123'));
  assert.ok(!isExpoPushToken(null));
  assert.ok(!isExpoPushToken(''));
});
