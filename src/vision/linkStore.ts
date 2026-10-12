// "Link game screen": watches a shared Madden window, keeps the Game Caller in sync and logs results.
// Runs entirely in the browser — frames are read and thrown away, nothing is uploaded.
import { create } from 'zustand';
import { useApp } from '@/state/store';
import { isPassPlay } from '@/engine/classify';
import { isSuccess } from '@/engine/situation';
import type { PlayResult, Situation } from '@/lib/types';
import { grayFromRGBA, type Gray } from './gray';
import { readScoreboard, sameSnap, type ScoreboardRead, type Side } from './scoreboard';
import { readPreviousPlay, type PreviousPlay } from './prevPlay';
import { browserOcr } from './ocrBrowser';
import { matchPlay, myScore, oppScore, planAutoLog } from './autoLog';
import { defenseFromCall, samePlayName } from './defenseCall';

export type LinkStatus = 'off' | 'starting' | 'live' | 'error';

interface LinkState {
  status: LinkStatus;
  error: string | null;
  mySide: Side;
  autoLog: boolean;
  /** last trusted scoreboard picture and when we saw it */
  read: ScoreboardRead | null;
  readAt: number;
  prev: PreviousPlay | null;
  lastLogged: string | null;
  aspectWarning: boolean;
  /** bumps every time a new snap with your ball is on screen (the Game Caller auto-recommends on it) */
  snapSeq: number;
  start(): Promise<void>;
  stop(): void;
  setMySide(s: Side): void;
  setAutoLog(v: boolean): void;
}

const LS_SIDE = 'atloc27:link:side';
const LS_AUTO = 'atloc27:link:auto';
const lsGet = (k: string) => { try { return localStorage.getItem(k); } catch { return null; } };
const lsSet = (k: string, v: string) => { try { localStorage.setItem(k, v); } catch { /* private mode */ } };

export const canLinkScreen = () => typeof navigator !== 'undefined' && Boolean(navigator.mediaDevices?.getDisplayMedia);

let stream: MediaStream | null = null;
let video: HTMLVideoElement | null = null;
let timer: ReturnType<typeof setInterval> | null = null;
let busy = false;
let candidate: ScoreboardRead | null = null; // waiting for a second identical read
let settled: ScoreboardRead | null = null;   // last snap we acted on

export const useGameLink = create<LinkState>((set, get) => ({
  status: 'off',
  error: null,
  mySide: (lsGet(LS_SIDE) as Side) === 'left' ? 'left' : 'right',
  autoLog: lsGet(LS_AUTO) !== 'off',
  read: null,
  readAt: 0,
  prev: null,
  lastLogged: null,
  aspectWarning: false,
  snapSeq: 0,

  async start() {
    if (get().status === 'live' || get().status === 'starting') return;
    set({ status: 'starting', error: null });
    try {
      stream = await navigator.mediaDevices.getDisplayMedia({ video: { frameRate: 5 }, audio: false });
      video = document.createElement('video');
      video.muted = true; video.playsInline = true; video.srcObject = stream;
      await video.play();
      stream.getVideoTracks()[0]?.addEventListener('ended', () => get().stop());
      candidate = null; settled = null;
      set({ status: 'live', read: null, readAt: 0, prev: null });
      timer = setInterval(() => { void tick(); }, 450);
      void browserOcr().catch(() => undefined); // warm up the text reader in the background
    } catch (e) {
      const msg = (e as Error).name === 'NotAllowedError' ? 'Screen sharing was cancelled.' : (e as Error).message;
      get().stop();
      set({ status: 'error', error: msg });
    }
  },

  stop() {
    if (timer) clearInterval(timer);
    timer = null;
    stream?.getTracks().forEach((t) => t.stop());
    stream = null; video = null; candidate = null; settled = null;
    set({ status: 'off' });
  },

  setMySide(s) { lsSet(LS_SIDE, s); set({ mySide: s }); settled = null; },
  setAutoLog(v) { lsSet(LS_AUTO, v ? 'on' : 'off'); set({ autoLog: v }); },
}));

const canvas = typeof document !== 'undefined' ? document.createElement('canvas') : null;

function grabFrame(): Gray | null {
  if (!video || !canvas || !video.videoWidth) return null;
  const w = video.videoWidth, h = video.videoHeight;
  useGameLink.setState({ aspectWarning: Math.abs(w / h - 16 / 9) > 0.03 });
  canvas.width = w; canvas.height = h;
  const ctx = canvas.getContext('2d', { willReadFrequently: true });
  if (!ctx) return null;
  ctx.drawImage(video, 0, 0, w, h);
  return grayFromRGBA(ctx.getImageData(0, 0, w, h).data, w, h);
}

async function tick() {
  if (busy) return;
  busy = true;
  try {
    const frame = grabFrame();
    if (!frame) return;
    const r = readScoreboard(frame);
    if (!r) return;
    useGameLink.setState({ read: r, readAt: Date.now() });
    // act only once the same picture shows twice in a row
    if (!sameSnap(candidate, r)) { candidate = r; return; }
    if (sameSnap(settled, r)) {
      // same snap; just keep the clock fresh
      const { mySide } = useGameLink.getState();
      if (r.possession === mySide) useApp.getState().setSituation({ clock: r.clock });
      return;
    }
    const before = settled;
    settled = r;
    await onNewSnap(before, r, frame);
  } finally {
    busy = false;
  }
}

async function onNewSnap(before: ScoreboardRead | null, after: ScoreboardRead, frame: Gray) {
  const side = useGameLink.getState().mySide;
  // Start the game record on the first picture, so a later auto-start can't reset the situation mid-drive.
  if (!useApp.getState().activeGameId) useApp.getState().startGame('Opponent');

  // 1) the screen is the truth for the new snap — update it first so the call shows instantly
  const ranIn: Situation = useApp.getState().situation; // the situation the last play was run in
  const scores = { myScore: myScore(after, side), oppScore: oppScore(after, side) };
  if (after.possession === side) {
    useApp.getState().setSituation({
      down: after.down, distance: after.distance, yardLine: after.yardLine, quarter: after.quarter, clock: after.clock,
      coverage: 'Unknown', pressure: 'Unknown', alignment: [], ...scores,
    });
    useGameLink.setState((st) => ({ snapSeq: st.snapSeq + 1 }));
  } else {
    useApp.getState().setSituation({ quarter: after.quarter, clock: after.clock, ...scores });
  }
  useApp.getState().updateGame(scores);

  // 2) then read the Previous Play box and record what just happened
  let prev: PreviousPlay | null = null;
  try { prev = await readPreviousPlay(frame, await browserOcr()); } catch { prev = null; }
  if (prev) useGameLink.setState({ prev });
  const link = useGameLink.getState();
  if (!before) return;
  if (!link.autoLog) {
    if (prev && before.possession === side) useGameLink.setState({ lastLogged: `Last defense: ${defenseFromCall(prev.defense).name}` });
    return;
  }
  const app = useApp.getState();
  const decision = planAutoLog(before, after, prev, side, (name) => {
    const p = matchPlay(name, app.plays, []);
    return p ? isPassPlay(p) : !/^(HB|QB|FB)\b/.test(name);
  });
  if (decision.kind !== 'log') return;

  const pending = app.calls.find((c) => c.id === app.pendingCallId && !c.result) ?? null;
  const pendingPlay = pending ? app.playsById.get(pending.playId) : undefined;
  let callId: string | null = null;
  let label = decision.offenseName;
  if (pending && pendingPlay && samePlayName(pendingPlay.playName, decision.offenseName)) {
    callId = pending.id;
    label = pendingPlay.playName;
  } else {
    const recentFormations = [...app.calls].reverse().map((c) => app.playsById.get(c.playId)?.formationId).filter((x): x is string => Boolean(x));
    const play = matchPlay(decision.offenseName, app.plays, recentFormations);
    if (!play) {
      useGameLink.setState({ lastLogged: `Not in playbook: ${decision.offenseName} (${decision.yards >= 0 ? '+' : ''}${decision.yards})` });
      return;
    }
    if (pending) app.setPendingCall(null);
    // the play was run in the previous snap's situation, not the one now on screen
    const sit: Situation = { ...ranIn, down: before.down, distance: before.distance, yardLine: before.yardLine, quarter: before.quarter, clock: before.clock };
    callId = app.callPlay(play.id, null, sit).id;
    label = play.playName;
  }

  const call = useApp.getState().calls.find((c) => c.id === callId)!;
  const play = useApp.getState().playsById.get(call.playId);
  const pass = play ? isPassPlay(play) : true;
  const o = decision.outcome;
  const result: PlayResult = {
    outcome: o, yards: decision.yards,
    success: isSuccess(call.down, call.distance, decision.yards, decision.touchdown, false) && o !== 'Incomplete' && o !== 'Sack',
    isPass: pass, completed: pass && o !== 'Incomplete' && o !== 'Sack',
    touchdown: decision.touchdown, turnover: false, sack: o === 'Sack',
    defenseSeen: decision.defense.seen,
    observations: [...(decision.defense.blitz ? ['Blitz called'] : []), `Defense call: ${decision.defense.name}`, 'Auto-logged'],
  };
  // recordResult would advance the chains; the screen already did, so keep the on-screen situation
  const onScreen = useApp.getState().situation;
  useApp.getState().recordResult(callId, result);
  useApp.getState().setSituation(onScreen);
  const msg = `${label}: ${decision.touchdown ? 'TD' : `${decision.yards >= 0 ? '+' : ''}${decision.yards}`} vs ${decision.defense.name}`;
  useGameLink.setState({ lastLogged: msg });
  useApp.getState().toast(`Logged ${msg}`);
}
