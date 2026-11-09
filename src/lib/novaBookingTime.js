// Owner scheduling uses an explicit Eastern-time wall clock, independent of device timezone.
const wallParts = value => Object.fromEntries(new Intl.DateTimeFormat('en-CA', {
  timeZone: 'America/New_York', year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', hourCycle: 'h23',
}).formatToParts(new Date(value)).filter(p => p.type !== 'literal').map(p => [p.type, p.value]));
const wallKey = value => { const p = wallParts(value); return `${p.year}-${p.month}-${p.day}T${p.hour}:${p.minute}`; };
export function fromEasternTime(input) {
  if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(input)) throw new Error('Enter a date and time.');
  const [year, month, day, hour, minute] = input.split(/[-T:]/).map(Number);
  const desired = Date.UTC(year, month - 1, day, hour, minute);
  let guess = desired;
  for (let i = 0; i < 4; i++) {
    const p = wallParts(guess);
    const represented = Date.UTC(+p.year, +p.month - 1, +p.day, +p.hour, +p.minute);
    const correction = desired - represented;
    guess += correction;
    if (!correction) break;
  }
  if (wallKey(guess) !== input || wallKey(guess - 3600000) === input || wallKey(guess + 3600000) === input) {
    throw new Error('Choose a time outside the daylight-saving clock change.');
  }
  return new Date(guess).toISOString();
}
export function formatEasternTime(value) {
  return new Intl.DateTimeFormat('en-US', { timeZone: 'America/New_York', weekday: 'short', month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit', timeZoneName: 'short' }).format(new Date(value));
}
