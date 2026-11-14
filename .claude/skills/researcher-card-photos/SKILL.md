---
name: researcher-card-photos
description: Use when judging a model photo for a data/raw card.
category: general
---

A card photo must show the exterior of the exact version the data row describes. An interior or dashboard shot, or a photo of another version, is not a card photo.

- Drop a rejected photo: remove its `images` entry. With none left, write `images: []` so the card falls back to the silhouette.
- A legible license plate in the frame rejects the photo. Drop it as is; do not retouch it into a card photo. The reviewer's finding and the user's approval are the basis, and the PR comment says so.
- Check the plate by opening the image file itself, every plate in frame, including the rear. A filename like `frontal.jpg` does not prove the view; flag a rear view in open_questions. A blank or blurred plate passes; a readable one (even foreign, e.g. Austrian) rejects.
- Commons photos are the usual offender: check the plate before writing the `images` entry, not only at review.
- Write an open question that names what is missing, such as an exterior photo with a license.
- Keep `license`, `attribution`, `source_url`, and `page_url` on any photo that stays.
- A Commons photo of a model in general does not confirm the electric version. Say so in open_questions instead of accepting it silently.
