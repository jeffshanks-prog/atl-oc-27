import { useApp } from '@/state/store';
import { FAVORITE_ROLES } from '@/lib/constants';
import { Chip } from './ui';

/** Optional special labels for a favorite (multi-select). Tagging a role also favorites the play. */
export function FavoriteRolesEditor({ playId }: { playId: string }) {
  const roles = useApp((s) => s.favorites[playId]);
  const setRoles = useApp((s) => s.setFavoriteRoles);
  const current = roles ?? [];
  return (
    <div className="flex flex-wrap gap-1.5">
      {FAVORITE_ROLES.map((r) => {
        const on = current.includes(r);
        return (
          <Chip key={r} size="sm" active={on} onClick={() => setRoles(playId, on ? current.filter((x) => x !== r) : [...current, r])}>
            {r}
          </Chip>
        );
      })}
    </div>
  );
}
