export type Down = 1 | 2 | 3 | 4;
export type Quarter = 1 | 2 | 3 | 4 | 5; // 5 = OT

export type Coverage =
  | 'Unknown' | 'Cover 0' | 'Cover 1' | 'Cover 2' | 'Cover 3' | 'Cover 4' | 'Cover 6' | 'Man' | 'Match' | 'Prevent';
export type Pressure = 'Unknown' | 'Normal rush' | 'Blitz' | 'Heavy blitz' | 'Double mug' | 'Edge pressure';
export type Alignment =
  | 'Light box' | 'Normal box' | 'Loaded box' | 'Press' | 'Off coverage' | 'User-controlled MLB' | 'User-controlled Safety';
export type FieldZone =
  | 'Own goal line' | 'Own territory' | 'Midfield' | 'Opponent territory' | 'Red zone' | 'Inside 10' | 'Goal line';
export type PlayType = 'Pass' | 'Run' | 'Screen' | 'RPO' | 'Play Action';

/** Concept keys that can carry a scheme weight. */
export type ConceptKey =
  | 'spacing' | 'screen' | 'run' | 'mesh' | 'rpo' | 'playAction' | 'shot'
  | 'flood' | 'levels' | 'drive' | 'quickGame' | 'verticals';
/** Families a play can belong to (run sub-families roll up to the `run` weight). */
export type Family = ConceptKey | 'insideZone' | 'outsideZone' | 'power';

export type QuickMode =
  | 'SPACING' | 'SCREEN' | 'RUN' | 'QUICK_GAME' | 'BEAT_MAN' | 'BEAT_ZONE' | 'BEAT_BLITZ' | 'RPO'
  | 'PLAY_ACTION' | 'SHOT' | 'RED_ZONE' | 'GOAL_LINE' | 'TWO_MINUTE' | 'CLOCK_CONTROL' | 'FAVORITES'
  | 'NEED_1' | 'NEED_3' | 'NEED_5' | 'NEED_10';

export type Outcome =
  | 'TD' | '+20' | '+10' | '+5' | '+3' | '+1' | '0' | 'Loss' | 'Incomplete' | 'Sack' | 'INT' | 'Fumble';
export type DefenseSeen = 'C0' | 'C1' | 'C2' | 'C3' | 'C4' | 'C6' | 'Man' | 'Blitz' | 'Unknown';

export type PackageName =
  | 'Opening Script' | 'Base Calls' | '1st Down' | '2nd Down' | '3rd & Short' | '3rd & Medium' | '3rd & Long'
  | '4th Down' | 'Red Zone' | 'Goal Line' | '2-Minute' | '4-Minute' | 'Beat Man' | 'Beat Zone' | 'Beat Blitz'
  | 'Screens' | 'Runs' | 'Shots' | 'Protect Lead' | 'Comeback Mode';

export interface Play {
  id: string;
  playbookId: string;
  playbook: string;
  formationId: string;
  formationFamily: string;
  formation: string;
  set: string;
  playName: string;
  playType: PlayType;
  personnel: string | null;
  concept: string | null;
  primaryScheme: string | null;
  secondarySchemes: string[];
  tags: string[];
  screenType: string | null;
  runConcept: string | null;
  passConcept: string | null;
  rpoType: string | null;
  playAction: boolean;
  bestVs: string[];
  weakVs: string[];
  blitzBeater: boolean;
  manBeater: boolean;
  zoneBeater: boolean;
  shortYardageRating: number;
  mediumYardageRating: number;
  longYardageRating: number;
  redZoneRating: number;
  goalLineRating: number;
  twoMinuteRating: number;
  fourMinuteRating: number;
  primaryRead: string | null;
  secondRead: string | null;
  thirdRead: string | null;
  checkdown: string | null;
  riskLevel: number;
  explosivePotential: number;
  notes: string | null;
  isSeed: boolean;
  ownerId: string | null;
}

export interface Profile { id: string; displayName: string | null; isAdmin: boolean }
export interface Subscription {
  status: string;
  currentPeriodEnd: string | null;
  cancelAtPeriodEnd: boolean;
  priceId: string | null;
}

export type Weights = Partial<Record<ConceptKey, number>>;

export interface Scheme {
  id: string;
  name: string;
  description: string;
  primaryConcept: string | null;
  secondaryConcepts: string[];
  runPhilosophy: string;
  screenPhilosophy: string;
  preferredFormations: string[];
  preferredPersonnel: string[];
  weights: Weights;
  isDefault: boolean;
  isActive: boolean;
  playIds: string[];
}

export interface GamePlanItem {
  id: string;
  package: PackageName;
  playId: string;
  position: number;
  completed: boolean;
}

export interface GamePlan {
  id: string;
  opponent: string;
  planDate: string | null;
  schemeId: string | null;
  notes: string;
  scriptLength: number;
  items: GamePlanItem[];
  createdAt: string;
}

export interface Game {
  id: string;
  opponent: string;
  gamePlanId: string | null;
  schemeId: string | null;
  startedAt: string;
  endedAt: string | null;
  myScore: number;
  oppScore: number;
  status: 'active' | 'final';
  adaptive: boolean;
}

export interface Situation {
  down: Down;
  distance: number;
  yardLine: number; // 1-99, own goal = 0, opponent goal = 100
  quarter: Quarter;
  clock: string; // mm:ss
  myScore: number;
  oppScore: number;
  coverage: Coverage;
  pressure: Pressure;
  alignment: Alignment[];
}

export interface PlayResult {
  outcome: Outcome;
  yards: number;
  success: boolean;
  isPass: boolean;
  completed: boolean;
  touchdown: boolean;
  turnover: boolean;
  sack: boolean;
  defenseSeen: DefenseSeen;
  observations: string[];
}

export interface PlayCall {
  id: string;
  gameId: string;
  playId: string;
  sequence: number;
  down: Down;
  distance: number;
  yardLine: number;
  fieldZone: FieldZone;
  quarter: Quarter;
  clock: string;
  myScore: number;
  oppScore: number;
  coverage: Coverage;
  pressure: Pressure;
  alignment: Alignment[];
  matchScore: number | null;
  createdAt: string;
  result: PlayResult | null;
}
