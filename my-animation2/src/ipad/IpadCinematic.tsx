import React from 'react';
import {AbsoluteFill, Html5Audio, continueRender, delayRender, spring, staticFile, useCurrentFrame, useVideoConfig} from 'remotion';
import {BuilderBody, BuilderFrame, BuilderInside, PrayerSilhouette, builderFrame, doorOpen} from './builder';
import {G, H, HOUSE, PAL, W} from './constants';
import {Clouds, Fog, Ground, Hills, MOON, Motes, Rain, Sky, Splashes, Weather, camera, layerTransform, toScreen, weather} from './environment';
import {DoorUnit, PieceView, PileView, WindowUnit} from './house';
import {A_SHIFT, Desk, PaperInHands, PlanSketch, PlannerFigure, plannerPose} from './planner';
import {FinalMessage, SceneCaptions} from './typography';
import {range} from './util';

// ---------- қаріптер (render басталмай тұрып жүктеледі) ----------
const fontHandle = delayRender('Loading fonts');
Promise.all([
  new FontFace('Cormorant', `url(${staticFile('fonts/CormorantGaramond.ttf')}) format('truetype')`, {weight: '300 700', style: 'normal'}).load(),
  new FontFace('Cormorant', `url(${staticFile('fonts/CormorantGaramond-Italic.ttf')}) format('truetype')`, {weight: '300 700', style: 'italic'}).load(),
  new FontFace('InterLight', `url(${staticFile('fonts/Inter-Light.otf')}) format('opentype')`, {weight: '300'}).load(),
]).then(fs => { fs.forEach(f => (document.fonts as any).add(f)); continueRender(fontHandle); }).catch(err => { console.error(err); continueRender(fontHandle); });

const Defs: React.FC<{w: Weather; gy: number; t: number}> = ({w, gy, t}) => (
  <defs>
    <linearGradient id="skyGrad" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0" stopColor="#07080a" />
      <stop offset="0.55" stopColor="#0e0f12" />
      <stop offset="0.68" stopColor="#17181c" />
      <stop offset="1" stopColor="#0b0c0e" />
    </linearGradient>
    <radialGradient id="moonHalo"><stop offset="0" stopColor="#dfe2e8" stopOpacity="0.55" /><stop offset="0.35" stopColor="#9fa4ad" stopOpacity="0.16" /><stop offset="1" stopColor="#9fa4ad" stopOpacity="0" /></radialGradient>
    <radialGradient id="moonDisc" cx="0.42" cy="0.4" r="0.65"><stop offset="0" stopColor="#fbfaf6" /><stop offset="0.7" stopColor="#e6e4de" /><stop offset="1" stopColor="#c8c7c2" /></radialGradient>
    <linearGradient id="groundGrad" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0" stopColor="#16171b" /><stop offset="0.35" stopColor="#0c0d10" /><stop offset="1" stopColor="#050506" />
    </linearGradient>
    <linearGradient id="streakGrad" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor="#e8eaee" /><stop offset="1" stopColor="#e8eaee" stopOpacity="0" /></linearGradient>
    <linearGradient id="woodGrad" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor="#f0eadc" /><stop offset="1" stopColor="#d6cdb9" /></linearGradient>
    <linearGradient id="woodGradDoor" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stopColor="#ddd5c2" /><stop offset="1" stopColor="#c9c0aa" /></linearGradient>
    <linearGradient id="woodGradGable" x1="0" y1="1" x2="0" y2="0"><stop offset="0" stopColor="#d9d0bc" /><stop offset="1" stopColor="#cbc1aa" /></linearGradient>
    <radialGradient id="windowWarm" cx="0.5" cy="0.6" r="0.75"><stop offset="0" stopColor={PAL.amberSoft} /><stop offset="0.6" stopColor={PAL.amber} /><stop offset="1" stopColor={PAL.amberDeep} /></radialGradient>
    <linearGradient id="glassSheen" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stopColor="#3a3e46" /><stop offset="0.55" stopColor="#16181c" /><stop offset="1" stopColor="#202329" /></linearGradient>
    <linearGradient id="interiorGrad" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor="#e9a64f" /><stop offset="0.7" stopColor={PAL.amberSoft} /><stop offset="1" stopColor="#b8702e" /></linearGradient>
    <radialGradient id="warmHalo"><stop offset="0" stopColor={PAL.amber} stopOpacity="0.5" /><stop offset="0.4" stopColor={PAL.amber} stopOpacity="0.14" /><stop offset="1" stopColor={PAL.amber} stopOpacity="0" /></radialGradient>
    <linearGradient id="deskGlow" x1="0" y1="1" x2="0" y2="0"><stop offset="0" stopColor="#f2f3f5" /><stop offset="1" stopColor="#b9bcc2" /></linearGradient>
    <radialGradient id="deskHalo"><stop offset="0" stopColor="#e9ecf1" stopOpacity="0.38" /><stop offset="1" stopColor="#e9ecf1" stopOpacity="0" /></radialGradient>
    <radialGradient id="vignette" cx="0.5" cy="0.52" r="0.72"><stop offset="0.55" stopColor="#000" stopOpacity="0" /><stop offset="1" stopColor="#000" stopOpacity="0.62" /></radialGradient>
    <linearGradient id="reflFade" gradientUnits="userSpaceOnUse" x1="0" y1={gy} x2="0" y2={gy + 470}>
      <stop offset="0" stopColor="#fff" stopOpacity="0.95" /><stop offset="1" stopColor="#fff" stopOpacity="0" />
    </linearGradient>
    <mask id="reflMask" maskUnits="userSpaceOnUse" x="0" y="0" width={W} height={H}><rect x={0} y={gy} width={W} height={H - gy} fill="url(#reflFade)" /></mask>
    <clipPath id="winClip"><rect x={HOUSE.win.x + 8} y={HOUSE.win.y + 8} width={HOUSE.win.w - 16} height={HOUSE.win.h - 16} /></clipPath>
    <clipPath id="doorClip"><rect x={HOUSE.door.x + 9} y={HOUSE.door.y + 9} width={HOUSE.door.w - 18} height={HOUSE.door.h - 9} /></clipPath>
    <filter id="blur2" x="-10%" y="-10%" width="120%" height="120%"><feGaussianBlur stdDeviation="1.6" /></filter>
    <filter id="blur12" x="-50%" y="-50%" width="200%" height="200%"><feGaussianBlur stdDeviation="12" /></filter>
    <filter id="blur24" x="-50%" y="-80%" width="200%" height="260%"><feGaussianBlur stdDeviation="22" /></filter>
    <filter id="blur30" x="-50%" y="-100%" width="200%" height="300%"><feGaussianBlur stdDeviation="30" /></filter>
    <filter id="glow" x="-20%" y="-20%" width="140%" height="140%">
      <feGaussianBlur stdDeviation="5" result="b" /><feComponentTransfer in="b" result="bb"><feFuncA type="linear" slope="0.45" /></feComponentTransfer>
      <feMerge><feMergeNode in="bb" /><feMergeNode in="SourceGraphic" /></feMerge>
    </filter>
    <filter id="ripple" filterUnits="userSpaceOnUse" x="0" y="0" width={W} height={H}>
      <feTurbulence type="turbulence" baseFrequency={`${0.0035 + 0.0006 * Math.sin(t * 0.7)} ${0.055 + 0.01 * Math.sin(t * 1.3)}`} numOctaves="2" seed="7" result="n" />
      <feDisplacementMap in="SourceGraphic" in2="n" scale={4 + 15 * w.wet} xChannelSelector="R" yChannelSelector="G" result="d" />
      <feGaussianBlur in="d" stdDeviation={1.1 + 1.3 * w.wet} />
    </filter>
  </defs>
);

/** Әлемнің өзі — негізгі кадрда да, шағылыста да дәл бірдей салынады (синхрон шағылыс). */
const WorldContent: React.FC<{t: number; bf: BuilderFrame; open: number; w: Weather; reflection?: boolean}> = ({t, bf, open, w, reflection}) => {
  const pa = plannerPose(t);
  const doorNode = <DoorUnit open={open} warm={w.warm} interior={<BuilderInside bf={bf} />} />;
  const winNode = <WindowUnit warm={w.warm} moon={w.moon} inside={<PrayerSilhouette t={t} />} />;
  const placed = bf.states.filter(s => s.layer === 'placed');
  const front = bf.states.filter(s => s.frontAlpha > 0 && s.layer !== 'pile');
  return (
    <g>
      {/* A: жоспар құрушы */}
      <g transform={`translate(${A_SHIFT},0)`}>
        <circle cx={630} cy={G - 140} r={150} fill="url(#deskHalo)" opacity={reflection ? 0.5 : 1} />
        <g filter={reflection ? undefined : 'url(#glow)'}><PlannerFigure t={t} layer="body" /></g>
        <Desk t={t} front />
        <g filter={reflection ? undefined : 'url(#glow)'}><PlannerFigure t={t} layer="arms" /></g>
        <PaperInHands t={t} hands={{l: pa.j.handL, r: pa.j.handR}} />
      </g>
      {/* үй: орнатылған бөлшектер */}
      {placed.map(s => <PieceView key={s.p.id} st={s} door={doorNode} win={winNode} />)}
      {/* үйінді (B-ның артында) → алыс қол → қолдағы бөлшек → B денесі → жақын қол */}
      <PileView states={bf.states} />
      <g filter={reflection ? undefined : 'url(#glow)'}><BuilderBody bf={bf} layer="far" /></g>
      {front.map(s => <PieceView key={'f' + s.p.id} st={s} alpha={s.frontAlpha} door={<DoorUnit open={1} warm={0} />} win={<WindowUnit warm={0} moon={w.moon} />} />)}
      <g filter={reflection ? undefined : 'url(#glow)'}><BuilderBody bf={bf} layer="body" /></g>
      <g filter={reflection ? undefined : 'url(#glow)'}><BuilderBody bf={bf} layer="nearArm" /></g>
    </g>
  );
};

export const IpadCinematic: React.FC = () => {
  const frame = useCurrentFrame();
  const {fps} = useVideoConfig();
  const t = frame / fps;
  const w = weather(t);
  const c = camera(t);
  const cam = layerTransform(c, 1);
  const open = doorOpen(t, fps, f => spring({frame: f, fps, config: {damping: 15, stiffness: 55, mass: 1.1}}));
  const bf = builderFrame(t, open);
  const gy = toScreen(c, 0, G)[1];
  const winC = toScreen(c, HOUSE.win.x + HOUSE.win.w / 2, HOUSE.win.y + HOUSE.win.h / 2);
  const doorC = toScreen(c, HOUSE.door.x + HOUSE.door.w / 2, G - 4);
  const moonS = toScreen(c, MOON.x, MOON.y, 0.2);
  const grade = 0.08 + 0.32 * (1 - w.moon) * (1 - 0.3 * w.warm);
  const grainIdx = frame % 8;
  return (
    <AbsoluteFill style={{backgroundColor: PAL.night}}>
      <svg width={W} height={H} viewBox={`0 0 ${W} ${H}`} style={{position: 'absolute', inset: 0}}>
        <Defs w={w} gy={gy} t={t} />
        <Sky t={t} c={c} w={w} />
        <Clouds t={t} c={c} w={w} />
        <Hills c={c} w={w} />
        <Fog t={t} c={c} w={w} />
        <Ground c={c} w={w} />
        {/* шағылыс: дәл сол әлем, жер сызығына қатысты айналы */}
        <g mask="url(#reflMask)" opacity={(0.3 + 0.2 * w.wet) * w.reveal}>
          <g filter="url(#ripple)">
            <g transform={cam.str}>
              <g transform={`translate(0,${2 * G}) scale(1,-1)`}>
                <WorldContent t={t} bf={bf} open={open} w={w} reflection />
              </g>
              <ellipse cx={HOUSE.win.x + 55} cy={G + 150} rx={70} ry={120} fill="url(#warmHalo)" opacity={0.7 * w.warm} />
            </g>
          </g>
        </g>
        <g transform={cam.str}><Splashes t={t} w={w} /></g>
        {/* негізгі әлем */}
        <g transform={cam.str} opacity={w.reveal}>
          <g transform={`translate(${A_SHIFT},0)`}><PlanSketch t={t} /></g>
          <WorldContent t={t} bf={bf} open={open} w={w} />
          <SceneCaptions t={t} />
        </g>
        <rect x={0} y={0} width={W} height={H} fill="#05060a" opacity={grade} />
        {/* жылы жарық: терезе мен есік (түнгі түзетуден кейін — жарқырап тұрады) */}
        <g style={{mixBlendMode: 'screen'}} opacity={w.warm}>
          <circle cx={winC[0]} cy={winC[1]} r={230 * c.z} fill="url(#warmHalo)" />
          <ellipse cx={doorC[0]} cy={doorC[1] + 30 * c.z} rx={110 * c.z} ry={26 * c.z} fill="url(#warmHalo)" opacity={range(1 - open, 0, 0.84) * 1.2} />
        </g>
        <Fog t={t} c={c} w={w} near />
        <g style={{mixBlendMode: 'screen'}} opacity={0.18 * w.warm * w.rain}>
          <circle cx={winC[0]} cy={winC[1]} r={360 * c.z} fill="url(#warmHalo)" />
        </g>
        <Rain t={t} w={w} />
        <Motes t={t} c={c} w={w} />
        {/* соңғы күңгірттену: сұлбалар мен ай жарығы сақталады */}
        <rect x={0} y={0} width={W} height={H} fill="#030304" opacity={w.dim} />
        <circle cx={moonS[0]} cy={moonS[1]} r={260} fill="url(#moonHalo)" opacity={0.5 * w.dim} />
        <rect x={0} y={0} width={W} height={H} fill="url(#vignette)" />
      </svg>
      <FinalMessage t={t} />
      <AbsoluteFill style={{backgroundImage: `url(${staticFile(`grain/g${grainIdx}.png`)})`, backgroundSize: '512px 512px', opacity: 0.05, mixBlendMode: 'normal'}} />
      <AbsoluteFill style={{backgroundColor: '#000', opacity: Math.min(1, 0.75 * (1 - w.reveal) + w.fadeOut)}} />
      <Html5Audio src={staticFile('audio/soundtrack.wav')} />
    </AbsoluteFill>
  );
};
