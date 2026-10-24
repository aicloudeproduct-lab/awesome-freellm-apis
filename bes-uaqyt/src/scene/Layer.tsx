import React from 'react';
import {CAMERA} from '../config/timeline';
import {Cam} from '../motion/camera';

/** Parallax group: children are drawn in that layer's world coordinates. */
export const Layer: React.FC<{cam: Cam; p: number; children: React.ReactNode; opacity?: number}> = ({cam, p, children, opacity}) => {
  const z = 1 + (cam.zoom - 1) * p;
  return (
    <g opacity={opacity} transform={`translate(540 ${CAMERA.anchorY}) scale(${z.toFixed(5)}) translate(${(-cam.x * p).toFixed(3)} ${(-cam.y * p).toFixed(3)})`}>
      {children}
    </g>
  );
};
