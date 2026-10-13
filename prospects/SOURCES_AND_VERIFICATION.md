# Prospect research — sources and verification (2026-10-13)

## Actual counts (targets in brackets)
| List | Who | Count | Area |
|---|---|---|---|
| A | Isaac | 17 [25] | Waterbury, Prospect, Wolcott, Watertown/Oakville |
| B | Salesperson 1 (placeholder) | 17 [25] | Southington, Plantsville, Milldale, Marion, Berlin, Wallingford |
| C | Salesperson 2 (placeholder) | 14 [25] | Naugatuck, Beacon Falls, Middlebury, Southbury, Oxford |
| D | Isaac — walk-in | 12 [20] | 4 geographic groups |

Lists are split by geography so no business is on two lists. Duplicate check (name, phone, website domain) runs in `build_prospects.py` and fails the build on any repeat.
**Totals are below target on purpose:** 21 further businesses are on the *Needs verification* sheet because their phone or hours could not be confirmed by the rule below. They are not on any call list.

## Sources used
- **Waterbury Regional Chamber member directory** — `web.waterburychamber.com/atlas/directory/category/…` (member-supplied name, phone, address, website). Read with a headless browser because the directory renders in JavaScript.
- **Southington Chamber of Commerce directory** — `southingtonchamber.com/business/<member>/`.
- **Better Business Bureau** category listings for Waterbury-area searches — `bbb.org/us/ct/waterbury/category/…`.
- **Each business's own website** — phone, address, hours, named owners, how customers request service.
- For four rows, other public directories (Trane dealer locator, BuildZoom, Yellow Pages, EVTech.News, threebestrated.com, dogdog.org) as the second independent source.

## Verification rule
A row is listed only when its business phone **appears on the business's own website**, **or** **two independent public directories agree**. Where the chamber listing and the website disagree, the website's number is used and the row says so. Walk-in rows also need opening hours from a named source; the source and its date are in the row (one comes from a January 2023 news article and is marked "dated — confirm").

## What was deliberately not collected
- Personal emails or mobile numbers shown on some chamber pages (only business lines were used).
- Names from customer reviews. Decision-makers are named only where the business's own website names them (12 rows).
- Street addresses of home-based businesses (town only).

## Excluded categories
Healthcare practices (patient messaging raises HIPAA questions), national chains and franchises, commercial-only contractors, unattended businesses (24/7 car wash), and homebuilders. See the *Excluded* sheet.

## Limits
- Directory and website details change; re-check a row on the day it is worked.
- Nothing was DNC-screened. No business was contacted during research.
- Search-engine summaries were used only to find candidates; every listed row was confirmed from the pages named in its `source_urls`, except the four two-directory rows, where one of the two directories was seen through search results.
