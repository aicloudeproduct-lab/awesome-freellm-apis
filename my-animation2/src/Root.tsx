import React from 'react';
import {Composition} from 'remotion';
import {IpadCinematic} from './ipad/IpadCinematic';
import {DURATION_FRAMES, FPS, H, W} from './ipad/constants';

export const RemotionRoot: React.FC = () => (
  <Composition
    id="IpadCinematic"
    component={IpadCinematic}
    durationInFrames={DURATION_FRAMES}
    fps={FPS}
    width={W}
    height={H}
  />
);
