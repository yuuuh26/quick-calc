import DecimalLibrary from '../vendor/decimal.mjs';

export const Decimal = DecimalLibrary.clone({ precision: 40, rounding: DecimalLibrary.ROUND_HALF_UP });
export class CalcError extends Error {
  constructor(code, message) { super(message); this.code = code; }
}
const symbols = { '+': '+', '-': '−', '*': '×', '/': '÷' };
export const LIMIT = 1200;
export function checked(value) {
  if (!value.isFinite() || (!value.isZero() && Math.abs(value.e) > 9999)) {
    throw new CalcError('range', '計算できる数の範囲を超えています');
  }
  return value.isZero() ? new Decimal(0) : value;
}
export function numberValue(raw) {
  if (typeof raw !== 'string' || raw.length > 100 || !/^-?(?:\d+(?:\.\d*)?|\.\d+)(?:e[+-]?\d{1,4})?$/i.test(raw)) {
    throw new CalcError('syntax', '計算式を確認してください');
  }
  return checked(new Decimal(raw));
}
export function expressionText(tokens) {
  return tokens.map(t => t.op ? symbols[t.op] : t.raw.replace(/^-/, '−') + (t.percent ? '%' : '')).join(' ');
}
export function tokenize(expression) {
  const text = expression.replaceAll('−', '-').replaceAll('×', '*').replaceAll('÷', '/');
  if (text.length > LIMIT) throw new CalcError('limit', '計算式が長すぎます');
  const tokens = []; let at = 0, wantsNumber = true;
  while (at < text.length) {
    if (/\s/.test(text[at])) { at++; continue; }
    if (wantsNumber) {
      const match = text.slice(at).match(/^-?(?:\d+(?:\.\d*)?|\.\d+)(?:e[+-]?\d{1,4})?/i);
      if (!match) throw new CalcError('syntax', '計算式を確認してください');
      const raw = match[0]; numberValue(raw); at += raw.length;
      while (/\s/.test(text[at] || '') && at < text.length) at++;
      const percent = text[at] === '%'; if (percent) at++;
      tokens.push({ raw, percent }); wantsNumber = false;
    } else {
      if (!['+', '-', '*', '/'].includes(text[at])) throw new CalcError('syntax', '計算式を確認してください');
      tokens.push({ op: text[at++] }); wantsNumber = true;
    }
  }
  return tokens;
}
// A bare percentage after + or − is relative to the accumulated left side.
// In × or ÷ terms, percentages are ordinary rates (10% = 0.1).
export function evaluate(input) {
  const tokens = typeof input === 'string' ? tokenize(input) : input;
  if (!Array.isArray(tokens) || !tokens.length || tokens.at(-1).op) {
    throw new CalcError('incomplete', '式の続きを入力してください');
  }
  if (expressionText(tokens).length > LIMIT) throw new CalcError('limit', '計算式が長すぎます');
  let at = 0;
  function operand() {
    const token = tokens[at++];
    if (!token || token.op) throw new CalcError('syntax', '計算式を確認してください');
    const value = numberValue(token.raw);
    return { value: token.percent ? value.div(100) : value, relative: !!token.percent };
  }
  function product() {
    let term = operand();
    while (['*', '/'].includes(tokens[at]?.op)) {
      const op = tokens[at++].op, rhs = operand();
      if (op === '/' && rhs.value.isZero()) throw new CalcError('zero', '0で割ることはできません');
      term = { value: checked(op === '*' ? term.value.times(rhs.value) : term.value.div(rhs.value)), relative: false };
    }
    return term;
  }
  let left = product().value;
  while (at < tokens.length) {
    const op = tokens[at++]?.op;
    if (!['+', '-'].includes(op)) throw new CalcError('syntax', '計算式を確認してください');
    const rhs = product(), value = rhs.relative ? left.times(rhs.value) : rhs.value;
    left = checked(op === '+' ? left.plus(value) : left.minus(value));
  }
  return checked(left);
}
