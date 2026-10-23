#!/usr/bin/env bash
# Full pipeline: rig QA → events → audio → 1080×1920@60 render → mux → verify.
# Usage: bash tools/render_final.sh   (≈ 15–25 min on 4 cores)
set -euo pipefail
cd "$(dirname "$0")/.."
mkdir -p build output

echo "== rig check";        npm run -s check
echo "== events";           npm run -s events
echo "== audio";            python3 tools/make_audio.py
echo "== video";            npx remotion render BesUaqyt build/video.mp4 \
                              --muted --codec=h264 --crf=16 --x264-preset=slow \
                              --pixel-format=yuv420p --log=error
echo "== mux";              ffmpeg -v error -y -i build/video.mp4 -i build/audio/master.wav \
                              -map 0:v:0 -map 1:a:0 -c:v copy \
                              -c:a aac -b:a 256k -ar 48000 -ac 2 \
                              -movflags +faststart -shortest output/final.mp4
echo "== verify";           python3 tools/verify.py output/final.mp4
