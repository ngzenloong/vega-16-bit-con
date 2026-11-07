# Verification — November 7, 2026

This pass covers the revisions after commit 39e10c0. Earlier initial repairs and two additional five-skill rounds remain preserved in the workspace audit directory. The latest user decisions supersede older screenshots and layout choices.

## Automated checks

The suite contains 63 regressions for game outcomes, physics, keyboard/pointer ownership, audio cancellation, modal focus and nested scroll locks, score migration, sprite frame geometry, driver passing/balance, bumper integration, facade ground contact, snack interruption and walking acceleration. TypeScript and production builds are required before publication. The final execution ledger records the exact final results and deployment SHA.

The race's clean-line simulation can finish first. Across eleven sampled shuffled grids, S-Cargo is the leading rival in most runs. These are arcade balance checks, not a guarantee that every player or every route wins. All eleven rivals are loaded each round; only the player's Fiat carries PostSIEM.com, and S-Cargo keeps its requested blue livery, rear white strips and 茶 plate without SIEM lettering.

## Observed interface checks

- Footer/page layouts were measured at 320,375,414,768,1024 and1440 px widths without document/footer overflow. Footer actions remain48/44 px and their labels fit on one line.
- Phone preview cards are centered, with50 px accessory choices, conditional edge fades and no horizontal scrollbar. Mouse dragging, native touch scrolling and keyboard radio selection are retained.
- The reduced320×380 details viewport kept the focused email input visible. The real software keyboard itself was not automated.
- Guest creation and returning-player editing preserve details locally. Confirmation holds for two seconds of visible/focused time before flip/reframe/drop. The recorded sequence held2267 ms and removed its temporary card/ghost elements.
- Dialogue return retained the exact recorded player transform and camera coordinate. Handheld mode and its scroll lock remained active after closing dialogue/game overlays.
- Both floor controls reflected the same sound and ambience values. Pause freezes decorative motion and hall music; late loads are guarded against hidden/unfocused state. The user previously completed a real software-switch return and reported success.
- Phone rotation pauses an active game, clears held input and preserves the round. The landscape Resume button is fully visible at44 px; long instructions/results scroll separately. World jumps rebase to the new floor and available headroom.
- Four game palettes, keyboard start/pause/exit paths, matching attract screens, graffiti facades and the racing roster were inspected. Cars and scenery share depth order; impacts use decay and sparks rather than instant lateral movement.
- Original careers movement was inspected again. Gradual walking, delayed camera, pooled dust and speed-linked footstep timing were adapted to this venue. Sam stays stationary without user control; ambient guests remain active.
- Pizza uses composed head/arm/slice frames and restores the held item. Repeated input does not restart it; Escape/movement cancels while retaining control. Merch opens the existing wardrobe.

## Design and source review

The five lenses were make-interfaces-feel-better, vercel-react-best-practices, humanizer, hallmark and stageshow. Each comparison uses the retained Figma PRD/brand/copy snapshots and the later user decisions. The reports, evidence matrix and final execution ledger live in the sibling `audit-2026-11-06/interaction-round-3` directory.

Critical token contrasts include ink on the dusk header colors 6.39:1 or better, body on paper 13.47:1, primary yellow 9.63:1 and focus on the darkest header sky 4.12:1. Gameplay labels on changing scenery use opaque readable grounds. These are targeted checks, not a complete WCAG certification.

## Verification limits

Viewport and pointer/keyboard checks are not physical iPhone/Android multitouch certification. A complete VoiceOver matrix, acoustic/output-latency measurement and formal FPS/heap benchmark were not performed. Stageshow's faux Stage/Act film gate and a DevTools 10% animation replay were not used; actual UI captures, measured geometry and source review are reported. Not every game was manually won. Local demo details belong to their site origin and do not transfer between different preview domains.
