# PXL — Brand portfolio

A one-page brand portfolio made with plain HTML, CSS, and JavaScript. Open this folder in VS Code. No framework, package installation, or build step is required.

## Preview

In the VS Code terminal, run:

```powershell
python -m http.server 4173 --bind 127.0.0.1
```

Open http://127.0.0.1:4173. Stop the preview with Ctrl+C. VS Code's Live Server extension also works. Most features work by opening `index.html` directly, but a local server gives more reliable clipboard behavior.

## What is included

- Layered parallax throughout the page: the hero landscape, section backgrounds, selected artwork, and footer logo move at different scroll speeds. Text, navigation, and drawing controls remain steady. Mobile travel is reduced; the motion switch and system reduced-motion preference stop all parallax.
- The main/primary logo appears in the header, footer, hero, and browser icon. Both logo versions remain in the identity presentation.
- Original pixel scenery, a clickable robot, and three collectible pixels.
- Mission and vision tabs, product tabs, an original 30-second mini-game, and a motion preview.
- Your supplied primary logo, secondary logo, original process board, first brand post, and promotional poster, with full-size viewers.
- Copyable brand colors and a live Tiny5/Jersey 10 type tester.
- A keyboard, touch, and pointer accessible pixel-art canvas with PNG download.
- A mobile menu, sound opt-in, motion toggle, system reduced-motion support, and keyboard navigation.
- No analytics, account system, database, or backend.

## Before submission

1. Replace the owner placeholder in the `team` section of `index.html` with the actual owners' names, roles, and photos. Add the photos to `assets/` and give each image descriptive alternative text.
2. Confirm or replace the suggested caption in the first-brand-post section.
3. The campaign sections show representative colors sampled directly from the supplied artwork. Replace these with exact design-file values if available. Confirm the actual typefaces used in each artwork if they differ from the supplied brand typefaces, Tiny5 and Jersey 10.
4. Confirm event details. The supplied poster reads **5 November 2026, Event Center, SM City Cabanatuan**.
5. The robot, collectible examples, mini-game, and animation loop are original website demonstrations, not claims about released products. Replace examples with actual products if available.

## Publish with Vercel

Upload this folder's contents to your GitHub repository and import that repository into Vercel. Use **Other** for the framework preset, an empty build command, and `.` for the output directory. `index.html` must sit in the selected project root. The included `vercel.json` supplies those static-site settings.

After publishing, test the production URL on desktop and phone. Check the owner information, full-size artwork, mobile navigation, game, drawing download, motion setting, and image loading. Submit only the accessible published website URL.

## Files

- `index.html`: content and page sections.
- `style.css`: palette, layout, responsive rules, and motion.
- `script.js`: browser interactions and game.
- `assets/`: supplied artwork and original website graphics.
- `vercel.json`: static hosting settings.

Font files are supplied locally when available. The original artwork is copied without modification. No affiliation with other game publishers or franchises is implied.

## Verification

Checked in the embedded browser at 375, 768, 1024, and 1440 pixel widths with no horizontal overflow. Verified mission/vision switching, product tabs, game start/pause, animation playback, motion reset, collectible pixels, full-size artwork viewing, live font preview, and keyboard drawing. No browser console warnings or errors were observed.

The art-export action generated its success feedback without errors, but the embedded browser did not expose a completed file-download event. Check the PNG download once in your normal browser before submission.

Local file references, unique IDs, navigation anchors, tab targets, font files/licenses, JavaScript syntax, and Vercel settings passed validation. The five supplied image files are byte-for-byte copies of your originals.
