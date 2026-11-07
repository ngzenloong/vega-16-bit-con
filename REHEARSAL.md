# Verification: 16-Bit Con

Reviewed November 7, 2026. The initial repair and two subsequent five-skill review rounds are retained in the workspace audit directory. The mobile/vehicles/music follow-up adds a further code and five-skill review against the same Figma PRD, brand guide and supplied copy.

## Current automated checks

- 50 tests pass, including integer sprite clocks, physical key ownership, legacy profile normalization, score migration, every12-rival grid, campaign lettering, contact widths, rhythm grading/anti-mashing and the two new audio cancellation/obsolete-error regressions.
- TypeScript and production build pass. Static export is checked separately for publication. Game controllers remain dynamically imported.
- All12 grid rotations can finish first using the simulation's clean-line controller. That proves a feasible route, not human difficulty.
- Asset checks pass for twelve distinct rival silhouettes, integer2x rendering, alpha/bounds/ground anchors, forward-readable badges and the S-Cargo tea-only exception. The13-car turn preview validates39 frames and preserves every approved straight group. Full side profiles cover all13 cars.

## Current observed browser checks

The QA profile uses a different local origin from the user's saved player on port3000.

- Page widths320,375,414,768 and1280 were measured and inspected. No horizontal document overflow was observed. A320px title/booth overlap found in that pass was corrected with fluid title sizing; short desktop floors retain additional space.
- The phone look step keeps its preview fixed while options scroll. Six preset looks were inspected. At568×320 the preview and options form two columns and Continue remains fully visible.
- A new guest selected a preset, advanced to details, received native rejection for a malformed email, corrected it, returned to the look step without losing the selection, then created a player. At390×380, the focused email and actions remained reachable through the scrolling form. This is a reduced viewport test, not a physical keyboard test.
- Existing-player editing omitted email and retained world position. New-player entry completes at the shared booth anchor. Profiles remain local; email is discarded.
- Tapping the venue enters handheld mode. Dialogue close and dialogue-to-game handoff preserve that mode. Escape from a paused game returns to the same character position. Only explicit world exit restores page scrolling.
- Sam remains stationary after dialogue; walking is400px/s. The pup's idle/run poses share the ground, and the new companions follow. Background-motion pause is reachable inside handheld mode; NPC frames remain frozen while deliberate player movement still works.
- All four games opened and accepted keyboard start, movement/action, pause/resume and exit. Runner replay was exercised. Racing displays13-car ranking, distinct cars and a keyboard-accessible optional garage. Rhythm uses24 spaced notes with a3-second lead-in and60% clear target.
- Direct lift travel and repeated input settle into one floor with stable player/world transforms. Reading scroll retains per-floor state; explicit navigation is camera-owned.
- Sound enable succeeded in the observed game flows without visible audio errors. Final audio files and their licenses are recorded in the public manifest; subjective audio quality is not inferred from this check. The user first selected Cozy Puzzle, then requested a more Japanese life-sim direction; the final hall uses Apple Cider.

## Brand and sources

The event remains October3-5,2026 at Javits Center,New York, with the supplied three sessions and Booth630. Hardware is the System16-era arcade, Mega Drive, SNES and Mega Drive+Mega-CD. The full desktop world and mobile handheld distinction remain. Original Vega marks, sprites, shallow perspective and typography roles are retained. S-Cargo's marine blue and tea plate are explicit user exceptions.

Each of the four games has a separate score; the hall uses Apple Cider. All public recordings are composer-published CC0. The MIT Riftpane recording is a separately credited research reference only. The race score is Fever Stadium, not a copied Deja Vu melody. Sources and exact edits are in ASSET_SOURCES.md and public/audio/ATTRIBUTION.txt.

The additive Figma drafts page retains ten categories and thirty editable line-art alternatives. Earlier NES/PS1 alternatives remain historical, not live hardware.

## Limits

No physical iPhone/Android multitouch, software-keyboard, VoiceOver, acoustic/output-latency, full cross-browser or formal frame-time/heap test was performed. Not every game was manually won. Reduced-motion/interruption cleanup was reviewed in source and deterministic tests; live OS preference switching was not tested.

The DevTools Animations panel at10% speed and Stageshow's faux Stage/Act film gate were not run. Normal-speed CUA observations and source review do not imply those gates passed. Private deployment success is reported from the hosting service; authenticated production visual QA is a separate boundary.

Detailed findings, dispositions and captures remain in audit-2026-11-06/mobile-follow-up. Historical proof, including the old52-note rhythm run, is preserved separately and is not claimed as verification of the current24-note chart.
