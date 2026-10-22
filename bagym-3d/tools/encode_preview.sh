#!/usr/bin/env bash
# Алдын ала қарау нұсқасы: frames_preview/ (1024x768) -> out/bagym_3d_preview_1024x768.mp4, 90 с, 30 fps.
# Тақ кадрлар әлі жоқ болса, жұп кадрлар (15 fps) екі еселеніп 30 fps-ке келтіріледі.
set -euo pipefail
cd "$(dirname "$0")/.."
odd=$( (ls frames_preview/f_*[13579].jpg 2>/dev/null || true) | wc -l); even=$(ls frames_preview/f_*[02468].jpg | wc -l)
if [ "$odd" -ge 1350 ]; then IN=(-framerate 30 -i frames_preview/f_%04d.jpg); FR=""; echo "30 fps (толық)"
else
  [ "$even" -ge 1350 ] || { echo "жұп кадрлар толық емес: $even/1350" >&2; exit 1; }
  L=$(mktemp -d); i=0; for f in $(seq 0 2 2698); do ln -s "$PWD/frames_preview/f_$(printf %04d $f).jpg" "$L/p_$(printf %04d $i).jpg"; i=$((i+1)); done
  IN=(-framerate 15 -i "$L/p_%04d.jpg"); FR="fps=30,"; echo "15 fps → 30 fps"
fi
I=$(ffmpeg -hide_banner -nostats -i out/audio.wav -af ebur128 -f null - 2>&1 | awk '/Summary/{s=1} s&&/I:/{print $2; exit}')
G=$(python3 -c "print(round(-20 - ($I), 2))")
ffmpeg -hide_banner -y -loglevel error "${IN[@]}" -i out/audio.wav \
  -vf "${FR}scale=in_color_matrix=bt601:in_range=pc,format=gbrp,scale=out_color_matrix=bt709:out_range=tv,format=yuv420p" -af "volume=${G}dB" \
  -c:v libx264 -preset slow -crf 20 -profile:v high -level:v 4.1 -g 60 -color_primaries bt709 -color_trc bt709 -colorspace bt709 -color_range tv \
  -c:a aac -b:a 192k -ar 48000 -ac 2 -frames:v 2700 -t 90 -movflags +faststart \
  -metadata "title=Жігіттің өзімен тартыссаң да, бағымен тартыспа (алдын ала қарау)" out/bagym_3d_preview_1024x768.mp4
ls -lh out/bagym_3d_preview_1024x768.mp4
