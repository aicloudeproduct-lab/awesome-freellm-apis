// How heavy the pack is over time. load = 1 with five stones, 0 when empty.

import {PRAYERS, PRAYER_RELEASE} from '../config/timeline';
import {smoothstep} from '../lib/math';

export const releaseTimes = PRAYERS.map((p) => p.t0 + p.dur * PRAYER_RELEASE);

/** Number of stones still in the pack at time t (discrete). */
export const stonesLeft = (t: number) => 5 - releaseTimes.filter((r) => t >= r).length;

/** Continuous load used by posture: eases down shortly after each stone leaves. */
export const loadAt = (t: number) => {
  let l = 1;
  for (const r of releaseTimes) l -= 0.2 * smoothstep(r + 0.04, r + 0.7, t);
  return Math.max(0, l);
};
