import { useMemo, useState } from 'react';
import { useApp } from '@/state/store';
import { PlaySearch, matchesQuery } from './PlaySearch';
import { PlayCard } from './PlayCard';
import { Button, Chip, Empty, Modal } from './ui';

/** Modal to pick a play — favorites first, then the full playbook. */
export function PlayPicker({ open, onClose, onPick, title = 'Add a play', excludeIds = [] }: {
  open: boolean; onClose: () => void; onPick: (playId: string) => void; title?: string; excludeIds?: string[];
}) {
  const plays = useApp((s) => s.plays);
  const favorites = useApp((s) => s.favorites);
  const [q, setQ] = useState('');
  const [tab, setTab] = useState<'fav' | 'all'>(Object.keys(favorites).length ? 'fav' : 'all');
  const list = useMemo(
    () => plays.filter((p) => (tab === 'all' || favorites[p.id]) && matchesQuery(p, q) && !excludeIds.includes(p.id)).slice(0, 150),
    [plays, favorites, tab, q, excludeIds],
  );
  return (
    <Modal open={open} onClose={onClose} title={title} wide>
      <div className="mb-3 flex gap-2">
        <Chip active={tab === 'fav'} onClick={() => setTab('fav')}>❤️ Favorites</Chip>
        <Chip active={tab === 'all'} onClick={() => setTab('all')}>Full playbook</Chip>
      </div>
      <PlaySearch value={q} onChange={setQ} />
      <div className="mt-3 space-y-2">
        {list.length === 0 && <Empty>{tab === 'fav' ? 'No favorites match. Tap ♡ on any play to add it.' : 'No plays match.'}</Empty>}
        {list.map((p) => (
          <PlayCard key={p.id} play={p} compact roles={favorites[p.id]} onSelect={() => onPick(p.id)}
            actions={<Button size="sm" tone="outline" onClick={() => onPick(p.id)}>Add</Button>} />
        ))}
      </div>
    </Modal>
  );
}
