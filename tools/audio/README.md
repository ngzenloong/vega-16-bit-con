# Convention music

The soundtrack uses **Welcome to the Item Shop** by **congusbongus**, released
by the composer under [CC0 1.0](https://creativecommons.org/publicdomain/zero/1.0/).
The [author's source page](https://opengameart.org/content/welcome-to-the-item-shop)
includes both the recording and an editable BambooTracker composition.

The arrangement uses warm YM2608 FM flute, bells, vibraphone, soft brass, choir,
and plucked accompaniment. `hall` preserves 32 bars at the original 115 BPM
(about 66.78 seconds). `beat` uses a 16-bar section at 120 BPM, with a small
pitch-preserving tempo change, and is exactly 32 seconds.

Run `python3 tools/audio/prepare.py` from the project root to reproduce the
WAV masters, Ogg delivery files, manifest, and 14-second MP3 previews. The
script requires Python's standard library and FFmpeg. It verifies the source
hash, softens the high frequencies, uses fixed gain for a quiet mix, prepares
the loop joins, and checks both PCM and decoded Ogg lengths and peak levels.
It uses no music-generation API, model, or account.

See `PROVENANCE.md` for source/license evidence and the researched music skills.
The `sources` directory retains the author's original recording and editable
`.btm` score. `previews` contains short playable review copies.

For Web Audio, set `loopStart = 0` and use the duration of the selected decoded
buffer for `loopEnd`. The hall is longer than 32 seconds. The rhythm game's
beat `n` occurs at `contextTime + n * 0.5` seconds; its track starts on beat zero.
