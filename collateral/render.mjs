// Renders the collateral sources to PDF with the project's Playwright Chromium.
//   node collateral/render.mjs
// Produces, in collateral/proofs/:
//   *_REVIEW-PROOF.pdf               trim/fold/safe guides + yellow "confirm" markers — for review only
//   *_PRINT-LAYOUT_NOT-APPROVED.pdf  bleed-size pages without guides — NOT approved for print until
//                                    every item in PREPRINT_CHECKLIST.md is confirmed
// Also writes PNG previews of each review page. Nothing is sent to a printer or uploaded anywhere.
import { chromium } from "playwright";
import { mkdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const out = join(here, "proofs");
mkdirSync(out, { recursive: true });

const PIECES = [
  { file: "business-card.html", name: "nova-business-card", width: "3.75in", height: "2.25in", px: [360, 216] },
  { file: "brochure.html", name: "nova-trifold-brochure", width: "11.25in", height: "8.75in", px: [1080, 840] },
];

const browser = await chromium.launch();
try {
  for (const p of PIECES) {
    for (const mode of ["review", "print"]) {
      const page = await browser.newPage({ viewport: { width: p.px[0], height: p.px[1] } });
      await page.goto(`${pathToFileURL(join(here, p.file)).href}?mode=${mode}`);
      await page.waitForLoadState("networkidle");
      const suffix = mode === "review" ? "REVIEW-PROOF" : "PRINT-LAYOUT_NOT-APPROVED";
      await page.pdf({ path: join(out, `${p.name}_${suffix}.pdf`), width: p.width, height: p.height, printBackground: true, preferCSSPageSize: true });
      if (mode === "review") {
        const sides = await page.$$("section");
        for (let i = 0; i < sides.length; i++) await sides[i].screenshot({ path: join(out, `${p.name}_review_${i + 1}.png`) });
      }
      await page.close();
      console.log(`wrote ${p.name}_${suffix}.pdf`);
    }
  }
} finally {
  await browser.close();
}
