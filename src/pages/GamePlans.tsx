import { useNavigate } from 'react-router-dom';
import { useApp } from '@/state/store';
import { GamePlanCard } from '@/components/GamePlanCard';
import { Button, Empty, PageHeader } from '@/components/ui';

export default function GamePlans() {
  const nav = useNavigate();
  const plans = useApp((s) => s.gamePlans);
  const startGame = useApp((s) => s.startGame);
  return (
    <div>
      <PageHeader title="Game Plans" sub="Opening scripts and situational packages for each opponent"
        right={<Button tone="red" onClick={() => nav('/game-plan/new')}>+ New game plan</Button>} />
      {plans.length === 0 && <Empty>No game plans yet. Create one, then add favorites into packages like Opening Script, 3rd & Medium, or Red Zone.</Empty>}
      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
        {plans.map((p) => (
          <GamePlanCard key={p.id} plan={p} onOpen={() => nav(`/game-plan/${p.id}`)} onStart={() => { startGame(p.opponent, p.id); nav('/'); }} />
        ))}
      </div>
    </div>
  );
}
