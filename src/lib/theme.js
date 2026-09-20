// Nova Systems — shared design tokens.
//
// Approved palette (Isaac, confirmed explicitly twice on 2026-09-20 for the entire public
// website, not just Nova HQ): deep navy, metallic gold, white, black. Semantic tokens instead of
// scattering hex values — per-file redeclaration of these same constants (previously ~60 files
// each defined their own local `GOLD = "#D4A030"`, the pre-migration gold) is exactly what this
// file replaces.
//
// Migration note (2026-09-20): the sitewide pass is done — every public page's `bg-black`/
// `#0a0a0a`/`#080600` background and `#D4A030`-family gold has been swapped to these values
// (bulk hex swap across ~60 files, not a per-file switch to importing this module — most files
// still locally redeclare `const GOLD = "#C9A84C"` etc. rather than importing NAVY/GOLD from
// here; only the newest files, HeroSection.jsx/BusinessDiagnostic.jsx/Navbar.jsx/Footer.jsx,
// actually import this module). A handful of pages were deliberately left out because they're a
// separate, legitimately light-themed surface, not an oversight: LegalPageLayout.jsx (Terms/
// Privacy/Service Agreement — white background by design, for readability) and WavesForm.jsx
// (light card-based form flow). See docs/implementation-status.md for the fuller record.

export const NAVY = "#04112B";
export const GOLD = "#C9A84C";
export const WHITE = "#FAFAFA";
export const BLACK = "#0A0A0A";

// Lighter/darker gold steps for gradients, matching the existing gradient pattern used
// throughout the codebase (a dark->bright->dark sweep on buttons/accents).
export const GOLD_DARK = "#8a6b2a";
export const GOLD_BRIGHT = "#E0C476";

export const GOLD_GRADIENT = `linear-gradient(135deg, ${GOLD_DARK} 0%, ${GOLD} 40%, ${GOLD_BRIGHT} 60%, ${GOLD} 80%, ${GOLD_DARK} 100%)`;
export const GOLD_TEXT_GRADIENT = `linear-gradient(90deg, ${GOLD} 0%, ${GOLD_BRIGHT} 50%, ${GOLD} 100%)`;

// Common translucent overlays used on navy backgrounds throughout the dashboard shell (Stage 3)
// — reused here so public-site work matches the same visual language rather than inventing a
// second system.
export const SURFACE = "rgba(255,255,255,0.03)";
export const SURFACE_BORDER = "rgba(255,255,255,0.08)";
export const TEXT_MUTED = "rgba(255,255,255,0.4)";
export const TEXT_FAINT = "rgba(255,255,255,0.25)";
