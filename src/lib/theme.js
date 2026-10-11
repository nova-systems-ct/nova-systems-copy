// Nova Systems — shared design tokens.
//
// Approved palette (Isaac, corrected 2026-09-20 — supersedes the earlier navy-and-gold spec):
// BLACK, WHITE, and GOLD only. No navy, no blue anywhere — backgrounds, hover/focus/loading
// states, and mobile views included.
//
// NAVY is kept as an exported name only so every file that already imports it (rather than
// redeclaring its own local hex) keeps working without an import-site rewrite — its VALUE now
// equals BLACK. This is the "fix the shared token" approach: any current or future `NAVY` usage
// automatically renders black. Prefer importing BLACK directly in new code; NAVY is a compatibility
// alias, not a real second color.
//
// Migration note (2026-09-20, black/white/gold correction): swept every raw `#04112B` hex, the
// `navy` Tailwind color (tailwind.config.js), and the handful of navy-toned rgba()/hex accents
// found in Navbar.jsx and DashboardLayout.jsx. A handful of pages stay intentionally outside this
// system, not by oversight: LegalPageLayout.jsx (Terms/Privacy/Service Agreement — white
// background by design, for readability) and WavesForm.jsx (light card-based form flow).

export const BLACK = "#0A0A0A";
export const NAVY = BLACK; // compatibility alias — see note above; do not reintroduce a real navy value here
export const GOLD = "#C9A84C";
export const WHITE = "#FAFAFA";

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
