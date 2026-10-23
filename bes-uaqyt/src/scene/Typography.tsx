// Titles for the five times, stone labels and the closing lines (HTML text,
// so the browser shapes Kazakh glyphs from the one bundled family).
import React from 'react';
import {FINAL_LINES, FONT_FAMILY, STONES, TITLES, TYPE} from '../config/text';
import {BRIDGE, SEGMENTS, TEXT_TIMING} from '../config/timeline';
import {smoothstep} from '../lib/math';
import {Cam, toScreen} from '../motion/camera';
import {deckY} from '../motion/bridge';
import {flightOf} from '../motion/pack';

const ease = (x: number) => 1 - Math.pow(1 - x, 3);

const fadeWindow = (t: number, t0: number, fadeIn: number, hold: number, fadeOut: number) => {
  const a = smoothstep(t0, t0 + fadeIn, t);
  const b = 1 - smoothstep(t0 + fadeIn + hold, t0 + fadeIn + hold + fadeOut, t);
  return {a: a * b, inP: ease(Math.min(1, Math.max(0, (t - t0) / fadeIn)))};
};

const shadow = '0 2px 18px rgba(4,6,12,0.38), 0 0 2px rgba(4,6,12,0.25)';

const base: React.CSSProperties = {
  position: 'absolute',
  fontFamily: `'${FONT_FAMILY}'`,
  color: TYPE.color,
  whiteSpace: 'nowrap',
  textShadow: shadow,
  fontKerning: 'normal',
  fontFeatureSettings: '"kern" 1, "liga" 1',
};

export const Titles: React.FC<{t: number}> = ({t}) => {
  const T = TEXT_TIMING.title;
  return (
    <>
      {SEGMENTS.map((s, i) => {
        const {a, inP} = fadeWindow(t, s.start + T.delay, T.fadeIn, T.hold, T.fadeOut);
        if (a <= 0.001) return null;
        return (
          <div key={s.key} style={{position: 'absolute', left: 0, right: 0, top: TYPE.title.y - 40, opacity: a, transform: `translateY(${(1 - inP) * T.rise}px)`}}>
            <div
              style={{
                ...base,
                position: 'relative',
                textAlign: 'center',
                fontSize: TYPE.title.size,
                fontWeight: TYPE.title.weight,
                letterSpacing: `${TYPE.title.tracking}em`,
                // letter-spacing adds trailing space after the last glyph; re-centre
                paddingLeft: `${TYPE.title.tracking}em`,
                lineHeight: 1,
              }}
            >
              {TITLES[s.key]}
            </div>
            <div style={{display: 'flex', justifyContent: 'center', gap: 14, marginTop: 26}}>
              {SEGMENTS.map((_, k) => (
                <div
                  key={k}
                  style={{
                    width: 7,
                    height: 7,
                    borderRadius: 4,
                    background: k <= i ? TYPE.color : 'transparent',
                    border: `1.5px solid ${TYPE.color}`,
                    opacity: k <= i ? 0.95 : 0.45,
                    boxShadow: k <= i ? '0 0 10px rgba(4,6,12,0.3)' : undefined,
                  }}
                />
              ))}
            </div>
          </div>
        );
      })}
    </>
  );
};

export const StoneLabels: React.FC<{t: number; cam: Cam}> = ({t, cam}) => {
  const T = TEXT_TIMING.stone;
  return (
    <>
      {STONES.map((label, k) => {
        const fl = flightOf(k);
        const {a, inP} = fadeWindow(t, fl.t0 + T.delay, T.fadeIn, T.hold, T.fadeOut);
        if (a <= 0.001) return null;
        const anchorX = Math.min(fl.pb.x, BRIDGE.x1 - 10);
        const s = toScreen(cam, anchorX, deckY(anchorX, t) + 150);
        const drift = Math.max(0, t - fl.t0) * T.drift;
        return (
          <div
            key={k}
            style={{
              ...base,
              right: 1080 - s.x + 34,
              top: s.y + drift - (1 - inP) * 8,
              opacity: a * 0.95,
              fontSize: 38,
              fontWeight: 500,
              letterSpacing: '0.02em',
              lineHeight: 1,
              display: 'flex',
              alignItems: 'center',
              gap: 16,
            }}
          >
            {label}
            <span style={{display: 'inline-block', width: 34, height: 1.5, background: TYPE.color, opacity: 0.6}} />
          </div>
        );
      })}
    </>
  );
};

export const FinalText: React.FC<{t: number}> = ({t}) => {
  const F = TEXT_TIMING.final;
  const out = 1 - smoothstep(F.out, F.out + 0.42, t);
  return (
    <>
      {FINAL_LINES.map((l, i) => {
        const t0 = F.lines[i];
        const p = smoothstep(t0, t0 + F.fadeIn, t);
        if (p <= 0.001) return null;
        return (
          <div
            key={i}
            style={{
              ...base,
              left: 0,
              right: 0,
              textAlign: 'center',
              top: l.y - l.size * 0.62,
              fontSize: l.size,
              fontWeight: l.weight,
              letterSpacing: `${l.tracking}em`,
              lineHeight: 1.1,
              opacity: p * out * (i === 1 ? 1 : 0.92),
              transform: `translateY(${(1 - ease(p)) * F.rise}px)`,
            }}
          >
            {l.text}
          </div>
        );
      })}
    </>
  );
};
