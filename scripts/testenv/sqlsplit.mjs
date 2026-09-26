// Splits a SQL script into statements, respecting quotes, comments and dollar-quoting.
export function splitSql(sql) {
  const out = []; let cur = ''; let i = 0; const n = sql.length;
  while (i < n) {
    const c = sql[i], d = sql[i + 1];
    if (c === '-' && d === '-') { const e = sql.indexOf('\n', i); const end = e < 0 ? n : e; cur += sql.slice(i, end); i = end; continue; }
    if (c === '/' && d === '*') { const e = sql.indexOf('*/', i + 2); const end = e < 0 ? n : e + 2; cur += sql.slice(i, end); i = end; continue; }
    if (c === "'") { let j = i + 1; while (j < n) { if (sql[j] === "'" && sql[j + 1] === "'") j += 2; else if (sql[j] === "'") break; else j++; } cur += sql.slice(i, j + 1); i = j + 1; continue; }
    if (c === '$') { const m = /^\$[A-Za-z0-9_]*\$/.exec(sql.slice(i, i + 40)); if (m) { const tag = m[0]; const e = sql.indexOf(tag, i + tag.length); const end = e < 0 ? n : e + tag.length; cur += sql.slice(i, end); i = end; continue; } }
    if (c === ';') { if (cur.trim()) out.push(cur.trim()); cur = ''; i++; continue; }
    cur += c; i++;
  }
  if (cur.trim()) out.push(cur.trim());
  return out.filter((x) => x.split('\n').some((l) => l.trim() && !l.trim().startsWith('--')));
}
