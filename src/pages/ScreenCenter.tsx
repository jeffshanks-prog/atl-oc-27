import { useMemo } from 'react';
import { useApp } from '@/state/store';
import { usePlayStats } from '@/state/useEngine';
import { familiesOf, screenCategory } from '@/engine/classify';
import { SCREEN_CATEGORIES } from '@/lib/constants';
import { PlayCard } from '@/components/PlayCard';
import { Empty, PageHeader, SectionTitle } from '@/components/ui';

export default function ScreenCenter() {
  const plays = useApp((s) => s.plays);
  const favorites = useApp((s) => s.favorites);
  const stats = usePlayStats();
  const groups = useMemo(() => {
    const screens = plays.filter((p) => familiesOf(p).has('screen'));
    return SCREEN_CATEGORIES.map((c) => ({ cat: c, plays: screens.filter((p) => screenCategory(p) === c) })).filter((g) => g.plays.length > 0);
  }, [plays]);
  const total = groups.reduce((a, g) => a + g.plays.length, 0);

  return (
    <div>
      <PageHeader title="🔥 Screen Center" sub={`${total} screen plays across the playbook`} />
      {groups.length === 0 && <Empty>No screens tagged yet. Import plays or bulk-tag screens in Admin.</Empty>}
      <div className="space-y-6">
        {groups.map((g) => (
          <section key={g.cat}>
            <SectionTitle>{g.cat} · {g.plays.length}</SectionTitle>
            <div className="grid gap-2 md:grid-cols-2">
              {g.plays.map((p) => <PlayCard key={p.id} play={p} stat={stats.get(p.id)} roles={favorites[p.id]} />)}
            </div>
          </section>
        ))}
      </div>
    </div>
  );
}
