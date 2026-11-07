# Audio preparation

Current order: `python3 tools/audio/prepare.py`, `python3 tools/audio/prepare_games.py`, then `python3 tools/audio/prepare_hall_life.py`.

The hall is Apple Cider by Zane Little, CC0, using the author's full loop. The old bossa and FM hall preparations remain reproducible references; running them intentionally replaces the hall until `prepare_hall_life.py` runs again. Public credits and manifest name the final files. OGG loads first; WAV is a compatibility fallback. A two-buffer decoded cache limits retained music memory.

## Reproduce current assets

Run these from the project root, using Python 3 and FFmpeg:

```sh
python3 tools/audio/prepare.py
python3 tools/audio/prepare_games.py
python3 tools/audio/prepare_hall_bossa.py
python3 tools/audio/prepare_references.py
```

`prepare.py` now prepares **beat only** by default and preserves the other
manifest entries. The superseded FM hall is available only through the
explicit `--legacy-hall` flag, which intentionally replaces the current hall.
Use `prepare_hall_bossa.py` for the current hall.

Original recordings are retained in `sources` and `references`; scripts verify
their hashes. The production scripts check PCM/Ogg duration and clipping.
Short music and loop-join previews are in `previews`.

`REFERENCE_SHORTLIST.md` distinguishes the verified MIT audio reference from
the recommended CC0 arrangements. The reference excerpts are research assets,
not extra live game tracks. No music-generation API, model or paid account is
used in these preparation scripts.

For Web Audio, set `loopStart = 0` and use the selected decoded buffer's own
duration for `loopEnd`. Only the rhythm game uses the 32-second/120 BPM clock.
The authored note chart controls its required inputs.
