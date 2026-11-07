#!/usr/bin/env python3
"""Prepare the life-sim hall score; preserve every game recording.

Source: Apple Cider by Zane Little, CC0 1.0. The author supplied this loop.
Run after prepare.py and prepare_games.py when rebuilding all audio assets.
prepare.py now prepares beat only unless --legacy-hall is explicitly supplied.
No composition model, generated melody, or chiptune synthesis is used here.
"""
from array import array
import hashlib
import json
import math
from pathlib import Path
import subprocess
import tempfile
import prepare as audio_utils

HERE = Path(__file__).resolve().parent
PUBLIC = HERE.parents[1] / "public" / "audio"
SOURCE = HERE / "references" / "apple-cider-loop.wav"
SOURCE_SHA = "afb73875b0485e12f71094683a6df58ed2b2fd92c493d93a9db07bed00e0177c"
SOURCE_PAGE = "https://opengameart.org/content/apple-cider-juiced"
SOURCE_URL = "https://opengameart.org/sites/default/files/apple_cider_loop.wav"
LICENSE_URL = "https://creativecommons.org/publicdomain/zero/1.0/"
RATE = 44100
DURATION = 86.4
FRAMES = round(DURATION * RATE)


def sha(path):
    return hashlib.sha256(path.read_bytes()).hexdigest()


def run(args, **kwargs):
    return subprocess.run(args, check=True, **kwargs)


def main():
    assert sha(SOURCE) == SOURCE_SHA
    protected = {path.name: sha(path) for name in ("beat", "breaker", "runner", "kart")
                 for ext in ("wav", "ogg") for path in [PUBLIC / f"{name}.{ext}"] if path.exists()}
    with tempfile.TemporaryDirectory(prefix="hall-life-", dir=HERE) as temporary:
        work = Path(temporary)
        prepared = work / "prepared.wav"
        run([audio_utils.FFMPEG, "-v", "error", "-y", "-stream_loop", "1", "-i", str(SOURCE),
             "-af", "highpass=f=30:p=2,treble=g=-2.5:f=4500:w=0.7,lowpass=f=12500:p=2",
             "-t", str(FRAMES / RATE + .2), "-ar", str(RATE), "-ac", "2",
             "-c:a", "pcm_f32le", str(prepared)])
        samples = audio_utils.floats(prepared)
        seam = round(.025 * RATE)
        assert len(samples) >= (FRAMES + seam) * 2
        for i in range(seam):
            weight = (1 - math.cos(math.pi * i / (seam - 1))) / 2
            for c in (0, 1):
                index = i * 2 + c
                samples[index] = samples[(FRAMES + i) * 2 + c] * (1 - weight) + samples[index] * weight
        del samples[FRAMES * 2:]
        loop = work / "loop.wav"
        audio_utils.write_float(loop, samples)
        gain = -23.5 - audio_utils.loudness(loop)["integratedLufs"]
        wav = PUBLIC / "hall.wav"
        run([audio_utils.FFMPEG, "-v", "error", "-y", "-i", str(loop),
             "-af", f"volume={gain}dB", "-ar", str(RATE), "-ac", "2",
             "-c:a", "pcm_s16le", str(wav)])
        levels = audio_utils.pcm_metrics(wav)
        levels.update(audio_utils.loudness(wav))
        assert levels["sampleFrames"] == FRAMES and levels["truePeakDbfs"] < -3
        encoders = run([audio_utils.FFMPEG, "-hide_banner", "-encoders"], capture_output=True, text=True).stdout
        codec = ["-c:a", "libvorbis"] if " libvorbis " in encoders else ["-c:a", "vorbis", "-strict", "-2"]
        ogg = PUBLIC / "hall.ogg"
        run([audio_utils.FFMPEG, "-v", "error", "-y", "-i", str(wav), *codec, "-q:a", "5",
             "-metadata", "ARTIST=Zane Little", "-metadata", "TITLE=Apple Cider",
             "-metadata", f"COPYRIGHT=CC0 1.0; {SOURCE_PAGE}",
             "-metadata", "COMMENT=Full author loop; gentle EQ, quiet gain and 25ms seam preparation; original tempo.",
             "-metadata", "LOOPSTART=0",
             "-metadata", f"LOOPEND={FRAMES}", str(ogg)])
        decoded = audio_utils.floats(ogg)
        assert len(decoded) == FRAMES * 2 and max(abs(v) for v in decoded) < 1
        levels["oggDecodedFrames"] = len(decoded) // 2
        levels["oggPeakDbfs"] = round(20 * math.log10(max(abs(v) for v in decoded)), 3)
        levels["oggClippedSamples"] = sum(abs(v) >= 1 for v in decoded)
        previews = HERE / "previews"
        run([audio_utils.FFMPEG, "-v", "error", "-y", "-i", str(wav), "-t", "14",
             "-af", "afade=t=in:d=0.03,afade=t=out:st=13.6:d=0.4", "-c:a", "libmp3lame",
             "-b:a", "128k", str(previews / "hall-preview.mp3")])
        join = array("f", samples[-4 * RATE * 2:]); join.extend(samples[:4 * RATE * 2])
        join_file = work / "join.wav"
        audio_utils.write_float(join_file, join)
        run([audio_utils.FFMPEG, "-v", "error", "-y", "-i", str(join_file),
             "-af", f"volume={gain}dB,afade=t=in:d=0.03,afade=t=out:st=7.6:d=0.4",
             "-c:a", "libmp3lame", "-b:a", "128k", str(previews / "hall-loop-preview.mp3")])
        hall = {
            "title": "Apple Cider", "artist": "Zane Little",
            "purpose": "Convention hall background", "files": {"ogg": "/audio/hall.ogg", "wav": "/audio/hall.wav"},
            "license": "CC0-1.0", "licenseUrl": LICENSE_URL, "sourcePage": SOURCE_PAGE,
            "sourceDownload": SOURCE_URL, "sourceSha256": SOURCE_SHA,
            "preparationSource": "tools/audio/prepare_hall_life.py",
            "instrumentation": "Author tags the original work as acoustic, guitar, whistle, flute and bells; the pack explicitly references Animal Crossing. No Nintendo melody is used.",
            "bpm": None, "sourceBpm": None, "durationSeconds": FRAMES / RATE, "sampleRateHz": RATE,
            "sampleFrames": FRAMES, "channels": 2,
            "loop": {"enabled": True, "startSeconds": 0, "endSeconds": FRAMES / RATE},
            "edit": {"sourceStartSeconds": 0, "sourceDurationSeconds": DURATION,
                     "tempoRatio": 1, "preservePitch": True, "seamBlendSeconds": .025,
                     "gainDb": round(gain, 3), "highShelfDb": -2.5, "lowpassHz": 12500},
            "levels": levels, "bytes": {"wav": wav.stat().st_size, "ogg": ogg.stat().st_size},
            "wavSha256": sha(wav), "oggSha256": sha(ogg),
        }
    for filename, expected in protected.items():
        assert sha(PUBLIC / filename) == expected, f"Game audio changed: {filename}"
    manifest_path = PUBLIC / "manifest.json"
    manifest = json.loads(manifest_path.read_text())
    beat = manifest["tracks"]["beat"]
    for field in ("sourcePage", "sourceDownload", "sourceSha256", "instrumentation", "preparationSource"):
        if field in manifest:
            beat.setdefault(field, manifest.pop(field))
    manifest["tracks"]["hall"] = hall
    extra = HERE / "game-tracks-manifest.json"
    if extra.exists():
        manifest["tracks"].update(json.loads(extra.read_text())["tracks"])
    manifest["provenance"] = "Separately credited composer-made CC0 recordings; see each track for its source. Hall uses Zane Little's acoustic life-sim loop. Rhythm retains congusbongus's FM recording. No music-generation provider was used."
    manifest["preparationScripts"] = ["tools/audio/prepare.py", "tools/audio/prepare_games.py", "tools/audio/prepare_hall_life.py"]
    manifest_path.write_text(json.dumps(manifest, indent=2) + "\n")
    (HERE / "hall-life-manifest.json").write_text(json.dumps({"hall": hall, "protectedGameAudioSha256": protected}, indent=2) + "\n")
    print(json.dumps({"duration": hall["durationSeconds"], "bpm": None, "bytes": hall["bytes"], "levels": levels}, indent=2))
    print("Hall changed to the acoustic life-sim recording; all game audio is byte-identical.")


if __name__ == "__main__":
    main()
