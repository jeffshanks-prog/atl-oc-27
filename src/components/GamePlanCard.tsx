import type { GamePlan } from '@/lib/types';
import { useApp } from '@/state/store';
import { Badge, Button, Card } from './ui';

export function GamePlanCard({ plan, onOpen, onStart }: { plan: GamePlan; onOpen: () => void; onStart: () => void }) {
  const scheme = useApp((s) => s.schemes.find((x) => x.id === plan.schemeId));
  const script = plan.items.filter((i) => i.package === 'Opening Script');
  const done = script.filter((i) => i.completed).length;
  const packages = new Set(plan.items.map((i) => i.package)).size;
  return (
    <Card className="p-4">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <div className="text-xs uppercase tracking-wider text-mute">vs</div>
          <h3 className="font-display text-xl font-bold uppercase tracking-wide">{plan.opponent || 'Untitled opponent'}</h3>
          <div className="mt-1 flex flex-wrap gap-1.5">
            {plan.planDate && <Badge>{plan.planDate}</Badge>}
            {scheme && <Badge tone="red">{scheme.name}</Badge>}
            <Badge>{plan.items.length} calls · {packages} packages</Badge>
            {script.length > 0 && <Badge tone="amber">Script {done}/{script.length}</Badge>}
          </div>
        </div>
      </div>
      <div className="mt-4 flex gap-2">
        <Button size="sm" onClick={onOpen}>Open</Button>
        <Button size="sm" tone="red" onClick={onStart}>Start game</Button>
      </div>
    </Card>
  );
}
