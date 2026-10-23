#!/usr/bin/env bash
# Final render of «Екі терезе»: 3D layer at SCENE_W (default 1440×2560) in
# restartable chunks, the text layer natively at 2160×3840, then compose
# (Lanczos upscale of the 3D layer + sharp text) and mux the master audio.
#   tools/render_final.sh            # everything (skips chunks already done)
#   SCENE_W=2160 tools/render_final.sh   # native 4K 3D layer (≈2× slower)
set -euo pipefail
cd "$(dirname "$0")/.."
SCENE_W=${SCENE_W:-1440}
FRAMES=${FRAMES:-2976}          # 124 s × 24 fps
CHUNK=${CHUNK:-300}
OUT=build/final
mkdir -p "$OUT" output

npx esbuild src/app.js --bundle --format=iife --outfile=build/app.js --log-level=warning

# 1) 3D layer, chunked (a chunk is only kept once ffmpeg has closed it)
list="$OUT/scene_list.txt"; : > "$list"
for ((a = 0; a < FRAMES; a += CHUNK)); do
  b=$((a + CHUNK < FRAMES ? a + CHUNK : FRAMES))
  f=$(printf '%s/scene_%04d.mp4' "$OUT" "$a")
  if [[ ! -s "$f" ]]; then
    echo "scene frames $a–$b"
    node tools/render.mjs --entry app --w "$SCENE_W" --flags layer=scene --crf 14 --pipe "$f.part.mp4" --from "$a" --to "$b"
    mv "$f.part.mp4" "$f"
  fi
  echo "file '$(basename "$f")'" >> "$list"
done
ffmpeg -v error -y -f concat -safe 0 -i "$list" -c copy "$OUT/scene.mp4"

# 2) text layer (subtitles, title, closing thought) at 2160×3840 with alpha
if [[ ! -s "$OUT/text.mov" ]]; then
  node tools/render.mjs --entry app --w 2160 --flags layer=text --alpha 1 --pipe "$OUT/text.part.mov" --from 0 --to "$FRAMES"
  mv "$OUT/text.part.mov" "$OUT/text.mov"
fi

# 3) audio (voices must exist: python3 tools/make_voice.py)
[[ -s build/audio/master.wav ]] || python3 tools/make_score.py

# 4) compose + mux: H.264 High yuv420p 24 fps CFR, AAC 48 kHz stereo, faststart
ffmpeg -v error -y -i "$OUT/scene.mp4" -i "$OUT/text.mov" -i build/audio/master.wav \
  -filter_complex "[0:v]scale=2160:3840:flags=lanczos+accurate_rnd[bg];[bg][1:v]overlay=format=auto,format=yuv420p[v]" \
  -map '[v]' -map 2:a -c:v libx264 -preset slow -crf "${CRF:-19}" -profile:v high -level 5.1 -r 24 -fps_mode cfr \
  -c:a aac -b:a 256k -ar 48000 -ac 2 -movflags +faststart -shortest output/final.mp4
ffprobe -v error -show_entries stream=codec_name,width,height,r_frame_rate,pix_fmt,sample_rate,channels:format=duration,size -of compact output/final.mp4
