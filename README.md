# 16-Bit Con

A playable convention landing page for the Vega Design Engineer assignment. Built with Next.js, React, TypeScript, whole-frame sprite playback, and small Canvas games.

## Run

Requires Node.js 22 or later.

```sh
npm install
npm run dev
```

Open http://127.0.0.1:3000. For a stable review build, use `npm run build` followed by `npm run start`.

For static hosting, run `VEGA_STATIC_EXPORT=1 npm run build`. The deployable files are written to `out/`. Run a normal `npm run build` again before using `npm run start`; local development still uses `npm run dev`.

```sh
npm run typecheck
npm test
npm run build
```

## Experience

The page is a 3,600 px-wide convention: the main hall is 2F and the social floor is 1F. Sam stays where you leave him. Arrow keys or a deliberate tap take control, with gradual acceleration, a delayed camera and speed-linked footsteps. Machines, guests, stalls and the lift use HTML buttons. Selecting a guest or pizza stand guides Sam over; selecting merch opens the wardrobe. Intentional floor navigation carries the player and camera together.

- **Hall:** Left/Right or A/D move; Space or Up jumps; Enter interacts; Down + Space drops through a platform; Escape releases movement; Tab follows the document's controls.
- **Conversation:** Enter, Space, or Down reveals then advances a line. At the final line, arrows choose a response and Enter selects it. Escape returns to the hall.
- **Games:** Enter starts or resumes; Enter/P pauses; R restarts; Escape/X exits; M toggles sound. Each machine shows its own movement/action controls. Normal Tab navigation remains available.
- **Phone:** Tap the venue or choose Explore to open a handheld layout with D-pad, A/B, sound, background-motion pause, and a fixed close button. Conversations and games return to the same handheld session. Pointer capture prevents dragging off a pressed control from leaving movement stuck. Closing restores the previous page scroll position.

Four games are open to guests: Daisy Breaker, Cartridge Run, Sam Circuit, and Sam's Beat. Every race loads the PostSIEM.com Fiat and all eleven distinct rival microcars. Finish first within 55 seconds; corners, traffic, collision penalties and boosts affect the result. S-Cargo is the strongest rival. Every car has its own speed, launch, cornering and braking profile; garage statistics use that same data. Collisions apply a strong slowdown, a small decaying impulse and sparks. The rhythm game has 24 spaced notes and a 60% clear threshold.

Player creation offers eight compact rows of visual accessories and five optional companions. Choose an outfit with a fixed preview, then enter details in a separate step. The phone card is centered and larger; accessory rows use edge fades instead of horizontal scrollbars. Desktop and phone use the same image-only accessory strips. Mouse dragging, touch scrolling and radio-group keyboard navigation are supported. Older three-part player profiles still load.

## Implementation

`Convention` owns profile, overlay, audio, and entry state. `World` renders the semantic scene. `lib/world.ts` owns a fixed-step movement loop, support surfaces measured from the DOM, the camera, proximity targets, and NPC routes. Per-frame movement writes transforms directly rather than rerendering React.

`GameHost` provides an immediately available loading/error shell; each game controller is loaded on demand. It owns the canvas, input, timing, menus, focus, pause/resume, and result handling. Games implement a small `update / draw / press / hud` contract. The environment supplies character art and sound, keeping the rules testable without a browser.

Native dialogs make other content inert. Game and dialogue states explicitly restore focus. Dialogue reserves the complete text and response area, so typewriter animation does not change its geometry. Its dark bars and speaker portrait reuse the original game's presentation. Reduced motion removes automatic sprite/cloud motion and the cinematic zoom; gameplay remains available through deliberate input.

Audio starts muted. The hall and four games each have a separate score, credited in `public/audio/ATTRIBUTION.txt`. Sound effects and the racing engine use Web Audio. Music loads on demand with OGG/WAV fallback and a bounded decoded cache. Load cancellation, timeouts and playback ownership keep a stalled or obsolete request from blocking a new game. Blur and visibility changes pause active games and audio. Returning restores the current dialog's focus and preserves handheld mode; page scroll locks remain owned until every active layer releases them. Both floors share sound and ambience controls. Pausing venue ambience stops background motion and hall music; a late load cannot restart it while the page is unfocused.

## Demo boundaries

16-Bit Con and its schedule are fictional assignment content. The supplied setting is October 3–5, 2026 at Javits Center, New York, with Vega at Booth 630. The RSVP form creates a local player; it does not register attendance. Email is validated and retained locally at the user's request to remember registration details. The app stores the player's name, email, outfit, session interests, and best scores in this browser when storage is available. Saved details belong to this site origin; different preview domains do not share them. If storage is unavailable, they last for this visit. There is no registration backend, email delivery, analytics, or multiplayer.

## References

- [Assignment instructions](https://www.figma.com/design/ntMv2Sr2WTPuAtRljGxoOa/?node-id=7518-128)
- [Brand guidelines](https://www.figma.com/design/ntMv2Sr2WTPuAtRljGxoOa/?node-id=7660-1488)
- [Event copy](https://www.figma.com/design/ntMv2Sr2WTPuAtRljGxoOa/?node-id=7545-12)
- [Raw explorations and approved choices](https://www.figma.com/design/ntMv2Sr2WTPuAtRljGxoOa/?node-id=9543-4)
- [Vega careers game](https://vega.io/careers)
- [Asset and audio sources](ASSET_SOURCES.md)
- [Verification and remaining limits](REHEARSAL.md)

The Figma palette and fonts govern the page. Existing Vega pixel assets, character animation, window behavior, and controls provide continuity. The new venue, console stations, player pass, conversations, and four game rules are the assignment's additions. The later direction uses a dusk skyline, a cable-hung billboard, unframed floor controls and a footer on the fading foreground floor. All four games include architectural Vega advertisements and daisy marks. Buildings, cars and attached adverts in the race share one depth order.

Rivals have model-specific acceleration, pace, cornering and driver confidence. They commit to passing lines, reconsider blocked overtakes and exchange places. Near cars remain in the draw list until they move below the camera, with depth-correct occlusion and held steering poses. These are arcade parameters informed by vehicle character, not a road-speed simulator.

Player creation saves the local pass before a two-second visible confirmation. The hold pauses when the window is inactive, followed by the card flip, camera framing and character drop. Returning players can save a new look or edit remembered details.
