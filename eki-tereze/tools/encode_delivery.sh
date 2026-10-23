#!/usr/bin/env bash
# Two-pass encode of the composed film to a size that fits a GitHub file
# (≤ 100 MB) → output/final.mp4. Needs build/final/{scene.mp4,text.mov} from
# tools/render_final.sh; its CRF master is kept as output/final_master_crf19.mp4.
set -euo pipefail
cd "$(dirname "$0")/.."
OUT=build/final
VB=${VB:-5600k}
FC="[0:v]scale=2160:3840:flags=lanczos+accurate_rnd[bg];[bg][1:v]overlay=format=auto,format=yuv420p[v]"
VID=(-filter_complex "$FC" -map '[v]' -c:v libx264 -preset slow -b:v "$VB" -maxrate 9M -bufsize 18M
     -profile:v high -level 5.1 -r 24 -fps_mode cfr -passlogfile "$OUT/x264pass")
ffmpeg -v error -y -i "$OUT/scene.mp4" -i "$OUT/text.mov" "${VID[@]}" -pass 1 -an -f mp4 /dev/null
ffmpeg -v error -y -i "$OUT/scene.mp4" -i "$OUT/text.mov" -i build/audio/master.wav "${VID[@]}" -pass 2 \
  -map 2:a -c:a aac -b:a 192k -ar 48000 -ac 2 -movflags +faststart -shortest output/final.mp4
ffprobe -v error -show_entries stream=codec_name,width,height,r_frame_rate,pix_fmt,sample_rate,channels:format=duration,size -of compact output/final.mp4
