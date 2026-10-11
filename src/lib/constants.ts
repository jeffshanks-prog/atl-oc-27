import type {
  Alignment, ConceptKey, Coverage, DefenseSeen, Down, FieldZone, Outcome, PackageName, PlayType, Pressure,
  Quarter, QuickMode, Weights,
} from './types';

export const DOWNS: { label: string; value: Down }[] = [
  { label: '1st', value: 1 }, { label: '2nd', value: 2 }, { label: '3rd', value: 3 }, { label: '4th', value: 4 },
];

export const DISTANCES: { label: string; value: number }[] = [
  { label: 'Inches', value: 0.5 },
  ...[1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map((n) => ({ label: String(n), value: n })),
  { label: '11–15', value: 13 },
  { label: '16+', value: 18 },
];

export const QUARTERS: { label: string; value: Quarter }[] = [
  { label: '1', value: 1 }, { label: '2', value: 2 }, { label: '3', value: 3 }, { label: '4', value: 4 }, { label: 'OT', value: 5 },
];

export const FIELD_ZONES: { zone: FieldZone; yardLine: number }[] = [
  { zone: 'Own goal line', yardLine: 3 },
  { zone: 'Own territory', yardLine: 25 },
  { zone: 'Midfield', yardLine: 50 },
  { zone: 'Opponent territory', yardLine: 65 },
  { zone: 'Red zone', yardLine: 85 },
  { zone: 'Inside 10', yardLine: 93 },
  { zone: 'Goal line', yardLine: 98 },
];

export const COVERAGES: Coverage[] = [
  'Unknown', 'Cover 0', 'Cover 1', 'Cover 2', 'Cover 3', 'Cover 4', 'Cover 6', 'Man', 'Match', 'Prevent',
];
export const PRESSURES: Pressure[] = ['Unknown', 'Normal rush', 'Blitz', 'Heavy blitz', 'Double mug', 'Edge pressure'];
export const ALIGNMENTS: Alignment[] = [
  'Light box', 'Normal box', 'Loaded box', 'Press', 'Off coverage', 'User-controlled MLB', 'User-controlled Safety',
];
export const PLAY_TYPES: PlayType[] = ['Pass', 'Run', 'Screen', 'RPO', 'Play Action'];

export const QUICK_CALLS: { mode: QuickMode; label: string; tone?: 'hot' | 'fav' }[] = [
  { mode: 'SPACING', label: 'SPACING' },
  { mode: 'SCREEN', label: '🔥 SCREEN NOW', tone: 'hot' },
  { mode: 'RUN', label: 'RUN' },
  { mode: 'QUICK_GAME', label: 'QUICK GAME' },
  { mode: 'BEAT_MAN', label: 'BEAT MAN' },
  { mode: 'BEAT_ZONE', label: 'BEAT ZONE' },
  { mode: 'BEAT_BLITZ', label: 'BEAT BLITZ' },
  { mode: 'RPO', label: 'RPO' },
  { mode: 'PLAY_ACTION', label: 'PLAY ACTION' },
  { mode: 'SHOT', label: 'SHOT PLAY' },
  { mode: 'RED_ZONE', label: 'RED ZONE' },
  { mode: 'GOAL_LINE', label: 'GOAL LINE' },
  { mode: 'TWO_MINUTE', label: '2-MINUTE' },
  { mode: 'CLOCK_CONTROL', label: 'CLOCK CONTROL' },
  { mode: 'FAVORITES', label: '❤️ FAVORITES', tone: 'fav' },
];
export const NEED_MODES: { mode: QuickMode; label: string }[] = [
  { mode: 'NEED_1', label: 'NEED 1' },
  { mode: 'NEED_3', label: 'NEED 3' },
  { mode: 'NEED_5', label: 'NEED 5' },
  { mode: 'NEED_10', label: 'NEED 10+' },
];
export const QUICK_MODE_LABEL: Record<QuickMode, string> = Object.fromEntries(
  [...QUICK_CALLS, ...NEED_MODES].map((q) => [q.mode, q.label]),
) as Record<QuickMode, string>;

export const FAVORITE_ROLES = [
  'Go-To', 'Money Play', 'Screen', 'Run', 'Quick Game', '3rd Down', '4th Down', 'Red Zone', 'Goal Line',
  'Man Beater', 'Zone Beater', 'Cover 2 Beater', 'Cover 3 Beater', 'Cover 4 Beater', 'Blitz Beater',
  'Shot Play', '2-Minute', 'Clock Killer',
] as const;

export const PACKAGES: PackageName[] = [
  'Opening Script', 'Base Calls', '1st Down', '2nd Down', '3rd & Short', '3rd & Medium', '3rd & Long', '4th Down',
  'Red Zone', 'Goal Line', '2-Minute', '4-Minute', 'Beat Man', 'Beat Zone', 'Beat Blitz', 'Screens', 'Runs',
  'Shots', 'Protect Lead', 'Comeback Mode',
];

export const OUTCOMES: Outcome[] = ['TD', '+20', '+10', '+5', '+3', '+1', '0', 'Loss', 'Incomplete', 'Sack', 'INT', 'Fumble'];
export const DEFENSE_SEEN: DefenseSeen[] = ['C0', 'C1', 'C2', 'C3', 'C4', 'C6', 'Man', 'Blitz', 'Unknown'];
export const OBSERVATIONS = [
  'User covered middle', 'User jumped flat', 'User jumped screen', 'Heavy pressure', 'Loaded box', 'Light box',
  'Press coverage', 'Soft coverage', 'QB spy', 'Edge rush', 'Safety came down',
] as const;

export const CONCEPT_KEYS: { key: ConceptKey; label: string }[] = [
  { key: 'spacing', label: 'Spacing' },
  { key: 'screen', label: 'Screens' },
  { key: 'run', label: 'Runs' },
  { key: 'mesh', label: 'Mesh / Man Beaters' },
  { key: 'rpo', label: 'RPO' },
  { key: 'playAction', label: 'Play Action' },
  { key: 'shot', label: 'Shots' },
  { key: 'flood', label: 'Flood' },
  { key: 'levels', label: 'Levels' },
  { key: 'drive', label: 'Drive' },
  { key: 'quickGame', label: 'Quick Game' },
  { key: 'verticals', label: 'Verticals' },
];

export const DEFAULT_WEIGHTS: Weights = {
  spacing: 30, screen: 20, run: 20, mesh: 10, rpo: 8, playAction: 7, shot: 5,
};
export const DEFAULT_SCHEME_NAME = "JEFF'S ATL SPACING OFFENSE";

/** Browse-by-scheme list (Playbook explorer). */
export const SCHEME_BROWSE: { label: string; family: string }[] = [
  { label: 'Spacing', family: 'spacing' },
  { label: 'Screens', family: 'screen' },
  { label: 'Mesh', family: 'mesh' },
  { label: 'Flood', family: 'flood' },
  { label: 'Levels', family: 'levels' },
  { label: 'Drive', family: 'drive' },
  { label: 'Quick Game', family: 'quickGame' },
  { label: 'RPO', family: 'rpo' },
  { label: 'Inside Zone', family: 'insideZone' },
  { label: 'Outside Zone', family: 'outsideZone' },
  { label: 'Power', family: 'power' },
  { label: 'Play Action', family: 'playAction' },
  { label: 'Verticals', family: 'verticals' },
  { label: 'Shot Plays', family: 'shot' },
];

export const SCHEME_TEMPLATES = [
  'Spacing', 'Screen Heavy', 'West Coast', 'Air Raid', 'Quick Game', 'Mesh', 'Flood', 'Levels', 'RPO',
  'Inside Zone', 'Outside Zone', 'Power Run', 'Play Action', 'Vertical', 'Shot Plays', 'Run Heavy', 'Custom Scheme',
];

export const FORMATION_FAMILY_ORDER = ['Gun', 'Pistol', 'Singleback', 'I Form', 'Strong', 'Weak', 'Split Backs', 'Goal Line', 'Other'];

export const SCREEN_CATEGORIES = [
  'HB Screen', 'Slip Screen', 'WR Screen', 'Bubble', 'RPO Screen', 'TE Screen', 'Motion Screen', 'Delayed Screen', 'Other',
] as const;
export type ScreenCategory = (typeof SCREEN_CATEGORIES)[number];
