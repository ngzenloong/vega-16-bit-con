# Verification: responsive interface pass

Reviewed November 8, 2026. This record covers the mobile interface changes and dedicated desktop review after the first PR was merged. Earlier game, art, audio, focus and camera repairs remain in the workspace evidence ledger. The local review address is http://127.0.0.1:3001/.

## Automated checks

- `npm test`: 120 passed, 0 failed. Coverage includes game outcomes, race balance, collisions, pointer/keyboard ownership, audio cancellation, modal focus, scroll locks, progress migration, sprite geometry, snack interruption, bounded asset loading, scroll-based floor following, same-floor exit and lift arrival ownership.
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

The retained Figma instruction, brand and copy snapshots were compared again. Event name, tagline, October 3–5, 2026, Javits Center, Booth 630 and the three supplied session titles/times remain intact. The brief does not assign session days, so the schedule describes event highlights without inventing a daily agenda. Original logo/daisy, Mondwest game text, Geist body/command roles and existing palette remain the foundation. The continuous venue, four era-specific games and local player follow the user's approved direction; the November 10 color pass restores the original daylight city.

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

Handheld exit cancels lift travel and held input before changing layout. A layout effect releases the scroll lock and frames the current floor before paint. It does not restore the entry floor's scroll position. The engine keeps one current Sam, returns focus to that floor, and walks him toward its center. The other floor's camera can recenter, but its inactive render surface does not move another Sam. Ordinary reading scroll still transfers Sam to the visible floor, carrying his position, pace and screen offset. Engine-owned exit/framing scroll does not trigger that transfer; interrupted framing hands ownership back to reading scroll when the gesture ends. Native focus inspection and geometry-only viewport changes can update the view without moving Sam.

The camera eases toward the hero and schedule while keeping the walking actor inside the frame. Desktop wheel, touch scrolling, scrollbar scrolling and released controls use the same current-floor return. New movement, reentry, navigation or deliberate target focus interrupts it at the current position. Arrival holds the destination lift open without replaying its opening animation; walking beyond the doorway or leaving that floor clears the hold. Proximity is invalidated on a floor transfer so the empty departure lift can close.

The engine distinguishes its own floor framing, focus and navigation scrolls from reading scroll, including the final event after a navigation ends. Blur, hidden tabs and overlays suspend movement; they do not exit the handheld session. Reduced motion settles the centered composition immediately. A buffered jump also keeps the frame loop awake when background motion is paused.

Twenty-seven real-engine regression cases use controlled DOM geometry and a frame clock. They cover both exit directions, a single visible player, current-floor exit, scroll-based floor following, rapid alternating floors, mid-return visibility, focus without player transfer, held arrival doors, empty departure doors, a lift link to the player's existing floor, repeated release, mid-lift exit, compact/hidden handheld geometry, reacquisition, blur/visibility/overlay suspension, airborne release, resize, live reduced-motion changes, offscreen suspension, scrollbar interruption and navigation scroll ownership. The camera containment check samples both approach directions on each floor at 240, 393, 760 and 1280 px widths. These are simulated geometry checks, not browser rendering evidence. The current rule preserves automatic floor changes during reading scroll while keeping exit's own recentering on the arrival floor; earlier documentation that prevented all reading-scroll transfers is superseded.

The existing Figma instruction, copy and brand snapshots were checked again: the repair restores access to the required hero, schedule and registration information. Event facts, typography, palette and the continuous-venue design are unchanged. Source and interaction reviewers found and repaired an initial camera-outruns-player case and a same-floor scrollbar gap before this record was written.

At that checkpoint, browser acceptance was pending because the earlier Ego workspace disappeared. The separate November 10 reference-alignment task now includes fresh browser evidence for reading-scroll floor following, handheld travel in both directions, same-floor exit/reentry and door holds. That newer evidence is recorded below; the earlier captures remain scoped to their own versions. See `audit-2026-11-06/exit-round-8` for the historical source reviews and logs.

## November 10: live Vega alignment and deliberate sound

The final reference is Vega's live white-window UI, not the abandoned train/flip-board exploration. Figma instruction, copy and palette/font frames were read again. The actual home/Careers CSS and rendered styles were inspected in Ego at phone, tablet and desktop sizes. The new UI role tokens preserve the Figma foundations while matching the live white, black and yellow controls. Original day sky, city textures, wall, brick, yellow trim and wood floor remain separate artwork roles.

The header follows the original 768 px navigation boundary and its compact wordmark/menu icon. Measured CTA top/right/bottom insets are exactly 8/8/8 px at desktop sizes and 4/4/4 px at 768–1023 px. Narrow layouts move links and signup into the dropdown. The hero uses the original 688 px maximum window width, 24 px side gutters and 40/16 px content padding. Narrow tablets/phones show the date and venue directly. Display type is Mondwest 48/56, 48/52 or 36/40 by breakpoint; body is Geist 14/20; chrome, metadata and controls are Geist Mono 13/20. Mobile actions retain 44 px targets. Muted text uses the darker live 700 role to preserve body-text contrast.

The shared information window and text reveal serve the hero and three supplied sessions. The title remains stable; full-text reserves prevent reflow as facts and description type. The underlying semantic copy is complete from the start. One browser trace recorded 43 text mutations with all three session windows staying exactly 228 px high. Signup followed by close leaves the unseen lineup in its waiting state; entering the floor reveals it once. Reduced motion exposes the full copy immediately. The mobile lineup dialog also uses the neutral window surface, titlebar type and 44 px close/sound controls.

Fresh Ego checks cover widths from 240 to 1920 px, including phone, tablet, landscape, short desktop and square viewports. The final responsive measurements show no document or hero overflow. Native menu toggles, Escape and outside dismissal work; the source/component regression checks also cover both directions of the new breakpoint, hidden-action recovery and preserving outside focus. Player selection was inspected at 393×800 and 1440×1000. Down moves name → email → Confirm; Left reaches Back; Enter returns to the look step without a pointer.

Native keyboard and synthesized touch both enabled sound on the first accepted horizontal movement. Explicit mute remained off on subsequent movement, and direct game start enabled sound before the race. A cold mid-round Beat unmute now prepares the score before sampling the fresh visual-clock offset. Request and launch ownership prevent stale loads from restarting old playback or stealing focus. The cold-network scenario is regression-fixture verified, not a physical-device or throttled-browser claim.

The phone floor trace starts in the main hall, travels to the social floor, exits and walks back to the center of that same floor, then reenters and travels upstairs before exiting there. One player surface is visible at every checkpoint. Body overflow is restored after each exit. The destination lift holds its arrived state until Sam walks away, while the departure lift closes. Reading scroll to the other floor still transfers Sam. A separate lower-floor entry/exit confirms the same behavior without travel.

Verification: **137 automated tests passed**, TypeScript checking, production build and diff whitespace checks passed. Independent source review closed the offscreen-typewriter and cold-Beat-offset findings. Separate make-interfaces-feel-better, Hallmark, Humanizer and applicable StageShow reviews found no remaining actionable issue in their inspected source/capture scope. StageShow's faux-UI film gate was not used as a substitute for live interaction tests. The mechanical UI scan reported only the two mandated Geist font warnings; these are deliberate source-brand matches, not replacement-font recommendations.

Evidence lives in the sibling `audit-2026-11-10-daylight` folder, including reference styles, final rendered-token measurements, responsive captures, floor traces and independent review reports. Local browser evidence is Chromium. Physical iOS audio unlocking/software keyboard behavior, VoiceOver output, exact-device touch feel and exhaustive low-speed motion inspection remain unverified. Deployment verification is separately recorded against the pushed commit.


## Rendering regressions and footer follow-up

The visible typewriter layer now inherits visibility from its scene, so hiding an information window also hides its text. Completed cursors blink, with static/reduced-motion states exempt. Whole-pixel board widths and grid columns avoid fractional transformed text; the scene no longer forces a persistent 3D text layer. The original lift-hit hover region is restored, including the secondary button border. A native edge-hover trace settled at the identical47,464 coordinates for the final10 sampled frames rather than repeatedly entering/leaving. The smaller lineup action uses the original secondary button sizing.

Dialogue scene setup/cleanup now runs before paint. It restores floor layout before releasing modal scroll ownership and removes the delayed scroll write that could overwrite a subsequent navigation. Three regressions fail on the previous ordering and pass on the repair. Browser checking confirmed all three hero text layers hidden during dialogue, restoration to2048px combined floor height, and immediate navigation to the schedule remaining atscrollY1024.

Both floors now continuously use the former1F acoustic score. Regression checks cover identical track selection on both floors and reuse of the running audio source. The footer follows the actual Vega footer: original53×48 flower, framed white surface, monospace event columns, two columns on narrow screens, and original brick artwork. Desktop1440px and mobile393px rendered without horizontal overflow. No corporate product catalog or registration backend was added.

142 tests, typecheck and production build passed for this follow-up. Physical-device limitations remain as above.

## Sequential window text follow-up

The hero now has a 520px maximum width and left-aligned contents. Its metadata labels and values share adjacent columns rather than opposite edges. One completion-driven sequence types the H1, Date label/value, Location label/value and description in order. Narrow layouts skip the hidden labels. The session sequence types each card's time and body before starting the next card, matching left-to-right desktop and top-to-bottom mobile reading order.

A browser mutation trace showed at most one typing step across the three session cards and a constant 372px schedule-board height. The hero trace showed all six ordered handoffs, including its formerly static title and labels. Phone checks completed with hidden labels, direct scrolling to the third card, and reduced motion. The queue advances past items clipped above a scrollport, including when a fast scroll produces no IntersectionObserver threshold event; resize also releases a newly hidden label. All text remains available semantically, and no-script rendering exposes the reserved copy. An initial waiting state prevents already-complete text flashing before hydration.

147 tests, typecheck, production build and diff checking passed. Independent source review closed the fast-scroll, inner-scrollport and exact-boundary queue cases. Evidence is in `audit-2026-11-10-daylight/sequence-desktop-trace.json` and the appended code review. Earlier simultaneous-typewriter and static-title descriptions are superseded by this sequence.


## Action and alignment follow-up

The Event Details window is centered with24px padding on all sides; desktop date/location labels and values occupy opposite edges. Its title and metadata now retain blinking cursor blocks. The header CTA's104px minimum is removed, so labels plus12px horizontal padding determine width. Both floor control rows share the header width token. Across ten viewport sizes from240 to1920px, measured header/control left and right edges matched exactly, the title text's center delta was0, and no page overflow was observed.

Each lineup card has one full-width yellow action: Sign up for guests, Add to my list for registered players, and On my list for saved sessions. Guest actions have no toggle semantics; saved-session actions expose pressed state. The scene prompt follows the same action label. Footer DOM and focus order are Event, Vega, Explore, Your player. Footer text controls can wrap on extremely narrow screens.

Wardrobe snap padding now matches its visual inset, eliminating the4px first-row scroll offset. Desktop measurement found all eight first tiles at the same582.078px coordinate; mobile found all eight at24px. Native touch swipe advanced165px and showed both overflow fades. End/Home checks removed/restored the correct fade and returned every first tile to the same origin. The fade widens from18 to36px with an8px transparent edge. Label-specific submission-button minimum widths were removed while paired Back/Confirm columns and touch targets remain.

Independent component review exercised six guest/registered/selected cases across page and dialog variants. Physical iOS and VoiceOver limitations remain as previously recorded.

The native signup/list flow also passed: selecting the Panel signup action opened player creation; completion retained that session as On my list while the other two became Add to my list. Adding and removing another session worked. Header width changed naturally from78.609px (Sign up) to94.203px (My player), retaining the same padding. The temporary local QA profile was restored afterward.147 tests, typecheck and production build passed.

The wardrobe keyboard focus ring is inset6px, preserving a distinct double outline without extending4px past the row’s shared left edge.

## Hero cursor completion

Hero cursors blink during the sequential entrance and become transparent once their text block completes. Their existing layout boxes remain in place. A browser trace recorded a constant316px hero height, an active blink during typing, and six completed cursors at opacity0 with their original dimensions intact. The production build and diff checks passed; no animation-state logic changed.


## Input hint exclusivity

The page now owns one hint preference, initialized from pointer capability and updated by actual game/navigation keys or touch/pen input. No operating-system/user-agent inference is used. Keyboard typing in editable fields, composition and modified shortcuts do not change the hint. A pointer-capability change resets the default. Both floors render the key legend only when selected; the sticky touch prompt uses the opposite condition. Redundant inline touch copy and the coarse-pointer right-alignment rule were removed. Settings retain their right edge and keyboard instructions stay at the left edge of the shared header-width frame.

Ego Chromium checks:768×1024 touch mode had no keyboard legends and one tap prompt; Tab switched to keyboard text atx16 with no tap prompt; a native touch switched back. Desktop1440px placed the key text and row atx72. A240px keyboard viewport had no horizontal overflow or overlap with the event window. These are emulated capability/native-event checks, not physical iPad verification. The existing tests, typecheck and production build passed.
