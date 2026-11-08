# Verification: responsive interface pass

Reviewed November 8, 2026. This record covers the mobile interface changes and dedicated desktop review after the first PR was merged. Earlier game, art, audio, focus and camera repairs remain in the workspace evidence ledger. The local review address is http://127.0.0.1:3001/.

## Automated checks

- `npm test`: 112 passed, 0 failed. Coverage includes game outcomes, race balance, collisions, pointer/keyboard ownership, audio cancellation, modal focus, scroll locks, progress migration, sprite geometry, snack interruption, bounded asset loading and page-mode return.
- `tsc --noEmit --incremental false`: passed.
- `npm run build`: passed, with the landing page prerendered.
- `git diff --check`: passed.

Tests establish the behavior they exercise. They do not certify native iOS gestures, subjective game difficulty, screen-reader output or frame rate.

## Browser evidence

The first-visitor reviewer exercised the event, editor, dialogue, lift and all four games in the in-app Chromium browser. After the user requested Ego Browser, the owner used Ego for final device metrics, touch input, guest registration, reduced-motion and transition checks. The separate desktop reviewer inspected captured evidence independently; that reviewer did not operate the browser. The senior engineer reviewed source and dependency harnesses independently.

| Scope | Observed result |
| --- | --- |
| Desktop sizes | 1920×1080, 2560×1440, 3840×2160, 1440×900, 1024×768, 1280×600, 900×1200, 900×900, 720×720 and 640×900. Header text shares one baseline; no horizontal document overflow. The scene covers the 4K right edge. |
| Narrow navigation | 240, 280, 320, 360, 393, 560, 768 and 1440 px widths. Menu and registration actions remain reachable with 44 px targets. |
| Full-screen player selection | 393×660, 320×480, 280×568, 240×480, 568×320, 768×1024, 1440×900, 900×900 and 1280×600. Direct character preview, eight visual strips and persistent actions. The details form also fits all nine sizes without horizontal overflow. |
| Keyboard registration | In Ego, a guest chose outfit and headwear with arrows, moved to Continue, entered test name/email, reached Confirm with Down, and submitted with Enter. Success confirmation and direct hall drop completed. The card/flip/morph sequence was removed at the user's request. Only the test profile was removed afterwards. |
| Touch ownership | Ego's Chromium touch emulation held steering and gas together, slid Right to Left, slid steering off while gas remained pressed, and released all input. No text selection remained. |
| Dialogue | Scene and blank-area taps advance dialogue; final choices require explicit selection. Tab/Enter and Escape remain available. The recorded desktop player transform was identical before and after return. |
| Handheld schedule | A compact lineup sign opens shared session tickets in a scrollable dialog. Page-size tickets no longer overlap the sofa or player. The narrow page schedule has enough floor height for its stacked content. |
| Prompts and garage | Handheld machine/lift prompts remain within the scene. Narrow portrait car selection uses a stacked layout with complete selected-car art and ratings. |
| Entry motion | Ego slowed browser animation playback to 10%; captures show the scene, header and controls at approximately 122, 192 and 293 ms of the 360 ms sequence. Entry completed and Escape restored page mode. |
| Reduced motion | Ego emulated the preference. Handheld mode entered successfully with zero active frame animations after entry. |
| Four games | Independent short start/input/pause/return passes covered Sam Circuit, Daisy Breaker, Cartridge Run and Sam's Beat. These were not full manual completion runs. |

The full reports and screenshots are in the sibling `audit-2026-11-06/mobile-round-5` directory. Superseded screenshots remain labelled as pre-repair evidence. The execution record supplies the commit, PR and Vercel deployment; localhost checks are separate from deployment verification.

## Brand and brief

The retained Figma instruction, brand and copy snapshots were compared again. Event name, tagline, October 3–5, 2026, Javits Center, Booth 630 and the three supplied session titles/times remain intact. The brief does not assign session days, so the schedule describes event highlights without inventing a daily agenda. Original logo/daisy, Mondwest game text, Geist body/command roles and existing palette remain the foundation. The dusk city, continuous venue, four era-specific games and local player follow the user's approved direction.

Five review lenses were applied: make-interfaces-feel-better, vercel-react-best-practices, humanizer, hallmark and stageshow. Reports distinguish source checks, browser observations and independent artifact review. No animation framework or design-system package was introduced. A fresh independent finish reviewer approved the full-screen selector after reviewing the nine viewport pairs, customization, success, mid-drop and landed evidence.

## Direct arrival and follow-up review

The latest player-selection follow-up adds eight arrival lifecycle tests. Escape, blur, hidden state and owner cancellation reveal the saved actor and release animation/keyboard ownership; reduced motion skips the drop. Browser evidence confirms that a returning desktop player remains visible at 1280×720, handheld editing retains handheld mode and the same page scroll, and lower-floor editing returns to that same floor. Registration rejects whitespace-only names, keeps preparation errors beside the form fields and uses one page-scroll owner during arrival. The follow-up evidence lives under `mobile-round-5/player-select`; earlier card screenshots are superseded.

## Verification limits

Chromium touch emulation does not prove that the native iOS magnifier is suppressed on a physical phone. The WebKit-specific gesture guard is implemented and scoped to the game pad; actual Safari/software-keyboard, hardware multitouch and complete VoiceOver checks remain unverified. No formal GPU/heap benchmark or acoustic latency measurement was performed. Sound remained muted during this round's visual tests.

Stageshow's Stage/Act film gate does not run this live application. Its framing and motion criteria were reviewed against actual UI captures; no film-gate pass is claimed. Earlier targeted contrast checks are preserved, but this is not a complete WCAG certification. Local demo profiles remain specific to each site origin.

## Handheld controller follow-up

The follow-up after PR 2 retains 86 passing tests and adds source-harness and Ego interaction evidence in `audit-2026-11-06/handheld-round-6`. The location sign and beam share a center anchor; seven measured page/form sizes have zero center delta and identical Back/Confirm font, padding, height and width.

Mobile game menus hide duplicated screen CTAs and retain the controller. The 393×660 racing frame stays 369×375 through intro, garage, play, pause and resume. Native touch checks cover breaker, runner and rhythm start/pause/resume/return; rhythm timing changes by 10 ms through the D-pad, and a connected keyboard scrolls the touch menu. Garage B/A retains selection and the same component; rotation and compact-mode return reveal the selected car.

A blocked music request and successful retry during racing leave the landscape frame at 240×220. The notice and recovery action stay between the side controls. Network blocking was removed and sound returned to muted. A high-level browser selector operation briefly hid the page during an early test, correctly triggering auto-pause; native browser touch events were used for the final gameplay transitions, and application visibility safeguards remain intact.

The shared menu-action family also serves desktop game actions and the player editor. The new responsive check covers eight handheld sizes plus a separate desktop garage, and the independent visual review closes the tablet spacing and landscape-label findings. Physical iOS and other limits above still apply.

Focus recovery now skips hidden, inert, disabled and non-rendered controls, including the retained garage and the hidden mobile Hall button. Regression assertions cover the first lost-focus Tab, reverse Tab and remembered inactive-menu focus. The suite remains at 86 tests.

## Navigation and toggle follow-up

The header no longer treats a null focus handoff as dismissal before the same click. Pointer opening keeps focus on Menu; keyboard opening focuses a visible item, including when ArrowDown/ArrowUp enters an already-open popup. Escape, real focus departure, outside click, scroll and both responsive breakpoints have explicit dismissal paths. Menu actions return focus to the stable trigger before opening a modal.

Conversation toolbar buttons keep their own native Enter/Space action; the sound button no longer reveals dialogue or selects a final response. The existing repeat guard and normal dialogue continuation remain.

Seven actual-component/handler regressions extend the suite to 93 tests. Ego checks at 320 and 393 px cover repeated pointer and native touch toggles, a controlled null-blur handoff, item activation, return focus, Escape, outside click, scroll, and the 352/560 px breakpoints. Native timing details alternate open/closed through pointer and keyboard activation; both venue ambience controls alternate together. Sound Enter enables and Space mutes without changing the current dialogue line; Continue still advances.

These results are in `audit-2026-11-06/navigation-round-7`. Ordinary Chromium clicks alternated normally in the initial pass; the original menu failure was established by the actual 713bd67 handler sequence with a null blur before click, not by claiming a physical Safari reproduction. Native-device limits above remain unchanged.

## Returning from exploration to the page

Handheld exit now cancels lift travel and held input before changing layout. Once page geometry and saved scroll are restored, the engine reconciles the visible floor, returns focus to the floor itself, and walks Sam toward the center of both rooms. The camera eases toward the hero and schedule while keeping the walking actor inside the frame. Desktop wheel, touch scrolling, scrollbar scrolling and released controls use the same return. New movement, reentry, navigation or deliberate target focus interrupts it at the current position.

The engine distinguishes its own floor framing, focus and navigation scrolls from reading scroll, including the final event after a navigation ends. Blur, hidden tabs and overlays suspend movement; they do not exit the handheld session. Reduced motion settles the centered composition immediately. A buffered jump also keeps the frame loop awake when background motion is paused.

Nineteen real-engine regression cases use controlled DOM geometry and a frame clock. They cover both floors, repeated release, mid-lift exit, an unchanged restored scroll offset, compact/hidden handheld geometry, reacquisition, focus, blur/visibility/overlay suspension, airborne release, resize, live reduced-motion changes, offscreen suspension, scrollbar interruption and navigation scroll ownership. The camera containment check samples every return frame at 240, 393, 760 and 1280 px widths. These are simulated geometry checks, not browser rendering evidence.

The existing Figma instruction, copy and brand snapshots were checked again: the repair restores access to the required hero, schedule and registration information. Event facts, typography, palette and the continuous-venue design are unchanged. Source and interaction reviewers found and repaired an initial camera-outruns-player case and a same-floor scrollbar gap before this record was written.

**Browser acceptance remains pending for this follow-up.** Ego's earlier task workspace disappeared; recovery authorization is pending. No replacement was created and no user-owned workspace was claimed. Earlier responsive captures remain evidence for their recorded versions, not proof of this new exit transition. A new Ego pass must exercise both floors, rapid reentry, the final navigation scroll event and normal/reduced motion before this follow-up is described as visually verified. See `audit-2026-11-06/exit-round-8` for the source reviews, logs and remaining checks.
