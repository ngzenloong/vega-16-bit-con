# Player selection

PLAYER SELECT is a full-screen game menu for choosing a character, entering local RSVP details, and joining the convention. It extends the existing Sam Circuit menu with the same dark stage, pixel platform, yellow actions, square controls, and original character art.

## Visual reuse

[Shared tokens](../app/tokens.css) remain the source of truth. [Sam Circuit](../components/CarSelection.tsx) and its [venue styles](../app/venue.css) establish the menu treatment; [player-select.css](../app/player-select.css) supplies the scoped layout. The surface reuses the existing primary race button, accessory thumbnails, `Sprite`, and `Companion`.

| Token | Role in this surface |
| --- | --- |
| `--color-outline` | Full-screen stage and action-area background |
| `--color-yellow`, through `--yellow` | Header, selected options, primary action, and success check |
| `--color-ink`, through `--ink` | Text on yellow and the inset selection border |
| `--color-paper`, through `--paper` | Main text and focus outlines on the dark stage |
| `--game-muted` | Item captions, instructions, and secondary confirmation text |
| `--platform-face`, `--color-grey-dark` | Unselected tiles and the platform; dark grey also marks disabled actions |
| `--cinema-keyline`, `--color-orange` | Secondary outlines and scrollbars; the shared primary button's pressed depth |
| `--font-game`, `--font-body` | PP Mondwest for game headings, captions, and actions; Geist for labels, inputs, and status text |
| `--space-*`, `--control-hit`, `--duration-fast` | Shared spacing, 44 px control targets, and the option background transition |

Selection has a yellow fill, inset ink border, and small triangle marker. Keyboard focus adds a separate paper outline. The platform uses the garage's clipped trapezoid and yellow lower edge. The success check has a short stepped entrance, disabled by reduced-motion preferences.

## Layout

The native modal dialog fills the visual viewport. A persistent yellow header contains the step title, sound control, and close button. The content occupies the remaining space above the action footer. Inventory and details scroll internally when needed. Safe-area insets protect the header and actions.

On a wide viewport, the look step uses two columns inside a maximum 1,280 px content width: character preview on the left and all eight accessory strips on the right. The preview shows the selected outfit and companion, the player's name, and the currently inspected category and item. The details step has a maximum 1,000 px width with the preview beside the fields. Confirmation centers the same character and a saved message.

| Condition | Layout adjustment |
| --- | --- |
| Width ≤ 900 px and aspect ratio ≤ 1:1 | Compact character/caption row above the scrolling inventory; 52 px option tiles; details preview hidden |
| Width ≤ 479 px | Smaller header and action typography with narrower horizontal padding |
| Width ≤ 351 px | Smaller preview, tighter header and footer; the details action can wrap |
| Width ≥ 480 px, height ≤ 600 px, aspect ratio ≥ 1:1 | Compact side-by-side look layout; shorter header and footer; details preview hidden; confirmation arranged horizontally |
| Width ≥ 480 px and height ≤ 360 px | Further reduction of preview height and scale |

The default option tiles are 60 px. Close and sound controls retain 44 px targets, and native fields are at least 48 px tall. Short layouts keep content scrollable rather than shrinking the inputs or removing inventory rows.

## States and ownership

| State | New player | Returning player |
| --- | --- | --- |
| `look` | PLAYER SELECT; Continue opens details | PLAYER SELECT; Save look confirms immediately; Edit details opens fields |
| `details` | DETAILS; name and email required | DETAILS; name required, email optional |
| `confirmed` | PLAYER READY | LOOK SAVED |

[Registration](../components/Registration.tsx) owns the draft appearance, fields, preview loading, retries, and confirmation hold. The inventory order is Outfit, Headwear, Eyewear, Neckwear, Backwear, Shoes, Handheld, and Companion. [Appearance data](../lib/appearance.ts) supplies every option, including five companions plus None, and fills missing parts in older three-part profiles.

Before confirmation, Registration prepares and loads all character animation sheets. It trims the name and email, preserves existing session interests, adds any selected session once, and calls `onSave`. [Convention](../components/Convention.tsx) updates the saved player and writes player state to browser storage. A storage failure leaves the player available for the visit and changes the confirmation message accordingly. The hall's rendered player is held separately until entry or closure of the saved confirmation.

The confirmed state displays the character, success check, and explicit saved message for two seconds while the document is visible and focused. Blur or hiding suspends the remaining hold. Closing before confirmation discards the draft; closing after saving retains the saved player. Preparing failures remain in the form with an error and retry path.

After the hold, Convention closes registration, updates the scene player, and pauses world input for arrival. A new player enters at Booth 630 on the main hall floor. An update uses the player's current floor and horizontal position. Convention calls the world positioning method without starting a competing page-scroll animation.

[Arrival](../lib/arrival.ts) owns page framing and animates the actual world character: a 520 ms drop followed by a 180 ms landing bounce. It anchors page scroll to the floor bottom and waits for framing to settle before the drop. In handheld mode it does not scroll the surrounding page. Reduced motion places the player immediately. Escape, blur, hiding, or an owner abort cancel the animation, reveal the grounded actor, and release temporary animation and input ownership. Convention then resumes the world and restores its focus.

## Keyboard and native input

[OutfitPicker](../components/OutfitPicker.tsx) exposes each accessory strip as a named radio group. Each option has an accessible label and checked state; the selected option is that group's Tab stop. Left/Right wrap through options, Home/End select the first/last option, and Up/Down move between selected options in adjacent rows. Down from Companion reaches Continue or Save look. Keyboard selection scrolls the option into view.

The action footer supports Left/Right between enabled actions, Up back to the last row or field, and Down to the first row or field. Standard Tab navigation and button activation remain available. In details, Enter from the name field advances to email; Up/Down move between fields and confirmation. Modified shortcuts and composition events bypass the dialog's custom key routing.

Name and email are native labeled inputs with autocomplete. The name requires at least one non-space character and has a 24-character limit. Email uses native email validation, email keyboard hints, and a 254-character limit. Both retain text editing, selection, and paste. Registration measures `visualViewport` height and offset on resize or scroll, then brings the focused field into view. This supports the layout response to a software keyboard; behavior on a physical iOS device remains unverified.

Touch uses native horizontal strip scrolling and tap selection. Mouse dragging captures the pointer after a 6 px movement threshold and suppresses the resulting click. Edge fades update after scrolling and resizing, without horizontal scrollbars. Blur, pointer cancellation, and unmount release drag state. The native modal and shared [dialog focus helper](../lib/dialog-focus.ts) retain focus and page-scroll ownership; Escape and the close button dismiss registration.

## Verification

The scoped verification completed on November 7, 2026: 86 automated tests, TypeScript checking, the production build, and the diff whitespace check passed. Arrival tests cover completion, reduced motion, handheld scroll ownership, Escape, blur, hidden documents, and owner cancellation. These simulated tests do not establish browser animation smoothness.

The browser evidence covers look and details at 393 × 660, 320 × 480, 280 × 568, 240 × 480, 568 × 320, 768 × 1024, 1440 × 900, 900 × 900, and 1280 × 600. The recorded layouts have viewport-sized dialogs, no page overflow, visible primary actions, and 44 px close controls. An independent review inspected all 18 captures and the success and arrival states, with no material findings in that evidence.

The recorded keyboard flow selected an option in all eight rows, reached Continue, rejected a whitespace-only name through native validation, and completed registration. The guest trace proceeds through confirmation, navigation, drop, landing, and completion. Returning-player checks retained the current floor and placed the actor inside the viewport, including the social floor. A handheld save retained handheld mode and left surrounding page scroll unchanged.

Physical iOS software-keyboard behavior, VoiceOver output, touch gesture feel, audio playback, and frame-by-frame animation smoothness remain unverified. The browser record does not exercise every inventory option or every failure/interruption branch; the details error placement was inspected in source. See [REHEARSAL.md](../REHEARSAL.md) for broader project verification and limits.
