# Music references and a softer hall arrangement

Research date: November 7, 2026. The user asked for permissively usable
references after finding the current chiptune unpleasant. At that request,
the three newer game recordings had not yet been integrated. This feedback
is not evidence that the user had heard or rejected those pending tracks.
The user selected the Cozy Puzzle direction after the supplied previews. All four game IDs are wired to independent scores; no browser audition was
performed in this audio task.

## Final direction

After selecting the Cozy Puzzle preview, the user asked for a more Japanese,
Animal Crossing-like feel. The final hall now uses Zane Little's **Apple Cider**
from the [author's Apple Cider Juiced pack](https://opengameart.org/content/apple-cider-juiced),
which explicitly lists Animal Crossing/calm/cozy tags and a CC0 license. The
original work lists acoustic guitar, whistle, flute and bells. This evidence
supports the arrangement direction; it is not an auditory evaluation by the
agent. No Nintendo music or melody is included.

`prepare_hall_life.py` prepares the author's whole86.4-second loop with gentle
EQ and a quiet -23.5LUFS target. `hall-life-manifest.json` records measured
levels, source SHA, output hashes and all four unchanged game scores. The
previous Cozy Puzzle preparation remains a reference, not the final hall.

## Earlier recommendation

Use **Cozy Puzzle In-Game 1** as the hall's new direction: a complete bossa
nova arrangement with saxophone, flute and mallets, as described by its
composer. The hall asset has been changed to a 32-bar excerpt at its original
118 BPM. This changes the composition and instrumentation, rather than just
filtering the old FM recording. Keep Eurobeat specific to racing. Urban Theme
is the next reference for a friendly, fuller game arrangement if the Runner
selection needs changing after listening.

The MIT example below is real music with an explicit media grant. It is not
automatically the best soundtrack merely because its license is MIT. The
recommended bossa/urban/racing recordings are **CC0, not MIT**.

## Final shortlist

| Reference | Actual media license evidence | Direction and selection |
|---|---|---|
| **Cozy Puzzle In-Game 1, MintoDog** | The [composer's original submission](https://opengameart.org/content/cozy-puzzle-in-game-1) identifies MintoDog, the actual downloadable audio, and CC0. The source file embeds title, artist and 118 BPM. | **Recommended and adopted for hall.** The author describes saxophone, flute, mallets and bossa nova. This is a direct move toward a fuller instrumental arrangement. |
| **Urban Theme, MintoDog** | The [composer's original submission](https://opengameart.org/content/urban-theme) identifies the audio as CC0, bright, saxophone/brass-led and loopable. The download is named 115 BPM. | **Recommended reference for a cheerful game/venue feel.** Use its melodic ensemble and rhythm-section balance as direction, rather than a constant high square-wave lead. Reference only; no Runner replacement was made in this task. |
| **Fever Stadium, MintoDog** | The [composer's original submission](https://opengameart.org/content/fever-stadium) explicitly labels the music Eurobeat for racing, loopable and CC0. The source has an embedded 165 BPM tag. | **Racing selection retained for review**, with the prepared 156 BPM pitch-preserving edit. It is its own composition, not Deja Vu. Its energetic role should remain distinct from the calmer hall. |
| **Riftpane, Riftpane Project Contributors** | The canonical repository's [Music section](https://github.com/sakurablush/riftpane#music) explicitly grants MIT to its two named MP3 versions. The exact [LICENSE](https://github.com/sakurablush/riftpane/blob/main/LICENSE) and a local copy of the music-specific grant are retained. | **Verified MIT audio reference, not adopted.** The repository calls it optional background music. I have not established its auditory fit for this convention, so licensing alone is not a reason to use it. |

Only these four references are recommended for this pass. Other searches
returned MIT engines, soundfonts or games whose music was separately licensed.
Those were not treated as MIT compositions. In particular, a MIT soundfont or
music engine does not establish a license for arbitrary music rendered with it.

## Listening evidence and limits

**No actual auditory listening was achieved through the available tools.**
The selection is based on the composers' instrumentation/style descriptions,
explicit media-license statements, downloaded files, metadata and level
inspection. These support the stated direction and rights evidence, but do
not prove that a listener will like the result. No claim of subjective music
acceptance, exact console emulation or device-latency testing is made.

Three 14-second previews were prepared at approximately -22.4 LUFS, with
only fixed gain and short outer fades. No timbre processing was added to
these reference clips, so they preserve the recordings' character. They are
intended for actual human comparison, not proof of an audition by the agent.

| Preview | Source excerpt | Local file |
|---|---|---|
| Cozy Puzzle | 8.136-22.136 seconds | `previews/reference-cozy.mp3` |
| Urban Theme | 8.348-22.348 seconds | `previews/reference-urban.mp3` |
| Riftpane, MIT | 20-34 seconds | `previews/reference-riftpane-mit.mp3` |

The already prepared racing sample is `previews/kart-preview.mp3`.
`references/preview-manifest.json` records source hashes, excerpt positions
and measured preview levels. `prepare_references.py` reproduces the clips.
The exact MIT notice is retained in `references/riftpane-LICENSE.txt`
beside the source recording and `riftpane-media-grant.md` evidence.

## Hall change made in this task

- File routes remain `/audio/hall.ogg` and `/audio/hall.wav`.
- New work: Cozy Puzzle In-Game 1, MintoDog, CC0 1.0.
- Original tempo: 118 BPM; no tempo or pitch change.
- Excerpt: first 32 bars, with a 25 ms circular splice and native encoder alignment.
- Delivered duration: **65.0855328798 seconds**, 2,870,272 frames at 44,100 Hz stereo.
- Master: 16-bit PCM, -23.5 LUFS, -11.6 dBFS true peak; no clipping.
- Ogg: 992,431 bytes; decoded length matches the WAV, with no clipping.
- All four game recordings, including the rhythm WAV/Ogg, were verified byte-identical during preparation. The rhythm chart was not edited.

`prepare_hall_bossa.py` reproduces the new hall and merges all five tracks into
`public/audio/manifest.json`. `public/audio/ATTRIBUTION.txt` identifies every
delivered file's work, composer, source, license and edits. The public tracks
are all CC0; the MIT reference is research material outside the public audio
set. The old FM hall is an explicit legacy export, not the default behavior
of `prepare.py`.

## Arrangement direction for further work

Prefer clear melodic phrases with rests, a rhythm section that supplies the
pulse, and a few complementary instrument colors. Saxophone, flute, mallets,
electric-piano-like chords and a rounded bass can keep a playful game feel
without relying on continuous bright pulse tones. Preserve arrangement changes
and avoid heavy bit-crushing. Compare music and effects together before
declaring the whole app mix pleasant; these file checks do not identify which
part of a live mix caused the user's complaint.

Do not change the existing 32-second/120 BPM rhythm recording independently
of its chart. A later switch to a different song requires a corresponding
timing/chart proposal, even when the new song can be retimed to 120 BPM.
