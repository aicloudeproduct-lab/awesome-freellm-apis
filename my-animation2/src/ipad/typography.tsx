import React from 'react';
import {G, PAL, SCHEDULE} from './constants';
import {clamp, eo, esine, range} from './util';

const E = SCHEDULE.events;

/** Әлемге бекітілген нәзік жазу (1-сахна): әріп аралығы біртіндеп жиналады, астына жіңішке сызық тартылады. */
export const Caption: React.FC<{t: number; x: number; y: number; text: string; index: string; tin: number; tout: number}> = ({t, x, y, text, index, tin, tout}) => {
  const a = esine(range(t, tin, tin + 0.9)) * (1 - esine(range(t, tout, tout + 0.8)));
  if (a <= 0.001) return null;
  const ls = 14 - 5 * eo(range(t, tin, tin + 1.4));
  const line = eo(range(t, tin + 0.35, tin + 1.2));
  return (
    <g opacity={a} transform={`translate(0,${(1 - eo(range(t, tin, tin + 0.9))) * 10})`}>
      <text x={x} y={y - 46} fill={PAL.silver} fontFamily="Cormorant" fontStyle="italic" fontSize={24} textAnchor="middle" opacity={0.8}>{index}</text>
      <text x={x} y={y} fill={PAL.ivory} fontFamily="InterLight" fontSize={26} letterSpacing={ls} textAnchor="middle">{text}</text>
      <line x1={x - 46 * line} y1={y + 22} x2={x + 46 * line} y2={y + 22} stroke={PAL.ivory} strokeWidth={1.2} opacity={0.7} />
    </g>
  );
};

export const SceneCaptions: React.FC<{t: number}> = ({t}) => (
  <g>
    <Caption t={t} x={800} y={G - 566} text="МІНСІЗ ЖОСПАР" index="I" tin={0.8} tout={6.0} />
    <Caption t={t} x={1575} y={G - 566} text="АЛҒАШҚЫ ҚАДАМ" index="II" tin={1.25} tout={6.2} />
  </g>
);

/** Финалдық хабар: сөзбе-сөз, өте жұмсақ easing, әріп аралығы баяу жиналады. */
const LINE1 = 'Намазды бастау үшін мінсіз болу шарт емес.'.split(' ');
const LINE2 = 'Бүгін алғашқы қадамыңды жаса.'.split(' ');
const Word: React.FC<{w: string; t: number; at: number; dur: number}> = ({w, t, at, dur}) => {
  const p = range(t, at, at + dur), e = 1 - Math.pow(1 - p, 4);
  return (
    <span style={{display: 'inline-block', opacity: clamp(e * 1.05), transform: `translateY(${(1 - e) * 18}px)`, filter: `blur(${((1 - e) * 6).toFixed(2)}px)`, marginRight: '0.28em'}}>{w}</span>
  );
};
export const FinalMessage: React.FC<{t: number}> = ({t}) => {
  if (t < E.text1 - 0.1) return null;
  const ls1 = 0.07 - 0.05 * esine(range(t, E.text1, E.text1 + 2.2));
  const ls2 = 0.12 - 0.07 * esine(range(t, E.text2, E.text2 + 1.8));
  const rule = eo(range(t, E.text2 - 0.25, E.text2 + 0.7));
  return (
    <div style={{position: 'absolute', left: 0, right: 0, top: 232, paddingRight: 120, textAlign: 'center', color: PAL.ivory}}>
      <div style={{fontFamily: 'Cormorant', fontWeight: 500, fontSize: 68, letterSpacing: `${ls1}em`, lineHeight: 1.15, textShadow: '0 0 28px rgba(0,0,0,0.6)'}}>
        {LINE1.map((w, i) => <Word key={i} w={w} t={t} at={E.text1 + i * 0.14} dur={0.85} />)}
      </div>
      <div style={{width: 120 * rule, height: 1.5, background: 'rgba(236,232,222,0.55)', margin: '26px auto 24px'}} />
      <div style={{fontFamily: 'Cormorant', fontStyle: 'italic', fontWeight: 500, fontSize: 54, letterSpacing: `${ls2}em`, color: '#e4e0d6', textShadow: '0 0 24px rgba(0,0,0,0.6)'}}>
        {LINE2.map((w, i) => <Word key={i} w={w} t={t} at={E.text2 + i * 0.16} dur={0.9} />)}
      </div>
    </div>
  );
};
