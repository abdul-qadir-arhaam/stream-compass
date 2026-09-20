import React, { useEffect, useState } from 'react';
import { Bookmark, Check, Trash2, Calendar, Clock, Star, Sparkles, Film } from 'lucide-react';
import { Link } from 'react-router-dom';
import type { WatchlistItem } from '../types';
import { api } from '../services/api';
import { TitleDetailModal } from '../components/TitleDetailModal';

import { useAuth } from '../context/AuthContext';

export const WatchlistPage: React.FC = () => {
  const { user } = useAuth();
  const [items, setItems] = useState<WatchlistItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [selectedTitleId, setSelectedTitleId] = useState<number | null>(null);

  const fetchWatchlist = async () => {
    if (!user) {
      setItems([]);
      setIsLoading(false);
      return;
    }
    try {
      setIsLoading(true);
      const data = await api.getWatchlist();
      setItems(data);
    } catch (err) {
      console.error('Failed to load watchlist', err);
      setItems([]);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchWatchlist();
  }, [user?.id]);

  const handleRemove = async (titleId: number, e: React.MouseEvent) => {
    e.stopPropagation();
    try {
      await api.toggleWatchlist({ title_id: titleId });
      setItems((prev) => prev.filter((it) => it.title_id !== titleId));
    } catch (err) {
      console.error('Failed to remove from watchlist', err);
    }
  };

  const handleMarkWatched = async (titleId: number, e: React.MouseEvent) => {
    e.stopPropagation();
    try {
      await api.markWatchlistWatched(titleId);
      // Remove from active watchlist state
      setItems((prev) => prev.filter((it) => it.title_id !== titleId));
      // Optionally open modal to invite rating
      setSelectedTitleId(titleId);
    } catch (err) {
      console.error('Failed to mark as watched', err);
    }
  };

  return (
    <div className="min-h-screen bg-obsidian-950 text-slate-100 py-10 px-4 sm:px-6 lg:px-8 max-w-7xl mx-auto space-y-8">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-6 border-b border-white/5">
        <div>
          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-compass-500/10 border border-compass-500/20 text-compass-400 text-xs font-semibold mb-2">
            <Bookmark className="w-3.5 h-3.5" />
            <span>Saved Coordinates</span>
          </div>
          <h1 className="text-3xl font-extrabold text-white tracking-tight">Watchlist</h1>
          <p className="text-sm text-slate-400 mt-1">
            Titles earmarked for future viewing sessions. Mark watched when finished to enrich your taste profile.
          </p>
        </div>

        <div className="px-5 py-2.5 rounded-2xl bg-obsidian-900 border border-white/10 text-center self-start md:self-auto">
          <div className="text-xs text-slate-400">Total Bookmarked</div>
          <div className="text-2xl font-extrabold text-compass-400">{items.length}</div>
        </div>
      </div>

      {/* Grid */}
      {isLoading ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="h-80 rounded-2xl bg-obsidian-900 animate-pulse border border-white/5" />
          ))}
        </div>
      ) : items.length === 0 ? (
        <div className="text-center py-20 bg-obsidian-900/50 rounded-3xl border border-white/5 p-8">
          <div className="w-16 h-16 rounded-2xl bg-compass-500/10 border border-compass-500/20 text-compass-400 flex items-center justify-center mx-auto mb-4">
            <Bookmark className="w-8 h-8" />
          </div>
          <h3 className="text-lg font-bold text-white">Your watchlist is empty</h3>
          <p className="text-xs text-slate-400 max-w-sm mx-auto mt-1">
            Browse through catalog recommendations and bookmark titles you intend to experience.
          </p>
          <div className="mt-6">
            <Link
              to="/search"
              className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-compass-500 text-obsidian-950 font-bold text-xs shadow-lg shadow-compass-500/20 hover:bg-compass-400 transition-all"
            >
              <Sparkles className="w-3.5 h-3.5" />
              <span>Browse Catalog</span>
            </Link>
          </div>
        </div>
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3 sm:gap-6">
          {items.map((item) => (
            <div
              key={item.id}
              onClick={() => setSelectedTitleId(item.title_id)}
              className="group cursor-pointer rounded-2xl overflow-hidden bg-obsidian-900 border border-white/10 hover:border-compass-500/50 transition-all flex flex-col shadow-lg card-hover-subtle"
            >
              {/* Poster */}
              <div className="aspect-[2/3] w-full relative overflow-hidden bg-obsidian-850">
                {item.title.poster_path ? (
                  <img
                    src={item.title.poster_path}
                    alt={item.title.title}
                    className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                  />
                ) : (
                  <div className="w-full h-full flex items-center justify-center text-slate-600 text-xs">
                    <Film className="w-8 h-8 stroke-[1]" />
                  </div>
                )}
                <div className="absolute inset-0 bg-gradient-to-t from-obsidian-950 via-transparent to-transparent opacity-80" />

                {/* Rating badge */}
                <div className="absolute top-3 left-3 bg-obsidian-950/80 backdrop-blur-md px-2 py-1 rounded-md border border-white/10 flex items-center gap-1 text-xs font-bold text-amber-400">
                  <Star className="w-3 h-3 fill-amber-400" />
                  <span>{item.title.vote_average.toFixed(1)}</span>
                </div>

                {/* Delete button */}
                <button
                  onClick={(e) => handleRemove(item.title_id, e)}
                  className="absolute top-3 right-3 p-1.5 rounded-lg bg-obsidian-950/80 text-slate-400 hover:text-red-400 border border-white/10 opacity-0 group-hover:opacity-100 transition-all cursor-pointer"
                  title="Remove from watchlist"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>

                {/* Bottom metadata */}
                <div className="absolute bottom-2 left-3 right-3 flex items-center justify-between text-[11px] text-slate-400">
                  <span className="flex items-center gap-1">
                    <Calendar className="w-3 h-3 text-compass-500" />
                    {item.title.release_date?.slice(0, 4)}
                  </span>
                  {item.title.runtime_minutes && (
                    <span className="flex items-center gap-1">
                      <Clock className="w-3 h-3" />
                      {item.title.runtime_minutes}m
                    </span>
                  )}
                </div>
              </div>

              {/* Information and Quick Watched Action */}
              <div className="p-4 flex-1 flex flex-col justify-between space-y-4">
                <div>
                  <h3 className="font-bold text-white text-sm truncate group-hover:text-compass-400 transition-colors">
                    {item.title.title}
                  </h3>
                  <p className="text-xs text-slate-400 mt-0.5 truncate">
                    Dir. {item.title.director || 'Unknown'}
                  </p>
                  <div className="flex flex-wrap gap-1 mt-2">
                    {item.title.genres.slice(0, 2).map((g) => (
                      <span
                        key={g.id}
                        className="text-[10px] px-1.5 py-0.5 rounded bg-white/5 text-slate-300 border border-white/5"
                      >
                        {g.name}
                      </span>
                    ))}
                  </div>
                </div>

                {/* Mark as Watched CTA */}
                <button
                  onClick={(e) => handleMarkWatched(item.title_id, e)}
                  className="w-full flex items-center justify-center gap-2 py-2 rounded-xl bg-obsidian-800 hover:bg-emerald-500/20 text-slate-300 hover:text-emerald-300 border border-white/10 hover:border-emerald-500/40 text-xs font-semibold transition-all cursor-pointer"
                  title="Mark watched and move to library"
                >
                  <Check className="w-3.5 h-3.5 stroke-[2.5]" />
                  <span>Mark as Watched</span>
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Title Details Modal */}
      <TitleDetailModal
        titleId={selectedTitleId}
        onClose={() => setSelectedTitleId(null)}
        onInteractionChange={fetchWatchlist}
      />
    </div>
  );
};
