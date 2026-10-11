import type { Tendencies } from '@/engine/tendencies';
import { Card, Meter, SectionTitle } from './ui';

const ROWS: { key: string; label: string; get: (t: Tendencies) => number }[] = [
  { key: 'C0', label: 'Cover 0', get: (t) => t.coverage.C0 },
  { key: 'C1', label: 'Cover 1', get: (t) => t.coverage.C1 },
  { key: 'C2', label: 'Cover 2', get: (t) => t.coverage.C2 },
  { key: 'C3', label: 'Cover 3', get: (t) => t.coverage.C3 },
  { key: 'C4', label: 'Cover 4', get: (t) => t.coverage.C4 },
  { key: 'C6', label: 'Cover 6', get: (t) => t.coverage.C6 },
  { key: 'Man', label: 'Man', get: (t) => t.coverage.Man },
  { key: 'blitz', label: 'Blitz / pressure', get: (t) => t.blitz },
  { key: 'press', label: 'Press', get: (t) => t.press },
  { key: 'loaded', label: 'Loaded box', get: (t) => t.loadedBox },
  { key: 'soft', label: 'Soft coverage', get: (t) => t.softCoverage },
];

export function OpponentTendencyCard({ t, opponent }: { t: Tendencies; opponent?: string }) {
  return (
    <Card className="p-4">
      <SectionTitle right={<span className="text-xs text-mute">{t.snaps} snaps</span>}>
        Opponent tendencies{opponent ? ` · ${opponent}` : ''}
      </SectionTitle>
      {t.snaps === 0 ? (
        <p className="text-sm text-mute">Record results after each snap — what defense you saw — and their tendencies build here.</p>
      ) : (
        <>
          <div className="space-y-1.5">
            {ROWS.map((r) => {
              const v = r.get(t) ?? 0;
              return (
                <div key={r.key} className="grid grid-cols-[96px_1fr_40px] items-center gap-2 text-xs">
                  <span className="text-mute">{r.label}</span>
                  <Meter value={v} tone={r.key === 'blitz' ? 'red' : 'white'} />
                  <span className="text-right font-semibold tabular-nums">{Math.round(v * 100)}%</span>
                </div>
              );
            })}
          </div>
          {t.insights.length > 0 && (
            <ul className="mt-3 space-y-1 border-t border-line pt-3 text-sm">
              {t.insights.map((i) => <li key={i}>• {i}</li>)}
            </ul>
          )}
        </>
      )}
    </Card>
  );
}
