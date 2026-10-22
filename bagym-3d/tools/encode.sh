#!/usr/bin/env bash
# frames/f_####.jpg + out/audio.wav -> out/bagym_3d_final.mp4 (2048x1536, 30 fps, 2700 кадр, H.264 High CRF 17, yuv420p BT.709, AAC)
# + out/bagym_3d_1024x768.mp4 (жеңіл нұсқа: телефонда/ескі құрылғыда ойнату және сақтау үшін)
set -euo pipefail
cd "$(dirname "$0")/.."
n=$(ls frames/f_*.jpg | wc -l)
if [ "$n" -ne 2700 ]; then echo "кадрлар толық емес: $n/2700 — алдымен: node tools/render_film.mjs" >&2; exit 1; fi
[ -f out/audio.wav ] || { echo "out/audio.wav жоқ — python3 tools/make_audio.py" >&2; exit 1; }
# дыбыс деңгейі: −20 LUFS (диктор дауысы кейін үстіне қосылғанда орын қалуы үшін), сызықтық күшейту
I=$(ffmpeg -hide_banner -nostats -i out/audio.wav -af ebur128 -f null - 2>&1 | awk '/Summary/{s=1} s&&/I:/{print $2; exit}')
G=$(python3 -c "print(round(-20 - ($I), 2))")
echo "аудио I=$I LUFS → күшейту ${G} дБ"
COLOR="scale=in_color_matrix=bt601:in_range=pc,format=gbrp,scale=out_color_matrix=bt709:out_range=tv,format=yuv420p"
TAGS=(-color_primaries bt709 -color_trc bt709 -colorspace bt709 -color_range tv)
META=(-metadata "title=Жігіттің өзімен тартыссаң да, бағымен тартыспа")
ffmpeg -hide_banner -y -framerate 30 -i frames/f_%04d.jpg -i out/audio.wav \
  -vf "$COLOR" -af "volume=${G}dB" \
  -c:v libx264 -preset slow -crf 17 -profile:v high -level:v 5.1 -g 60 -bf 2 "${TAGS[@]}" \
  -c:a aac -b:a 256k -ar 48000 -ac 2 -frames:v 2700 -t 90 -movflags +faststart "${META[@]}" \
  out/bagym_3d_final.mp4
ffmpeg -hide_banner -y -i out/bagym_3d_final.mp4 \
  -vf "scale=1024:768:flags=lanczos" -c:v libx264 -preset slow -crf 21 -profile:v high -level:v 4.1 -g 60 "${TAGS[@]}" -pix_fmt yuv420p \
  -c:a aac -b:a 192k -movflags +faststart "${META[@]}" out/bagym_3d_1024x768.mp4
ls -lh out/bagym_3d_final.mp4 out/bagym_3d_1024x768.mp4
