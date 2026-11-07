# Distinct game recordings

Prepared November 7, 2026. These three recordings give Daisy Breaker,
Cartridge Run and Sam Circuit different compositions. Sam's Beat retains
the existing Welcome to the Item Shop excerpt and its 32-second, 120 BPM
timing. `prepare_games.py` does not change hall or rhythm files. The hall's
later bossa-nova replacement is documented in `REFERENCE_SHORTLIST.md`.

| Game | Recording and composer | License and primary source | Musical direction |
|---|---|---|---|
| Daisy Breaker | Homely Arcade, Spring Spring | [Author's submission](https://opengameart.org/content/homely-arcade), CC0 option | Warm FM arcade chiptune; the author tags it 16-bit. |
| Cartridge Run | Wacky Wobblings, Fupi | [Author's submission](https://opengameart.org/content/wacky-wobblings), CC0 | Slap bass, swing, drums and synth/blues, made in BeepBox and tagged 16-bit. |
| Sam Circuit | Fever Stadium, MintoDog | [Author's submission](https://opengameart.org/content/fever-stadium), CC0 | Synth Eurobeat written for racing, slowed from the author's 165 BPM to 156 BPM without changing pitch. |

All three use the [CC0 1.0 dedication](https://creativecommons.org/publicdomain/zero/1.0/).
Homely Arcade is offered under both OGA-BY 3.0 and CC0; this preparation selects
the CC0 option. Its copyright/attribution field says "Spring Spring". The
other two submissions name Fupi and MintoDog as their respective authors.
Credit is retained in the Ogg metadata and in this record even though CC0
does not require it. The composers do not endorse the app.

Fever Stadium is the composer's existing independent Eurobeat composition.
No audio or melody from Deja Vu was obtained, copied, or recreated. The
32 kHz/16-bit preparation gives it a restrained sampled-game texture. It is
not a claim of exact console-chip emulation or an AI-generated composition.
No music-generation provider or paid account was used.

## Delivery files and timing

| Asset | Loop duration | Sample frames | Tempo | Integrated loudness | True peak |
|---|---:|---:|---|---:|---:|
| `/audio/breaker.ogg`, `/audio/breaker.wav` | 134.968 s | 4,318,976 | Not published; pulse estimate about 128 BPM | -22.5 LUFS | -10.0 dBFS |
| `/audio/runner.ogg`, `/audio/runner.wav` | 46.364 s | 1,483,648 | Not published; swing pulse estimate about 88 BPM, or 176 double-time | -22.0 LUFS | -7.1 dBFS |
| `/audio/kart.ogg`, `/audio/kart.wav` | 90.770 s | 2,904,640 | 156 BPM; author-tagged source 165 BPM | -21.5 LUFS | -10.6 dBFS |

Every new master is stereo 16-bit PCM at 32,000 Hz. Ogg versions decode to
the same frame counts. Loop from zero to the decoded buffer duration.
No clipping was found in either the PCM masters or decoded Ogg files.
The separate manifest contains RMS, PCM/Ogg peaks, file sizes and hashes.

Breaker and Runner are not retimed. Their authors provide no tempo metadata,
so `bpm` is null and approximate pulse estimates are labeled separately.
The estimates came from positive envelope changes in low/mid frequency bands,
autocorrelation, and phase-independent pulse-energy checks. They are not
author-confirmed tempo values and are not intended for rhythm-game judging.

The complete recordings are retained to preserve their arrangements. The
author explicitly supplies Wacky Wobblings and Fever Stadium as loops.
Homely Arcade is prepared as a whole-recording loop; the author does not
make a loop-ready claim. Short loop-join previews are included for review.

## Reproduce

Run `python3 tools/audio/prepare_games.py` from the project root. It requires
Python's standard library, FFmpeg and ffprobe. It verifies the retained source
hashes, processes repeated source periods to provide the filters with context,
keeps one period, prepares a 25 ms circular splice, and applies gentle treble
reduction plus an 11.5 kHz low-pass filter. The racing track uses the
pitch-preserving tempo ratio 156/165. A fixed gain sets each mix's loudness;
no new melody, percussion, heavy bit-crushing, limiter or compressor is added.

The masters are aligned to the native Vorbis encoder's 64-sample boundary,
which changes each nominal period by less than 2 ms. The script verifies
decoded lengths and clipping, creates 14-second music previews and 8-second
loop-join previews, and asserts that hall.wav, hall.ogg, beat.wav and beat.ogg
retain their original hashes. It does not read or change the game chart.

`game-tracks-manifest.json` describes only these new assets and includes the
protected hall/rhythm hashes. The app's main manifest, global credits and
AudioBus track mapping must be updated by the integration owner.

## Retained source files

| File under `sources/game-tracks` | Original download | SHA-256 |
|---|---|---|
| `homely-arcade.ogg` | [Author-hosted recording](https://opengameart.org/sites/default/files/homely_arcade_0.ogg) | `ea9fc11a8b79691ebab390bd51588151c68abbe76155b824890417b5c1070c3c` |
| `wacky-wobblings.ogg` | [Author-hosted loop](https://opengameart.org/sites/default/files/wackywobblings.ogg) | `e33833cfe5276e58deb60aa705846112e1c5ab11d0e2bf4a534082c5e9f476fc` |
| `fever-stadium-165.ogg` | [Author-hosted loop](https://opengameart.org/sites/default/files/fever_stadium_bpm165_0.ogg) | `65c892eba361402e1519c01e5082781931879d247c39a80e45af044303766a6a` |

The source recordings, metadata, waveform continuity and levels were inspected.
The previews support subjective listening by the reviewer. These file checks
do not establish perceptual music quality or audible behavior in the app.

## Credit text for integration

> Daisy Breaker: "Homely Arcade" by Spring Spring, CC0 1.0. Source: https://opengameart.org/content/homely-arcade . Edited for loop playback, sample rate, EQ and level.
>
> Cartridge Run: "Wacky Wobblings" by Fupi, CC0 1.0. Source: https://opengameart.org/content/wacky-wobblings . Edited for loop playback, sample rate, EQ and level.
>
> Sam Circuit: "Fever Stadium" by MintoDog, CC0 1.0. Source: https://opengameart.org/content/fever-stadium . Edited from 165 to 156 BPM with pitch preserved, plus loop, sample-rate, EQ and level preparation.
