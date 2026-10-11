import { useNavigate } from 'react-router-dom';
import { useApp } from '@/state/store';
import { SchemeCard } from '@/components/SchemeCard';
import { Button, Empty, PageHeader } from '@/components/ui';
import { uuid } from '@/lib/supabase';

export default function Schemes() {
  const nav = useNavigate();
  const schemes = useApp((s) => s.schemes);
  const setActive = useApp((s) => s.setActiveScheme);
  const save = useApp((s) => s.saveScheme);
  const del = useApp((s) => s.deleteScheme);
  const toast = useApp((s) => s.toast);
  return (
    <div>
      <PageHeader title="My Schemes" sub="Build any offense from the same master playbook. Weights steer recommendations — they are not play-call quotas."
        right={<Button tone="red" onClick={() => nav('/schemes/new')}>+ Create scheme</Button>} />
      {schemes.length === 0 && <Empty>No schemes yet.</Empty>}
      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
        {schemes.map((s) => (
          <SchemeCard key={s.id} scheme={s}
            onActivate={() => { setActive(s.id); toast(`${s.name} is now active`); }}
            onEdit={() => nav(`/schemes/${s.id}`)}
            onDuplicate={() => save({ ...s, id: uuid(), name: `${s.name} (copy)`, isActive: false, isDefault: false })}
            onDelete={schemes.length > 1 ? () => { if (confirm(`Delete ${s.name}?`)) del(s.id); } : undefined} />
        ))}
      </div>
    </div>
  );
}
