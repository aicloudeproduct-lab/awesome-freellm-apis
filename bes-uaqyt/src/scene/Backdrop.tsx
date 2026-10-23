// Sky, celestial bodies, distant ridges, rock pillars and chasm fog.
import React from 'react';
import {MOON} from '../config/palette';
import {HEIGHT, WIDTH} from '../config/timeline';
import {mix} from '../lib/color';
import {smoothstep} from '../lib/math';
import {Atmos} from '../motion/atmosphere';
import {Cam} from '../motion/camera';
import {geometry, pathOf} from './geometry';
import {Layer} from './Layer';

type Props = {t: number; at: Atmos; cam: Cam};

export const BackdropDefs: React.FC<{at: Atmos}> = ({at}) => {
  const p = at.p;
  const lit = at.lightDir;
  const rim = mix(p.rockMid, p.rockRim, 0.5 * Math.abs(lit) + 0.08);
  return (
    <>
      <linearGradient id="sky" gradientUnits="userSpaceOnUse" x1="0" y1="0" x2="0" y2={HEIGHT}>
        <stop offset="0" stopColor={p.skyTop} />
        <stop offset="0.27" stopColor={p.skyMid} />
        <stop offset="0.5" stopColor={p.skyLow} />
        <stop offset="0.6" stopColor={mix(p.skyLow, p.haze, 0.7)} />
        <stop offset="0.78" stopColor={mix(p.haze, p.chasm, 0.55)} />
        <stop offset="1" stopColor={p.chasm} />
      </linearGradient>
      <radialGradient id="sunGlow">
        <stop offset="0" stopColor={p.glow} stopOpacity="0.55" />
        <stop offset="0.35" stopColor={p.glow} stopOpacity="0.18" />
        <stop offset="1" stopColor={p.glow} stopOpacity="0" />
      </radialGradient>
      <radialGradient id="moonGlow">
        <stop offset="0" stopColor="#c9d6f5" stopOpacity="0.22" />
        <stop offset="1" stopColor="#c9d6f5" stopOpacity="0" />
      </radialGradient>
      <radialGradient id="cloudG">
        <stop offset="0" stopColor={p.cloud} stopOpacity="1" />
        <stop offset="1" stopColor={p.cloud} stopOpacity="0" />
      </radialGradient>
      <radialGradient id="fogG">
        <stop offset="0" stopColor={p.fog} stopOpacity="1" />
        <stop offset="0.6" stopColor={p.fog} stopOpacity="0.45" />
        <stop offset="1" stopColor={p.fog} stopOpacity="0" />
      </radialGradient>
      <linearGradient id="farRidgeG" gradientUnits="userSpaceOnUse" x1="0" y1="-400" x2="0" y2="260">
        <stop offset="0" stopColor={mix(p.ridgeFar, p.skyLow, 0.12)} />
        <stop offset="0.55" stopColor={mix(p.ridgeFar, p.haze, 0.45)} />
        <stop offset="1" stopColor={p.haze} />
      </linearGradient>
      <linearGradient id="nearRidgeG" gradientUnits="userSpaceOnUse" x1="0" y1="-260" x2="0" y2="360">
        <stop offset="0" stopColor={p.ridgeNear} />
        <stop offset="0.7" stopColor={mix(p.ridgeNear, p.haze, 0.55)} />
        <stop offset="1" stopColor={mix(p.haze, p.chasm, 0.3)} />
      </linearGradient>
      <linearGradient id="rockG" x1={lit >= 0 ? '0' : '1'} y1="0" x2={lit >= 0 ? '1' : '0'} y2="0">
        <stop offset="0" stopColor={p.rockMid} />
        <stop offset="0.72" stopColor={p.rockMid} />
        <stop offset="1" stopColor={rim} />
      </linearGradient>
      <linearGradient id="rockFade" gradientUnits="userSpaceOnUse" x1="0" y1="0" x2="0" y2="900">
        <stop offset="0" stopColor={p.haze} stopOpacity="0" />
        <stop offset="0.45" stopColor={mix(p.haze, p.chasm, 0.4)} stopOpacity="0.35" />
        <stop offset="1" stopColor={p.chasm} stopOpacity="0.9" />
      </linearGradient>
      <linearGradient id="hazeBand" gradientUnits="userSpaceOnUse" x1="0" y1="-140" x2="0" y2="320">
        <stop offset="0" stopColor={p.haze} stopOpacity="0" />
        <stop offset="0.5" stopColor={p.haze} stopOpacity="0.55" />
        <stop offset="1" stopColor={p.haze} stopOpacity="0" />
      </linearGradient>
      <linearGradient id="chasmShade" gradientUnits="userSpaceOnUse" x1="0" y1="1180" x2="0" y2={HEIGHT}>
        <stop offset="0" stopColor={p.chasm} stopOpacity="0" />
        <stop offset="1" stopColor={p.chasm} stopOpacity="0.62" />
      </linearGradient>
      <radialGradient id="bloomG">
        <stop offset="0" stopColor={p.glow} stopOpacity="1" />
        <stop offset="1" stopColor={p.glow} stopOpacity="0" />
      </radialGradient>
      <mask id="moonMask">
        <rect x="-60" y="-60" width="120" height="120" fill="#fff" />
        <circle cx={MOON.r * 0.42} cy={-MOON.r * 0.28} r={MOON.r * 0.93} fill="#000" />
      </mask>
    </>
  );
};

export const Sky: React.FC<Props> = ({t, at, cam}) => {
  const g = geometry();
  const p = at.p;
  const skyShift = -cam.x * 0.02;
  const starA = at.stars;
  return (
    <>
      <rect x="0" y="0" width={WIDTH} height={HEIGHT} fill="url(#sky)" />
      {starA > 0.01 && (
        <g>
          {g.stars.map((s, i) => {
            const tw = 0.62 + 0.38 * Math.sin(t * s.sp + s.ph);
            const horizon = 1 - smoothstep(620, 980, s.y);
            const a = starA * tw * horizon * (0.45 + s.r * 0.3);
            if (a < 0.02) return null;
            const x = (((s.x + skyShift) % 1180) + 1180) % 1180 - 50;
            return <circle key={i} cx={x} cy={s.y} r={s.r} fill="#eef3ff" opacity={Math.min(1, a)} />;
          })}
          <ellipse cx={720 + skyShift} cy={430} rx={620} ry={95} transform={`rotate(-28 ${720 + skyShift} 430)`} fill="url(#moonGlow)" opacity={starA * 0.55} />
        </g>
      )}
      {at.sun.alpha > 0.01 && (
        <g opacity={at.sun.alpha}>
          <circle cx={at.sun.x + skyShift} cy={at.sun.y} r={330} fill="url(#sunGlow)" />
          <circle cx={at.sun.x + skyShift} cy={at.sun.y} r={29} fill={p.sun} />
        </g>
      )}
      {at.moon > 0.01 && (
        <g opacity={at.moon} transform={`translate(${MOON.x + skyShift * 0.5} ${MOON.y})`}>
          <circle r={MOON.r * 6} fill="url(#moonGlow)" />
          <circle r={MOON.r} fill="#e9eefb" mask="url(#moonMask)" />
        </g>
      )}
      <g opacity={1 - starA * 0.55}>
        {g.clouds.map((c, i) => (
          <ellipse key={i} cx={c.x - cam.x * 0.05 + t * 3} cy={c.y} rx={c.rx} ry={c.ry} fill="url(#cloudG)" opacity={c.a} />
        ))}
      </g>
    </>
  );
};

export const Landscape: React.FC<Props> = ({t, at, cam}) => {
  const g = geometry();
  return (
    <>
      <Layer cam={cam} p={0.1}>
        <path d={pathOf(g.farRidge)} fill="url(#farRidgeG)" />
        <rect x="-1200" y="-140" width="3000" height="460" fill="url(#hazeBand)" />
      </Layer>
      <Layer cam={cam} p={0.2}>
        <path d={pathOf(g.nearRidge)} fill="url(#nearRidgeG)" />
      </Layer>
      <Layer cam={cam} p={0.3}>
        {g.fog
          .filter((f) => f.layer === 0)
          .map((f, i) => (
            <ellipse key={i} cx={f.x + t * f.drift} cy={f.y - 120} rx={f.rx * 1.3} ry={f.ry} fill="url(#fogG)" opacity={f.a * at.fog * 0.8} />
          ))}
      </Layer>
      <Layer cam={cam} p={0.3}>
        {g.pillarsFar.map((pl, i) => (
          <path key={i} d={pathOf(pl.pts)} fill={mix(at.p.rockMid, at.p.haze, 0.42)} />
        ))}
        <rect x="-1400" y="-60" width="3400" height="1560" fill="url(#rockFade)" />
      </Layer>
      <Layer cam={cam} p={0.42}>
        {g.fog
          .filter((f) => f.layer === 1)
          .map((f, i) => (
            <ellipse key={i} cx={f.x - t * f.drift * 0.6} cy={f.y + 120} rx={f.rx * 1.2} ry={f.ry * 0.8} fill="url(#fogG)" opacity={f.a * at.fog * 0.7} />
          ))}
      </Layer>
      <Layer cam={cam} p={0.5}>
        {g.pillars.map((pl, i) => (
          <path key={i} d={pathOf(pl.pts)} fill="url(#rockG)" />
        ))}
        <rect x="-1400" y="0" width="3400" height="1500" fill="url(#rockFade)" />
      </Layer>
      <Layer cam={cam} p={0.62}>
        {g.fog
          .filter((f) => f.layer !== 0)
          .map((f, i) => (
            <ellipse key={i} cx={f.x + t * f.drift * (f.layer === 1 ? 1 : -0.7)} cy={f.y + 40} rx={f.rx} ry={f.ry} fill="url(#fogG)" opacity={f.a * at.fog} />
          ))}
      </Layer>
      <rect x="0" y="0" width={WIDTH} height={HEIGHT} fill="url(#chasmShade)" />
      {/* soft light bloom near the horizon behind the bridge */}
      <ellipse cx={at.sun.x * 0.4 + 324} cy={980} rx={760} ry={170} fill="url(#bloomG)" opacity={0.1 + 0.08 * at.sun.alpha} />
    </>
  );
};
