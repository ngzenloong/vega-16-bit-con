#!/usr/bin/env python3
"""Prepare the licensed FM rhythm recording; preserve the current hall by default.

Source: Welcome to the Item Shop by congusbongus, CC0 1.0.
This script edits an existing recording; it does not generate a composition.
Requires Python 3 and FFmpeg, with no Python packages or API credentials.
Run from the project root: python3 tools/audio/prepare.py
The superseded FM hall export requires the explicit --legacy-hall flag.
Use prepare_hall_bossa.py for the current hall recording.
"""

from array import array
import argparse
import hashlib
import json
import math
from pathlib import Path
import re
import shutil
import subprocess
import sys
import tempfile
import wave

HERE = Path(__file__).resolve().parent
PUBLIC = HERE.parents[1] / "public" / "audio"
SOURCE = HERE / "sources" / "welcome-to-the-item-shop.ogg"
SOURCE_SHA256 = "a3b783d367a7d1299bc3c34d7d7e1e7a7e23c3e91a89cf63223c6a6af82efd03"
SOURCE_PAGE = "https://opengameart.org/content/welcome-to-the-item-shop"
SOURCE_URL = "https://opengameart.org/sites/default/files/welcome_to_the_item_shop_1.ogg"
LICENSE_URL = "https://creativecommons.org/publicdomain/zero/1.0/"
RATE = 44100
SOURCE_BPM = 115
SOURCE_START = 8 * 60 / SOURCE_BPM  # Skip the two-bar introduction.
SEAM_SECONDS = 0.025
FFMPEG = shutil.which("ffmpeg")


def run(arguments, **kwargs):
    return subprocess.run(arguments, check=True, **kwargs)


def floats(path):
    raw = subprocess.check_output([
        FFMPEG, "-v", "error", "-i", str(path), "-ar", str(RATE), "-ac", "2",
        "-f", "f32le", "-c:a", "pcm_f32le", "-",
    ])
    samples = array("f", raw)
    if sys.byteorder != "little":
        samples.byteswap()
    return samples


def loudness(path):
    output = run([
        FFMPEG, "-hide_banner", "-nostats", "-i", str(path),
        "-af", "ebur128=framelog=verbose:peak=true", "-f", "null", "-",
    ], capture_output=True, text=True).stderr
    summary = output[output.rfind("Summary:"):]
    return {
        "integratedLufs": float(re.search(r"I:\s+(-?[\d.]+) LUFS", summary)[1]),
        "loudnessRangeLu": float(re.search(r"LRA:\s+(-?[\d.]+) LU", summary)[1]),
        "truePeakDbfs": float(re.search(r"Peak:\s+(-?[\d.]+) dBFS", summary)[1]),
    }


def write_float(path, samples):
    raw = array("f", samples)
    if sys.byteorder != "little":
        raw.byteswap()
    run([
        FFMPEG, "-v", "error", "-y", "-f", "f32le", "-ar", str(RATE),
        "-ac", "2", "-i", "-", "-c:a", "pcm_f32le", str(path),
    ], input=raw.tobytes())


def pcm_metrics(path):
    with wave.open(str(path), "rb") as reader:
        assert reader.getframerate() == RATE and reader.getnchannels() == 2
        frames = reader.getnframes()
        samples = array("h", reader.readframes(frames))
    if sys.byteorder != "little":
        samples.byteswap()
    peak = max(abs(value) for value in samples) / 32768
    rms = math.sqrt(sum(value * value for value in samples) / len(samples)) / 32768
    clipped = sum(abs(value) >= 32767 for value in samples)
    assert clipped == 0
    return {
        "sampleFrames": frames,
        "peakDbfs": round(20 * math.log10(peak), 3),
        "rmsDbfs": round(20 * math.log10(rms), 3),
        "clippedSamples": clipped,
        "boundaryStepLinear": [round(abs(samples[c] - samples[-2 + c]) / 32768, 7)
                               for c in range(2)],
    }


def prepare(name, bars, bpm, target_lufs, work):
    duration = bars * 4 * 60 / bpm
    # FFmpeg's native Vorbis encoder ends on a 64-sample boundary. Align the
    # master too, adding less than 1.5 ms for hall; beat remains exactly 32 s.
    frames = math.ceil(duration * RATE / 64) * 64
    # Pitch-preserving 4.35% tempo change for the game; original tempo for hall.
    speed = bpm / SOURCE_BPM
    source_seconds = bars * 4 * 60 / SOURCE_BPM
    prepared = work / f"{name}-prepared.wav"
    filters = (
        f"atrim=start={SOURCE_START:.12f}:duration={source_seconds + .3:.12f},"
        f"asetpts=PTS-STARTPTS,atempo={speed:.12f},"
        "highpass=f=32:p=2,treble=g=-2.5:f=3000:w=0.7,lowpass=f=10500:p=2"
    )
    run([FFMPEG, "-v", "error", "-y", "-i", str(SOURCE), "-af", filters,
         "-ar", str(RATE), "-ac", "2", "-c:a", "pcm_f32le", str(prepared)])
    samples = floats(prepared)
    seam = round(SEAM_SECONDS * RATE)
    assert len(samples) >= (frames + seam) * 2
    # Blend the natural post-boundary continuation into the beginning. The end
    # and the first sample remain adjacent recording samples, while the phrase
    # resolves to its beginning over 25 ms. The beat grid and length do not move.
    for frame in range(seam):
        blend = (1 - math.cos(math.pi * frame / (seam - 1))) / 2
        for channel in range(2):
            i = frame * 2 + channel
            continuation = samples[(frames + frame) * 2 + channel]
            samples[i] = continuation * (1 - blend) + samples[i] * blend
    del samples[frames * 2:]
    loop = work / f"{name}-loop.wav"
    write_float(loop, samples)
    before = loudness(loop)
    gain_db = target_lufs - before["integratedLufs"]
    wav_path = PUBLIC / f"{name}.wav"
    run([FFMPEG, "-v", "error", "-y", "-i", str(loop), "-af", f"volume={gain_db}dB",
         "-ar", str(RATE), "-ac", "2", "-c:a", "pcm_s16le", str(wav_path)])
    measured = pcm_metrics(wav_path)
    assert measured["sampleFrames"] == frames
    measured.update(loudness(wav_path))
    encoders = run([FFMPEG, "-hide_banner", "-encoders"],
                   capture_output=True, text=True).stdout
    codec = ["-c:a", "libvorbis"] if " libvorbis " in encoders else ["-c:a", "vorbis", "-strict", "-2"]
    ogg_path = PUBLIC / f"{name}.ogg"
    run([FFMPEG, "-v", "error", "-y", "-i", str(wav_path), *codec, "-q:a", "5",
         "-metadata", "ARTIST=congusbongus", "-metadata", "TITLE=Welcome to the Item Shop",
         "-metadata", f"COMMENT=CC0 1.0; excerpt, EQ, quiet gain and loop edit. Source: {SOURCE_PAGE}",
         "-metadata", "LOOPSTART=0", "-metadata", f"LOOPEND={frames}",
         "-metadata", f"BPM={bpm}", str(ogg_path)])
    delivered = floats(ogg_path)
    assert len(delivered) == frames * 2, "Ogg decode length differs from WAV"
    delivery_peak = max(abs(value) for value in delivered)
    assert delivery_peak < .95, "Insufficient encoded headroom"
    measured["oggPeakDbfs"] = round(20 * math.log10(delivery_peak), 3)
    measured["oggDecodedFrames"] = len(delivered) // 2
    # Short, independent review files; these fades are only on previews.
    preview = HERE / "previews" / f"{name}-preview.mp3"
    preview.parent.mkdir(exist_ok=True)
    run([FFMPEG, "-v", "error", "-y", "-i", str(wav_path), "-t", "14",
         "-af", "afade=t=in:d=0.03,afade=t=out:st=13.6:d=0.4",
         "-c:a", "libmp3lame", "-b:a", "128k", str(preview)])
    return {
        "title": "Welcome to the Item Shop",
        "artist": "congusbongus",
        "purpose": "Convention hall background" if name == "hall" else "Rhythm-game music",
        "files": {"ogg": f"/audio/{name}.ogg", "wav": f"/audio/{name}.wav"},
        "license": "CC0-1.0", "licenseUrl": LICENSE_URL, "sourcePage": SOURCE_PAGE,
        "bpm": bpm, "sourceBpm": SOURCE_BPM, "timeSignature": "4/4", "bars": bars,
        "beats": bars * 4, "durationSeconds": frames / RATE, "sampleRateHz": RATE,
        "sampleFrames": frames, "channels": 2, "beatOffsetSeconds": 0,
        "secondsPerBeat": 60 / bpm,
        "loop": {"enabled": True, "startSeconds": 0, "endSeconds": frames / RATE},
        "edit": {"sourceStartSeconds": SOURCE_START, "sourceDurationSeconds": source_seconds,
                 "tempoRatio": speed, "preservePitch": True, "seamBlendSeconds": SEAM_SECONDS,
                 "gainDb": round(gain_db, 3), "highShelfDb": -2.5},
        "levels": measured,
        "bytes": {"wav": wav_path.stat().st_size, "ogg": ogg_path.stat().st_size},
        "wavSha256": hashlib.sha256(wav_path.read_bytes()).hexdigest(),
    }


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--legacy-hall", action="store_true",
                        help="Explicitly replace the current hall with the superseded FM hall, as well as preparing beat.")
    args = parser.parse_args()
    if not FFMPEG:
        raise SystemExit("FFmpeg is required to prepare the licensed recording.")
    if not SOURCE.is_file():
        raise SystemExit(f"Download the CC0 source from {SOURCE_URL} to {SOURCE}")
    assert hashlib.sha256(SOURCE.read_bytes()).hexdigest() == SOURCE_SHA256, "Source hash changed"
    PUBLIC.mkdir(parents=True, exist_ok=True)
    tracks = {}
    jobs = [("beat", 16, 120, -21.5)]
    if args.legacy_hall:
        jobs.insert(0, ("hall", 32, 115, -23.5))
    with tempfile.TemporaryDirectory(prefix="prepare-", dir=HERE) as temporary:
        for name, bars, bpm, level in jobs:
            print(f"Preparing {name}...", flush=True)
            tracks[name] = prepare(name, bars, bpm, level, Path(temporary))
            print(json.dumps({"track": name, "duration": tracks[name]["durationSeconds"],
                              "levels": tracks[name]["levels"]}), flush=True)
    manifest_path = PUBLIC / "manifest.json"
    manifest = json.loads(manifest_path.read_text()) if manifest_path.exists() else {"tracks": {}}
    for track in tracks.values():
        track.update({"preparationSource": "tools/audio/prepare.py", "sourceDownload": SOURCE_URL,
                      "sourceSha256": SOURCE_SHA256,
                      "instrumentation": "Author-created BambooTracker/YM2608 FM arrangement with flute, bells, vibraphone, soft brass, choir and plucked accompaniment."})
    manifest.setdefault("tracks", {}).update(tracks)
    manifest["provenance"] = "Separately credited composer-made CC0 recordings; see each track for its source. No music-generation provider was used."
    manifest.setdefault("license", "CC0-1.0")
    manifest.setdefault("licenseUrl", LICENSE_URL)
    manifest.setdefault("playback", "Loop each decoded buffer from zero to its own duration. Beat remains exactly 32 seconds at 120 BPM.")
    manifest_path.write_text(json.dumps(manifest, indent=2) + "\n")
    print("Prepared beat and its preview." + (" Explicit legacy hall export also completed." if args.legacy_hall else " Current hall preserved."), flush=True)


if __name__ == "__main__":
    main()
