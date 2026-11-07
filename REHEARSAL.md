# Verification — 16-Bit Con

Reviewed November 7, 2026. The initial repair was followed by two complete review/repair rounds using make-interfaces-feel-better, Vercel React best practices, humanizer, Hallmark and Stageshow. Each round compared the implementation with the Figma instructions, brand guide and supplied copy.

## Automated checks

- `npm test`: 35 passing tests. They cover crossed-platform landing, physical input ownership, stored-profile validation, fixed-step clock fairness, continuous Breaker contacts, serve timing, rotation at the paddle, Runner grace/buffer/release/checkpoints/rewards, timestamped rhythm grading/calibration/anti-mash behavior, authored road continuity and matching visible/off-road boundaries.
- TypeScript and production/static builds passed. The page is prerendered; game controllers remain dynamically imported.
- Separate deterministic audio fixtures exercised pending-load cancellation, latest-track ownership, mute during load, the complete hall-loop duration and output-clock mapping.
- Simulated controller playthroughs reached wins in all four games. Portrait Breaker also cleared at tested sizes. These simulations do not establish human difficulty.

## Observed browser checks

- Hero, schedule and existing-player form at 320, 375, 414 and 768 CSS px; ordinary 1280px desktop; 320×568 short portrait; 768×540 and 844×390 landscape. No horizontal document overflow in the measured page matrix. Important schedule/exit controls measured 44px.
- Immediate keyboard movement, direct station/NPC controls, repeated lift activation, per-floor position/camera preservation during reading scroll, explicit navigation, handheld exit and schedule handoff.
- Fixed dialogue text/choice geometry, keyboard response selection, original game font roles and matching activity portraits. Normal-speed and interrupted states were inspected.
- A fresh local-origin guest form rejected malformed email. Three outfit parts were changed and a player was created. Editing an existing player did not ask for email again.
- Player-pass flip/morph/drop completed. Escape during another entry preserved the player, removed all temporary pass/ghost elements and restored scrolling.
- Every game opened, accepted input and supported keyboard start/pause/resume/replay/exit. Phone games adapt their field or camera instead of shrinking a widescreen scene into a tall screen.
- A real automated keyboard rhythm round lasted 32 seconds and hit 52/52 notes, with 0 extra taps, 90% accuracy and 4,160 points. It showed Round cleared and New personal best, then replayed from Enter. This is UI input evidence, not a human playtest or audio-latency measurement.
- The race shows three rivals, authored bends, a complete New York skyline and the PostSIEM.com Fiat. Portrait road, cars and props share the same projection scale. Speed rose above 300 km/h after acceleration.
- A local QA server intentionally returned 503 for audio, then restored 200 responses. The active game showed a visible fallback and Retry action; recovery cleared it. A paused retry restored dialog focus and Enter resumed.
- The same server returned 503 for the game font. Game unavailable stayed cancellable. After the file recovered, keyboard Try again loaded a fresh font face and returned to the game.
- Session add/remove actions exposed their state and announced the actual title. Footer keyboard focus was visibly distinct from its green background.

The test profile used a separate local origin. The user's existing player on port 3000 was preserved. RSVP remained local; no attendance registration, email, analytics or multiplayer traffic was introduced.

## Design and provenance

The active hardware is a System 16-era arcade, Mega Drive, SNES and Mega Drive + Mega-CD. Original Vega art, paired marks, shallow pixel perspective and font/palette roles remain the foundation. The modern Fiat is a deliberate campaign reference rendered as pixel art.

Music is edited from congusbongus's CC0 recording, not claimed as AI-generated. The hall loop is 66.783492 seconds; the rhythm edit is 32 seconds. The 52-note chart is authored from the accompanying tracker score. See ASSET_SOURCES.md, THIRD_PARTY_NOTICES.md and tools/audio/PROVENANCE.md.

The additive [Figma drafts page](https://www.figma.com/design/ntMv2Sr2WTPuAtRljGxoOa/?node-id=9543-4) preserves ten decision categories and thirty editable line-art alternatives. Historical NES/PS1 options are explicitly superseded by the final 16-bit lineup.

## Verification limits

No physical iPhone/Android multitouch or soft-keyboard test, VoiceOver review, full cross-browser matrix, acoustic/output-latency measurement or formal frame-time/memory profile was performed. Browser viewport tests are not physical-device certification. Not every game was manually won.

Reduced-motion behavior and interruption cleanup were reviewed in source; live OS preference switching was not tested. The browser Animations panel at 10% speed and Stageshow's faux Stage/Act film gate were not available/run. The playable application's observed states do not imply those gates passed.

Detailed initial reports, both five-skill rounds, issue dispositions and before/after captures remain in the workspace's audit-2026-11-06 folder. Historical notes were preserved there separately from this current record.
