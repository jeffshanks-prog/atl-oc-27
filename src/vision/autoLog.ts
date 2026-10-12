// Decide what a new scoreboard picture means for the play that was just run.
import type { Outcome, Play } from '../lib/types.ts';
import type { ScoreboardRead, Side } from './scoreboard.ts';
import { defenseFromCall, samePlayName, type DefenseRead } from './defenseCall.ts';
import type { PreviousPlay } from './prevPlay.ts';

export type AutoLog =
  | { kind: 'log'; offenseName: string; yards: number; outcome: Outcome; touchdown: boolean; defense: DefenseRead }
  | { kind: 'skip'; reason: string; defense?: DefenseRead };

const SPECIAL_TEAMS = /\b(PUNT|FIELD GOAL|FG|KICK|KICKOFF|ONSIDE|EXTRA POINT|PAT|KNEEL|SPIKE)\b/;

export function myScore(r: ScoreboardRead, side: Side) { return side === 'left' ? r.leftScore : r.rightScore; }
export function oppScore(r: ScoreboardRead, side: Side) { return side === 'left' ? r.rightScore : r.leftScore; }

export function outcomeFor(yards: number, isPass: boolean, touchdown: boolean): Outcome {
  if (touchdown) return 'TD';
  if (yards >= 20) return '+20';
  if (yards >= 10) return '+10';
  if (yards >= 5) return '+5';
  if (yards >= 3) return '+3';
  if (yards >= 1) return '+1';
  if (yards === 0) return isPass ? 'Incomplete' : '0';
  return isPass ? 'Sack' : 'Loss';
}

/**
 * `before` = the last settled picture (my snap), `after` = the new settled picture.
 * Only plays that keep the ball with me (or score) are logged automatically.
 */
export function planAutoLog(
  before: ScoreboardRead | null, after: ScoreboardRead, prev: PreviousPlay | null, mySide: Side, isPass: (offenseName: string) => boolean,
): AutoLog {
  const defense = prev ? defenseFromCall(prev.defense) : undefined;
  if (!before) return { kind: 'skip', reason: 'first picture', defense };
  if (before.possession !== mySide) return { kind: 'skip', reason: 'their possession', defense };
  if (!prev) return { kind: 'skip', reason: 'previous play not readable' };
  if (SPECIAL_TEAMS.test(prev.offense)) return { kind: 'skip', reason: 'special teams', defense };

  const scored = myScore(after, mySide) - myScore(before, mySide);
  const touchdown = scored >= 6;
  if (!touchdown && after.possession !== mySide) return { kind: 'skip', reason: 'possession changed (turnover / downs)', defense };
  if (!touchdown && before.quarter !== after.quarter && (before.quarter === 2 || before.quarter === 4)) {
    return { kind: 'skip', reason: 'half ended', defense };
  }
  const yards = touchdown ? 100 - before.yardLine : after.yardLine - before.yardLine;
  if (!touchdown && Math.abs(yards) > 99) return { kind: 'skip', reason: 'implausible yards', defense };
  const pass = isPass(prev.offense);
  return { kind: 'log', offenseName: prev.offense, yards, outcome: outcomeFor(yards, pass, touchdown), touchdown, defense: defense! };
}

/** Pick the playbook play that matches Madden's name, preferring the formation used most recently. */
export function matchPlay(name: string, plays: Play[], preferFormationIds: string[]): Play | null {
  const hits = plays.filter((p) => samePlayName(p.playName, name));
  if (!hits.length) return null;
  for (const f of preferFormationIds) {
    const h = hits.find((p) => p.formationId === f);
    if (h) return h;
  }
  return hits[0];
}
