// Pure helpers for the Business desk's Open times tab (src/pages/dashboard/OpenTimes.jsx).

// Times grouped by the day they start on, in the business's time zone, in the order given.
export function groupByDay(times, timeZone) {
  const day = (iso) => new Date(iso).toLocaleDateString('en-US', { timeZone, weekday: 'short', month: 'short', day: 'numeric' });
  const out = [];
  for (const t of times) {
    const label = day(t.start_at), last = out[out.length - 1];
    if (last && last.label === label) last.times.push(t); else out.push({ label, times: [t] });
  }
  return out;
}
