// Row <-> domain mapping. Keeps snake_case DB shapes out of the UI.
import type {
  Alignment, Coverage, DefenseSeen, Down, Game, GamePlan, GamePlanItem, Outcome, PackageName, Play, PlayCall,
  PlayResult, PlayType, Pressure, Quarter, Scheme, FieldZone, Weights,
} from '@/lib/types';

/* eslint-disable @typescript-eslint/no-explicit-any */
type Row = Record<string, any>;

export function rowToPlay(r: Row): Play {
  const f = r.formation ?? {};
  const pb = r.playbook ?? {};
  const tags: string[] = (r.play_tags ?? []).map((t: Row) => t.tag?.name).filter(Boolean);
  return {
    id: r.id,
    playbookId: r.playbook_id,
    playbook: pb.name ?? 'Atlanta',
    formationId: r.formation_id,
    formationFamily: f.family ?? 'Other',
    formation: f.name ?? '',
    set: r.set_name ?? '',
    playName: r.play_name,
    playType: r.play_type as PlayType,
    personnel: r.personnel ?? null,
    concept: r.concept ?? null,
    primaryScheme: r.primary_scheme ?? null,
    secondarySchemes: r.secondary_schemes ?? [],
    tags,
    screenType: r.screen_type ?? null,
    runConcept: r.run_concept ?? null,
    passConcept: r.pass_concept ?? null,
    rpoType: r.rpo_type ?? null,
    playAction: Boolean(r.play_action),
    bestVs: r.best_vs ?? [],
    weakVs: r.weak_vs ?? [],
    blitzBeater: Boolean(r.blitz_beater),
    manBeater: Boolean(r.man_beater),
    zoneBeater: Boolean(r.zone_beater),
    shortYardageRating: r.short_yardage_rating ?? 3,
    mediumYardageRating: r.medium_yardage_rating ?? 3,
    longYardageRating: r.long_yardage_rating ?? 3,
    redZoneRating: r.red_zone_rating ?? 3,
    goalLineRating: r.goal_line_rating ?? 3,
    twoMinuteRating: r.two_minute_rating ?? 3,
    fourMinuteRating: r.four_minute_rating ?? 3,
    primaryRead: r.primary_read ?? null,
    secondRead: r.second_read ?? null,
    thirdRead: r.third_read ?? null,
    checkdown: r.checkdown ?? null,
    riskLevel: r.risk_level ?? 2,
    explosivePotential: r.explosive_potential ?? 2,
    notes: r.notes ?? null,
    isSeed: Boolean(r.is_seed),
    ownerId: r.owner_id ?? null,
  };
}

/** Columns written to the plays table (tags/formation handled separately). */
export function playToRow(p: Play): Row {
  return {
    id: p.id,
    playbook_id: p.playbookId,
    formation_id: p.formationId,
    set_name: p.set ?? '',
    play_name: p.playName,
    play_type: p.playType,
    personnel: p.personnel,
    concept: p.concept,
    primary_scheme: p.primaryScheme,
    secondary_schemes: p.secondarySchemes,
    screen_type: p.screenType,
    run_concept: p.runConcept,
    pass_concept: p.passConcept,
    rpo_type: p.rpoType,
    play_action: p.playAction,
    best_vs: p.bestVs,
    weak_vs: p.weakVs,
    blitz_beater: p.blitzBeater,
    man_beater: p.manBeater,
    zone_beater: p.zoneBeater,
    short_yardage_rating: p.shortYardageRating,
    medium_yardage_rating: p.mediumYardageRating,
    long_yardage_rating: p.longYardageRating,
    red_zone_rating: p.redZoneRating,
    goal_line_rating: p.goalLineRating,
    two_minute_rating: p.twoMinuteRating,
    four_minute_rating: p.fourMinuteRating,
    primary_read: p.primaryRead,
    second_read: p.secondRead,
    third_read: p.thirdRead,
    checkdown: p.checkdown,
    risk_level: p.riskLevel,
    explosive_potential: p.explosivePotential,
    notes: p.notes,
    is_seed: p.isSeed,
    owner_id: p.ownerId,
  };
}

export function rowToScheme(r: Row): Scheme {
  return {
    id: r.id,
    name: r.name,
    description: r.description ?? '',
    primaryConcept: r.primary_concept ?? null,
    secondaryConcepts: r.secondary_concepts ?? [],
    runPhilosophy: r.run_philosophy ?? '',
    screenPhilosophy: r.screen_philosophy ?? '',
    preferredFormations: r.preferred_formations ?? [],
    preferredPersonnel: r.preferred_personnel ?? [],
    weights: (r.weights ?? {}) as Weights,
    isDefault: Boolean(r.is_default),
    isActive: Boolean(r.is_active),
    playIds: (r.scheme_plays ?? []).map((x: Row) => x.play_id),
  };
}

export function schemeToRow(s: Scheme, userId: string): Row {
  return {
    id: s.id, user_id: userId, name: s.name, description: s.description, primary_concept: s.primaryConcept,
    secondary_concepts: s.secondaryConcepts, run_philosophy: s.runPhilosophy, screen_philosophy: s.screenPhilosophy,
    preferred_formations: s.preferredFormations, preferred_personnel: s.preferredPersonnel, weights: s.weights,
    is_default: s.isDefault, is_active: s.isActive,
  };
}

export function rowToGamePlan(r: Row): GamePlan {
  const items: GamePlanItem[] = (r.game_plan_plays ?? []).map((i: Row) => ({
    id: i.id, package: i.package as PackageName, playId: i.play_id, position: i.position, completed: Boolean(i.completed),
  }));
  return {
    id: r.id, opponent: r.opponent ?? '', planDate: r.plan_date ?? null, schemeId: r.scheme_id ?? null,
    notes: r.notes ?? '', scriptLength: r.script_length ?? 10, items, createdAt: r.created_at,
  };
}
export function gamePlanToRow(g: GamePlan, userId: string): Row {
  return {
    id: g.id, user_id: userId, opponent: g.opponent, plan_date: g.planDate, scheme_id: g.schemeId,
    notes: g.notes, script_length: g.scriptLength,
  };
}
export function gamePlanItemToRow(i: GamePlanItem, planId: string): Row {
  return { id: i.id, game_plan_id: planId, package: i.package, play_id: i.playId, position: i.position, completed: i.completed };
}

export function rowToGame(r: Row): Game {
  return {
    id: r.id, opponent: r.opponent ?? '', gamePlanId: r.game_plan_id ?? null, schemeId: r.scheme_id ?? null,
    startedAt: r.started_at, endedAt: r.ended_at ?? null, myScore: r.my_score ?? 0, oppScore: r.opp_score ?? 0,
    status: r.status, adaptive: Boolean(r.adaptive),
  };
}
export function gameToRow(g: Game, userId: string): Row {
  return {
    id: g.id, user_id: userId, opponent: g.opponent, game_plan_id: g.gamePlanId, scheme_id: g.schemeId,
    started_at: g.startedAt, ended_at: g.endedAt, my_score: g.myScore, opp_score: g.oppScore, status: g.status,
    adaptive: g.adaptive,
  };
}

export function rowToResult(r: Row | null | undefined): PlayResult | null {
  if (!r) return null;
  return {
    outcome: r.outcome as Outcome, yards: r.yards, success: Boolean(r.success), isPass: Boolean(r.is_pass),
    completed: Boolean(r.completed), touchdown: Boolean(r.touchdown), turnover: Boolean(r.turnover),
    sack: Boolean(r.sack), defenseSeen: r.defense_seen as DefenseSeen, observations: r.observations ?? [],
  };
}

export function rowToCall(r: Row): PlayCall {
  const res = Array.isArray(r.play_results) ? r.play_results[0] : r.play_results;
  return {
    id: r.id, gameId: r.game_id, playId: r.play_id, sequence: r.sequence, down: r.down as Down,
    distance: Number(r.distance), yardLine: r.yard_line, fieldZone: r.field_zone as FieldZone,
    quarter: r.quarter as Quarter, clock: r.clock, myScore: r.my_score, oppScore: r.opp_score,
    coverage: r.coverage as Coverage, pressure: r.pressure as Pressure, alignment: (r.alignment ?? []) as Alignment[],
    matchScore: r.match_score ?? null, createdAt: r.created_at, result: rowToResult(res),
  };
}
export function callToRow(c: PlayCall, userId: string): Row {
  return {
    id: c.id, user_id: userId, game_id: c.gameId, play_id: c.playId, sequence: c.sequence, down: c.down,
    distance: c.distance, yard_line: c.yardLine, field_zone: c.fieldZone, quarter: c.quarter, clock: c.clock,
    my_score: c.myScore, opp_score: c.oppScore, coverage: c.coverage, pressure: c.pressure, alignment: c.alignment,
    match_score: c.matchScore, created_at: c.createdAt,
  };
}
export function resultToRow(callId: string, r: PlayResult, userId: string): Row {
  return {
    play_call_id: callId, user_id: userId, outcome: r.outcome, yards: r.yards, success: r.success, is_pass: r.isPass,
    completed: r.completed, touchdown: r.touchdown, turnover: r.turnover, sack: r.sack, defense_seen: r.defenseSeen,
    observations: r.observations,
  };
}
