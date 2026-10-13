# Collateral proofs — read before anything is printed

Nothing has been ordered, uploaded to a printer, or printed. These are proofs for Isaac's review.

## Files
| File | What it is |
|---|---|
| `business-card.html`, `brochure.html` | Editable source (HTML/CSS). Edit text here, then run `node collateral/render.mjs`. |
| `proofs/*_REVIEW-PROOF.pdf` | For review: pink = trim, green dashed = folds, blue dashed = safe area, yellow = value to confirm. |
| `proofs/*_PRINT-LAYOUT_NOT-APPROVED.pdf` | Bleed-size pages without guides. **Not approved for print** until every box below is ticked. |
| `proofs/*_review_N.png` | Quick-look previews. |

Specs used: business card 3.5 × 2 in trim, 0.125 in bleed, 0.125 in safe margin, two sides.
Brochure: US Letter landscape tri-fold (roll fold), 0.125 in bleed, fold-in panel 1/16 in narrower; two sides.
Brand: black #0A0A0A, white #FAFAFA, gold #C9A84C.

## Confirm before printing (owner)
- [ ] **Name and title** on the card ("Isaac Nova", "Chief Executive Officer").
- [ ] **Phone** (203) 706-0504 — taken from the website footer; confirm it is the number you want printed and that it is answered.
- [ ] **Email** hello@nova-systems.app — taken from the website footer; confirm it receives mail.
- [ ] **Web address** nova-systems.app — the site is currently disabled (Vercel billing, since 2026-10-03). Do not print a web address or QR code until the site loads.
- [ ] **QR code destination** — a placeholder box is printed in its place. Choose the URL (for example the audit request page), confirm it loads on a phone, then generate the code and replace the placeholder.
- [ ] **Location** "Waterbury, Connecticut" — from the website footer.
- [ ] **"What is available today" table** (brochure back) matches the product readiness at the time of printing. It is copied from `docs/NOVA_OPERATIONAL_MVP_READINESS.md` and the website. If the AI phone receptionist or any pilot status changes, update it, or remove the table to avoid printing a statement that goes out of date.
- [ ] **No prices, testimonials, client names or results** are printed. Keep it that way unless each is approved in writing.

## Confirm with the printer
- [ ] Printer's exact trim, bleed and safe-area requirements, and fold type for the brochure.
- [ ] Colour mode: these PDFs are RGB. Ask whether the printer converts to CMYK or wants a CMYK file; request a hard proof of the gold (#C9A84C converts unpredictably and may print brown or flat). Ask about a metallic/foil option only if you want to pay for it.
- [ ] Rich black: large black areas usually need the printer's rich-black recipe.
- [ ] **Logo resolution:** `public/logo.png` is 256 × 256 px. That is fine on the card (about 250 dpi at 1.25 in) but low for the brochure cover (about 135 dpi at 1.9 in). Get a vector (SVG/PDF/AI) or ≥ 600 px version of the logo before printing the brochure.
- [ ] Fonts: the proofs use Helvetica Neue/Arial from this computer. The PDFs embed them; if a designer edits the source, use the same family.
- [ ] Paper stock, quantity and cost — needs your approval; nothing has been quoted or purchased.
