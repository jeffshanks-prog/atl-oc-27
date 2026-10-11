import { useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useApp } from '@/state/store';
import { FAMILY_LABEL, familiesOf, formationLabel } from '@/engine/classify';
import { groupStats, fmtAvg, pct, totals } from '@/analytics/stats';
import { distanceBucket } from '@/engine/situation';
import { FavoriteHeart } from '@/components/FavoriteHeart';
import { FavoriteRolesEditor } from '@/components/FavoriteRolesEditor';
import { AddToGamePlanModal } from '@/components/AddToGamePlanModal';
import { Badge, Button, Card, Empty, Modal, SectionTitle } from '@/components/ui';

function Rating({ label, v }: { label: string; v: number }) {
  return (
    <div className="flex items-center justify-between gap-2 text-sm">
      <span className="text-mute">{label}</span>
      <span className="tracking-[0.2em] text-red">{'●'.repeat(v)}<span className="text-slate2">{'●'.repeat(5 - v)}</span></span>
    </div>
  );
}

export default function PlayDetail() {
  const { id } = useParams();
  const nav = useNavigate();
  const play = useApp((s) => (id ? s.playsById.get(id) : undefined));
  const calls = useApp((s) => s.calls);
  const schemes = useApp((s) => s.schemes);
  const addPlayToScheme = useApp((s) => s.addPlayToScheme);
  const callPlay = useApp((s) => s.callPlay);
  const isAdmin = useApp((s) => s.profile?.isAdmin);
  const userId = useApp((s) => s.userId);
  const isFav = useApp((s) => Boolean(id && s.favorites[id]));
  const toast = useApp((s) => s.toast);
  const [planOpen, setPlanOpen] = useState(false);
  const [schemeOpen, setSchemeOpen] = useState(false);

  const myCalls = useMemo(() => calls.filter((c) => c.playId === id), [calls, id]);
  const total = useMemo(() => totals(myCalls), [myCalls]);
  const byCov = useMemo(() => [...groupStats(myCalls, (c) => c.result.defenseSeen).entries()], [myCalls]);
  const byDown = useMemo(() => [...groupStats(myCalls, (c) => `${c.down}${['', 'st', 'nd', 'rd', 'th'][c.down]} down`).entries()], [myCalls]);
  const byDist = useMemo(() => [...groupStats(myCalls, (c) => distanceBucket(c.distance)).entries()], [myCalls]);

  if (!play) return <Empty>Play not found. <button className="text-red underline" onClick={() => nav('/playbook')}>Back to playbook</button></Empty>;
  const canEdit = isAdmin || (play.ownerId && play.ownerId === userId);
  const reads = [play.primaryRead, play.secondRead, play.thirdRead, play.checkdown];

  return (
    <div className="mx-auto max-w-4xl space-y-4">
      <button className="text-sm text-mute hover:text-white" onClick={() => nav(-1)}>← Back</button>
      <Card className="p-5">
        <div className="flex items-start gap-3">
          <div className="min-w-0 flex-1">
            <div className="text-xs font-semibold uppercase tracking-wider text-mute">{play.playbook} · {formationLabel(play)}</div>
            <h1 className="font-display text-3xl font-bold uppercase tracking-wide">{play.playName}</h1>
            <div className="mt-2 flex flex-wrap gap-1.5">
              <Badge tone="red">{play.playType}</Badge>
              {play.personnel && <Badge>{play.personnel} personnel</Badge>}
              {[...familiesOf(play)].map((f) => <Badge key={f}>{FAMILY_LABEL[f]}</Badge>)}
              {play.isSeed && <Badge tone="amber">Auto-tagged — verify</Badge>}
            </div>
          </div>
          <FavoriteHeart playId={play.id} size="lg" />
        </div>
        <div className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-4">
          <Button tone="red" onClick={() => { callPlay(play.id, null); toast('Called — record the result on Game Caller'); nav('/'); }}>Call play</Button>
          <Button onClick={() => setPlanOpen(true)}>+ Game plan</Button>
          <Button onClick={() => setSchemeOpen(true)}>+ Scheme</Button>
          {canEdit ? <Button onClick={() => nav(`/admin/play/${play.id}`)}>Edit play</Button> : <span />}
        </div>
      </Card>

      <div className="grid gap-4 md:grid-cols-2">
        <Card className="space-y-2 p-4">
          <SectionTitle>Concept & schemes</SectionTitle>
          <div className="text-sm"><span className="text-mute">Concept:</span> {play.concept ?? '—'}</div>
          <div className="text-sm"><span className="text-mute">Primary scheme:</span> {play.primaryScheme ?? '—'}</div>
          <div className="text-sm"><span className="text-mute">Also in:</span> {play.secondarySchemes.join(', ') || '—'}</div>
          {play.screenType && <div className="text-sm"><span className="text-mute">Screen type:</span> {play.screenType}</div>}
          {play.runConcept && <div className="text-sm"><span className="text-mute">Run concept:</span> {play.runConcept}</div>}
          {play.passConcept && <div className="text-sm"><span className="text-mute">Pass concept:</span> {play.passConcept}</div>}
          {play.rpoType && <div className="text-sm"><span className="text-mute">RPO:</span> {play.rpoType}</div>}
          <div className="text-sm"><span className="text-mute">Best vs:</span> {play.bestVs.join(', ') || '—'}</div>
          <div className="text-sm"><span className="text-mute">Weak vs:</span> {play.weakVs.join(', ') || '—'}</div>
          <div className="flex flex-wrap gap-1.5 pt-1">
            {play.blitzBeater && <Badge tone="red">Blitz beater</Badge>}
            {play.manBeater && <Badge tone="red">Man beater</Badge>}
            {play.zoneBeater && <Badge tone="red">Zone beater</Badge>}
            {play.tags.map((t) => <Badge key={t}>{t}</Badge>)}
          </div>
        </Card>
        <Card className="space-y-1.5 p-4">
          <SectionTitle>Situation ratings</SectionTitle>
          <Rating label="Short yardage" v={play.shortYardageRating} />
          <Rating label="Medium yardage" v={play.mediumYardageRating} />
          <Rating label="Long yardage" v={play.longYardageRating} />
          <Rating label="Red zone" v={play.redZoneRating} />
          <Rating label="Goal line" v={play.goalLineRating} />
          <Rating label="2-minute" v={play.twoMinuteRating} />
          <Rating label="4-minute" v={play.fourMinuteRating} />
          <Rating label="Risk" v={play.riskLevel} />
          <Rating label="Explosive potential" v={play.explosivePotential} />
        </Card>
      </div>

      <Card className="p-4">
        <SectionTitle>Read progression</SectionTitle>
        {reads.some(Boolean) ? (
          <ol className="space-y-1 text-sm">
            {reads.map((r, i) => r && <li key={i}><span className="mr-2 font-display text-red">{i === 3 ? 'Checkdown' : `${i + 1}.`}</span>{r}</li>)}
          </ol>
        ) : <p className="text-sm text-mute">Not entered yet.{canEdit ? ' Use Edit play to add it.' : ''}</p>}
        {play.notes && <p className="mt-3 border-t border-line pt-3 text-sm text-mute">{play.notes}</p>}
      </Card>

      <Card className="p-4">
        <SectionTitle>{isFav ? 'Favorite roles' : 'Favorite roles (tagging a role adds it to favorites)'}</SectionTitle>
        <FavoriteRolesEditor playId={play.id} />
      </Card>

      <Card className="p-4">
        <SectionTitle>Your statistics</SectionTitle>
        {total.calls === 0 ? <p className="text-sm text-mute">No recorded results yet. Stats appear after you call this play and log the result.</p> : (
          <>
            <div className="grid grid-cols-3 gap-2 text-center sm:grid-cols-5">
              {[
                ['Called', total.calls], ['Avg yds', fmtAvg(total.avg)], ['Success', pct(total.successRate)],
                ['TDs', total.tds], ['Turnovers', total.turnovers], ['Attempts', total.attempts], ['Completions', total.completions],
                ['Total yds', total.yards], ['Sacks', total.sacks], ['Explosive', total.explosives],
              ].map(([k, v]) => (
                <div key={String(k)} className="rounded-xl bg-ink p-2">
                  <div className="font-display text-xl font-bold">{v}</div>
                  <div className="text-[10px] uppercase tracking-wider text-mute">{k}</div>
                </div>
              ))}
            </div>
            {[['By coverage seen', byCov], ['By down', byDown], ['By distance', byDist]].map(([label, rows]) => (
              <div key={label as string} className="mt-4">
                <div className="mb-1 text-xs font-semibold uppercase tracking-wider text-mute">{label as string}</div>
                <div className="divide-y divide-line rounded-xl border border-line">
                  {(rows as [string, ReturnType<typeof totals>][]).map(([k, s]) => (
                    <div key={k} className="grid grid-cols-4 px-3 py-2 text-sm">
                      <span className="font-semibold capitalize">{k}</span>
                      <span className="text-mute">{s.calls} calls</span>
                      <span className="text-mute">{fmtAvg(s.avg)} avg</span>
                      <span className="text-right">{pct(s.successRate)}</span>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </>
        )}
      </Card>

      <AddToGamePlanModal playId={play.id} open={planOpen} onClose={() => setPlanOpen(false)} />
      <Modal open={schemeOpen} onClose={() => setSchemeOpen(false)} title="Add to scheme">
        <div className="space-y-2">
          {schemes.map((s) => {
            const has = s.playIds.includes(play.id);
            return (
              <Button key={s.id} className="w-full justify-between" disabled={has}
                onClick={() => { addPlayToScheme(s.id, play.id); toast(`Added to ${s.name}`); setSchemeOpen(false); }}>
                <span>{s.name}</span><span className="text-xs text-mute">{has ? 'Already in' : 'Add'}</span>
              </Button>
            );
          })}
        </div>
      </Modal>
    </div>
  );
}
