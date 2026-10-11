import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useApp } from '@/state/store';
import { PACKAGES } from '@/lib/constants';
import type { GamePlan, GamePlanItem, PackageName } from '@/lib/types';
import { uuid } from '@/lib/supabase';
import { playLabel } from '@/engine/classify';
import { PlayPicker } from '@/components/PlayPicker';
import { FavoriteHeart } from '@/components/FavoriteHeart';
import { Badge, Button, Card, Chip, Field, PageHeader, cx, inputCls } from '@/components/ui';

const blank = (): GamePlan => ({
  id: uuid(), opponent: '', planDate: new Date().toISOString().slice(0, 10), schemeId: null, notes: '', scriptLength: 10, items: [], createdAt: new Date().toISOString(),
});

export default function GamePlanEditor() {
  const { id } = useParams();
  const nav = useNavigate();
  const existing = useApp((s) => s.gamePlans.find((g) => g.id === id));
  const schemes = useApp((s) => s.schemes);
  const playsById = useApp((s) => s.playsById);
  const savePlan = useApp((s) => s.saveGamePlan);
  const deletePlan = useApp((s) => s.deleteGamePlan);
  const startGame = useApp((s) => s.startGame);
  const toast = useApp((s) => s.toast);
  const [g, setG] = useState<GamePlan>(() => existing ?? { ...blank(), schemeId: schemes.find((s) => s.isActive)?.id ?? null });
  const [open, setOpen] = useState<PackageName | null>('Opening Script');
  const [picker, setPicker] = useState<{ pkg: PackageName; replaceId?: string } | null>(null);
  const [dragId, setDragId] = useState<string | null>(null);
  const [dirty, setDirty] = useState(!existing);

  // keep in sync if the plan was changed elsewhere (e.g. script items marked complete during a game)
  useEffect(() => { if (existing && !dirty) setG(existing); }, [existing, dirty]);

  const update = (next: GamePlan) => { setG(next); setDirty(true); };
  const items = (pkg: PackageName) => g.items.filter((i) => i.package === pkg).sort((a, b) => a.position - b.position);
  const reorder = (pkg: PackageName, list: GamePlanItem[]) =>
    update({ ...g, items: [...g.items.filter((i) => i.package !== pkg), ...list.map((i, idx) => ({ ...i, position: idx }))] });
  const move = (pkg: PackageName, from: number, to: number) => {
    const list = items(pkg);
    if (to < 0 || to >= list.length) return;
    const [x] = list.splice(from, 1);
    list.splice(to, 0, x);
    reorder(pkg, list);
  };
  const save = (silent = false) => {
    savePlan(g);
    setDirty(false);
    if (!silent) toast('Game plan saved');
  };

  return (
    <div className="mx-auto max-w-4xl">
      <PageHeader title={existing ? `vs ${g.opponent || 'Opponent'}` : 'New game plan'}
        right={<div className="flex gap-2">
          <Button onClick={() => save()} disabled={!dirty}>Save</Button>
          <Button tone="red" onClick={() => { save(true); startGame(g.opponent, g.id); nav('/'); }}>Start game</Button>
        </div>} />

      <Card className="grid gap-3 p-4 sm:grid-cols-3">
        <Field label="Opponent name"><input className={inputCls} value={g.opponent} onChange={(e) => update({ ...g, opponent: e.target.value })} /></Field>
        <Field label="Date"><input type="date" className={inputCls} value={g.planDate ?? ''} onChange={(e) => update({ ...g, planDate: e.target.value || null })} /></Field>
        <Field label="Scheme">
          <select className={inputCls} value={g.schemeId ?? ''} onChange={(e) => update({ ...g, schemeId: e.target.value || null })}>
            <option value="">Active scheme</option>
            {schemes.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
          </select>
        </Field>
        <div className="sm:col-span-3"><Field label="Notes"><textarea className={inputCls} rows={2} value={g.notes} onChange={(e) => update({ ...g, notes: e.target.value })} placeholder="Opponent tendencies, user-defender habits..." /></Field></div>
      </Card>

      <div className="mt-4 space-y-2">
        {PACKAGES.map((pkg) => {
          const list = items(pkg);
          const isScript = pkg === 'Opening Script';
          const isOpen = open === pkg;
          return (
            <div key={pkg} className={cx('rounded-2xl border bg-coal', isScript ? 'border-red/50' : 'border-line')}>
              <button className="flex w-full items-center justify-between px-4 py-3" onClick={() => setOpen(isOpen ? null : pkg)} aria-expanded={isOpen}>
                <span className="font-display text-base font-semibold uppercase tracking-wide">{pkg}</span>
                <span className="text-sm text-mute">
                  {isScript ? `${list.filter((i) => i.completed).length}/${Math.min(list.length, g.scriptLength)} done · ` : ''}{list.length} plays {isOpen ? '▲' : '▼'}
                </span>
              </button>
              {isOpen && (
                <div className="space-y-2 border-t border-line p-3">
                  {isScript && (
                    <div className="flex flex-wrap items-center gap-1.5">
                      <span className="mr-1 text-xs font-semibold uppercase text-mute">Script length</span>
                      {[10, 15].map((n) => <Chip key={n} size="sm" active={g.scriptLength === n} onClick={() => update({ ...g, scriptLength: n })}>Opening {n}</Chip>)}
                      <input className={cx(inputCls, 'w-20 py-1 text-sm')} inputMode="numeric" value={g.scriptLength}
                        onChange={(e) => update({ ...g, scriptLength: Math.max(1, Math.min(60, parseInt(e.target.value || '1', 10))) })} aria-label="Custom script length" />
                    </div>
                  )}
                  {list.length === 0 && <p className="text-sm text-mute">No plays in this package yet.</p>}
                  {list.map((item, idx) => {
                    const p = playsById.get(item.playId);
                    const over = isScript && idx >= g.scriptLength;
                    return (
                      <div key={item.id} draggable
                        onDragStart={() => setDragId(item.id)}
                        onDragOver={(e) => e.preventDefault()}
                        onDrop={() => {
                          if (!dragId || dragId === item.id) return;
                          const from = list.findIndex((x) => x.id === dragId);
                          if (from >= 0) move(pkg, from, idx);
                          setDragId(null);
                        }}
                        className={cx('flex items-center gap-2 rounded-xl border border-line bg-ink p-2', item.completed && 'opacity-60', over && 'border-dashed')}>
                        <span className="cursor-grab px-1 text-mute" title="Drag to reorder" aria-hidden>⋮⋮</span>
                        <span className="w-6 text-center font-display text-red">{idx + 1}</span>
                        <button className="min-w-0 flex-1 truncate text-left text-sm" onClick={() => p && nav(`/play/${p.id}`)}>
                          {p ? playLabel(p) : 'Removed play'} {over && <Badge>beyond script</Badge>}
                        </button>
                        {isScript && (
                          <label className="flex items-center gap-1 text-xs text-mute">
                            <input type="checkbox" className="h-5 w-5 accent-red" checked={item.completed}
                              onChange={(e) => update({ ...g, items: g.items.map((i) => (i.id === item.id ? { ...i, completed: e.target.checked } : i)) })} />
                            Done
                          </label>
                        )}
                        {p && <FavoriteHeart playId={p.id} size="sm" />}
                        <div className="flex">
                          <button className="h-9 w-8 rounded text-mute hover:bg-slate2" onClick={() => move(pkg, idx, idx - 1)} aria-label="Move up">↑</button>
                          <button className="h-9 w-8 rounded text-mute hover:bg-slate2" onClick={() => move(pkg, idx, idx + 1)} aria-label="Move down">↓</button>
                          <button className="h-9 rounded px-2 text-xs text-mute hover:bg-slate2" onClick={() => setPicker({ pkg, replaceId: item.id })}>Replace</button>
                          <button className="h-9 rounded px-2 text-xs text-mute hover:bg-slate2 hover:text-red" onClick={() => reorder(pkg, list.filter((x) => x.id !== item.id))} aria-label="Remove">✕</button>
                        </div>
                      </div>
                    );
                  })}
                  <Button size="sm" tone="outline" onClick={() => setPicker({ pkg })}>+ Add play</Button>
                </div>
              )}
            </div>
          );
        })}
      </div>

      {existing && (
        <div className="mt-6 text-right">
          <Button tone="ghost" onClick={() => { if (confirm('Delete this game plan?')) { deletePlan(g.id); nav('/game-plan'); } }}>Delete game plan</Button>
        </div>
      )}

      {dirty && (
        <div className="fixed inset-x-0 bottom-[calc(64px+env(safe-area-inset-bottom))] z-30 p-3 lg:bottom-4 lg:left-auto lg:right-6 lg:w-80">
          <Button tone="red" size="lg" className="w-full shadow-2xl" onClick={() => save()}>Save game plan</Button>
        </div>
      )}

      <PlayPicker open={Boolean(picker)} onClose={() => setPicker(null)} title={picker?.replaceId ? 'Replace play' : `Add to ${picker?.pkg ?? ''}`}
        onPick={(pid) => {
          if (!picker) return;
          if (picker.replaceId) {
            update({ ...g, items: g.items.map((i) => (i.id === picker.replaceId ? { ...i, playId: pid, completed: false } : i)) });
            setPicker(null);
          } else {
            update({ ...g, items: [...g.items, { id: uuid(), package: picker.pkg, playId: pid, position: items(picker.pkg).length, completed: false }] });
            toast('Added');
          }
        }} />
    </div>
  );
}
