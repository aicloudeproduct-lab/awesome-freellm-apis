// Foreground motes, light mist, vignette and fine grain.
import React from 'react';
import {Img, staticFile} from 'remotion';
import {HEIGHT, WIDTH} from '../config/timeline';
import {rgba} from '../lib/color';
import {Atmos} from '../motion/atmosphere';
import {Cam} from '../motion/camera';
import {geometry} from './geometry';

export const Motes: React.FC<{t: number; at: Atmos; cam: Cam}> = ({t, at, cam}) => {
  const g = geometry();
  const night = at.stars;
  return (
    <g>
      {g.motes.map((m, i) => {
        const x = ((((m.x - cam.x * m.p + t * m.sp + Math.sin(t * 0.7 + m.ph) * 8) % 1180) + 1180) % 1180) - 50;
        const y = m.y - t * m.sp * 0.35 + Math.sin(t * 0.9 + m.ph * 2) * 6 + cam.y * 0.2;
        const yy = ((((y - 250) % 1700) + 1700) % 1700) + 250;
        const a = m.a * (0.55 + 0.45 * night);
        return <circle key={i} cx={x} cy={yy} r={m.r} fill={rgba(at.p.mote, a)} />;
      })}
    </g>
  );
};

export const OverlayDefs: React.FC = () => (
  <>
    <radialGradient id="vignette" cx="0.5" cy="0.47" r="0.75">
      <stop offset="0.55" stopColor="#000" stopOpacity="0" />
      <stop offset="1" stopColor="#000" stopOpacity="0.5" />
    </radialGradient>
    <linearGradient id="lowMist" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0" stopColor="#fff" stopOpacity="0" />
      <stop offset="1" stopColor="#fff" stopOpacity="1" />
    </linearGradient>
  </>
);

export const Vignette: React.FC<{at: Atmos}> = ({at}) => (
  <>
    <rect x="0" y={HEIGHT - 520} width={WIDTH} height={520} fill="url(#lowMist)" opacity={0.05 * at.fog} style={{mixBlendMode: 'screen'}} />
    <rect x="0" y="0" width={WIDTH} height={HEIGHT} fill="url(#vignette)" opacity={0.42 + 0.25 * at.stars} />
  </>
);

export const Grain: React.FC<{frame: number}> = ({frame}) => {
  const k = Math.floor(frame / 2) % 6;
  return (
    <Img
      src={staticFile(`grain/g${k}.png`)}
      style={{position: 'absolute', left: 0, top: 0, width: WIDTH, height: HEIGHT, opacity: 0.075, mixBlendMode: 'soft-light', pointerEvents: 'none'}}
    />
  );
};
