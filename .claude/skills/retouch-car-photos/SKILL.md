---
name: retouch-car-photos
description: Use when retouching car photos or checking a cutout.
category: dev-tooling
---

A passing pixel check only proves the car pixels were copied unchanged. It does not prove the cutout is clean: always open the before/after sheet before accepting a photo.

## Rule

- Run `node factory/retouch-image.ts <data/images/marca/modelo/foto.jpg>`. On success it writes `<foto>.png`, deletes the original, and writes a sheet to `ops/retouch/<run_id>/`. Keep a copy of the original if you may need to rerun.
- Read the sheet before opening a PR or adding the photo to a card. Reject the photo if any foreign object stays attached to the car (a stanchion, pole, rope, sign, another vehicle), or if the plate cover misses the plate.
- Exit 1 with nothing written means no car instance, or the instance touches an edge. Pick another photo; do not loosen the thresholds.
- Rejecting a photo after it was retouched: `rm` the PNG and `git checkout -- <original.jpg>` to restore the original (the script deleted it, so this only works while the original is committed). Keep the sheet in `ops/retouch/<run_id>/` as the reason for the rejection. The retoucher agent follows this in `.claude/agents/retoucher.md`.
- The plate cover only applies to text with a digit in the lower half of the car. Check the cover by eye.
- Do not merge a retoucher PR that publishes cutouts until the web renders them: the card and the model page must read the `edits` entry and credit the photo as modified («Foto: {attribution} (modificada)», PRD-001 CA-23, CC BY-SA). Until then a transparent PNG in an `object-fit: cover` frame gets cropped; the Renault 4 pilot lost its roof and nose.
- Pilot on at least three photos of different body shapes before trusting the script. Details of the last pilot: `references/pilot-2026-11-14.md`.

## Showing a cutout on the site

A clean cutout is still not ready for the site. Cards and model pages that crop a photo with `object-fit: cover` clip a transparent PNG: the R4 pilot lost its roof and nose. Do not merge a retoucher PR that adds cutouts until a design check shows the whole car at 390 and 1280 px. The credit must also say the photo was modified: «Foto: {attribution} (modificada)» (PRD-001 CA-23; CC BY-SA). Keep the retoucher PR open until the page does both.

## Pitfalls

- Write the temporary PNG next to the target (`${target}.tmp`) and rename it there. A rename from another directory can cross devices and fail.
- Vision runs only on macOS. The pixel logic is tested on Linux CI with synthetic images (`factory/tests/retouch-image.test.ts`), so CI cannot catch a bad mask.
