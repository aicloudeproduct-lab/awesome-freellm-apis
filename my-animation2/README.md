# my-animation2 — «Намазды бастау» (iPad, 4:3, Remotion)

Премиум минималистік ақ-қара анимация: 2048×1536, 30 fps, дәл 27 с (810 кадр), H.264 + AAC.
Бір кейіпкер мінсіз жоспарды шексіз қайта сызады; екіншісі мінсіз болмаса да бастайды —
үй тұрғызып, жаңбырда жылы үйге кіріп, намазын бастайды. Соңғы хабар:
«Намазды бастау үшін мінсіз болу шарт емес.» / «Бүгін алғашқы қадамыңды жаса.»

## Құрылым (`src/ipad/`)
| Файл | Мазмұны |
|---|---|
| `IpadCinematic.tsx` | Композиция: қабаттар, камера, синхрон шағылыс (сол әлем айналы түрде + толқын сүзгісі), жарық, түс түзету, дән, аудио |
| `constants.ts`, `schedule.json` | Өлшемдер, палитра, үй геометриясы, құрылыс кестесі, B-ның timelapse сағаты `tauOf()` |
| `rig.tsx` | Кейіпкер ригі: тұрақты пропорциялар, 2 буынды IK, табан сырғымайтын қадам симуляциясы, бүйір/алдыңғы көрініс, бұрылу морфы |
| `pieces.ts`, `house.tsx` | Бөлшектер күйі (үйінді → қолда → орнында) және ағаш тақтайлар, есік, терезе, шатыр панельдері |
| `builder.tsx` | B: құрылыс позалары, есікті ашу, бұрылып ішке кіру, терезедегі намаз сұлбасы |
| `planner.tsx` | A: жарық үстел, қаламмен сызу, өшіру, қағазды умаждап лақтыру, ауадағы жоспар |
| `environment.tsx` | Аспан, ай, жұлдыздар, бұлттар, тұман, жылтыр жер, 3 тереңдіктегі жаңбыр, шашырау, бөлшектер, камера кілттері |
| `typography.tsx` | Кейіпкер жазулары және сөзбе-сөз ашылатын финал хабары (Cormorant Garamond, Inter Light) |

`tools/make_audio.py` — дыбыс (numpy/scipy), `tools/make_grain.py` — дән тайлдары,
`tools/stills.mjs` — QC скриншоттары, `tools/qc_video.py` — MP4 тексеру.

## Командалар
```bash
npm install
python3 tools/make_grain.py && python3 tools/make_audio.py
npm run typecheck
npx remotion studio                              # интерактивті қарау
npx remotion render IpadCinematic out/preview_1024x768.mp4 --scale=0.5 --crf=20
npx remotion render IpadCinematic out/ipad_cinematic_final.mp4 --codec=h264 --crf=17
python3 tools/qc_video.py out/ipad_cinematic_final.mp4
```
Linux-та жүйелік Chromium қолдансаң: `--browser-executable=/path/to/headless_shell`.

Қаріптер: Cormorant Garamond (SIL OFL), Inter (SIL OFL) — `public/fonts/`.
