import React from 'react';
import {AbsoluteFill, Audio, staticFile, useCurrentFrame} from 'remotion';
import {FPS, HEIGHT, TEXT_TIMING, WIDTH} from './config/timeline';
import {smoothstep} from './lib/math';
import {atmosAt} from './motion/atmosphere';
import {cameraAt} from './motion/camera';
import {jointsAt} from './motion/character';
import {packAt} from './motion/pack';
import {Landscape, Sky, BackdropDefs} from './scene/Backdrop';
import {BridgeBack, BridgeFront, Cliffs} from './scene/BridgeScene';
import {Layer} from './scene/Layer';
import {Grain, Motes, OverlayDefs, Vignette} from './scene/Overlay';
import {FinalText, StoneLabels, Titles} from './scene/Typography';
import {FallingStones, StoneDefs, Walker} from './scene/Walker';

export const Film: React.FC<{audio?: boolean}> = ({audio = true}) => {
  const frame = useCurrentFrame();
  const t = frame / FPS;
  const at = atmosAt(t);
  const cam = cameraAt(t);
  const j = jointsAt(t);
  const pack = packAt(t);
  const [fb0, fb1] = TEXT_TIMING.fadeFromBlack;
  const [ft0, ft1] = TEXT_TIMING.fadeToBlack;
  const black = Math.max(0.45 * (1 - smoothstep(fb0, fb1, t)), 0.86 * smoothstep(ft0, ft1, t));
  return (
    <AbsoluteFill style={{background: '#000'}}>
      <svg width={WIDTH} height={HEIGHT} viewBox={`0 0 ${WIDTH} ${HEIGHT}`} style={{position: 'absolute'}}>
        <defs>
          <BackdropDefs at={at} />
          <StoneDefs at={at} />
          <OverlayDefs />
        </defs>
        <Sky t={t} at={at} cam={cam} />
        <Landscape t={t} at={at} cam={cam} />
        <Layer cam={cam} p={1}>
          <Cliffs t={t} at={at} />
          <BridgeBack t={t} at={at} />
          <Walker j={j} pack={pack} t={t} at={at} />
          <BridgeFront t={t} at={at} />
          <FallingStones t={t} />
        </Layer>
        <Motes t={t} at={at} cam={cam} />
        <Vignette at={at} />
      </svg>
      <Grain frame={frame} />
      <AbsoluteFill>
        <Titles t={t} />
        <StoneLabels t={t} cam={cam} />
        <FinalText t={t} />
      </AbsoluteFill>
      <AbsoluteFill style={{background: '#000', opacity: black}} />
      {audio && <Audio src={staticFile('audio/mix.wav')} />}
    </AbsoluteFill>
  );
};
