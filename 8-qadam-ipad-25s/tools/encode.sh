#!/usr/bin/env bash
# frames/*.png + audio/music.wav -> out/8-qadam-ipad-25s.mp4 (2048x1536, H.264 High, yuv420p, BT.709, 30 fps, AAC)
set -euo pipefail
cd "$(dirname "$0")/.."
n=$(ls frames/f_*.png | wc -l)
if [ "$n" -ne 750 ]; then echo "кадрлар толық емес: $n/750 — алдымен: node tools/render.mjs" >&2; exit 1; fi
mkdir -p out
ffmpeg -hide_banner -y -framerate 30 -i frames/f_%04d.png -i audio/music.wav \
  -vf "scale=out_color_matrix=bt709:out_range=tv,format=yuv420p" \
  -c:v libx264 -preset slow -crf 16 -profile:v high -level:v 5.0 -g 60 -bf 2 \
  -color_primaries bt709 -color_trc bt709 -colorspace bt709 -color_range tv \
  -c:a aac -b:a 256k -ar 48000 -ac 2 \
  -frames:v 750 -t 25 -movflags +faststart \
  -metadata title="Өміріңді өзгертетін 8 қадам" \
  out/8-qadam-ipad-25s.mp4
ls -lh out/8-qadam-ipad-25s.mp4
