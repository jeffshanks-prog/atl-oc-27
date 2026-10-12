// Global app state. Optimistic local updates -> IndexedDB snapshot -> offline-safe write queue.
import { create } from 'zustand';
import { get as idbGet, set as idbSet } from 'idb-keyval';
import type {
  Game, GamePlan, GamePlanItem, Play, PlayCall, PlayResult, Profile, Scheme, Situation, Subscription,
} from '@/lib/types';
import { write } from '@/offline/queue';
import {
  callToRow, gamePlanItemToRow, gamePlanToRow, gameToRow, resultToRow, schemeToRow,
} from '@/data/mappers';
import { freshSituation, nextSituation, zoneFromYardLine } from '@/engine/situation';
import { DEFAULT_SCHEME_NAME, DEFAULT_WEIGHTS } from '@/lib/constants';
import type { Snapshot } from '@/data/api';
import { uuid } from '@/lib/supabase';

export interface Toast { id: number; text: string; tone?: 'ok' | 'warn' }

interface AppState {
  userId: string | null;
  profile: Profile | null;
  subscription: Subscription | null;
  plays: Play[];
  playsById: Map<string, Play>;
  favorites: Record<string, string[]>;
  schemes: Scheme[];
  gamePlans: GamePlan[];
  games: Game[];
  calls: PlayCall[];
  activeGameId: string | null;
  situation: Situation;
  pendingCallId: string | null;
  loaded: boolean;
  toasts: Toast[];

  hydrate(userId: string, snap: Partial<Snapshot>): void;
  reset(): void;
  toast(text: string, tone?: Toast['tone']): void;
  setSituation(patch: Partial<Situation>): void;

  // favorites
  toggleFavorite(playId: string): void;
  setFavoriteRoles(playId: string, roles: string[]): void;

  // schemes
  saveScheme(s: Scheme): void;
  deleteScheme(id: string): void;
  setActiveScheme(id: string): void;
  addPlayToScheme(schemeId: string, playId: string): void;

  // game plans
  saveGamePlan(g: GamePlan): void;
  deleteGamePlan(id: string): void;
  addToGamePlan(planId: string, pkg: GamePlanItem['package'], playId: string): void;

  // games
  startGame(opponent: string, gamePlanId?: string | null): Game;
  updateGame(patch: Partial<Game>): void;
  endGame(): void;
  callPlay(playId: string, matchScore: number | null, at?: Situation): PlayCall;
  recordResult(callId: string, result: PlayResult): void;
  setPendingCall(id: string | null): void;

  // plays (admin / custom)
  upsertPlaysLocal(plays: Play[]): void;
  removePlayLocal(id: string): void;
}

const snapKey = (uid: string) => `atloc27:snap:${uid}`;
let persistTimer: ReturnType<typeof setTimeout> | null = null;

export const useApp = create<AppState>((set, get) => {
  const persist = () => {
    if (persistTimer) clearTimeout(persistTimer);
    persistTimer = setTimeout(() => {
      const s = get();
      if (!s.userId) return;
      void idbSet(snapKey(s.userId), {
        profile: s.profile, subscription: s.subscription, plays: s.plays, favorites: s.favorites,
        schemes: s.schemes, gamePlans: s.gamePlans, games: s.games, calls: s.calls,
        activeGameId: s.activeGameId, situation: s.situation, pendingCallId: s.pendingCallId,
      });
    }, 300);
  };
  const uid = () => get().userId ?? '';
  const patch = (p: Partial<AppState>) => { set(p); persist(); };

  return {
    userId: null, profile: null, subscription: null, plays: [], playsById: new Map(), favorites: {},
    schemes: [], gamePlans: [], games: [], calls: [], activeGameId: null, situation: freshSituation(),
    pendingCallId: null, loaded: false, toasts: [],

    hydrate(userId, snap) {
      const cur = get();
      const plays = snap.plays ?? cur.plays;
      const games = snap.games ?? cur.games;
      const active = games.find((g) => g.status === 'active');
      set({
        userId,
        profile: snap.profile !== undefined ? snap.profile : cur.profile,
        subscription: snap.subscription !== undefined ? snap.subscription : cur.subscription,
        plays, playsById: new Map(plays.map((p) => [p.id, p])),
        favorites: snap.favorites ?? cur.favorites,
        schemes: snap.schemes ?? cur.schemes,
        gamePlans: snap.gamePlans ?? cur.gamePlans,
        games, calls: snap.calls ?? cur.calls,
        activeGameId: active?.id ?? null,
        loaded: true,
      });
      persist();
    },
    reset() {
      set({ userId: null, profile: null, subscription: null, plays: [], playsById: new Map(), favorites: {},
        schemes: [], gamePlans: [], games: [], calls: [], activeGameId: null, situation: freshSituation(),
        pendingCallId: null, loaded: false });
    },
    toast(text, tone = 'ok') {
      const id = Date.now() + Math.random();
      set({ toasts: [...get().toasts, { id, text, tone }] });
      setTimeout(() => set({ toasts: get().toasts.filter((t) => t.id !== id) }), 2600);
    },
    setSituation(p) { patch({ situation: { ...get().situation, ...p } }); },

    // ---------------- favorites ----------------
    toggleFavorite(playId) {
      const favs = { ...get().favorites };
      if (favs[playId]) {
        delete favs[playId];
        patch({ favorites: favs });
        void write({ table: 'favorites', kind: 'delete', match: { user_id: uid(), play_id: playId } });
      } else {
        favs[playId] = [];
        patch({ favorites: favs });
        void write({ table: 'favorites', kind: 'upsert', rows: [{ user_id: uid(), play_id: playId }], onConflict: 'user_id,play_id' });
      }
    },
    setFavoriteRoles(playId, roles) {
      const favs = { ...get().favorites };
      const wasFav = Boolean(favs[playId]);
      const prev = favs[playId] ?? [];
      favs[playId] = roles;
      patch({ favorites: favs });
      void (async () => {
        if (!wasFav) await write({ table: 'favorites', kind: 'upsert', rows: [{ user_id: uid(), play_id: playId }], onConflict: 'user_id,play_id' });
        for (const r of prev.filter((x) => !roles.includes(x))) {
          await write({ table: 'favorite_roles', kind: 'delete', match: { user_id: uid(), play_id: playId, role: r } });
        }
        const added = roles.filter((x) => !prev.includes(x));
        if (added.length) {
          await write({ table: 'favorite_roles', kind: 'upsert', rows: added.map((role) => ({ user_id: uid(), play_id: playId, role })), onConflict: 'user_id,play_id,role' });
        }
      })();
    },

    // ---------------- schemes ----------------
    saveScheme(s) {
      const list = get().schemes;
      const prev = list.find((x) => x.id === s.id);
      const next = prev ? list.map((x) => (x.id === s.id ? s : x)) : [...list, s];
      patch({ schemes: next });
      void (async () => {
        await write({ table: 'schemes', kind: 'upsert', rows: [schemeToRow(s, uid())] });
        const before = prev?.playIds ?? [];
        for (const pid of before.filter((x) => !s.playIds.includes(x))) {
          await write({ table: 'scheme_plays', kind: 'delete', match: { scheme_id: s.id, play_id: pid } });
        }
        const add = s.playIds.filter((x) => !before.includes(x));
        if (add.length) await write({ table: 'scheme_plays', kind: 'upsert', rows: add.map((play_id) => ({ scheme_id: s.id, play_id })), onConflict: 'scheme_id,play_id' });
      })();
    },
    deleteScheme(id) {
      const list = get().schemes.filter((x) => x.id !== id);
      if (list.length && !list.some((x) => x.isActive)) list[0] = { ...list[0], isActive: true };
      patch({ schemes: list });
      void write({ table: 'schemes', kind: 'delete', match: { id } });
      const act = list.find((x) => x.isActive);
      if (act) void write({ table: 'schemes', kind: 'upsert', rows: [schemeToRow(act, uid())] });
    },
    setActiveScheme(id) {
      const list = get().schemes.map((x) => ({ ...x, isActive: x.id === id }));
      patch({ schemes: list });
      void write({ table: 'schemes', kind: 'upsert', rows: list.map((x) => schemeToRow(x, uid())) });
    },
    addPlayToScheme(schemeId, playId) {
      const s = get().schemes.find((x) => x.id === schemeId);
      if (!s || s.playIds.includes(playId)) return;
      get().saveScheme({ ...s, playIds: [...s.playIds, playId] });
    },

    // ---------------- game plans ----------------
    saveGamePlan(g) {
      const list = get().gamePlans;
      const prev = list.find((x) => x.id === g.id);
      patch({ gamePlans: prev ? list.map((x) => (x.id === g.id ? g : x)) : [g, ...list] });
      void (async () => {
        await write({ table: 'game_plans', kind: 'upsert', rows: [gamePlanToRow(g, uid())] });
        const keep = new Set(g.items.map((i) => i.id));
        for (const old of prev?.items ?? []) {
          if (!keep.has(old.id)) await write({ table: 'game_plan_plays', kind: 'delete', match: { id: old.id } });
        }
        if (g.items.length) await write({ table: 'game_plan_plays', kind: 'upsert', rows: g.items.map((i) => gamePlanItemToRow(i, g.id)) });
      })();
    },
    deleteGamePlan(id) {
      patch({ gamePlans: get().gamePlans.filter((x) => x.id !== id) });
      void write({ table: 'game_plans', kind: 'delete', match: { id } });
    },
    addToGamePlan(planId, pkg, playId) {
      const g = get().gamePlans.find((x) => x.id === planId);
      if (!g) return;
      const pos = g.items.filter((i) => i.package === pkg).length;
      get().saveGamePlan({ ...g, items: [...g.items, { id: uuid(), package: pkg, playId, position: pos, completed: false }] });
    },

    // ---------------- games ----------------
    startGame(opponent, gamePlanId = null) {
      const cur = get();
      if (cur.activeGameId) cur.endGame();
      const scheme = cur.schemes.find((x) => x.isActive) ?? null;
      const plan = gamePlanId ? cur.gamePlans.find((x) => x.id === gamePlanId) : null;
      const game: Game = {
        id: uuid(), opponent: opponent || plan?.opponent || 'Opponent', gamePlanId: gamePlanId ?? null,
        schemeId: plan?.schemeId ?? scheme?.id ?? null, startedAt: new Date().toISOString(), endedAt: null,
        myScore: 0, oppScore: 0, status: 'active', adaptive: true,
      };
      if (plan?.schemeId && plan.schemeId !== scheme?.id) cur.setActiveScheme(plan.schemeId);
      patch({ games: [game, ...get().games], activeGameId: game.id, situation: freshSituation({ quarter: 1, clock: '15:00', myScore: 0, oppScore: 0 }), pendingCallId: null });
      void write({ table: 'games', kind: 'upsert', rows: [gameToRow(game, uid())] });
      return game;
    },
    updateGame(p) {
      const id = get().activeGameId;
      if (!id) return;
      const games = get().games.map((g) => (g.id === id ? { ...g, ...p } : g));
      patch({ games });
      const g = games.find((x) => x.id === id)!;
      void write({ table: 'games', kind: 'upsert', rows: [gameToRow(g, uid())] });
    },
    endGame() {
      const s = get();
      const id = s.activeGameId;
      if (!id) return;
      const games = s.games.map((g) => (g.id === id ? { ...g, status: 'final' as const, endedAt: new Date().toISOString(), myScore: s.situation.myScore, oppScore: s.situation.oppScore } : g));
      patch({ games, activeGameId: null, pendingCallId: null });
      const g = games.find((x) => x.id === id)!;
      void write({ table: 'games', kind: 'upsert', rows: [gameToRow(g, uid())] });
    },
    callPlay(playId, matchScore, at) {
      let s = get();
      if (!s.activeGameId) { s.startGame('Opponent'); s = get(); }
      const sit = at ?? s.situation;
      const seq = s.calls.filter((c) => c.gameId === s.activeGameId).reduce((m, c) => Math.max(m, c.sequence), 0) + 1;
      const call: PlayCall = {
        id: uuid(), gameId: s.activeGameId!, playId, sequence: seq, down: sit.down, distance: sit.distance,
        yardLine: sit.yardLine, fieldZone: zoneFromYardLine(sit.yardLine), quarter: sit.quarter, clock: sit.clock,
        myScore: sit.myScore, oppScore: sit.oppScore, coverage: sit.coverage, pressure: sit.pressure,
        alignment: sit.alignment, matchScore, createdAt: new Date().toISOString(), result: null,
      };
      patch({ calls: [...s.calls, call], pendingCallId: call.id });
      void write({ table: 'play_calls', kind: 'upsert', rows: [callToRow(call, uid())] });
      // Mark the matching opening-script item complete
      const game = get().games.find((g) => g.id === call.gameId);
      const plan = game?.gamePlanId ? get().gamePlans.find((p) => p.id === game.gamePlanId) : null;
      if (plan) {
        const item = plan.items.filter((i) => i.package === 'Opening Script' && !i.completed).sort((a, b) => a.position - b.position)
          .find((i) => i.playId === playId);
        if (item) get().saveGamePlan({ ...plan, items: plan.items.map((i) => (i.id === item.id ? { ...i, completed: true } : i)) });
      }
      return call;
    },
    recordResult(callId, result) {
      const s = get();
      const call = s.calls.find((c) => c.id === callId);
      if (!call) return;
      const calls = s.calls.map((c) => (c.id === callId ? { ...c, result } : c));
      // Only a first-time result advances down & distance; editing an old result never moves the chains.
      const advance = call.gameId === s.activeGameId && !call.result;
      const next = advance ? nextSituation(s.situation, result) : s.situation;
      patch({ calls, pendingCallId: s.pendingCallId === callId ? null : s.pendingCallId, situation: next });
      void write({ table: 'play_results', kind: 'upsert', rows: [resultToRow(callId, result, uid())], onConflict: 'play_call_id' });
      if (result.touchdown && advance) get().updateGame({ myScore: next.myScore });
    },
    setPendingCall(id) { patch({ pendingCallId: id }); },

    // ---------------- plays ----------------
    upsertPlaysLocal(plays) {
      const map = new Map(get().plays.map((p) => [p.id, p]));
      for (const p of plays) map.set(p.id, p);
      const list = [...map.values()].sort((a, b) => a.playName.localeCompare(b.playName));
      patch({ plays: list, playsById: new Map(list.map((p) => [p.id, p])) });
    },
    removePlayLocal(id) {
      const list = get().plays.filter((p) => p.id !== id);
      const favs = { ...get().favorites };
      delete favs[id];
      patch({ plays: list, playsById: new Map(list.map((p) => [p.id, p])), favorites: favs });
    },
  };
});

/** Load cached snapshot (instant + offline). */
export async function loadCachedSnapshot(userId: string): Promise<boolean> {
  const snap = (await idbGet(snapKey(userId))) as (Partial<Snapshot> & { situation?: Situation; activeGameId?: string | null; pendingCallId?: string | null }) | undefined;
  if (!snap) return false;
  useApp.getState().hydrate(userId, snap);
  if (snap.situation) useApp.setState({ situation: snap.situation });
  if (snap.pendingCallId !== undefined) useApp.setState({ pendingCallId: snap.pendingCallId });
  return true;
}

/** If the database trigger didn't create a scheme (e.g. older account), make the default one. */
export function ensureDefaultScheme(): void {
  const s = useApp.getState();
  if (s.schemes.length) {
    if (!s.schemes.some((x) => x.isActive)) s.setActiveScheme(s.schemes[0].id);
    return;
  }
  s.saveScheme({
    id: uuid(), name: DEFAULT_SCHEME_NAME, description: 'Spacing + Screen identity.', primaryConcept: 'Spacing',
    secondaryConcepts: ['Screens', 'Run', 'Mesh', 'RPO', 'Play Action', 'Shot Plays'], runPhilosophy: '',
    screenPhilosophy: '', preferredFormations: [], preferredPersonnel: [], weights: { ...DEFAULT_WEIGHTS },
    isDefault: true, isActive: true, playIds: [],
  });
}

// ---- convenience selectors ----
export const useActiveScheme = () => useApp((s) => s.schemes.find((x) => x.isActive) ?? s.schemes[0] ?? null);
export const useActiveGame = () => useApp((s) => s.games.find((g) => g.id === s.activeGameId) ?? null);
