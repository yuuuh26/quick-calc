import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { Decimal, evaluate, tokenize } from '../js/engine.js';
import { formatValue } from '../js/format.js';
const cases = [
  ['0.1 + 0.2', '0.3'], ['1.2 * 3', '3.6'], ['10 / 4', '2.5'], ['12.5 * 8 + 320 / 4', '180'],
  ['1 - 2', '-1'], ['200 + 10%', '220'], ['200 - 10%', '180'], ['200 * 10%', '20'], ['200 / 10%', '2000'],
  ['-5 * -3', '15'], ['5 + -2', '3'], ['-0.1 - 0.2', '-0.3'], ['0.3 / 0.1', '3'],
  ['1.23456789 * 100000000', '123456789'], ['2 + 3 * 4 - 10 / 2', '9'], ['24 / 3 / 2', '4'],
  ['1 - 2 - 3', '-4'], ['10 - -2 * 3', '16'], ['0%', '0'], ['100 + 20 + 10%', '132'],
  ['200 * 10% + 10%', '22'], ['200 + 10% * 2', '200.2'], ['200 - -10%', '220'],
  ['200 + 10% + 10%', '242'], ['200 / -10%', '-2000'], ['1e99 * 1e99', '1e198'],
  ['1e-100 * 1e-100', '1e-200'], ['999999999999999 + 1', '1000000000000000'],
  ['1000000000000000000000000000000 + 1 - 1000000000000000000000000000000', '1'],
  [Array(120).fill('0.1').join('+'), '12'], ['1.000000000000000000000000000000000000001 - 1', '1e-39'],
  ['−2 × 3 + 8 ÷ 4', '-4'], ['12.', '12'], ['.5 + .25', '0.75']
];
for (const [expression, result] of cases) test(expression, () => assert.ok(evaluate(expression).eq(new Decimal(result))));
for (const expression of ['10/0', '1/-0', '200/0%', '0/0']) test('0除算: '+expression, () => assert.throws(() => evaluate(expression), { code: 'zero' }));
for (const expression of ['', '12+', '1.2.3', '1%%', 'Math.random()', '1;alert(1)', '1e99999', '1**2']) test('不正入力: '+expression, () => assert.throws(() => evaluate(expression)));
test('範囲超過はInfinityを返さない', () => assert.throws(() => evaluate('1e9999 * 10'), { code: 'range' }));
test('内部40有効桁', () => assert.equal(evaluate('1/3').toFixed(), '0.' + '3'.repeat(40)));
test('丸めは表示段階だけ', () => { const x = evaluate('1/3'); assert.equal(formatValue(x), '0.333333333333333'); assert.equal(x.toFixed(), '0.' + '3'.repeat(40)); });
for (const [raw, expected] of [['2.50000000', '2.5'], ['-0', '0'], ['1.234567890123444', '1.23456789012344'], ['1.234567890123445', '1.23456789012345'], ['-1.234567890123445', '-1.23456789012345'], ['999999999999999.5', '1e+15'], ['1e-7', '1e-7'], ['1e-6', '0.000001'], ['1e200', '1e+200']]) {
  test('表示: '+raw, () => assert.equal(formatValue(raw), expected));
}
test('文字列/トークン解析が同じ', () => assert.equal(evaluate(tokenize('200 + 10%')).toString(), '220'));
const corpus = JSON.parse(readFileSync(new URL('./oracle-corpus.json', import.meta.url)));
test(`Python Decimalとの独立照合 ${corpus.length}式`, () => { for (const { expression, result } of corpus) assert.ok(evaluate(expression).eq(result), expression); });
