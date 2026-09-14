import React from 'react';
import { Users, Star } from 'lucide-react';
import { useFriendsWatched } from '../context/FriendsWatchedContext';

interface FriendWatchedBadgeProps {
  titleId: number;
  className?: string;
  compact?: boolean;
}

export const FriendWatchedBadge: React.FC<FriendWatchedBadgeProps> = ({
  titleId,
  className = '',
  compact = false,
}) => {
  const { getFriendsForTitle } = useFriendsWatched();
  const friends = getFriendsForTitle(titleId);

  if (!friends || friends.length === 0) {
    return null;
  }

  const primaryFriend = friends[0];
  const additionalCount = friends.length - 1;

  if (compact) {
    return (
      <div
        className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-emerald-500/20 border border-emerald-500/40 text-emerald-300 text-[10px] font-semibold tracking-wide ${className}`}
        title={`Watched by ${friends.map((f) => `${f.friend_username}${f.rating ? ` (${f.rating}★)` : ''}`).join(', ')}`}
      >
        <Users className="w-3 h-3 text-emerald-400" />
        <span>
          {primaryFriend.friend_username}
          {primaryFriend.rating ? ` (${primaryFriend.rating}★)` : ''}
          {additionalCount > 0 ? ` +${additionalCount}` : ''}
        </span>
      </div>
    );
  }

  return (
    <div
      className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-emerald-950/60 border border-emerald-500/30 text-emerald-300 text-xs font-medium shadow-sm ${className}`}
      title={`Watched by: ${friends.map((f) => `${f.friend_username}${f.rating ? ` (${f.rating}★)` : ''}`).join(', ')}`}
    >
      <div className="w-4 h-4 rounded-full bg-emerald-500/30 flex items-center justify-center text-[9px] font-extrabold text-emerald-200">
        {primaryFriend.friend_username[0].toUpperCase()}
      </div>
      <span>
        Watched by <strong className="text-white font-bold">{primaryFriend.friend_username}</strong>
        {primaryFriend.rating ? (
          <span className="inline-flex items-center ml-1 text-amber-300 font-bold">
            <Star className="w-2.5 h-2.5 fill-amber-300 inline mr-0.5" />
            {primaryFriend.rating}
          </span>
        ) : null}
        {additionalCount > 0 ? ` & ${additionalCount} other${additionalCount > 1 ? 's' : ''}` : ''}
      </span>
    </div>
  );
};
