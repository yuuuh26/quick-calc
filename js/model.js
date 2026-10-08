import { Decimal, evaluate, checked, numberValue, expressionText, LIMIT } from './engine.js';
import { formatValue } from './format.js';
const copy = tokens => tokens.map(t => ({ ...t }));
export class Calculator {
  constructor(saved = {}) {
    if (!saved || typeof saved !== 'object' || Array.isArray(saved)) saved = {};
    this.tokens = []; this.result = new Decimal(0); this.finalized = false; this.error = ''; this.notice = '';
    this.memory = new Decimal(0); this.memoryUsed = false; this.history = [];
    try { this.memory = numberValue(saved.memory || '0'); this.memoryUsed = saved.memoryUsed === true; } catch {}
    if (Array.isArray(saved.history)) {
      for (const entry of saved.history.slice(0, 100)) {
        try {
          if (!Array.isArray(entry.tokens) || !entry.tokens.length || entry.tokens.at(-1).op) continue;
          const value = evaluate(entry.tokens);
          if (!value.eq(numberValue(entry.result))) continue;
          this.history.push({ tokens: copy(entry.tokens), result: value.toString() });
        } catch {}
      }
    }
  }
  get text() { return expressionText(this.tokens) || '0'; }
  get display() { return this.error ? 'Error' : formatValue(this.result); }
  get incomplete() { return !!this.tokens.at(-1)?.op; }
  snapshot() { return { memory: this.memory.toString(), memoryUsed: this.memoryUsed, history: this.history }; }
  recompute() {
    this.error = '';
    if (!this.tokens.length) { this.result = new Decimal(0); return; }
    const tokens = this.incomplete ? this.tokens.slice(0, -1) : this.tokens;
    try { this.result = evaluate(tokens); } catch (e) { this.error = e.message; }
  }
  clear() { this.tokens = []; this.result = new Decimal(0); this.finalized = false; this.error = ''; }
  input(key) {
    this.notice = '';
    if (key === 'AC') { this.clear(); return; }
    if (key === 'MC') { this.memory = new Decimal(0); this.memoryUsed = false; return; }
    if (key === 'M+' || key === 'M-') {
      if (this.error) { this.notice = 'エラーを直してから操作してください'; return; }
      try { this.memory = checked(key === 'M+' ? this.memory.plus(this.result) : this.memory.minus(this.result)); this.memoryUsed = true; }
      catch (e) { this.notice = e.message; } return;
    }
    if (key === 'MR') {
      if (this.finalized) this.clear();
      const before = copy(this.tokens);
      const token = { raw: this.memory.toString(), percent: false };
      if (!this.tokens.length || this.incomplete) this.tokens.push(token); else this.tokens[this.tokens.length - 1] = token;
      if (this.text.length > LIMIT) { this.tokens = before; this.notice = '計算式が長すぎます'; }
      this.recompute(); return;
    }
    if (key === '=') {
      if (this.incomplete) { this.notice = '式の続きを入力してください'; return; }
      if (this.error || !this.tokens.length || this.finalized) return;
      this.recompute(); if (this.error) return;
      this.history.unshift({ tokens: copy(this.tokens), result: this.result.toString() });
      this.history.length = Math.min(100, this.history.length); this.finalized = true; return;
    }
    if (key === 'back') {
      this.finalized = false;
      const last = this.tokens.at(-1); if (!last) return;
      if (last.op) this.tokens.pop();
      else if (last.percent) last.percent = false;
      else if (/e/i.test(last.raw)) this.tokens.pop();
      else { last.raw = last.raw.slice(0, -1); if (!last.raw || last.raw === '-') this.tokens.pop(); }
      this.recompute(); return;
    }
    if (['+', '-', '*', '/'].includes(key)) {
      if (this.error) return;
      if (this.finalized) { this.tokens = [{ raw: this.result.toString(), percent: false }]; this.finalized = false; }
      if (!this.tokens.length) this.tokens.push({ raw: '0', percent: false });
      if (this.incomplete) this.tokens[this.tokens.length - 1] = { op: key }; else this.tokens.push({ op: key });
      if (this.text.length > LIMIT) { this.tokens.pop(); this.notice = '計算式が長すぎます'; }
      this.recompute(); return;
    }
    if (key === 'sign') {
      if (this.finalized) { this.tokens = [{ raw: this.result.toString(), percent: false }]; this.finalized = false; }
      if (!this.tokens.length || this.incomplete) this.tokens.push({ raw: '-0', percent: false });
      else { const last = this.tokens.at(-1); last.raw = last.raw.startsWith('-') ? last.raw.slice(1) : '-' + last.raw; }
      this.recompute(); return;
    }
    if (key === '%') {
      if (this.error) return;
      if (this.finalized) { this.tokens = [{ raw: this.result.toString(), percent: false }]; this.finalized = false; }
      const last = this.tokens.at(-1); if (last && !last.op) last.percent = true;
      this.recompute(); return;
    }
    if (!/^\d$/.test(key) && key !== '.') return;
    if (this.finalized) this.clear();
    const before = copy(this.tokens);
    if (!this.tokens.length || this.incomplete) this.tokens.push({ raw: '0', percent: false });
    const last = this.tokens.at(-1);
    if (last.percent || /e/i.test(last.raw)) { last.raw = '0'; last.percent = false; }
    if (key === '.') { if (!last.raw.includes('.')) last.raw += '.'; }
    else if (last.raw === '0' || last.raw === '-0') last.raw = (last.raw[0] === '-' ? '-' : '') + key;
    else last.raw += key;
    if (last.raw.length > 80 || this.text.length > LIMIT) { this.tokens = before; this.notice = '入力できる桁数を超えています'; }
    this.recompute();
  }
  reuse(index) {
    const entry = this.history[index]; if (!entry) return;
    this.tokens = copy(entry.tokens); this.result = new Decimal(entry.result); this.finalized = true; this.error = ''; this.notice = '';
  }
}
