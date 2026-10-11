import { useState } from 'react';
import { useApp } from '@/state/store';
import { PACKAGES } from '@/lib/constants';
import type { GamePlan, PackageName } from '@/lib/types';
import { uuid } from '@/lib/supabase';
import { Button, Chip, Field, Modal, inputCls } from './ui';

export function AddToGamePlanModal({ playId, open, onClose }: { playId: string; open: boolean; onClose: () => void }) {
  const plans = useApp((s) => s.gamePlans);
  const addToGamePlan = useApp((s) => s.addToGamePlan);
  const saveGamePlan = useApp((s) => s.saveGamePlan);
  const toast = useApp((s) => s.toast);
  const [planId, setPlanId] = useState<string>('');
  const [pkg, setPkg] = useState<PackageName>('Base Calls');
  const [newName, setNewName] = useState('');
  const chosen = planId || plans[0]?.id || '';

  const save = () => {
    let id = chosen;
    if (!id || newName.trim()) {
      const gp: GamePlan = { id: uuid(), opponent: newName.trim() || 'New opponent', planDate: null, schemeId: null, notes: '', scriptLength: 10, items: [], createdAt: new Date().toISOString() };
      saveGamePlan(gp);
      id = gp.id;
    }
    addToGamePlan(id, pkg, playId);
    toast(`Added to ${pkg}`);
    setNewName('');
    onClose();
  };

  return (
    <Modal open={open} onClose={onClose} title="Add to game plan">
      <div className="space-y-4">
        {plans.length > 0 && (
          <Field label="Game plan">
            <select className={inputCls} value={chosen} onChange={(e) => setPlanId(e.target.value)}>
              {plans.map((p) => <option key={p.id} value={p.id}>{p.opponent || 'Untitled'}{p.planDate ? ` · ${p.planDate}` : ''}</option>)}
            </select>
          </Field>
        )}
        <Field label={plans.length ? 'Or create a new plan (opponent)' : 'New game plan — opponent'}>
          <input className={inputCls} value={newName} onChange={(e) => setNewName(e.target.value)} placeholder="Opponent name" />
        </Field>
        <div>
          <div className="mb-1 text-xs font-semibold uppercase tracking-wider text-mute">Package</div>
          <div className="flex flex-wrap gap-1.5">
            {PACKAGES.map((p) => <Chip key={p} size="sm" active={pkg === p} onClick={() => setPkg(p)}>{p}</Chip>)}
          </div>
        </div>
        <Button tone="red" size="lg" className="w-full" onClick={save}>Add play</Button>
      </div>
    </Modal>
  );
}
