import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useApp } from '@/state/store';
import type { Play } from '@/lib/types';
import { FORMATION_FAMILY_ORDER, PLAY_TYPES } from '@/lib/constants';
import { deletePlay, ensureFormation, ensurePlaybook, listFormations, listPlaybooks, savePlay, type FormationRow, type PlaybookRow } from '@/data/plays';
import { Button, Card, Chip, Field, PageHeader, SectionTitle, cx, inputCls } from '@/components/ui';

const COV_TAGS = ['Cover 0', 'Cover 1', 'Cover 2', 'Cover 3', 'Cover 4', 'Cover 6', 'Man', 'Zone', 'Blitz', 'Match', 'Prevent'];
const RATINGS: [keyof Play, string][] = [
  ['shortYardageRating', 'Short yardage'], ['mediumYardageRating', 'Medium yardage'], ['longYardageRating', 'Long yardage'],
  ['redZoneRating', 'Red zone'], ['goalLineRating', 'Goal line'], ['twoMinuteRating', '2-minute'], ['fourMinuteRating', '4-minute'],
];

const blank = (ownerId: string | null): Play => ({
  id: '', playbookId: '', playbook: 'Atlanta', formationId: '', formationFamily: 'Gun', formation: '', set: '', playName: '',
  playType: 'Pass', personnel: null, concept: null, primaryScheme: null, secondarySchemes: [], tags: [], screenType: null,
  runConcept: null, passConcept: null, rpoType: null, playAction: false, bestVs: [], weakVs: [], blitzBeater: false,
  manBeater: false, zoneBeater: false, shortYardageRating: 3, mediumYardageRating: 3, longYardageRating: 3, redZoneRating: 3,
  goalLineRating: 3, twoMinuteRating: 3, fourMinuteRating: 3, primaryRead: null, secondRead: null, thirdRead: null,
  checkdown: null, riskLevel: 2, explosivePotential: 2, notes: null, isSeed: false, ownerId,
});

function ListInput({ value, onChange, placeholder }: { value: string[]; onChange: (v: string[]) => void; placeholder?: string }) {
  const [t, setT] = useState(value.join(', '));
  return (
    <input className={inputCls} value={t} placeholder={placeholder}
      onChange={(e) => { setT(e.target.value); onChange(e.target.value.split(',').map((x) => x.trim()).filter(Boolean)); }} />
  );
}

export default function PlayEditor() {
  const { id } = useParams();
  const nav = useNavigate();
  const isNew = !id || id === 'new';
  const existing = useApp((s) => (!isNew && id ? s.playsById.get(id) : undefined));
  const isAdmin = Boolean(useApp((s) => s.profile?.isAdmin));
  const userId = useApp((s) => s.userId);
  const upsertPlaysLocal = useApp((s) => s.upsertPlaysLocal);
  const removePlayLocal = useApp((s) => s.removePlayLocal);
  const toast = useApp((s) => s.toast);
  const [p, setP] = useState<Play>(() => existing ?? blank(isAdmin ? null : userId));
  const [formations, setFormations] = useState<FormationRow[]>([]);
  const [playbooks, setPlaybooks] = useState<PlaybookRow[]>([]);
  const [newFormation, setNewFormation] = useState(false);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    void (async () => {
      try {
        const [pb, fm] = await Promise.all([listPlaybooks(), listFormations()]);
        setPlaybooks(pb); setFormations(fm);
        if (isNew && fm.length && !p.formationId) {
          const atl = pb.find((x) => x.name === 'Atlanta') ?? pb[0];
          const first = fm.find((f) => f.playbook_id === atl?.id) ?? fm[0];
          setP((cur) => ({ ...cur, playbookId: first.playbook_id, playbook: pb.find((x) => x.id === first.playbook_id)?.name ?? 'Atlanta', formationId: first.id, formationFamily: first.family, formation: first.name }));
        }
        if (!fm.length) setNewFormation(true);
      } catch (e) { setErr((e as Error).message); }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (!isNew && !existing) return <div className="text-mute">Play not found.</div>;
  if (existing && !isAdmin && existing.ownerId !== userId) return <div className="text-mute">Only admins can edit master playbook plays.</div>;

  const set = <K extends keyof Play>(k: K, v: Play[K]) => setP((cur) => ({ ...cur, [k]: v }));
  const text = (k: keyof Play) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => set(k, (e.target.value || null) as never);

  const onSave = async () => {
    setErr(null);
    if (!p.playName.trim()) return setErr('Play name is required.');
    if (!p.formation.trim()) return setErr('Formation is required.');
    setBusy(true);
    try {
      let next = { ...p, playName: p.playName.trim() };
      if (newFormation || !next.formationId) {
        if (!isAdmin) throw new Error('Pick an existing formation (only admins can create formations).');
        const pb = await ensurePlaybook(next.playbook || 'Atlanta', playbooks);
        const fm = await ensureFormation(pb.id, next.formationFamily, next.formation.trim(), formations);
        next = { ...next, playbookId: pb.id, formationId: fm.id, formationFamily: fm.family, formation: fm.name };
      }
      const saved = await savePlay({ ...next, isSeed: isNew ? false : next.isSeed }, isNew);
      upsertPlaysLocal([saved]);
      toast(isNew ? 'Play added' : 'Play saved');
      nav(`/play/${saved.id}`, { replace: true });
    } catch (e) {
      setErr((e as Error).message);
    } finally {
      setBusy(false);
    }
  };

  const onDelete = async () => {
    if (!existing || !confirm(`Delete ${existing.playName}? Calls and stats for it will be removed.`)) return;
    try { await deletePlay(existing.id); removePlayLocal(existing.id); toast('Play deleted'); nav('/playbook'); }
    catch (e) { setErr((e as Error).message); }
  };

  return (
    <div className="mx-auto max-w-4xl space-y-4">
      <PageHeader title={isNew ? '+ Add play' : `Edit: ${existing?.playName}`}
        sub={isAdmin ? (p.ownerId ? 'Custom play (only you)' : 'Master playbook') : 'Custom play — visible only to you'}
        right={<Button tone="red" onClick={onSave} disabled={busy}>{busy ? 'Saving…' : 'Save play'}</Button>} />
      {err && <div className="rounded-xl border border-red bg-red-soft p-3 text-sm">{err}</div>}

      <Card className="grid gap-3 p-4 sm:grid-cols-2">
        <Field label="Play name *"><input className={inputCls} value={p.playName} onChange={(e) => set('playName', e.target.value)} /></Field>
        <Field label="Play type *">
          <select className={inputCls} value={p.playType} onChange={(e) => set('playType', e.target.value as Play['playType'])}>
            {PLAY_TYPES.map((t) => <option key={t}>{t}</option>)}
          </select>
        </Field>
        {!newFormation ? (
          <Field label="Formation *">
            <select className={inputCls} value={p.formationId}
              onChange={(e) => {
                const f = formations.find((x) => x.id === e.target.value);
                if (f) setP((cur) => ({ ...cur, formationId: f.id, formationFamily: f.family, formation: f.name, playbookId: f.playbook_id, playbook: playbooks.find((b) => b.id === f.playbook_id)?.name ?? cur.playbook }));
              }}>
              {formations.map((f) => <option key={f.id} value={f.id}>{playbooks.find((b) => b.id === f.playbook_id)?.name} · {f.family} {f.name}</option>)}
            </select>
            {isAdmin && <button className="mt-1 text-xs text-red" onClick={() => setNewFormation(true)}>+ New formation</button>}
          </Field>
        ) : (
          <div className="grid grid-cols-2 gap-2">
            <Field label="Family *">
              <select className={inputCls} value={p.formationFamily} onChange={(e) => set('formationFamily', e.target.value)}>
                {FORMATION_FAMILY_ORDER.map((f) => <option key={f}>{f}</option>)}
              </select>
            </Field>
            <Field label="Formation *"><input className={inputCls} value={p.formation} onChange={(e) => set('formation', e.target.value)} placeholder="e.g. Trips TE" /></Field>
            {formations.length > 0 && <button className="col-span-2 text-left text-xs text-mute" onClick={() => setNewFormation(false)}>← pick existing formation</button>}
          </div>
        )}
        <Field label="Set (optional)"><input className={inputCls} value={p.set} onChange={(e) => set('set', e.target.value)} /></Field>
        <Field label="Personnel"><input className={inputCls} value={p.personnel ?? ''} onChange={text('personnel')} placeholder="e.g. 11" /></Field>
        <Field label="Concept"><input className={inputCls} value={p.concept ?? ''} onChange={text('concept')} placeholder="e.g. Spacing" /></Field>
        <Field label="Primary scheme"><input className={inputCls} value={p.primaryScheme ?? ''} onChange={text('primaryScheme')} /></Field>
        <Field label="Secondary schemes (comma separated)"><ListInput value={p.secondarySchemes} onChange={(v) => set('secondarySchemes', v)} /></Field>
        <Field label="Tags (comma separated)"><ListInput value={p.tags} onChange={(v) => set('tags', v)} placeholder="Screen, Blitz Beater" /></Field>
        <Field label="Screen type"><input className={inputCls} value={p.screenType ?? ''} onChange={text('screenType')} placeholder="HB, Slip, Bubble…" /></Field>
        <Field label="Run concept"><input className={inputCls} value={p.runConcept ?? ''} onChange={text('runConcept')} /></Field>
        <Field label="Pass concept"><input className={inputCls} value={p.passConcept ?? ''} onChange={text('passConcept')} /></Field>
        <Field label="RPO type"><input className={inputCls} value={p.rpoType ?? ''} onChange={text('rpoType')} /></Field>
      </Card>

      <Card className="space-y-3 p-4">
        <SectionTitle>Coverage tags</SectionTitle>
        {(['bestVs', 'weakVs'] as const).map((k) => (
          <div key={k}>
            <div className="mb-1 text-xs font-semibold uppercase text-mute">{k === 'bestVs' ? 'Best vs' : 'Weak vs'}</div>
            <div className="flex flex-wrap gap-1.5">
              {COV_TAGS.map((c) => <Chip key={c} size="sm" active={p[k].includes(c)} onClick={() => set(k, p[k].includes(c) ? p[k].filter((x) => x !== c) : [...p[k], c])}>{c}</Chip>)}
            </div>
          </div>
        ))}
        <div className="flex flex-wrap gap-1.5">
          {(['blitzBeater', 'manBeater', 'zoneBeater', 'playAction'] as const).map((k) => (
            <Chip key={k} active={p[k]} onClick={() => set(k, !p[k])}>{{ blitzBeater: 'Blitz beater', manBeater: 'Man beater', zoneBeater: 'Zone beater', playAction: 'Play action' }[k]}</Chip>
          ))}
        </div>
      </Card>

      <Card className="p-4">
        <SectionTitle>Situation ratings</SectionTitle>
        <div className="grid gap-x-6 gap-y-2 sm:grid-cols-2">
          {[...RATINGS, ['riskLevel', 'Risk level'] as [keyof Play, string], ['explosivePotential', 'Explosive potential'] as [keyof Play, string]].map(([k, label]) => {
            const min = k === 'riskLevel' || k === 'explosivePotential' ? 1 : 0;
            return (
              <div key={k} className="flex items-center justify-between gap-2 text-sm">
                <span>{label}</span>
                <div className="flex gap-1">
                  {Array.from({ length: 6 - min }, (_, i) => i + min).map((n) => (
                    <button key={n} onClick={() => set(k, n as never)}
                      className={cx('h-9 w-9 rounded-lg border text-sm font-semibold', p[k] === n ? 'border-red bg-red' : 'border-line bg-ink text-mute')}>{n}</button>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      </Card>

      <Card className="grid gap-3 p-4 sm:grid-cols-2">
        <SectionTitle>Read progression</SectionTitle><span />
        <Field label="1. Primary read"><input className={inputCls} value={p.primaryRead ?? ''} onChange={text('primaryRead')} /></Field>
        <Field label="2. Second read"><input className={inputCls} value={p.secondRead ?? ''} onChange={text('secondRead')} /></Field>
        <Field label="3. Third read"><input className={inputCls} value={p.thirdRead ?? ''} onChange={text('thirdRead')} /></Field>
        <Field label="Checkdown"><input className={inputCls} value={p.checkdown ?? ''} onChange={text('checkdown')} /></Field>
        <div className="sm:col-span-2"><Field label="Notes"><textarea className={inputCls} rows={3} value={p.notes ?? ''} onChange={text('notes')} /></Field></div>
      </Card>

      <div className="flex justify-between">
        {!isNew ? <Button tone="ghost" onClick={onDelete}>Delete play</Button> : <span />}
        <Button tone="red" size="lg" onClick={onSave} disabled={busy}>{busy ? 'Saving…' : 'Save play'}</Button>
      </div>
    </div>
  );
}
