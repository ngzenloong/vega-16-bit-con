# 16-Bit Con

A playable convention landing page for the Vega Design Engineer assignment. Built with Next.js, React, TypeScript, whole-frame sprite playback, and small Canvas games.

## Run

Requires Node.js 22 or later.

```sh
npm install
npm run dev
```

Open http://127.0.0.1:3001. For a production build, stop the development server, run `npm run build`, then `npm run start` on the same port.

For static hosting, run `VEGA_STATIC_EXPORT=1 npm run build`. The deployable files are written to `out/`. Run a normal `npm run build` again before using `npm run start`; local development still uses `npm run dev`.

```sh
npm run typecheck
npm test
npm run build
```

## Experience

The page is a 3,600 px-wide convention: the main hall is 2F and the social floor is 1F. There is one Sam, and reading scroll carries him to the currently visible floor. Arrow keys or a deliberate tap take control, with gradual acceleration, a delayed camera and speed-linked footsteps. Scrolling or releasing page controls sends Sam walking back to the center of his current floor and eases both cameras toward the event information. If reading scroll changes floors during that walk, his position, pace and framing carry over. New movement or a deliberate target selection interrupts the return. Machines, guests, stalls and the lift use HTML buttons. Selecting a guest or pizza stand guides Sam over; selecting merch opens the wardrobe. Intentional floor navigation carries the player and camera together. The arrival lift stays open until Sam leaves its doorway; the empty departure lift closes.

- **Hall:** Left/Right or A/D move; Space or Up jumps; Enter interacts; Down + Space drops through a platform; Escape releases movement; Tab follows the document's controls.
- **Conversation:** With the dialogue focused, Enter, Space, or Down reveals then advances a line. Sound and close controls retain their native keyboard actions. On touch screens, tap the scene or text to advance. At the final line, select a response explicitly; arrows and Enter work too. Escape returns to the hall.
- **Games:** Enter starts or resumes; Enter/P pauses; R restarts; Escape/X exits; M toggles sound. Each machine shows its own movement/action controls. Normal Tab navigation remains available.
- **Phone:** Tap the venue or choose Explore to open a handheld layout with D-pad, A/B, sound, background-motion pause, and a fixed close button. Required control and player images decode before the scene moves into place. Conversations and games return to the same handheld session. Each finger owns its input: slide between directions while holding A/B with another finger, or slide off to release. Closing cancels any lift travel, frames Sam's current floor in the page, and walks him back to its center. It does not return him to the floor where handheld mode began. Reduced motion centers him immediately.

The header keeps its full links at 560 px and wider, uses Menu beside the registration action below that, and moves all actions into Menu below 352 px. Repeated activation, Escape, outside clicks, scrolling and breakpoint changes close the disclosure consistently. Pointer activation keeps focus on Menu; keyboard activation enters the links. In handheld mode, the social floor's lineup sign opens the same three session tickets in a scrollable dialog. The provided times are event highlights; the brief does not assign individual session dates.

In a mobile game menu, D-pad and A/B are the controls: A starts, resumes or retries; B returns to the hall. In the car garage, B goes back to the introduction and A reopens it with the selected car and scroll position retained. D-pad directions browse cars or scroll instructions; Left/Right adjusts rhythm timing in its menu. The game screen, HUD and pad keep their dimensions across these states. Desktop keeps its visible menu actions.

Four games are open to guests: Daisy Breaker, Cartridge Run, Sam Circuit, and Sam's Beat. Sam Circuit opens a separate car-selection screen after Play game. Start with the PostSIEM.com Fiat; first-place wins unlock cars in four groups, saved locally. Every race includes all twelve distinct models: the selected player car plus eleven rivals. The Fiat has 55 seconds; slower unlocked cars get a proportional time budget. Corners, traffic, collision penalties and boosts affect the result. S-Cargo is the strongest rival. Every car has its own speed, launch, cornering and braking profile; garage meters use that same data. Collisions apply a strong slowdown, a small decaying impulse and sparks. The rhythm game has 24 spaced notes and a 60% clear threshold.

Player creation opens a full-screen 16-bit selection menu with the character and companion on a pixel platform. Eight image-only accessory rows support mouse dragging, touch scrolling, and arrow-key selection; edge fades indicate more options. The yellow header keeps sound and close available, and the primary action stays below the scrollable content. Desktop places the preview beside the inventory; portrait stacks a compact preview above it. Continue opens native name and email fields. Down moves from name to email to confirmation, Up returns, and Enter activates the focused action. Five companions are optional, and older three-part player profiles still load.

Confirmation saves the player before a two-second visible success hold, which pauses while the window is inactive. The character then drops directly into the hall. Returning players can save a new look or edit their details and return to their current floor and position. Reduced motion skips the drop; handheld entry preserves the surrounding page scroll.

## Implementation

`Convention` owns profile, overlay, audio, and entry state. `World` renders the semantic scene. `lib/world.ts` owns a fixed-step movement loop, support surfaces measured from the DOM, the camera, proximity targets, and NPC routes. Per-frame movement writes transforms directly rather than rerendering React.

`GameHost` provides an immediately available loading/error shell; each game controller is loaded on demand. It owns the canvas, input, timing, menus, focus, pause/resume, and result handling. Games implement a small `update / draw / press / hud` contract. The environment supplies character art and sound, keeping the rules testable without a browser.

Shared image and game-font loaders bound stalled requests, evict failed cache entries and permit retry. Handheld entry waits only for the images it needs. Optional document fonts cannot hold the controls behind an unrelated request. Pointer, keyboard and assistive activation keep separate input owners, with cleanup on cancellation, blur and unmount.

Native dialogs make other content inert. Game and dialogue states explicitly restore focus. Dialogue reserves the complete text and response area, so typewriter animation does not change its geometry. Its dark bars and speaker portrait reuse the original game's presentation. Reduced motion removes automatic sprite/cloud motion and the cinematic zoom; gameplay remains available through deliberate input.

Audio starts muted. The upper hall shares Sam’s Beat’s score; the lower office uses the acoustic life-sim loop. All four games retain their own score, credited in `public/audio/ATTRIBUTION.txt`. Sound effects and the racing engine use Web Audio. Music loads on demand with OGG/WAV fallback and a bounded decoded cache. Load cancellation, timeouts and playback ownership keep a stalled or obsolete request from blocking a new game. Blur and visibility changes pause active games and audio. Returning restores the current dialog's focus and preserves handheld mode; page scroll locks remain owned until every active layer releases them. Both floors share sound and ambience controls; the room track changes on arrival and follows ordinary scrolling. Pausing venue ambience stops background motion and hall music; a late load cannot restart it while the page is unfocused.

## Demo boundaries

16-Bit Con and its schedule are fictional assignment content. The supplied setting is October 3–5, 2026 at Javits Center, New York, with Vega at Booth 630. The RSVP form creates a local player; it does not register attendance. Email is validated and retained locally at the user's request to remember registration details. The app stores the player's name, email, outfit, session interests, and best scores in this browser when storage is available. Saved details belong to this site origin; different preview domains do not share them. If storage is unavailable, they last for this visit. There is no registration backend, email delivery, analytics, or multiplayer.

## References

- [Assignment instructions](https://www.figma.com/design/ntMv2Sr2WTPuAtRljGxoOa/?node-id=7518-128)
- [Brand guidelines](https://www.figma.com/design/ntMv2Sr2WTPuAtRljGxoOa/?node-id=7660-1488)
- [Event copy](https://www.figma.com/design/ntMv2Sr2WTPuAtRljGxoOa/?node-id=7545-12)
- [Raw explorations and approved choices](https://www.figma.com/design/ntMv2Sr2WTPuAtRljGxoOa/?node-id=9543-4)
- [Vega careers game](https://vega.io/careers)
- [Asset and audio sources](ASSET_SOURCES.md)
- [Player selection layout and behavior](docs/player-selection.md)
- [Verification and remaining limits](REHEARSAL.md)

The Figma palette and fonts govern the page. Existing Vega pixel assets, character animation, window behavior, and controls provide continuity. The new venue, console stations, player customization, conversations, and four game rules are the assignment's additions. The venue uses Vega's original daylight skyline, a cable-hung billboard, unframed floor controls and a footer on the fading foreground floor. The hall, four games and live cabinet previews share the blue-gray city materials, cream clouds and blue glass reflections. Buildings, silhouettes and murals retain their geometry; distant racing facades use a small sky-color haze. All four games include architectural Vega advertisements and daisy marks. Buildings, cars and attached adverts in the race share one depth order.

Rivals have model-specific acceleration, pace, cornering and driver confidence. They commit to passing lines, reconsider blocked overtakes and exchange places. Near cars remain in the draw list until they move below the camera, with depth-correct occlusion and held steering poses. These are arcade parameters informed by vehicle character, not a road-speed simulator.
