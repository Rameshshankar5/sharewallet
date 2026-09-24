/**
 * The calculator behind the amount fields: "1200 + 350 × 2" → Rs 1,900.00.
 *
 * Hand-written rather than `eval`: the input is only ever digits, a decimal
 * point and four operators, and a parser this small can be exhaustively
 * tested, which matters more here than anywhere — its answer becomes money.
 *
 * Multiplication and division bind tighter than addition and subtraction, as
 * on any calculator people are used to. The working is done in ordinary
 * numbers and rounded to the cent once, at the end, so "1000 ÷ 3 × 3" comes
 * back as 1000.00 rather than 999.99.
 */

export type Operator = '+' | '-' | '*' | '/';

export const OPERATORS: readonly Operator[] = ['+', '-', '*', '/'];

/** How each operator is shown: real minus, times and divide signs. */
export const OPERATOR_GLYPH: Record<Operator, string> = {
  '+': '+', '-': '−', '*': '×', '/': '÷',
};

export type CalcResult =
  | { kind: 'empty' }
  | { kind: 'ok'; cents: number }
  | { kind: 'error'; message: string };

const MAX_LENGTH = 80;
/** Larger than any real bill, small enough that cents stay exact in a double. */
const MAX_CENTS = 99_999_999_999;

function isOperator(ch: string): ch is Operator {
  return (OPERATORS as readonly string[]).includes(ch);
}

/** The number being typed at the end of the expression, if any. */
function lastNumber(expr: string): string {
  const m = expr.match(/[0-9.]*$/);
  return m ? m[0] : '';
}

/**
 * Apply one keypad press. Presses that would make the expression malformed are
 * ignored or corrected rather than accepted, so the expression on screen is
 * always one that can be evaluated.
 */
export function press(expr: string, key: string): string {
  if (key === 'C') return '';
  if (key === 'back') return expr.slice(0, -1);
  if (expr.length >= MAX_LENGTH) return expr;

  const last = expr.slice(-1);

  if (isOperator(key)) {
    if (!expr) return ''; // Nothing to operate on yet.
    if (last === '.') return `${expr.slice(0, -1)}${key}`; // "12." then "+" means "12+".
    if (isOperator(last)) return `${expr.slice(0, -1)}${key}`; // Changed their mind.
    return expr + key;
  }

  if (key === '.') {
    const current = lastNumber(expr);
    if (current.includes('.')) return expr;
    return expr + (current ? '.' : '0.');
  }

  if (/^[0-9]+$/.test(key)) {
    const current = lastNumber(expr);
    const decimals = current.includes('.') ? current.split('.')[1].length : 0;
    if (current.includes('.') && decimals + key.length > 2) return expr; // Cents only.
    // No "007": a leading zero is replaced, unless a decimal point follows.
    if (current === '0') return expr.slice(0, -1) + (key === '00' ? '0' : key);
    if (!current && key === '00') return `${expr}0`;
    return expr + key;
  }

  return expr;
}

/** Work out an expression. A trailing operator is ignored, as it is mid-typing. */
export function evaluate(raw: string): CalcResult {
  let expr = raw.replace(/\s+/g, '');
  while (expr && (isOperator(expr.slice(-1)) || expr.endsWith('.'))) expr = expr.slice(0, -1);
  if (!expr) return { kind: 'empty' };
  if (!/^[0-9.+\-*/]+$/.test(expr)) return { kind: 'error', message: 'Only numbers and + − × ÷ work here.' };

  const tokens = expr.match(/[0-9]*\.?[0-9]+|[0-9]+\.?|[+\-*/]/g) ?? [];
  if (tokens.join('') !== expr) return { kind: 'error', message: 'That sum does not add up.' };

  // Numbers and operators must alternate, starting and ending on a number.
  const numbers: number[] = [];
  const ops: Operator[] = [];
  for (let i = 0; i < tokens.length; i++) {
    const t = tokens[i];
    if (i % 2 === 0) {
      if (isOperator(t)) return { kind: 'error', message: 'That sum does not add up.' };
      const n = Number(t);
      if (!Number.isFinite(n)) return { kind: 'error', message: 'That sum does not add up.' };
      numbers.push(n);
    } else {
      if (!isOperator(t)) return { kind: 'error', message: 'That sum does not add up.' };
      ops.push(t);
    }
  }

  // × and ÷ first, folding each run into a single term.
  const terms: number[] = [numbers[0]];
  const addOps: Operator[] = [];
  for (let i = 0; i < ops.length; i++) {
    const op = ops[i];
    const next = numbers[i + 1];
    if (op === '*' || op === '/') {
      if (op === '/' && next === 0) return { kind: 'error', message: 'Cannot divide by zero.' };
      const prev = terms.pop()!;
      terms.push(op === '*' ? prev * next : prev / next);
    } else {
      addOps.push(op);
      terms.push(next);
    }
  }

  let total = terms[0];
  for (let i = 0; i < addOps.length; i++) {
    total = addOps[i] === '+' ? total + terms[i + 1] : total - terms[i + 1];
  }

  // Round to the cent once. The epsilon absorbs binary-fraction noise such as
  // 1.005 being stored as 1.00499999…, so what people see is what they typed.
  const cents = Math.round(total * 100 + (total >= 0 ? 1e-7 : -1e-7));
  if (!Number.isFinite(cents) || Math.abs(cents) > MAX_CENTS) {
    return { kind: 'error', message: 'That number is too large.' };
  }
  return { kind: 'ok', cents: cents === 0 ? 0 : cents };
}

/** "1200+350*2" → "1,200 + 350 × 2", for the display above the keypad. */
export function prettyExpression(expr: string): string {
  return expr
    .split(/([+\-*/])/)
    .map((part) => {
      if (isOperator(part)) return ` ${OPERATOR_GLYPH[part]} `;
      const [whole, frac] = part.split('.');
      const grouped = whole.replace(/\B(?=(\d{3})+(?!\d))/g, ',');
      return frac !== undefined ? `${grouped}.${frac}` : grouped;
    })
    .join('');
}

/** True when there is actually a sum to show, not just one number. */
export function hasOperator(expr: string): boolean {
  return /[0-9.][+\-*/][0-9.]/.test(expr);
}
