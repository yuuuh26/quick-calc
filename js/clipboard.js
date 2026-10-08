export function calculationText({ expression, result, incomplete = false }) {
  return incomplete ? `${expression}\n途中結果: ${result}` : `${expression} = ${result}`;
}
export function renderCalculation({ expression, result, incomplete = false }, colors) {
  const canvas = document.createElement('canvas'), ctx = canvas.getContext('2d');
  const width = 960, pad = 64, available = width - pad * 2;
  ctx.font = '32px system-ui, sans-serif';
  const lines = []; let line = '';
  for (const character of expression) {
    if (ctx.measureText(line + character).width > available && line) { lines.push(line.trim()); line = character; }
    else line += character;
  }
  if (line) lines.push(line.trim());
  canvas.width = width; canvas.height = pad * 2 + lines.length * 48 + 112;
  ctx.fillStyle = colors.background; ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.fillStyle = colors.expression; ctx.font = '32px system-ui, sans-serif'; ctx.textBaseline = 'top';
  lines.forEach((text, i) => ctx.fillText(text, pad, pad + i * 48));
  const answer = `${incomplete ? '途中結果: ' : '= '}${result}`;
  let size = 68; ctx.font = `600 ${size}px system-ui, sans-serif`;
  while (ctx.measureText(answer).width > available && size > 24) ctx.font = `600 ${--size}px system-ui, sans-serif`;
  ctx.fillStyle = colors.result; ctx.textAlign = 'right';
  ctx.fillText(answer, width - pad, pad + lines.length * 48 + 30);
  return canvas;
}
function legacyTextCopy(text) {
  const area = document.createElement('textarea'); area.value = text; area.className = 'clipboard-helper';
  area.setAttribute('aria-hidden', 'true'); document.body.append(area); area.select();
  let success = false; try { success = document.execCommand('copy'); } catch {} area.remove();
  return success;
}
export async function copyText(text) {
  try { if (navigator.clipboard?.writeText) { await navigator.clipboard.writeText(text); return true; } } catch {}
  return legacyTextCopy(text);
}
export async function copyCalculation(data, colors) {
  const text = calculationText(data);
  if (globalThis.isSecureContext && navigator.clipboard?.write && globalThis.ClipboardItem) {
    try {
      const canvas = renderCalculation(data, colors);
      const png = new Promise((resolve, reject) => canvas.toBlob(blob => blob ? resolve(blob) : reject(new Error('PNG作成失敗')), 'image/png'));
      // Start write in the user gesture; PNG encoding can complete asynchronously.
      await navigator.clipboard.write([new ClipboardItem({ 'image/png': png, 'text/plain': new Blob([text], { type: 'text/plain' }) })]);
      return { kind: 'image', text };
    } catch {}
  }
  return { kind: await copyText(text) ? 'text' : 'manual', text };
}
