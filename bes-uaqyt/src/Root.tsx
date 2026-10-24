import React from 'react';
import {Composition, continueRender, delayRender, staticFile} from 'remotion';
import {FONT_FAMILY, FONT_FILE} from './config/text';
import {DURATION_FRAMES, FPS, HEIGHT, WIDTH} from './config/timeline';
import {Film} from './Film';

// The bundled variable font must be ready before any frame is captured.
const fontHandle = delayRender('Loading Noto Sans');
const face = new FontFace(FONT_FAMILY, `url(${staticFile(FONT_FILE)}) format('truetype')`, {weight: '100 900'});
face
  .load()
  .then((f) => {
    (document.fonts as unknown as {add: (x: FontFace) => void}).add(f);
    return Promise.all([400, 460, 500, 520, 600].map((w) => document.fonts.load(`${w} 40px '${FONT_FAMILY}'`, 'ӘҒҚҢӨҰҮҺІ')));
  })
  .then(() => continueRender(fontHandle))
  .catch((e) => {
    console.error(e);
    throw e;
  });

export const Root: React.FC = () => (
  <>
    <Composition id="BesUaqyt" component={Film} durationInFrames={DURATION_FRAMES} fps={FPS} width={WIDTH} height={HEIGHT} defaultProps={{audio: true}} />
  </>
);
