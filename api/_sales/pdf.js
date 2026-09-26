// Minimal dependency-free PDF writer (text only, standard Helvetica/Courier, Letter size, automatic page breaks).
// Used for downloadable signed agreements and certificates. Not a layout engine: headings, paragraphs, monospace lines.
const PAGE_W = 612, PAGE_H = 792, MARGIN = 56;
const STYLES = { h1: { font: 'F2', size: 18, lead: 24, before: 4, after: 6 }, h2: { font: 'F2', size: 13, lead: 18, before: 10, after: 2 }, p: { font: 'F1', size: 10.5, lead: 14.5, before: 0, after: 4 }, mono: { font: 'F3', size: 8.5, lead: 11.5, before: 0, after: 2 }, small: { font: 'F1', size: 8.5, lead: 11.5, before: 2, after: 2 } };
const latin = (s) => String(s ?? '').replace(/[‘’]/g, "'").replace(/[“”]/g, '"').replace(/[–—]/g, '-').replace(/…/g, '...').replace(/[^\x09\x0A\x0D\x20-\x7E\xA0-\xFF]/g, '?');
const esc = (s) => latin(s).replace(/\\/g, '\\\\').replace(/\(/g, '\\(').replace(/\)/g, '\\)');
const charW = (font, size) => size * (font === 'F3' ? 0.6 : font === 'F2' ? 0.56 : 0.52);
function wrap(text, font, size, maxW) {
  const out = [];
  for (const para of latin(text).split('\n')) {
    if (!para.trim()) { out.push(''); continue; }
    let line = '';
    for (const word of para.split(/\s+/)) {
      const candidate = line ? `${line} ${word}` : word;
      if (candidate.length * charW(font, size) <= maxW) line = candidate;
      else { if (line) out.push(line); let w = word; while (w.length * charW(font, size) > maxW) { const n = Math.floor(maxW / charW(font, size)); out.push(w.slice(0, n)); w = w.slice(n); } line = w; }
    }
    out.push(line);
  }
  return out;
}
// blocks: [{ style: 'h1'|'h2'|'p'|'mono'|'small', text }]  (style 'gap' adds vertical space)
export function textPdf({ title = 'Document', blocks = [] }) {
  const pages = []; let cur = []; let y = PAGE_H - MARGIN;
  const newPage = () => { pages.push(cur); cur = []; y = PAGE_H - MARGIN; };
  for (const b of blocks) {
    if (b.style === 'gap') { y -= 10; continue; }
    const st = STYLES[b.style] || STYLES.p; y -= st.before;
    for (const line of wrap(b.text, st.font, st.size, PAGE_W - 2 * MARGIN)) {
      if (y - st.lead < MARGIN) newPage();
      y -= st.lead; if (line) cur.push(`BT /${st.font} ${st.size} Tf ${MARGIN} ${y.toFixed(1)} Td (${esc(line)}) Tj ET`);
    }
    y -= st.after;
  }
  pages.push(cur);
  const objs = []; const add = (s) => { objs.push(s); return objs.length; };
  const f1 = add('<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica /Encoding /WinAnsiEncoding >>');
  const f2 = add('<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold /Encoding /WinAnsiEncoding >>');
  const f3 = add('<< /Type /Font /Subtype /Type1 /BaseFont /Courier /Encoding /WinAnsiEncoding >>');
  const contentIds = pages.map((p) => { const body = p.join('\n'); return add(`<< /Length ${Buffer.byteLength(body, 'latin1')} >>\nstream\n${body}\nendstream`); });
  const pagesId = objs.length + pages.length + 1;
  const pageIds = contentIds.map((cid) => add(`<< /Type /Page /Parent ${pagesId} 0 R /MediaBox [0 0 ${PAGE_W} ${PAGE_H}] /Resources << /Font << /F1 ${f1} 0 R /F2 ${f2} 0 R /F3 ${f3} 0 R >> >> /Contents ${cid} 0 R >>`));
  add(`<< /Type /Pages /Kids [${pageIds.map((i) => `${i} 0 R`).join(' ')}] /Count ${pageIds.length} >>`);
  const catalog = add(`<< /Type /Catalog /Pages ${pagesId} 0 R >>`);
  const info = add(`<< /Title (${esc(title)}) /Producer (Nova Systems) >>`);
  let out = '%PDF-1.4\n'; const offsets = [];
  objs.forEach((o, i) => { offsets.push(Buffer.byteLength(out, 'latin1')); out += `${i + 1} 0 obj\n${o}\nendobj\n`; });
  const xref = Buffer.byteLength(out, 'latin1');
  out += `xref\n0 ${objs.length + 1}\n0000000000 65535 f \n${offsets.map((o) => `${String(o).padStart(10, '0')} 00000 n \n`).join('')}trailer\n<< /Size ${objs.length + 1} /Root ${catalog} 0 R /Info ${info} 0 R >>\nstartxref\n${xref}\n%%EOF\n`;
  return Buffer.from(out, 'latin1');
}
