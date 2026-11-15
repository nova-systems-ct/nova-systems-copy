// Industry packs: a ready list of services for a trade, so a new business starts with its own
// words instead of a blank form. A pack never sets a price. Every service arrives unpriced and
// unapproved, so the agents cannot quote it until the owner sets and approves a price.
// `return_days` is the usual time before a customer needs the service again; Revive uses it and
// the owner can change it.
export const INDUSTRY_PACKS = Object.freeze({
  lawn_care: { name: 'Lawn care', services: [
    { name: 'Lawn mowing', description: 'Mow, trim the edges and clear the clippings.', keywords: ['mow', 'mowing', 'grass', 'lawn cut'], return_days: 14 },
    { name: 'Leaf and yard cleanup', description: 'Rake, bag and remove leaves and yard debris.', keywords: ['leaves', 'leaf', 'yard cleanup', 'fall cleanup', 'spring cleanup'], return_days: 180 },
    { name: 'Hedge and shrub trimming', description: 'Shape hedges and shrubs and remove the cuttings.', keywords: ['hedge', 'hedges', 'shrubs', 'bushes'], return_days: 90 },
    { name: 'Snow shovelling', description: 'Clear walkways, steps and driveways after a storm.', keywords: ['snow', 'shovel', 'shovelling', 'shoveling'], return_days: null },
  ] },
  car_detailing: { name: 'Car detailing', services: [
    { name: 'Exterior wash and wax', description: 'Hand wash, dry and wax.', keywords: ['wash', 'wax', 'exterior'], return_days: 30 },
    { name: 'Interior detail', description: 'Vacuum, wipe down and clean the seats, mats and glass.', keywords: ['interior', 'vacuum', 'seats', 'inside'], return_days: 60 },
    { name: 'Full detail', description: 'Interior and exterior together.', keywords: ['full detail', 'complete detail', 'inside and out'], return_days: 90 },
  ] },
  window_cleaning: { name: 'Window cleaning', services: [
    { name: 'Exterior window cleaning', description: 'Outside glass, frames and sills.', keywords: ['outside windows', 'exterior windows'], return_days: 120 },
    { name: 'Interior and exterior window cleaning', description: 'Both sides of the glass, frames and sills.', keywords: ['inside and outside windows', 'all windows'], return_days: 120 },
    { name: 'Storefront window cleaning', description: 'Regular cleaning for shop and office fronts.', keywords: ['storefront', 'shop windows', 'office windows'], return_days: 14 },
  ] },
  barbershop: { name: 'Barbershop', services: [
    { name: 'Haircut', description: 'Cut and style.', keywords: ['haircut', 'cut', 'fade', 'trim'], return_days: 21 },
    { name: 'Beard trim', description: 'Shape and line up.', keywords: ['beard', 'line up', 'lineup'], return_days: 14 },
    { name: 'Haircut and beard', description: 'Cut, style and beard together.', keywords: ['cut and beard', 'haircut and beard'], return_days: 21 },
  ] },
  home_services: { name: 'Home services (plumbing, heating and cooling)', services: [
    { name: 'Repair visit', description: 'Diagnose and fix a problem.', keywords: ['repair', 'broken', 'leak', 'leaking', 'not working', 'no heat', 'no hot water'], return_days: null },
    { name: 'Seasonal tune-up', description: 'Check, clean and test the system before the season.', keywords: ['tune up', 'tune-up', 'maintenance', 'service check'], return_days: 365 },
    { name: 'Estimate for replacement or installation', description: 'Visit to measure and price a new system or fixture.', keywords: ['install', 'installation', 'replace', 'replacement', 'new unit'], return_days: null },
  ] },
  auto_repair: { name: 'Auto repair', services: [
    { name: 'Oil change', description: 'Oil and filter change with a basic check.', keywords: ['oil change', 'oil'], return_days: 120 },
    { name: 'Brake service', description: 'Inspect and replace pads or rotors as needed.', keywords: ['brakes', 'brake pads', 'rotors'], return_days: null },
    { name: 'Diagnostic check', description: 'Find the cause of a warning light or problem.', keywords: ['check engine', 'diagnostic', 'warning light', 'noise'], return_days: null },
    { name: 'Tire rotation and seasonal change', description: 'Rotate tires or swap seasonal sets.', keywords: ['tires', 'tire rotation', 'winter tires'], return_days: 180 },
  ] },
  marketing_agency: { name: 'Marketing', services: [
    { name: 'Mystery box campaign', description: 'Personal packages delivered to the business owners you want to meet, with follow-up.', keywords: ['mystery box', 'boxes', 'gifts', 'gifting'], return_days: null },
    { name: 'Content day', description: 'One day of filming at your business and on the street, turned into a month of posts.', keywords: ['content day', 'filming', 'video', 'street interviews'], return_days: 30 },
    { name: 'Event', description: 'Planning and running a customer or owner event.', keywords: ['event', 'grand opening', 'pop-up', 'pop up'], return_days: null },
  ] },
});

// Adds a pack's services to a business. Services the business already has (by name) are left
// exactly as they are. Returns what was added and what was skipped.
export async function applyPack(db, orgId, packKey) {
  const pack = Object.hasOwn(INDUSTRY_PACKS, packKey) ? INDUSTRY_PACKS[packKey] : null;
  if (!pack) throw Object.assign(new Error(`Unknown pack. Choose one of: ${Object.keys(INDUSTRY_PACKS).join(', ')}`), { expected: true, status: 422 });
  const have = new Set((await db.select('business_services', { organization_id: orgId })).map((s) => s.name.toLowerCase()));
  const added = [], skipped = [];
  for (const s of pack.services) {
    if (have.has(s.name.toLowerCase())) { skipped.push(s.name); continue; }
    await db.insert('business_services', { organization_id: orgId, name: s.name, description: s.description, keywords: s.keywords, return_days: s.return_days, price_cents: null, price_approved: false, deposit_cents: null, terms_text: null, terms_approved: false, active: true });
    added.push(s.name);
  }
  return { pack: pack.name, added, skipped };
}
