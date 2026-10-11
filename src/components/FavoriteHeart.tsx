import { useApp } from '@/state/store';
import { cx } from './ui';

/** ♡ / ♥ — one tap adds/removes a play from My Favorites. Used on every play card. */
export function FavoriteHeart({ playId, size = 'md', className }: { playId: string; size?: 'sm' | 'md' | 'lg'; className?: string }) {
  const fav = useApp((s) => Boolean(s.favorites[playId]));
  const toggle = useApp((s) => s.toggleFavorite);
  return (
    <button
      type="button"
      aria-pressed={fav}
      aria-label={fav ? 'Remove from favorites' : 'Add to favorites'}
      title={fav ? 'Remove from favorites' : 'Add to favorites'}
      onClick={(e) => { e.stopPropagation(); e.preventDefault(); toggle(playId); }}
      className={cx(
        'grid shrink-0 place-items-center rounded-full transition active:scale-90',
        size === 'sm' && 'h-8 w-8 text-lg',
        size === 'md' && 'h-10 w-10 text-xl',
        size === 'lg' && 'h-12 w-12 text-2xl',
        fav ? 'text-red' : 'text-mute hover:text-white',
        className,
      )}
    >
      {fav ? '♥' : '♡'}
    </button>
  );
}
