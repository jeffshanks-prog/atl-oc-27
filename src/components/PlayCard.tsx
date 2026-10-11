import type { ReactNode } from 'react';
import { useNavigate } from 'react-router-dom';
import type { Play } from '@/lib/types';
import { FAMILY_LABEL, familiesOf, formationLabel } from '@/engine/classify';
import { FavoriteHeart } from './FavoriteHeart';
import { Badge, cx } from './ui';
import type { PlayStat } from '@/analytics/stats';
import { fmtAvg, pct } from '@/analytics/stats';

const TYPE_TONE: Record<string, 'red' | 'dark' | 'green' | 'amber'> = {
  Screen: 'red', Run: 'green', RPO: 'amber', 'Play Action': 'amber', Pass: 'dark',
};

export function PlayCard({
  play, stat, actions, compact, selected, onSelect, roles, subtitle,
}: {
  play: Play;
  stat?: PlayStat;
  actions?: ReactNode;
  compact?: boolean;
  selected?: boolean;
  onSelect?: () => void;
  roles?: string[];
  subtitle?: ReactNode;
}) {
  const nav = useNavigate();
  const fams = [...familiesOf(play)].slice(0, 3);
  return (
    <div
      role="button"
      tabIndex={0}
      onClick={() => (onSelect ? onSelect() : nav(`/play/${play.id}`))}
      onKeyDown={(e) => { if (e.key === 'Enter') (onSelect ? onSelect() : nav(`/play/${play.id}`)); }}
      className={cx(
        'group flex items-center gap-2 rounded-xl border bg-coal px-3 transition hover:border-mute/40 cursor-pointer',
        compact ? 'py-2' : 'py-3',
        selected ? 'border-red ring-1 ring-red' : 'border-line',
      )}
    >
      <div className="min-w-0 flex-1">
        <div className="truncate text-[11px] font-semibold uppercase tracking-wider text-mute">{formationLabel(play)}</div>
        <div className="truncate font-display text-base font-semibold uppercase tracking-wide text-white sm:text-lg">{play.playName}</div>
        {!compact && (
          <div className="mt-1 flex flex-wrap items-center gap-1">
            <Badge tone={TYPE_TONE[play.playType]}>{play.playType}</Badge>
            {fams.map((f) => <Badge key={f}>{FAMILY_LABEL[f]}</Badge>)}
            {play.isSeed && <Badge tone="amber">Auto-tagged</Badge>}
            {play.ownerId && <Badge>Custom</Badge>}
            {roles?.slice(0, 3).map((r) => <Badge key={r} tone="red">{r}</Badge>)}
          </div>
        )}
        {subtitle && <div className="mt-1 text-xs text-mute">{subtitle}</div>}
        {stat && stat.calls > 0 && (
          <div className="mt-1 text-xs text-mute">
            {stat.calls} calls · {fmtAvg(stat.avg)} avg · {pct(stat.successRate)} success
          </div>
        )}
      </div>
      {actions && <div className="flex shrink-0 items-center gap-1" onClick={(e) => e.stopPropagation()}>{actions}</div>}
      <FavoriteHeart playId={play.id} />
    </div>
  );
}
