# Nova: design decisions (owner-approved direction)

Source: Isaac Nova, repair brief of 2026-10-25, and the previously approved dashboard, split sign-in and audit
references (used for commit `58b2fa7` and the 2026-10-25 design session). Supersedes the navy/gold HQ note in
`docs/product-requirements.md`: **no navy theme.**

- **Palette:** black `#0A0A0A`, white `#FAFAFA`, gold `#C9A84C`. Gold is subtle emphasis, not blanket buttons.
  This palette wins over any skill's generic color advice (for example "tint your blacks").
- **Logo:** the existing Nova logo only.
- **Feel:** restrained luxury with clear technology. Rolex/Lamborghini/Apple describe the level of care, not
  something to copy.
- **Rejected:** navy theme, oversized heavy headings, neon-yellow buttons everywhere, decorative card grids, long
  repeated technical explanations.
- **System:** one shared set of typography, spacing, surfaces, buttons, form states and navigation applied
  everywhere. Legible type, meaningful whitespace, purposeful motion.
- **Data:** every metric has a label, a period and a source. Financial fields separate cash collected, contract
  value and estimates. No invented counts, rates, revenue or losses. Test records stay out of real figures.
- **Navigation:** primary Home, Audits, Clients, Inbox, Calendar, Workers; Training, Growth and admin under More.
  One menu, no sprawling tab bars, clear back navigation and selected business. Don't hide needed functions.
- **Actions:** every visible control does something real or states its prerequisite and links to it.
- **Devices:** laptop, iPad portrait and landscape, phone. No clipped controls, horizontal page scroll, nested scroll
  traps, or a chat button covering content.
- **Skill roles:** `frontend-design` builds against these references; `impeccable` refines (critique, polish,
  typography, error states); `web-design-guidelines` reviews keyboard, labels, focus and touch targets.
