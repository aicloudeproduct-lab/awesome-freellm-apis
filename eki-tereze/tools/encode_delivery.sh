#!/usr/bin/env bash
# Two-pass encode of the composed film to a size that fits a GitHub file
# (≤ 100 MB) → output/final.mp4. Needs build/final/{scene.mp4,text.mov} from
# tools/render_final.sh; its CRF master is kept as output/final_master_crf19.mp4.
# Variant with an external soundtrack (no subtitles):
#   TEXT=build/final/text_nosubs.mov AUDIO=build/audio/master_replaced.wav DEST=output/final_speech.mp4 tools/encode_delivery.sh
set -euo pipefail
cd "$(dirname "$0")/.."
OUT=build/final
VB=${VB:-5600k}
TEXT=${TEXT:-$OUT/text.mov}
AUDIO=${AUDIO:-build/audio/master.wav}
DEST=${DEST:-output/final.mp4}
FC="[0:v]scale=2160:3840:flags=lanczos+accurate_rnd[bg];[bg][1:v]overlay=format=auto,format=yuv420p[v]"
VID=(-filter_complex "$FC" -map '[v]' -c:v libx264 -preset slow -b:v "$VB" -maxrate 9M -bufsize 18M
     -profile:v high -level 5.1 -r 24 -fps_mode cfr -passlogfile "$OUT/x264pass")
ffmpeg -v error -y -i "$OUT/scene.mp4" -i "$TEXT" "${VID[@]}" -pass 1 -an -f mp4 /dev/null
ffmpeg -v error -y -i "$OUT/scene.mp4" -i "$TEXT" -i "$AUDIO" "${VID[@]}" -pass 2 \
  -map 2:a -c:a aac -b:a 192k -ar 48000 -ac 2 -movflags +faststart -shortest "$DEST"
ffprobe -v error -show_entries stream=codec_name,width,height,r_frame_rate,pix_fmt,sample_rate,channels:format=duration,size -of compact "$DEST"
