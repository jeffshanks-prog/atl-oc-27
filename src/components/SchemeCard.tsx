import type { Scheme } from '@/lib/types';
import { CONCEPT_KEYS } from '@/lib/constants';
import { Badge, Button, Card, Meter } from './ui';

export function SchemeCard({ scheme, onActivate, onEdit, onDuplicate, onDelete }: {
  scheme: Scheme; onActivate: () => void; onEdit: () => void; onDuplicate: () => void; onDelete?: () => void;
}) {
  const weights = CONCEPT_KEYS.map((c) => ({ ...c, v: scheme.weights[c.key] ?? 0 })).filter((x) => x.v > 0).sort((a, b) => b.v - a.v);
  return (
    <Card className={scheme.isActive ? 'border-red p-4' : 'p-4'}>
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-1.5">
            {scheme.isActive && <Badge tone="red">Active</Badge>}
            {scheme.isDefault && <Badge>Default</Badge>}
            {scheme.primaryConcept && <Badge>{scheme.primaryConcept}</Badge>}
          </div>
          <h3 className="mt-1 font-display text-xl font-bold uppercase tracking-wide">{scheme.name}</h3>
          {scheme.description && <p className="mt-0.5 line-clamp-2 text-sm text-mute">{scheme.description}</p>}
        </div>
      </div>
      <div className="mt-3 space-y-1.5">
        {weights.map((w) => (
          <div key={w.key} className="grid grid-cols-[120px_1fr_36px] items-center gap-2 text-xs">
            <span className="text-mute">{w.label}</span>
            <Meter value={w.v} max={100} />
            <span className="text-right font-semibold tabular-nums">{w.v}%</span>
          </div>
        ))}
      </div>
      {scheme.playIds.length > 0 && <div className="mt-2 text-xs text-mute">{scheme.playIds.length} preferred plays</div>}
      <div className="mt-4 flex flex-wrap gap-2">
        {!scheme.isActive && <Button tone="red" size="sm" onClick={onActivate}>Set active</Button>}
        <Button size="sm" onClick={onEdit}>Edit</Button>
        <Button size="sm" onClick={onDuplicate}>Duplicate</Button>
        {onDelete && <Button size="sm" tone="ghost" onClick={onDelete}>Delete</Button>}
      </div>
    </Card>
  );
}
