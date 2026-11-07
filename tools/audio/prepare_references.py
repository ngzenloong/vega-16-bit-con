#!/usr/bin/env python3
"""Create short, level-matched reference previews without changing live tracks."""
from pathlib import Path
import hashlib
import json
import subprocess
import tempfile
import prepare as audio_utils

HERE = Path(__file__).resolve().parent
REFERENCES = [
    {"id": "cozy", "file": "cozy-puzzle-118.ogg", "startSeconds": 8.135593220338983,
     "title": "Cozy Puzzle In-Game 1", "artist": "MintoDog", "bpm": 118,
     "license": "CC0-1.0", "source": "https://opengameart.org/content/cozy-puzzle-in-game-1"},
    {"id": "urban", "file": "urban-theme-115.ogg", "startSeconds": 8.347826086956522,
     "title": "Urban Theme", "artist": "MintoDog", "bpm": 115,
     "license": "CC0-1.0", "source": "https://opengameart.org/content/urban-theme"},
    {"id": "riftpane-mit", "file": "riftpane.mp3", "startSeconds": 20,
     "title": "Riftpane", "artist": "Riftpane Project Contributors", "bpm": None,
     "license": "MIT (explicit audio grant in README)", "source": "https://github.com/sakurablush/riftpane#music"},
]


def main():
    results = []
    with tempfile.TemporaryDirectory(prefix="reference-previews-", dir=HERE) as temporary:
        for ref in REFERENCES:
            source = HERE / "references" / ref["file"]
            clip = Path(temporary) / f"{ref['id']}.wav"
            subprocess.run([audio_utils.FFMPEG, "-v", "error", "-y", "-ss", str(ref["startSeconds"]),
                            "-i", str(source), "-t", "14", "-ar", "44100", "-ac", "2",
                            "-af", "afade=t=in:d=0.03,afade=t=out:st=13.6:d=0.4",
                            "-c:a", "pcm_f32le", str(clip)], check=True)
            before = audio_utils.loudness(clip)
            gain = min(-22 - before["integratedLufs"], -3 - before["truePeakDbfs"])
            target = HERE / "previews" / f"reference-{ref['id']}.mp3"
            subprocess.run([audio_utils.FFMPEG, "-v", "error", "-y", "-i", str(clip),
                            "-af", f"volume={gain}dB", "-c:a", "libmp3lame", "-b:a", "128k",
                            "-metadata", f"ARTIST={ref['artist']}", "-metadata", f"TITLE={ref['title']}",
                            "-metadata", f"COMMENT=Reference excerpt; {ref['license']}; {ref['source']}",
                            str(target)], check=True)
            results.append({**ref, "durationSeconds": 14, "gainDb": round(gain, 3),
                            "sourceSha256": hashlib.sha256(source.read_bytes()).hexdigest(),
                            "preview": str(target.relative_to(HERE.parents[1])),
                            "levels": audio_utils.loudness(target)})
            print(json.dumps(results[-1]), flush=True)
    (HERE / "references" / "preview-manifest.json").write_text(json.dumps(results, indent=2) + "\n")


if __name__ == "__main__":
    main()
