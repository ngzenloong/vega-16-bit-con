#!/usr/bin/env python3
"""Prepare three distinct licensed game recordings without changing hall/beat.

Run: python3 tools/audio/prepare_games.py
Requires Python's standard library and FFmpeg. Source recordings are retained
under sources/game-tracks. This edits existing CC0 music; it is not a music
generation model, a cover of Deja Vu, or a console-emulation claim.
"""

from array import array
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
RATE = 32000
FFMPEG = shutil.which("ffmpeg")
FFPROBE = shutil.which("ffprobe")
CC0 = "https://creativecommons.org/publicdomain/zero/1.0/"
TRACKS = [
    {
        "id": "breaker", "title": "Homely Arcade", "artist": "Spring Spring",
        "sourceFile": "homely-arcade.ogg",
        "sourceUrl": "https://opengameart.org/sites/default/files/homely_arcade_0.ogg",
        "sourcePage": "https://opengameart.org/content/homely-arcade",
        "sourceSha256": "ea9fc11a8b79691ebab390bd51588151c68abbe76155b824890417b5c1070c3c",
        "sourceBpm": None, "bpm": None, "estimatedPulseBpm": 128,
        "bpmEvidence": "The author publishes no BPM. An onset-envelope pulse estimate is about 128 BPM; the recording is not retimed.",
        "style": "Author-described warm 16-bit FM arcade chiptune.",
        "sourceLoopReady": False,
        "licenseNote": "The author offers OGA-BY 3.0 and CC0. This use selects the CC0 option. Attribution notice: Spring Spring.",
        "tempoRatio": 1.0, "targetLufs": -22.5, "trebleDb": -1.5,
        "previewStart": 7.5,
    },
    {
        "id": "runner", "title": "Wacky Wobblings", "artist": "Fupi",
        "sourceFile": "wacky-wobblings.ogg",
        "sourceUrl": "https://opengameart.org/sites/default/files/wackywobblings.ogg",
        "sourcePage": "https://opengameart.org/content/wacky-wobblings",
        "sourceSha256": "e33833cfe5276e58deb60aa705846112e1c5ab11d0e2bf4a534082c5e9f476fc",
        "sourceBpm": None, "bpm": None, "estimatedPulseBpm": 88,
        "bpmEvidence": "The author publishes no BPM. The swing pulse estimates near 88 BPM (176 double-time); the recording is not retimed.",
        "style": "Author-described 16-bit-style slap-bass, swing, drums and synth/blues arrangement made in BeepBox.",
        "sourceLoopReady": True,
        "licenseNote": "The author's original submission licenses the recording under CC0. The separate introduction file is not used.",
        "tempoRatio": 1.0, "targetLufs": -22.0, "trebleDb": -1.8,
        "previewStart": 0,
    },
    {
        "id": "kart", "title": "Fever Stadium", "artist": "MintoDog",
        "sourceFile": "fever-stadium-165.ogg",
        "sourceUrl": "https://opengameart.org/sites/default/files/fever_stadium_bpm165_0.ogg",
        "sourcePage": "https://opengameart.org/content/fever-stadium",
        "sourceSha256": "65c892eba361402e1519c01e5082781931879d247c39a80e45af044303766a6a",
        "sourceBpm": 165, "bpm": 156, "estimatedPulseBpm": None,
        "bpmEvidence": "165 BPM is supplied in the author's filename and embedded BPM tag. The edit uses a pitch-preserving 156/165 tempo ratio.",
        "style": "Author-described synth Eurobeat for a racing game, prepared with restrained 32 kHz/16-bit sample texture. It is not exact console-chip emulation.",
        "sourceLoopReady": True,
        "licenseNote": "The author's original submission licenses this track under CC0. The faster Climax variant is not used.",
        "tempoRatio": 156 / 165, "targetLufs": -21.5, "trebleDb": -1.2,
        "previewStart": 6.153846153846154,
    },
]


def run(args, **kwargs):
    return subprocess.run(args, check=True, **kwargs)


def digest(path):
    return hashlib.sha256(path.read_bytes()).hexdigest()


def probe(path):
    return json.loads(subprocess.check_output([
        FFPROBE, "-v", "error", "-show_entries",
        "stream=sample_rate,channels,duration:format=duration,size:stream_tags",
        "-of", "json", str(path),
    ]))


def decode(path):
    data = subprocess.check_output([
        FFMPEG, "-v", "error", "-i", str(path), "-ar", str(RATE), "-ac", "2",
        "-c:a", "pcm_f32le", "-f", "f32le", "-",
    ])
    samples = array("f", data)
    if sys.byteorder != "little":
        samples.byteswap()
    return samples


def float_wav(path, samples):
    data = array("f", samples)
    if sys.byteorder != "little":
        data.byteswap()
    run([FFMPEG, "-v", "error", "-y", "-f", "f32le", "-ar", str(RATE),
         "-ac", "2", "-i", "-", "-c:a", "pcm_f32le", str(path)], input=data.tobytes())


def loudness(path):
    output = run([
        FFMPEG, "-hide_banner", "-nostats", "-i", str(path),
        "-af", "ebur128=framelog=verbose:peak=true", "-f", "null", "-",
    ], capture_output=True, text=True).stderr
    output = output[output.rfind("Summary:"):]
    return {
        "integratedLufs": float(re.search(r"I:\s+(-?[\d.]+) LUFS", output)[1]),
        "loudnessRangeLu": float(re.search(r"LRA:\s+(-?[\d.]+) LU", output)[1]),
        "truePeakDbfs": float(re.search(r"Peak:\s+(-?[\d.]+) dBFS", output)[1]),
    }


def metrics(path):
    with wave.open(str(path), "rb") as w:
        assert w.getframerate() == RATE and w.getnchannels() == 2 and w.getsampwidth() == 2
        frames = w.getnframes()
        samples = array("h", w.readframes(frames))
    if sys.byteorder != "little":
        samples.byteswap()
    peak = max(abs(n) for n in samples) / 32768
    rms = math.sqrt(sum(n * n for n in samples) / len(samples)) / 32768
    clipped = sum(abs(n) >= 32767 for n in samples)
    assert clipped == 0
    return {
        "sampleFrames": frames, "peakDbfs": round(20 * math.log10(peak), 3),
        "rmsDbfs": round(20 * math.log10(rms), 3), "clippedSamples": clipped,
        "boundaryStepLinear": [round(abs(samples[c] - samples[-2 + c]) / 32768, 7)
                               for c in (0, 1)],
    }


def prepare(spec, work, codec):
    name = spec["id"]
    source = HERE / "sources" / "game-tracks" / spec["sourceFile"]
    assert source.is_file(), f"Missing source: {spec['sourceUrl']}"
    assert digest(source) == spec["sourceSha256"], "Source hash changed"
    source_info = probe(source)
    source_duration = float(source_info["format"]["duration"])
    nominal_duration = source_duration / spec["tempoRatio"]
    # Native Vorbis rounds the last granule to a 64-sample boundary. The aligned
    # PCM master therefore differs from the nominal period by less than 2 ms.
    frames = math.ceil(nominal_duration * RATE / 64) * 64
    duration = frames / RATE
    prepared = work / f"{name}-periodic.wav"
    filters = []
    if spec["tempoRatio"] != 1:
        filters.append(f"atempo={spec['tempoRatio']:.12f}")
    filters += ["highpass=f=30:p=2", f"treble=g={spec['trebleDb']}:f=4200:w=0.7",
                "lowpass=f=11500:p=2"]
    # Process three copies and keep the middle period. This gives the EQ and
    # tempo processor real musical context at both ends of the exported loop.
    run([FFMPEG, "-v", "error", "-y", "-stream_loop", "2", "-i", str(source),
         "-af", ",".join(filters), "-ar", str(RATE), "-ac", "2",
         "-c:a", "pcm_f32le", str(prepared)])
    rendered = decode(prepared)
    start = round(nominal_duration * RATE)
    seam = round(.025 * RATE)
    samples = rendered[start * 2:(start + frames + seam) * 2]
    assert len(samples) == (frames + seam) * 2
    for i in range(seam):
        blend = (1 - math.cos(math.pi * i / (seam - 1))) / 2
        for c in (0, 1):
            target = i * 2 + c
            samples[target] = samples[(frames + i) * 2 + c] * (1 - blend) + samples[target] * blend
    del samples[frames * 2:]
    loop = work / f"{name}-loop.wav"
    float_wav(loop, samples)
    before = loudness(loop)
    gain = spec["targetLufs"] - before["integratedLufs"]
    wav = PUBLIC / f"{name}.wav"
    run([FFMPEG, "-v", "error", "-y", "-i", str(loop), "-af", f"volume={gain}dB",
         "-ar", str(RATE), "-ac", "2", "-c:a", "pcm_s16le", str(wav)])
    measures = metrics(wav)
    assert measures["sampleFrames"] == frames
    measures.update(loudness(wav))
    assert measures["truePeakDbfs"] < -3
    ogg = PUBLIC / f"{name}.ogg"
    run([FFMPEG, "-v", "error", "-y", "-i", str(wav), *codec, "-q:a", "5",
         "-metadata", f"ARTIST={spec['artist']}", "-metadata", f"TITLE={spec['title']}",
         "-metadata", f"COPYRIGHT=CC0 1.0; {spec['sourcePage']}",
         "-metadata", "COMMENT=Licensed recording; 32 kHz sample preparation, quiet fixed gain, EQ and loop splice.",
         "-metadata", "LOOPSTART=0", "-metadata", f"LOOPEND={frames}",
         *(["-metadata", f"BPM={spec['bpm']}"] if spec["bpm"] else []), str(ogg)])
    delivered = decode(ogg)
    assert len(delivered) == frames * 2, "Ogg duration differs from PCM master"
    peak = max(abs(value) for value in delivered)
    assert peak < 1
    measures["oggPeakDbfs"] = round(20 * math.log10(peak), 3)
    measures["oggClippedSamples"] = sum(abs(value) >= 1 for value in delivered)
    measures["oggDecodedFrames"] = len(delivered) // 2
    previews = HERE / "previews"
    previews.mkdir(exist_ok=True)
    run([FFMPEG, "-v", "error", "-y", "-ss", str(spec["previewStart"]), "-i", str(wav),
         "-t", "14", "-af", "afade=t=in:d=0.03,afade=t=out:st=13.6:d=0.4",
         "-c:a", "libmp3lame", "-b:a", "128k", str(previews / f"{name}-preview.mp3")])
    # A separate review clip contains the actual loop join, with only its outer
    # edges faded. The join itself has the same samples as the delivered asset.
    join = array("f", samples[-4 * RATE * 2:])
    join.extend(samples[:4 * RATE * 2])
    join_wav = work / f"{name}-join.wav"
    float_wav(join_wav, join)
    run([FFMPEG, "-v", "error", "-y", "-i", str(join_wav),
         "-af", f"volume={gain}dB,afade=t=in:d=0.03,afade=t=out:st=7.6:d=0.4",
         "-c:a", "libmp3lame", "-b:a", "128k", str(previews / f"{name}-loop-preview.mp3")])
    return {
        **{key: value for key, value in spec.items() if key not in ("previewStart", "targetLufs", "trebleDb")},
        "license": "CC0-1.0", "licenseUrl": CC0,
        "files": {"ogg": f"/audio/{name}.ogg", "wav": f"/audio/{name}.wav"},
        "sourceDurationSeconds": source_duration,
        "durationSeconds": duration, "sampleRateHz": RATE, "channels": 2, "pcmBits": 16,
        "sampleFrames": frames, "loop": {"startSeconds": 0, "endSeconds": duration},
        "loopPreparation": "Whole-recording period with 25 ms circular splice; no newly composed melody or percussion.",
        "gainDb": round(gain, 3), "highShelfDb": spec["trebleDb"],
        "lowpassHz": 11500, "levels": measures,
        "bytes": {"ogg": ogg.stat().st_size, "wav": wav.stat().st_size},
        "wavSha256": digest(wav), "oggSha256": digest(ogg),
        "preview": f"tools/audio/previews/{name}-preview.mp3",
        "loopPreview": f"tools/audio/previews/{name}-loop-preview.mp3",
    }


def main():
    if not FFMPEG or not FFPROBE:
        raise SystemExit("FFmpeg and ffprobe are required.")
    protected = {str(path.relative_to(PUBLIC)): digest(path)
                 for name in ("hall", "beat") for ext in ("wav", "ogg")
                 for path in [PUBLIC / f"{name}.{ext}"]}
    encoders = run([FFMPEG, "-hide_banner", "-encoders"], capture_output=True, text=True).stdout
    codec = ["-c:a", "libvorbis"] if " libvorbis " in encoders else ["-c:a", "vorbis", "-strict", "-2"]
    tracks = {}
    with tempfile.TemporaryDirectory(prefix="prepare-games-", dir=HERE) as temporary:
        for spec in TRACKS:
            print(f"Preparing {spec['id']}: {spec['title']}", flush=True)
            tracks[spec["id"]] = prepare(spec, Path(temporary), codec)
            print(json.dumps({"id": spec["id"], "duration": tracks[spec["id"]]["durationSeconds"],
                              "levels": tracks[spec["id"]]["levels"]}), flush=True)
    for name, expected in protected.items():
        assert digest(PUBLIC / name) == expected, f"Protected audio changed: {name}"
    manifest = {
        "preparedOn": "2026-11-07", "preparationScript": "tools/audio/prepare_games.py",
        "provenance": "Three different author-published CC0 recordings. No music-generation provider or copied Deja Vu melody was used. The 32 kHz/16-bit preparation is a restrained sample texture, not console-chip emulation.",
        "protectedAudioSha256": protected,
        "bpmNote": "Kart tempo is author-tagged and adjusted to 156 BPM. Breaker and Runner have no published BPM; their approximate pulse estimates are separately labeled and neither recording is retimed.",
        "tracks": tracks,
    }
    (HERE / "game-tracks-manifest.json").write_text(json.dumps(manifest, indent=2) + "\n")
    print("Prepared three independent game loops; hall and beat remain byte-identical.", flush=True)


if __name__ == "__main__":
    main()
