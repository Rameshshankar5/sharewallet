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
const { pairwiseFromExpense, buildLedger, simplify } = require('../.math-build/balance');

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
