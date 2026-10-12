import type { Box } from './gray.ts';

/** Where things sit on Madden 27's play-call screen, measured on a 1920×1080 frame. */
export const REGIONS = {
  downDistance: { x0: 884, y0: 996, x1: 1040, y1: 1022 },
  quarter: { x0: 872, y0: 1026, x1: 912, y1: 1055 },
  clock: { x0: 912, y0: 1026, x1: 970, y1: 1055 },
  ballSpot: { x0: 1006, y0: 1026, x1: 1048, y1: 1055 },
  leftScore: { x0: 752, y0: 998, x1: 832, y1: 1050 },
  rightScore: { x0: 1088, y0: 998, x1: 1168, y1: 1050 },
  prevDefense: { x0: 1384, y0: 238, x1: 1618, y1: 270 },
  prevOffense: { x0: 1624, y0: 238, x1: 1860, y1: 270 },
} satisfies Record<string, Box>;

/** Brightness cut-off per region (white text vs. the grey text used for quarter and ball spot). */
export const THRESHOLD = {
  downDistance: 150, quarter: 105, clock: 150, ballSpot: 105, leftScore: 150, rightScore: 150,
} as const;
