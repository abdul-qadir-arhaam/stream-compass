import React, { useEffect, useState, useMemo } from 'react';
import { Film, Tv, Star, Trash2, Calendar, Clock, Filter, Sparkles, BookOpen } from 'lucide-react';
import { Link } from 'react-router-dom';
import type { UserTitle } from '../types';
import { api } from '../services/api';
import { TitleDetailModal } from '../components/TitleDetailModal';

import { useAuth } from '../context/AuthContext';

export const LibraryPage: React.FC = () => {
  const { user } = useAuth();
  const [items, setItems] = useState<UserTitle[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [selectedTitleId, setSelectedTitleId] = useState<number | null>(null);
  const [typeFilter, setTypeFilter] = useState<'all' | 'movie' | 'series'>('all');
  const [ratingFilter, setRatingFilter] = useState<string>('all');

  const fetchLibrary = async () => {
    if (!user) {
      setItems([]);
      setIsLoading(false);
      return;
    }
    try {
      setIsLoading(true);
      const data = await api.getWatched();
      setItems(data);
    } catch (err) {
      console.error('Failed to load watched library', err);
      setItems([]);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchLibrary();
  }, [user?.id]);

  const handleRemove = async (titleId: number, e: React.MouseEvent) => {
    e.stopPropagation();
    if (!confirm('Remove this title from your watched history?')) return;
    try {
      await api.removeWatched(titleId);
      setItems((prev) => prev.filter((it) => it.title_id !== titleId));
    } catch (err) {
      console.error('Failed to remove watched title', err);
    }
  };

  const filteredItems = useMemo(() => {
    return items.filter((item) => {
      if (typeFilter !== 'all' && item.title.type !== typeFilter) {
        return false;
      }
      if (ratingFilter === 'rated' && !item.rating) {
        return false;
      }
      if (ratingFilter === '5' && item.rating !== 5) {
        return false;
      }
      if (ratingFilter === '4' && item.rating !== 4) {
        return false;
      }
      if (ratingFilter === '3' && item.rating !== 3) {
        return false;
      }
      if (ratingFilter === 'low' && (item.rating === null || item.rating === undefined || item.rating > 2)) {
        return false;
      }
      return true;
    });
  }, [items, typeFilter, ratingFilter]);

  const ratedCount = items.filter((i) => i.rating !== null && i.rating !== undefined).length;
  const avgRating =
    ratedCount > 0
      ? (
          items.reduce((acc, curr) => acc + (curr.rating || 0), 0) / ratedCount
        ).toFixed(1)
      : '—';

  return (
    <div className="min-h-screen bg-obsidian-950 text-slate-100 py-10 px-4 sm:px-6 lg:px-8 max-w-7xl mx-auto space-y-8">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-6 border-b border-white/5">
        <div>
          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-compass-500/10 border border-compass-500/20 text-compass-400 text-xs font-semibold mb-2">
            <BookOpen className="w-3.5 h-3.5" />
            <span>Personal Archive</span>
          </div>
          <h1 className="text-3xl font-extrabold text-white tracking-tight">My Library</h1>
          <p className="text-sm text-slate-400 mt-1">
            Watched stories, personal ratings, and the building blocks of your taste profile.
          </p>
        </div>

        {/* Stats Badges */}
        <div className="flex items-center gap-4">
          <div className="px-4 py-2.5 rounded-2xl bg-obsidian-900 border border-white/10 text-center">
            <div className="text-xs text-slate-400">Total Watched</div>
            <div className="text-xl font-extrabold text-white">{items.length}</div>
          </div>
          <div className="px-4 py-2.5 rounded-2xl bg-obsidian-900 border border-white/10 text-center">
            <div className="text-xs text-slate-400">Rated Titles</div>
            <div className="text-xl font-extrabold text-compass-400">{ratedCount}</div>
          </div>
          <div className="px-4 py-2.5 rounded-2xl bg-obsidian-900 border border-white/10 text-center">
            <div className="text-xs text-slate-400">Avg Rating</div>
            <div className="text-xl font-extrabold text-amber-400 flex items-center justify-center gap-1">
              <span>{avgRating}</span>
              {avgRating !== '—' && <Star className="w-4 h-4 fill-amber-400" />}
            </div>
          </div>
        </div>
      </div>

      {/* Filter Bar */}
      <div className="flex flex-wrap items-center justify-between gap-4 p-4 rounded-2xl bg-obsidian-900 border border-white/10">
        {/* Type tabs */}
        <div className="flex items-center gap-1.5 p-1 rounded-xl bg-obsidian-950 border border-white/5 text-xs">
          <button
            onClick={() => setTypeFilter('all')}
            className={`px-3 py-1.5 rounded-lg font-medium transition-all cursor-pointer ${
              typeFilter === 'all'
                ? 'bg-compass-500 text-obsidian-950 font-bold'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            All Types
          </button>
          <button
            onClick={() => setTypeFilter('movie')}
            className={`flex items-center gap-1 px-3 py-1.5 rounded-lg font-medium transition-all cursor-pointer ${
              typeFilter === 'movie'
                ? 'bg-compass-500 text-obsidian-950 font-bold'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            <Film className="w-3.5 h-3.5" /> Movies
          </button>
          <button
            onClick={() => setTypeFilter('series')}
            className={`flex items-center gap-1 px-3 py-1.5 rounded-lg font-medium transition-all cursor-pointer ${
              typeFilter === 'series'
                ? 'bg-compass-500 text-obsidian-950 font-bold'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            <Tv className="w-3.5 h-3.5" /> Series
          </button>
        </div>

        {/* Rating filter dropdown */}
        <div className="flex items-center gap-2">
          <Filter className="w-4 h-4 text-slate-400" />
          <select
            value={ratingFilter}
            onChange={(e) => setRatingFilter(e.target.value)}
            className="bg-obsidian-950 text-slate-200 border border-white/10 rounded-xl px-3 py-1.5 text-xs focus:outline-none focus:border-compass-500"
          >
            <option value="all">All Ratings</option>
            <option value="5">5 Stars Only (Masterpieces)</option>
            <option value="4">4 Stars</option>
            <option value="3">3 Stars</option>
            <option value="low">1-2 Stars</option>
            <option value="rated">Rated Only</option>
          </select>
        </div>
      </div>

      {/* Content Grid */}
      {isLoading ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6">
          {[1, 2, 3, 4, 5, 6, 7, 8].map((i) => (
            <div key={i} className="h-80 rounded-2xl bg-obsidian-900 animate-pulse border border-white/5" />
          ))}
        </div>
      ) : filteredItems.length === 0 ? (
        <div className="text-center py-20 bg-obsidian-900/50 rounded-3xl border border-white/5 p-8">
          <div className="w-16 h-16 rounded-2xl bg-compass-500/10 border border-compass-500/20 text-compass-400 flex items-center justify-center mx-auto mb-4">
            <BookOpen className="w-8 h-8" />
          </div>
          <h3 className="text-lg font-bold text-white">No titles found</h3>
          <p className="text-xs text-slate-400 max-w-sm mx-auto mt-1">
            {items.length === 0
              ? "You haven't added any watched titles to your library yet. Rate films to begin tailoring your recommendations."
              : "No titles match the selected filter criteria."}
          </p>
          <div className="mt-6">
            <Link
              to="/search"
              className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-compass-500 text-obsidian-950 font-bold text-xs shadow-lg shadow-compass-500/20 hover:bg-compass-400 transition-all"
            >
              <Sparkles className="w-3.5 h-3.5" />
              <span>Explore Catalog</span>
            </Link>
          </div>
        </div>
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3 sm:gap-6">
          {filteredItems.map((item) => (
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
                    No Poster
                  </div>
                )}
                <div className="absolute inset-0 bg-gradient-to-t from-obsidian-950 via-transparent to-transparent opacity-80" />

                {/* Remove button */}
                <button
                  onClick={(e) => handleRemove(item.title_id, e)}
                  className="absolute top-3 right-3 p-1.5 rounded-lg bg-obsidian-950/80 text-slate-400 hover:text-red-400 border border-white/10 opacity-0 group-hover:opacity-100 transition-all cursor-pointer"
                  title="Remove from watched"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>

                {/* Type badge */}
                <div className="absolute top-3 left-3 px-2 py-0.5 rounded-md bg-obsidian-950/80 border border-white/10 text-[10px] font-bold text-slate-300 uppercase tracking-wider">
                  {item.title.type}
                </div>

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

              {/* Details and Rating */}
              <div className="p-4 flex-1 flex flex-col justify-between space-y-3">
                <div>
                  <h3 className="font-bold text-white text-sm truncate group-hover:text-compass-400 transition-colors">
                    {item.title.title}
                  </h3>
                  <p className="text-xs text-slate-400 mt-0.5 truncate">
                    Dir. {item.title.director || 'Unknown'}
                  </p>
                </div>

                <div className="pt-2 border-t border-white/5 space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] uppercase font-semibold text-slate-400">Rating</span>
                    {item.rating ? (
                      <span className="flex items-center gap-1 text-xs font-bold text-compass-400">
                        <Star className="w-3.5 h-3.5 fill-compass-400 text-compass-400" />
                        <span>{item.rating}.0★</span>
                      </span>
                    ) : (
                      <span className="text-[11px] text-slate-500">Unrated</span>
                    )}
                  </div>

                  {/* Rating reason chip if provided */}
                  {item.rating_reason && (
                    <div className="inline-block px-2 py-0.5 rounded-md bg-compass-500/10 border border-compass-500/20 text-[10px] text-compass-300 font-medium truncate max-w-full">
                      "{item.rating_reason}"
                    </div>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Title Details Modal */}
      <TitleDetailModal
        titleId={selectedTitleId}
        onClose={() => setSelectedTitleId(null)}
        onInteractionChange={fetchLibrary}
      />
    </div>
  );
};
