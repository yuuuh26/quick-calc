"""Independent arithmetic corpus: Python decimal, fixed seed, 40 significant digits."""
import decimal, json, random
from pathlib import Path
decimal.getcontext().prec = 40
decimal.getcontext().rounding = decimal.ROUND_HALF_UP
rng = random.Random(101008)
cases = []
for _ in range(800):
    numbers = [str(decimal.Decimal(rng.randint(-999999, 999999)).scaleb(-rng.randint(0, 7))) for _ in range(rng.randint(2, 9))]
    operators = [rng.choice('+-*/') for _ in numbers[1:]]
    expression = numbers[0]
    values, ops = [decimal.Decimal(numbers[0])], []
    def apply():
        right, left, op = values.pop(), values.pop(), ops.pop()
        values.append({'+': lambda: left+right, '-': lambda: left-right, '*': lambda: left*right, '/': lambda: left/right}[op]())
    for op, number in zip(operators, numbers[1:]):
        expression += ' ' + op + ' ' + number
        while ops and (2 if ops[-1] in '*/' else 1) >= (2 if op in '*/' else 1): apply()
        ops.append(op); values.append(decimal.Decimal(number))
    while ops: apply()
    cases.append({'expression': expression, 'result': str(values[0])})
Path(__file__).with_name('oracle-corpus.json').write_text(json.dumps(cases, indent=2)+'\n')
