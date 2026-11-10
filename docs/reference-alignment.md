# Vega reference alignment

Reference pass: November 10, 2026. The [home page](https://vega.io/) and [Careers page](https://vega.io/careers) supply the UI treatment. The [Figma assignment](https://www.figma.com/design/ntMv2Sr2WTPuAtRljGxoOa/?node-id=7518-128), [brand guide](https://www.figma.com/design/ntMv2Sr2WTPuAtRljGxoOa/?node-id=7660-1488) and [event copy](https://www.figma.com/design/ntMv2Sr2WTPuAtRljGxoOa/?node-id=7545-12) supply the brief and brand foundations.

## Roles, not a replacement palette

The live website and Figma swatches differ slightly. Foundation tokens retain the guide values; the `--ui-*` aliases describe the sampled website surfaces. Physical artwork and machine-specific game screens keep their own palettes.

| Role | Live value | Use |
| --- | --- | --- |
| UI surface | `#FAFAF9` | Navigation, information windows, player editor, secondary buttons |
| UI ink | `#141310` | Text, 1 px keylines, black selected state, hard 4 px window shadow |
| Primary action | `#F9B806` | Sign up and the current form action |
| Secondary text | `#686355` | Description, instructions, notes |
| Decorative line | `#C6C2B9` | Low-emphasis separation; not the sole selected/focus indicator |
| Room wall | `#FFF8ED` | Social floor and original brick textures |
| Day sky | `#84C5FF` | Hall, four games and cabinet previews |

PP Mondwest is the pixel display face. Geist is body text; Geist Mono is window chrome, controls and event data. The hero and lineup use the Careers display scale: 48/56 px on desktop and 48/52 px on tablet, with 36/40 px on mobile. Window text, metadata, chrome and controls use 13/20 px. Body text uses 14/20 px. These are paired semantic font tokens in `app/tokens.css`, alongside the original window, titlebar, button and navigation padding roles. Mobile targets stay at least 44 px high; desktop controls match the source’s 32 px height. The darker live 700 muted role is used for readable body-text contrast.

## Reused patterns

- The navigation has the original compact Vega wordmark on the left, centered section links and a single yellow action on the right. It follows the original 768 px breakpoint: the narrow layout has the original menu icon, with signup inside the dropdown. The source navigation insets are 8 px top/right/bottom and 16 px left above 1024 px; 4 px top/right/bottom and 12 px left below it. Mobile hit areas stay at least 44 px high.
- `InfoWindow` shares the titlebar, three original decorative window marks, white face, black outline and hard offset shadow. The hero is an ordinary scene element, not a blocking dialog.
- The hero presents the supplied event name, date, venue and tagline with one sign-up action. Its facts remain available without entering a game. Width is capped at 520 px with 24 px outer side gutters and the original 40 px vertical / 16 px horizontal content padding. On narrow tablets and phones, date and venue are shown directly instead of label/value rows.
- Each lineup window has its time in the titlebar, session type and title in the body, and one personal-list action. Selected actions use black and white.
- The hero title, labels, values and description form one `TypewriterSequence`. A block finishes before the next starts; the date/location values sit beside their labels. The three session windows have a separate sequence, typing each time and body before the next card. Hidden narrow-layout labels are skipped, and scrolling past an earlier item reveals it fully so later visible cards cannot stall. `TypewriterText` follows the original lore-window cadence: 65 characters per second and a 250 ms paragraph pause. Full text reserves the final size. The visible animation is hidden from assistive technology, which receives the full semantic text immediately. It starts on readable entry, pauses offscreen or when the browser loses focus, and does not replay after completion. Reduced motion or an explicit ambience pause reveals it immediately. Opening a dialog before visiting the lineup does not consume its entrance.

## World continuity

Original daytime skyline layers replace the sunset tint without changing silhouettes, murals, geometry or parallax. All four game scenes and their live cabinet previews use the same daylight resources. The room uses the original cream wall, sparse brick textures, yellow wall trim and wood floor. Yellow trim is wall paint, not a furniture platform: desks, sofa and Sam share the walking baseline. The original daisy desk and code-monitor desk provide variation without new decorative labels.

## Sound intent

The first accepted left/right movement or deliberate game start enables audio synchronously in the user gesture. Explicit mute wins over subsequent movement, game entry and automatic navigation. Initial sound enable, loading, failure, cancellation and hidden-tab handling continue through the shared audio owner; each game retains its own score. Both venue floors share the former 1F acoustic loop without a track switch.

## Evidence boundaries

Raw live computed styles, original CSS, Figma reads, screenshots and review reports are stored in the sibling `audit-2026-11-10-daylight` folder. Those browser captures are Chromium evidence. They do not certify physical iOS audio unlocking, VoiceOver output or every possible device. See [REHEARSAL.md](../REHEARSAL.md) for the executed checks and remaining limits.
