#!/usr/bin/env bash
# frames/f_####.jpg + out/audio.wav → out/alga_qadam_22s.mp4 (1080×1920, 30 fps, 660 кадр, H.264 High, yuv420p BT.709, AAC 48 кГц)
set -euo pipefail
cd "$(dirname "$0")/.."
n=$(ls frames/f_*.jpg | wc -l); [ "$n" -eq 660 ] || { echo "кадрлар толық емес: $n/660" >&2; exit 1; }
I=$(ffmpeg -hide_banner -nostats -i out/audio.wav -af ebur128 -f null - 2>&1 | awk '/Summary/{s=1} s&&/I:/{print $2; exit}')
G=$(python3 -c "print(round(-15 - ($I), 2))")
echo "аудио I=$I LUFS → −15 LUFS (${G} дБ), шың шектегіш −1.2 dBFS"
ffmpeg -hide_banner -y -loglevel error -framerate 30 -i frames/f_%04d.jpg -i out/audio.wav \
  -vf "scale=in_color_matrix=bt601:in_range=pc,format=gbrp,scale=out_color_matrix=bt709:out_range=tv,format=yuv420p" \
  -af "volume=${G}dB,alimiter=limit=0.87:attack=2:release=60:level=disabled" \
  -c:v libx264 -preset slow -crf 18 -profile:v high -level:v 4.2 -g 60 -bf 2 \
  -color_primaries bt709 -color_trc bt709 -colorspace bt709 -color_range tv \
  -c:a aac -b:a 256k -ar 48000 -ac 2 -frames:v 660 -t 22 -movflags +faststart \
  -metadata "title=Алға қадам жаса" -metadata "comment=Voice: ISSAI KazakhTTS (CC-BY-4.0) via Piper" out/alga_qadam_22s.mp4
ls -lh out/alga_qadam_22s.mp4
