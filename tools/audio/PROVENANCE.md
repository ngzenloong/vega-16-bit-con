# Music source and preparation

## Delivered music

- **Work:** Welcome to the Item Shop
- **Composer/uploader:** congusbongus
- **Primary source:** https://opengameart.org/content/welcome-to-the-item-shop
- **Original recording:** https://opengameart.org/sites/default/files/welcome_to_the_item_shop_1.ogg
- **Editable composition:** https://opengameart.org/sites/default/files/welcome_to_the_item_shop.btm_.zip
- **License:** CC0 1.0, linked in the author's submission.
- **License terms:** https://creativecommons.org/publicdomain/zero/1.0/
- **Checked:** 2026-11-06.

The author describes a comfortable, upbeat 16-bit town/shop theme made with
BambooTracker. The supplied `.btm` identifies the work and composer, sets the
tempo to 115 BPM with speed 6 and 32-row patterns, and includes flute, calm
bell, vibraphone, soft brass, choir and other FM instruments. The source score
was inspected using the format implemented by BambooTracker's official
`BambooTracker/io/btm_io.cpp` loader. The audible recording, rather than a new
render or synthesized imitation, is used for the app.

Recording SHA-256:
`a3b783d367a7d1299bc3c34d7d7e1e7a7e23c3e91a89cf63223c6a6af82efd03`

Editable score SHA-256:
`62e503816dad233d297e46a68ef755f1fcdb37d6482686bfa766705d43965f18`

## Edits

The two-bar introduction is omitted. The hall takes the next 32 bars at the
original 115 BPM; the rhythm game takes the next 16 bars with a gentle,
pitch-preserving 115-to-120 BPM tempo adjustment. Both retain the composer's
melody, harmony, instrumentation and arrangement. A 25 ms circular splice
smooths the join without shortening the musical timeline. A small high-shelf
cut softens the timbre, followed by fixed gain targeting -23.5 LUFS for the
hall and -21.5 LUFS for the game. No new melody or metronome is layered on top.

`prepare.py` records measured PCM/encoded peaks, RMS, integrated loudness,
duration, sample frames, loop boundaries and source hashes in the manifest.
The Ogg files are decoded after encoding to verify their exact duration and
headroom. Short playback previews are supplied for subjective review; source
score, phrase structure, waveform continuity and loudness were inspected.

The hall master is extended by 0.884 ms to a 64-sample encoder boundary, so its
WAV and native Vorbis decode contain exactly the same 2,945,152 frames. Its
tempo remains nominally 115 BPM. The game master is exactly 1,411,200 frames,
32 seconds and 120 BPM.

## Music skills and available tooling researched

1. **ElevenLabs official music skill:**
   https://skills.sh/elevenlabs/skills/music
   and https://github.com/elevenlabs/skills.
   This is actual model-based music generation with composition-plan support;
   it requires ElevenLabs account/API authorization. No such generation was
   invoked for this work.
2. **ByteDance DeerFlow music-generation:**
   https://skills.sh/bytedance/deer-flow/music-generation
   and https://github.com/bytedance/deer-flow/blob/main/skills/public/music-generation/SKILL.md.
   It calls the MiniMax music API and requires `MINIMAX_API_KEY`. No API was
   invoked and no credential files were searched.
3. **Local music-gen skill:**
   https://github.com/sirruf/music-gen-skill.
   This uses MIDI plus FluidSynth/Timidity and a SoundFont for sampled
   instruments. The local tool check found FFmpeg but no MIDI renderer or
   installed SoundFont. Its direct-waveform fallback was not used.

The November 6 tooling check found fal and Runway available but unconnected.
Neither provider was used. The soundtrack uses the composer-made CC0 recording
described above. No downloaded skill code was installed or executed during
preparation.
