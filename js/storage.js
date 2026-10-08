const KEY = 'yuu.quick-calc.user.v1';
export function load() {
  try {
    const data = JSON.parse(localStorage.getItem(KEY) || '{}');
    return data && typeof data === 'object' && !Array.isArray(data) ? { data, ok: true } : { data: {}, ok: false };
  }
  catch { return { data: {}, ok: false }; }
}
export function save(data) {
  try { localStorage.setItem(KEY, JSON.stringify(data)); return true; } catch { return false; }
}
