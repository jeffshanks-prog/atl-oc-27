import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useApp } from '@/state/store';
import { download, exportCsv, parseImport, runImport, templateCsv, type ImportReport, type Parsed } from '@/import/importer';
import { loadPlays } from '@/data/api';
import { playToRow } from '@/data/mappers';
import { setPlayTags } from '@/data/plays';
import { supabase } from '@/lib/supabase';
import { PlaySearch, matchesQuery } from '@/components/PlaySearch';
import { PlayFilters, applyFilters, EMPTY_FILTERS, type Filters } from '@/components/PlayFilters';
import { FavoriteHeart } from '@/components/FavoriteHeart';
import { Badge, Button, Card, Chip, Empty, Field, PageHeader, SectionTitle, cx, inputCls } from '@/components/ui';
import { formationLabel } from '@/engine/classify';
import type { Play } from '@/lib/types';

type Tab = 'import' | 'tag' | 'plays';

export default function Admin() {
  const isAdmin = useApp((s) => s.profile?.isAdmin);
  const nav = useNavigate();
  const [tab, setTab] = useState<Tab>(isAdmin ? 'import' : 'plays');
  return (
    <div>
      <PageHeader title={isAdmin ? 'Admin' : 'My custom plays'}
        sub={isAdmin ? 'Import, tag, and maintain the master Atlanta playbook' : 'Add plays missing from the master playbook — they are visible only to you'}
        right={<Button tone="red" onClick={() => nav('/admin/play/new')}>+ Add play</Button>} />
      {isAdmin && (
        <div className="mb-4 flex gap-2">
          <Chip active={tab === 'import'} onClick={() => setTab('import')}>Import</Chip>
          <Chip active={tab === 'tag'} onClick={() => setTab('tag')}>Bulk tagging</Chip>
          <Chip active={tab === 'plays'} onClick={() => setTab('plays')}>All plays</Chip>
        </div>
      )}
      {tab === 'import' && isAdmin && <ImportPanel />}
      {tab === 'tag' && isAdmin && <BulkTag />}
      {tab === 'plays' && <PlayList />}
    </div>
  );
}

function ImportPanel() {
  const plays = useApp((s) => s.plays);
  const upsertPlaysLocal = useApp((s) => s.upsertPlaysLocal);
  const [kind, setKind] = useState<'csv' | 'json'>('csv');
  const [text, setText] = useState('');
  const [parsed, setParsed] = useState<Parsed | null>(null);
  const [busy, setBusy] = useState(false);
  const [progress, setProgress] = useState<[number, number] | null>(null);
  const [report, setReport] = useState<ImportReport | null>(null);

  const onFile = async (f: File) => {
    const t = await f.text();
    const k = f.name.toLowerCase().endsWith('.json') ? 'json' : 'csv';
    setKind(k); setText(t); setReport(null);
    setParsed(parseImport(t, k));
  };

  const go = async () => {
    if (!parsed?.valid.length) return;
    setBusy(true); setReport(null);
    try {
      const r = await runImport(parsed.valid, (d, t) => setProgress([d, t]));
      r.errors = [...parsed.errors, ...r.errors];
      setReport(r);
      upsertPlaysLocal(await loadPlays());
    } catch (e) {
      setReport({ added: 0, updated: 0, skipped: 0, errors: [{ row: 0, message: (e as Error).message }] });
    } finally {
      setBusy(false); setProgress(null);
    }
  };

  return (
    <div className="grid gap-4 lg:grid-cols-[1fr_340px]">
      <Card className="space-y-3 p-4">
        <SectionTitle>Import plays (CSV or JSON)</SectionTitle>
        <div className="flex flex-wrap gap-2">
          <label className="inline-flex min-h-[44px] cursor-pointer items-center rounded-xl bg-red px-4 font-semibold">
            Choose file
            <input type="file" accept=".csv,.json,text/csv,application/json" className="hidden" onChange={(e) => e.target.files?.[0] && onFile(e.target.files[0])} />
          </label>
          <Chip active={kind === 'csv'} onClick={() => setKind('csv')}>CSV</Chip>
          <Chip active={kind === 'json'} onClick={() => setKind('json')}>JSON</Chip>
        </div>
        <textarea className={cx(inputCls, 'h-48 font-mono text-xs')} placeholder="…or paste CSV / JSON here" value={text}
          onChange={(e) => { setText(e.target.value); setParsed(null); setReport(null); }} />
        <div className="flex flex-wrap gap-2">
          <Button onClick={() => setParsed(parseImport(text, kind))} disabled={!text.trim()}>Validate</Button>
          <Button tone="red" onClick={go} disabled={!parsed?.valid.length || busy}>
            {busy ? `Importing ${progress ? `${progress[0]}/${progress[1]}` : '…'}` : `Import ${parsed?.valid.length ?? 0} plays`}
          </Button>
        </div>

        {parsed && !report && (
          <div className="rounded-xl border border-line bg-ink p-3 text-sm">
            <div><Badge tone="green">{parsed.valid.length} valid</Badge> <Badge tone={parsed.errors.length ? 'red' : 'dark'}>{parsed.errors.length} errors</Badge></div>
            <ErrorList errors={parsed.errors} />
          </div>
        )}
        {report && (
          <div className="rounded-xl border border-line bg-ink p-3">
            <div className="grid grid-cols-4 gap-2 text-center">
              {[['Added', report.added, 'text-emerald-400'], ['Updated', report.updated, 'text-amber-300'], ['Skipped', report.skipped, 'text-mute'], ['Errors', report.errors.length, 'text-red']].map(([k, v, c]) => (
                <div key={k as string}><div className={cx('font-display text-3xl font-bold', c as string)}>{v as number}</div><div className="text-xs uppercase text-mute">{k as string}</div></div>
              ))}
            </div>
            <ErrorList errors={report.errors} />
          </div>
        )}
      </Card>

      <Card className="space-y-3 p-4 text-sm">
        <SectionTitle>Template & rules</SectionTitle>
        <Button className="w-full" onClick={() => download('atl-oc-27-import-template.csv', templateCsv())}>⬇ Download import template</Button>
        <Button className="w-full" onClick={() => download('atl-oc-27-playbook.csv', exportCsv(plays.filter((p) => !p.ownerId)))} disabled={!plays.length}>⬇ Export current playbook (CSV)</Button>
        <ul className="list-disc space-y-1 pl-4 text-mute">
          <li>Required: <b className="text-white">playName</b>, <b className="text-white">formation</b>, <b className="text-white">playType</b> (Pass, Run, Screen, RPO, Play Action).</li>
          <li>Duplicates are matched on <b className="text-white">Playbook + Formation + Set + Play Name</b>: changed rows update, identical rows are skipped.</li>
          <li>List fields (tags, bestVs, secondarySchemes…) use <code>|</code> between values.</li>
          <li>Ratings are 0–5; riskLevel and explosivePotential are 1–5. Blank = default.</li>
          <li>If formationFamily is blank, it is read from the formation name (e.g. "Gun Bunch TE" → Gun / Bunch TE).</li>
          <li>Importing a row that matches an auto-tagged play replaces its tags/ratings and clears the Auto-tagged flag.</li>
        </ul>
      </Card>
    </div>
  );
}

function ErrorList({ errors }: { errors: { row: number; message: string }[] }) {
  if (!errors.length) return null;
  return (
    <ul className="mt-2 max-h-48 space-y-0.5 overflow-y-auto text-xs text-red">
      {errors.map((e, i) => <li key={i}>{e.row ? `Row ${e.row}: ` : ''}{e.message}</li>)}
    </ul>
  );
}

function BulkTag() {
  const plays = useApp((s) => s.plays);
  const upsertPlaysLocal = useApp((s) => s.upsertPlaysLocal);
  const toast = useApp((s) => s.toast);
  const master = useMemo(() => plays.filter((p) => !p.ownerId), [plays]);
  const [q, setQ] = useState('');
  const [filters, setFilters] = useState<Filters>(EMPTY_FILTERS);
  const [sel, setSel] = useState<Set<string>>(new Set());
  const [tag, setTag] = useState('');
  const [scheme, setScheme] = useState('');
  const [bestVs, setBestVs] = useState('');
  const [flags, setFlags] = useState<{ blitzBeater?: boolean; manBeater?: boolean; zoneBeater?: boolean }>({});
  const [busy, setBusy] = useState(false);
  const shown = master.filter((p) => matchesQuery(p, q) && applyFilters(p, filters));

  const toggle = (id: string) => { const n = new Set(sel); n.has(id) ? n.delete(id) : n.add(id); setSel(n); };
  const add = (arr: string[], v: string) => (v.trim() && !arr.some((x) => x.toLowerCase() === v.trim().toLowerCase()) ? [...arr, v.trim()] : arr);

  const save = async () => {
    setBusy(true);
    const updated: Play[] = [];
    try {
      for (const id of sel) {
        const p = master.find((x) => x.id === id);
        if (!p) continue;
        const next: Play = {
          ...p,
          tags: add(p.tags, tag),
          secondarySchemes: scheme && scheme !== p.primaryScheme ? add(p.secondarySchemes, scheme) : p.secondarySchemes,
          bestVs: add(p.bestVs, bestVs),
          blitzBeater: flags.blitzBeater ?? p.blitzBeater,
          manBeater: flags.manBeater ?? p.manBeater,
          zoneBeater: flags.zoneBeater ?? p.zoneBeater,
        };
        const { error } = await supabase.from('plays').update(playToRow(next)).eq('id', id);
        if (error) throw new Error(error.message);
        if (tag.trim()) await setPlayTags(id, next.tags);
        updated.push(next);
      }
      upsertPlaysLocal(updated);
      toast(`Updated ${updated.length} plays`);
      setSel(new Set()); setTag(''); setScheme(''); setBestVs(''); setFlags({});
    } catch (e) {
      toast((e as Error).message, 'warn');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="grid gap-4 lg:grid-cols-[1fr_320px]">
      <div className="space-y-2">
        <PlaySearch value={q} onChange={setQ} />
        <PlayFilters plays={master} value={filters} onChange={setFilters} />
        <div className="flex items-center gap-2 text-sm">
          <Button size="sm" onClick={() => setSel(new Set(shown.map((p) => p.id)))}>Select all shown ({shown.length})</Button>
          <Button size="sm" tone="ghost" onClick={() => setSel(new Set())}>Clear</Button>
          <span className="text-mute">{sel.size} selected</span>
        </div>
        <div className="space-y-1">
          {shown.map((p) => (
            <label key={p.id} className={cx('flex cursor-pointer items-center gap-3 rounded-xl border bg-coal px-3 py-2', sel.has(p.id) ? 'border-red' : 'border-line')}>
              <input type="checkbox" className="h-5 w-5 accent-red" checked={sel.has(p.id)} onChange={() => toggle(p.id)} />
              <div className="min-w-0 flex-1">
                <div className="truncate text-sm font-semibold">{formationLabel(p)} — {p.playName}</div>
                <div className="truncate text-xs text-mute">{p.playType} · {p.tags.join(', ') || 'no tags'}</div>
              </div>
              <FavoriteHeart playId={p.id} size="sm" />
            </label>
          ))}
          {shown.length === 0 && <Empty>No plays match.</Empty>}
        </div>
      </div>
      <Card className="h-fit space-y-3 p-4 lg:sticky lg:top-20">
        <SectionTitle>Apply to {sel.size} plays</SectionTitle>
        <Field label="Add tag"><input className={inputCls} value={tag} onChange={(e) => setTag(e.target.value)} placeholder="e.g. Screen" /></Field>
        <Field label="Add scheme"><input className={inputCls} value={scheme} onChange={(e) => setScheme(e.target.value)} placeholder="e.g. Screen Game" /></Field>
        <Field label="Best vs"><input className={inputCls} value={bestVs} onChange={(e) => setBestVs(e.target.value)} placeholder="e.g. Blitz, Cover 3, Man" /></Field>
        <div className="space-y-1">
          {(['blitzBeater', 'manBeater', 'zoneBeater'] as const).map((k) => (
            <div key={k} className="flex items-center justify-between text-sm">
              <span>{k.replace('Beater', ' beater').replace(/^./, (c) => c.toUpperCase())}</span>
              <div className="flex gap-1">
                <Chip size="sm" active={flags[k] === undefined} onClick={() => setFlags({ ...flags, [k]: undefined })}>Keep</Chip>
                <Chip size="sm" active={flags[k] === true} onClick={() => setFlags({ ...flags, [k]: true })}>Yes</Chip>
                <Chip size="sm" active={flags[k] === false} onClick={() => setFlags({ ...flags, [k]: false })}>No</Chip>
              </div>
            </div>
          ))}
        </div>
        <Button tone="red" size="lg" className="w-full" disabled={!sel.size || busy} onClick={save}>{busy ? 'Saving…' : 'Save'}</Button>
      </Card>
    </div>
  );
}

function PlayList() {
  const plays = useApp((s) => s.plays);
  const userId = useApp((s) => s.userId);
  const isAdmin = useApp((s) => s.profile?.isAdmin);
  const nav = useNavigate();
  const [q, setQ] = useState('');
  const mine = plays.filter((p) => (isAdmin ? true : p.ownerId === userId) && matchesQuery(p, q));
  return (
    <div className="space-y-2">
      <PlaySearch value={q} onChange={setQ} />
      {mine.length === 0 && <Empty>{isAdmin ? 'No plays.' : 'You have not added any custom plays yet.'}</Empty>}
      {mine.map((p) => (
        <div key={p.id} className="flex items-center gap-2 rounded-xl border border-line bg-coal px-3 py-2">
          <div className="min-w-0 flex-1">
            <div className="truncate text-sm font-semibold">{formationLabel(p)} — {p.playName}</div>
            <div className="flex gap-1">{p.isSeed && <Badge tone="amber">Auto-tagged</Badge>}{p.ownerId && <Badge>Custom</Badge>}<Badge>{p.playType}</Badge></div>
          </div>
          <FavoriteHeart playId={p.id} size="sm" />
          <Button size="sm" onClick={() => nav(`/admin/play/${p.id}`)}>Edit</Button>
        </div>
      ))}
    </div>
  );
}
