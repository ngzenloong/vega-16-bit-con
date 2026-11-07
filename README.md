# 16-Bit Con

A playable convention landing page for the Vega Design Engineer assignment. Built with Next.js, React, TypeScript, CSS sprite animation, and small Canvas games.

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

The page is a 2,880 px-wide, two-floor convention. Arrow keys immediately move Sam; the camera follows. Machines, people, the lift, and registration use HTML buttons. You can select them directly without moving Sam.

- **Hall:** Left/Right or A/D move; Space or Up jumps; Enter interacts; Down + Space drops through a platform; Escape releases movement; Tab follows the document's controls.
- **Conversation:** Enter, Space, or Down reveals then advances a line. At the final line, arrows choose a response and Enter selects it. Escape returns to the hall.
- **Games:** Enter starts or resumes; Enter/P pauses; R restarts; Escape/X exits; M toggles sound. Each machine shows its own movement/action controls. Normal Tab navigation remains available.
- **Phone:** Explore the hall opens a handheld layout with D-pad, A/B, and a fixed close button. Pointer capture prevents dragging off a pressed control from leaving movement stuck. Closing restores the previous page scroll position.

Four games are open to guests: Daisy Breaker, Cartridge Run, Sam Circuit, and Sam's Beat. Sam Circuit uses a pixel Fiat based on the supplied PostSIEM.com event photograph and three fictional Legacy Stack rivals, with authored corners, collision penalties, boosts, and a podium target.

## Implementation

`Convention` owns profile, overlay, audio, and entry state. `World` renders the semantic scene. `lib/world.ts` owns a fixed-step movement loop, support surfaces measured from the DOM, the camera, proximity targets, and NPC routes. Per-frame movement writes transforms directly rather than rerendering React.

`GameHost` provides an immediately available loading/error shell; each game controller is loaded on demand. It owns the canvas, input, timing, menus, focus, pause/resume, and result handling. Games implement a small `update / draw / press / hud` contract. The environment supplies character art and sound, keeping the rules testable without a browser.

Native dialogs make other content inert. Game and dialogue states explicitly restore focus. Dialogue reserves the complete text and response area, so typewriter animation does not change its geometry. Its dark bars and speaker portrait reuse the original game's presentation. Reduced motion removes automatic sprite/cloud motion and the cinematic zoom; gameplay remains available through deliberate input.

Audio starts muted. The hall and rhythm tracks are edited excerpts of congusbongus’s CC0 FM track, Welcome to the Item Shop. Sound effects and the racing engine use Web Audio. Music is decoded on demand, with OGG and WAV fallback. Visibility changes pause active games and audio.

## Demo boundaries

16-Bit Con and its schedule are fictional assignment content. The supplied setting is October 3–5, 2026 at Javits Center, New York, with Vega at Booth 630. The RSVP form creates a local player; it does not register attendance. Email is validated, then discarded. The app stores the player's name, outfit, session interests, and best scores in this browser when storage is available. Otherwise, they last for this visit. There is no registration backend, email delivery, analytics, or multiplayer.

## References

- [Assignment instructions](https://www.figma.com/design/ntMv2Sr2WTPuAtRljGxoOa/?node-id=7518-128)
- [Brand guidelines](https://www.figma.com/design/ntMv2Sr2WTPuAtRljGxoOa/?node-id=7660-1488)
- [Event copy](https://www.figma.com/design/ntMv2Sr2WTPuAtRljGxoOa/?node-id=7545-12)
- [Raw explorations and approved choices](https://www.figma.com/design/ntMv2Sr2WTPuAtRljGxoOa/?node-id=9543-4)
- [Vega careers game](https://vega.io/careers)
- [Asset and audio sources](ASSET_SOURCES.md)
- [Verification and remaining limits](REHEARSAL.md)

The Figma palette and fonts govern the page. Existing Vega pixel assets, character animation, window behavior, and controls provide continuity. The new venue, console stations, player pass, conversations, and four game rules are the assignment's additions.
