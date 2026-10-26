# Алға қадам жаса — 22 с, 9:16 (1080×1920, 30 fps)

Қара-ақ минималистік 3D моушн-видео (Three.js, CPU WebGL рендер) және қазақша диктор.

- `scene/` — әлем (`world.js`), оқиға мен камера (`timeline.js`), ақ кейіпкер (`character.js`, 'W' нұсқасы), жүру (`walk.js`), рендер және мәтін (`main.js`).
- `tools/make_voice.py` — диктор: [Piper](https://github.com/rhasspy/piper) + ISSAI KazakhTTS (M1 «Iseke» дауысы). Модель лицензиясы: CC-BY-4.0, дереккөзі: https://github.com/IS2AI/Kazakh_TTS. Модель файлын жүктеу: `voice-kk-issai-high.tar.gz` (rhasspy/piper, v0.0.2 релизі) → `voice_model/`.
- `tools/make_audio.py` — ambient музыка, пианино және эффектілер (бәрі процедуралық синтез), музыка сөйлеу кезінде дикторан ~21 дБ төмен.
- `tools/render_film.mjs` → `frames/`, `tools/encode.sh` → `out/alga_qadam_22s.mp4`.
- Тексеру: `tools/check.mjs` (камера қабырғаға кірмейді, кейіпкер кадрда), `tools/events.mjs` (қадам дыбыстарының уақыты).

Дауыс атрибуциясы (CC-BY-4.0): Kazakh TTS voice — ISSAI (Institute of Smart Systems and Artificial Intelligence, Nazarbayev University), KazakhTTS / KazakhTTS2.
