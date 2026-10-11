// CSV / JSON playbook import: parse → validate → dedupe (Playbook + Formation + Set + Play Name) → write.
import Papa from 'papaparse';
import type { Play, PlayType } from '@/lib/types';
import { FORMATION_FAMILY_ORDER, PLAY_TYPES } from '@/lib/constants';
import { loadPlays } from '@/data/api';
import { playToRow } from '@/data/mappers';
import { supabase } from '@/lib/supabase';
import { ensureFormation, ensurePlaybook, listFormations, listPlaybooks, setPlayTags } from '@/data/plays';

/** Template columns — map 1:1 to the master play database. Arrays use "|" separators. */
export const TEMPLATE_FIELDS = [
  'playbook', 'formationFamily', 'formation', 'set', 'playName', 'playType', 'personnel', 'concept', 'primaryScheme',
  'secondarySchemes', 'tags', 'screenType', 'runConcept', 'passConcept', 'rpoType', 'playAction', 'bestVs', 'weakVs',
  'blitzBeater', 'manBeater', 'zoneBeater', 'shortYardageRating', 'mediumYardageRating', 'longYardageRating',
  'redZoneRating', 'goalLineRating', 'twoMinuteRating', 'fourMinuteRating', 'primaryRead', 'secondRead', 'thirdRead',
  'checkdown', 'riskLevel', 'explosivePotential', 'notes',
] as const;

const EXAMPLE: Record<(typeof TEMPLATE_FIELDS)[number], string> = {
  playbook: 'Atlanta', formationFamily: 'Gun', formation: 'Bunch', set: '', playName: 'Spacing', playType: 'Pass',
  personnel: '', concept: 'Spacing', primaryScheme: 'Spacing', secondarySchemes: 'Quick Game', tags: 'Spacing|Zone Beater',
  screenType: '', runConcept: '', passConcept: 'Spacing', rpoType: '', playAction: 'false', bestVs: 'Cover 3|Cover 2|Zone',
  weakVs: '', blitzBeater: 'false', manBeater: 'false', zoneBeater: 'true', shortYardageRating: '4', mediumYardageRating: '4',
  longYardageRating: '2', redZoneRating: '4', goalLineRating: '2', twoMinuteRating: '4', fourMinuteRating: '3',
  primaryRead: '', secondRead: '', thirdRead: '', checkdown: '', riskLevel: '2', explosivePotential: '2', notes: '',
};

export function templateCsv(): string {
  return Papa.unparse({ fields: [...TEMPLATE_FIELDS], data: [TEMPLATE_FIELDS.map((f) => EXAMPLE[f])] });
}

export type ImportPlay = Omit<Play, 'id' | 'playbookId' | 'formationId' | 'isSeed' | 'ownerId'>;
export interface RowIssue { row: number; message: string }
export interface Parsed { valid: { row: number; play: ImportPlay }[]; errors: RowIssue[] }
export interface ImportReport { added: number; updated: number; skipped: number; errors: RowIssue[] }

const norm = (k: string) => k.toLowerCase().replace(/[^a-z0-9]/g, '');
const FIELD_BY_NORM = new Map<string, string>(TEMPLATE_FIELDS.map((f) => [norm(f), f]));
// helpful aliases
for (const [a, f] of [['name', 'playName'], ['play', 'playName'], ['type', 'playType'], ['family', 'formationFamily'],
  ['setname', 'set'], ['schemes', 'secondarySchemes'], ['read1', 'primaryRead'], ['read2', 'secondRead'], ['read3', 'thirdRead'],
  ['risk', 'riskLevel'], ['explosive', 'explosivePotential']] as const) FIELD_BY_NORM.set(a, f);

function str(v: unknown): string { return v === null || v === undefined ? '' : String(v).trim(); }
function nullable(v: unknown): string | null { const s = str(v); return s ? s : null; }
function list(v: unknown): string[] {
  if (Array.isArray(v)) return v.map(str).filter(Boolean);
  return str(v).split(/[|;]/).map((x) => x.trim()).filter(Boolean);
}
function bool(v: unknown): boolean {
  if (typeof v === 'boolean') return v;
  return ['true', 'yes', 'y', '1', 'x'].includes(str(v).toLowerCase());
}
function rating(v: unknown, def: number, lo: number, field: string, issues: string[]): number {
  const s = str(v);
  if (!s) return def;
  const n = Number(s);
  if (!Number.isInteger(n) || n < lo || n > 5) { issues.push(`${field} must be a whole number ${lo}-5 (got "${s}")`); return def; }
  return n;
}
function playType(v: unknown): PlayType | null {
  const s = norm(str(v));
  if (s === 'pa' || s === 'playaction') return 'Play Action';
  return PLAY_TYPES.find((t) => norm(t) === s) ?? null;
}
function splitFormation(family: string, formation: string): { family: string; formation: string } {
  if (family) return { family, formation };
  const f = formation.replace(/^shotgun\b/i, 'Gun');
  const fam = FORMATION_FAMILY_ORDER.find((x) => f.toLowerCase().startsWith(x.toLowerCase() + ' '));
  return fam ? { family: fam, formation: f.slice(fam.length).trim() } : { family: 'Other', formation: f };
}

export function normalizeRecord(raw: Record<string, unknown>, rowNum: number): { play?: ImportPlay; error?: RowIssue } {
  const r: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(raw)) { const f = FIELD_BY_NORM.get(norm(k)); if (f) r[f] = v; }
  const issues: string[] = [];
  const name = str(r.playName);
  const formationRaw = str(r.formation);
  const type = playType(r.playType);
  if (!name) issues.push('playName is required');
  if (!formationRaw) issues.push('formation is required');
  if (!type) issues.push(`playType must be one of ${PLAY_TYPES.join(', ')}${str(r.playType) ? ` (got "${str(r.playType)}")` : ''}`);
  const { family, formation } = splitFormation(str(r.formationFamily), formationRaw);
  const play: ImportPlay = {
    playbook: str(r.playbook) || 'Atlanta', formationFamily: family, formation, set: str(r.set), playName: name,
    playType: type ?? 'Pass', personnel: nullable(r.personnel), concept: nullable(r.concept), primaryScheme: nullable(r.primaryScheme),
    secondarySchemes: list(r.secondarySchemes), tags: list(r.tags), screenType: nullable(r.screenType),
    runConcept: nullable(r.runConcept), passConcept: nullable(r.passConcept), rpoType: nullable(r.rpoType),
    playAction: bool(r.playAction) || type === 'Play Action', bestVs: list(r.bestVs), weakVs: list(r.weakVs),
    blitzBeater: bool(r.blitzBeater), manBeater: bool(r.manBeater), zoneBeater: bool(r.zoneBeater),
    shortYardageRating: rating(r.shortYardageRating, 3, 0, 'shortYardageRating', issues),
    mediumYardageRating: rating(r.mediumYardageRating, 3, 0, 'mediumYardageRating', issues),
    longYardageRating: rating(r.longYardageRating, 3, 0, 'longYardageRating', issues),
    redZoneRating: rating(r.redZoneRating, 3, 0, 'redZoneRating', issues),
    goalLineRating: rating(r.goalLineRating, 3, 0, 'goalLineRating', issues),
    twoMinuteRating: rating(r.twoMinuteRating, 3, 0, 'twoMinuteRating', issues),
    fourMinuteRating: rating(r.fourMinuteRating, 3, 0, 'fourMinuteRating', issues),
    primaryRead: nullable(r.primaryRead), secondRead: nullable(r.secondRead), thirdRead: nullable(r.thirdRead),
    checkdown: nullable(r.checkdown), riskLevel: rating(r.riskLevel, 2, 1, 'riskLevel', issues),
    explosivePotential: rating(r.explosivePotential, 2, 1, 'explosivePotential', issues), notes: nullable(r.notes),
  };
  if (issues.length) return { error: { row: rowNum, message: issues.join('; ') } };
  return { play };
}

export function parseImport(text: string, kind: 'csv' | 'json'): Parsed {
  const out: Parsed = { valid: [], errors: [] };
  let records: Record<string, unknown>[] = [];
  if (kind === 'json') {
    try {
      const j = JSON.parse(text) as unknown;
      const arr = Array.isArray(j) ? j : (j as { plays?: unknown }).plays;
      if (!Array.isArray(arr)) throw new Error('JSON must be an array of plays (or { "plays": [...] })');
      records = arr as Record<string, unknown>[];
    } catch (e) {
      out.errors.push({ row: 0, message: `Invalid JSON: ${(e as Error).message}` });
      return out;
    }
  } else {
    const res = Papa.parse<Record<string, string>>(text.trim(), { header: true, skipEmptyLines: 'greedy' });
    for (const e of res.errors) out.errors.push({ row: (e.row ?? 0) + 2, message: e.message });
    records = res.data;
  }
  const seen = new Map<string, number>();
  records.forEach((rec, i) => {
    const rowNum = kind === 'csv' ? i + 2 : i + 1; // CSV row 1 = header
    const { play, error } = normalizeRecord(rec, rowNum);
    if (error) { out.errors.push(error); return; }
    const key = dedupeKey(play!.playbook, play!.formationFamily, play!.formation, play!.set, play!.playName);
    if (seen.has(key)) { out.errors.push({ row: rowNum, message: `Duplicate of row ${seen.get(key)} in this file — skipped` }); return; }
    seen.set(key, rowNum);
    out.valid.push({ row: rowNum, play: play! });
  });
  return out;
}

export function dedupeKey(playbook: string, family: string, formation: string, set: string, name: string): string {
  return [playbook, family, formation, set, name].map((x) => x.trim().toLowerCase()).join('|');
}

const COMPARE_FIELDS = Object.keys(playToRow({} as Play)).filter((k) => !['id', 'playbook_id', 'formation_id', 'is_seed', 'owner_id'].includes(k));

/** Writes to the MASTER playbook (admin only — enforced by database policy). */
export async function runImport(rows: { row: number; play: ImportPlay }[], onProgress?: (done: number, total: number) => void): Promise<ImportReport> {
  const report: ImportReport = { added: 0, updated: 0, skipped: 0, errors: [] };
  const playbooks = await listPlaybooks();
  const formations = await listFormations();
  const existing = (await loadPlays()).filter((p) => p.ownerId === null);
  const byKey = new Map(existing.map((p) => [dedupeKey(p.playbook, p.formationFamily, p.formation, p.set, p.playName), p]));

  for (let i = 0; i < rows.length; i++) {
    const { row, play } = rows[i];
    try {
      const pb = await ensurePlaybook(play.playbook, playbooks);
      const fm = await ensureFormation(pb.id, play.formationFamily, play.formation, formations);
      const key = dedupeKey(pb.name, fm.family, fm.name, play.set, play.playName);
      const prev = byKey.get(key);
      const full: Play = { ...play, id: prev?.id ?? '', playbookId: pb.id, formationId: fm.id, playbook: pb.name, formationFamily: fm.family, formation: fm.name, isSeed: false, ownerId: null };
      const row_ = playToRow(full);
      if (prev) {
        const before = playToRow(prev);
        const changed = COMPARE_FIELDS.some((k) => JSON.stringify(before[k] ?? null) !== JSON.stringify(row_[k] ?? null))
          || [...prev.tags].sort().join('|').toLowerCase() !== [...play.tags].sort().join('|').toLowerCase()
          || prev.isSeed;
        if (!changed) { report.skipped++; continue; }
        const { error } = await supabase.from('plays').update({ ...row_, id: prev.id, is_seed: false }).eq('id', prev.id);
        if (error) throw new Error(error.message);
        await setPlayTags(prev.id, play.tags);
        byKey.set(key, { ...full, id: prev.id });
        report.updated++;
      } else {
        const { id: _drop, ...ins } = row_;
        void _drop;
        const { data, error } = await supabase.from('plays').insert(ins).select('id').single();
        if (error) throw new Error(error.message);
        await setPlayTags(data.id, play.tags);
        byKey.set(key, { ...full, id: data.id });
        report.added++;
      }
    } catch (e) {
      report.errors.push({ row, message: (e as Error).message });
    }
    onProgress?.(i + 1, rows.length);
  }
  return report;
}

export function exportCsv(plays: Play[]): string {
  return Papa.unparse({
    fields: [...TEMPLATE_FIELDS],
    data: plays.map((p) => TEMPLATE_FIELDS.map((f) => {
      const v = (p as unknown as Record<string, unknown>)[f];
      return Array.isArray(v) ? v.join('|') : v === null || v === undefined ? '' : String(v);
    })),
  });
}

export function download(name: string, text: string, type = 'text/csv'): void {
  const url = URL.createObjectURL(new Blob([text], { type }));
  const a = document.createElement('a');
  a.href = url; a.download = name; a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
