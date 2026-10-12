// Turn the defensive play name from Madden's "Previous Play" box into the coverage + pressure it shows.
import type { DefenseSeen } from '../lib/types.ts';

const BLITZ_WORDS = [
  'BLITZ', 'FIRE', 'STING', 'SUGAR', 'MUG', 'PINCH', 'DOG', 'STORM', 'BOSS', 'OVERLOAD', 'SNIPER', 'CROSS',
  'GAP', 'EDGE', 'SMASH', 'DBL', 'DOUBLE', 'SPINNER', 'SHOOT', 'BULLET', 'LB DOGS', 'NICKEL DOGS',
];

export interface DefenseRead { name: string; seen: DefenseSeen; blitz: boolean }

export function defenseFromCall(raw: string): DefenseRead {
  // Madden's font is tightly spaced, so the reader can drop spaces ("SAWBLITZ1"): match without them.
  const name = raw.toUpperCase().replace(/[^A-Z0-9 ]/g, ' ').replace(/([A-Z])(\d)/g, '$1 $2').replace(/(\d)([A-Z])/g, '$1 $2')
    .replace(/\s+/g, ' ').trim();
  const c = name.replace(/ /g, '');
  const blitz = BLITZ_WORDS.some((w) => c.includes(w.replace(/ /g, '')));

  let seen: DefenseSeen = 'Unknown';
  const cover = c.match(/COVER(\d)/);
  if (/COVER2MAN|(^|[^0-9])2MAN|MANUNDER/.test(c)) seen = 'Man';
  else if (cover) {
    const n = cover[1];
    seen = n === '0' ? 'C0' : n === '1' ? 'C1' : n === '2' ? 'C2' : n === '3' ? 'C3' : n === '4' ? 'C4' : n === '6' ? 'C6' : 'Unknown';
  } else if (c.includes('TAMPA')) seen = 'C2';
  else if (c.includes('QUARTERHALF') || c.includes('QTRHALF')) seen = 'C6';
  else if (c.includes('QUARTERS') || c.includes('PALMS') || c.includes('QTRS')) seen = 'C4';
  else {
    // blitz names carry the coverage behind them as a lone number: "SAW BLITZ 1", "FIRE ZONE 3"
    const d = name.split(' ').find((w) => /^[0-4]$/.test(w));
    if (d) seen = (['C0', 'C1', 'C2', 'C3', 'C4'] as const)[Number(d)];
    else if (name.split(' ').includes('MAN')) seen = 'Man';
  }
  return { name, seen, blitz };
}

/** Loose match between the play name Madden shows and a play name in the playbook. */
export function samePlayName(a: string, b: string): boolean {
  const n = (s: string) => s.toUpperCase().replace(/[^A-Z0-9]/g, '');
  return n(a) === n(b);
}
