import { useState, useEffect } from 'react';
import { Search, Film, Tv, Star, X, SlidersHorizontal, Sparkles } from 'lucide-react';
import type { Title, Genre } from '../types';
import { api } from '../services/api';
import { TitleDetailModal } from '../components/TitleDetailModal';
import { FriendWatchedBadge } from '../components/FriendWatchedBadge';


export const SearchPage = () => {
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedType, setSelectedType] = useState<string>('all');
  const [selectedGenre, setSelectedGenre] = useState<string>('all');
  const [sortBy, setSortBy] = useState<'popularity' | 'rating' | 'newest'>('popularity');
  const [genres, setGenres] = useState<Genre[]>([]);
  const [results, setResults] = useState<Title[]>([]);
  const [totalCount, setTotalCount] = useState<number>(0);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [selectedTitleId, setSelectedTitleId] = useState<number | null>(null);

  // Load available genres
  useEffect(() => {
    api
      .getGenres()
      .then((data) => setGenres(data))
      .catch((err) => console.error('Failed to load genres', err));
  }, []);

  // Fetch search results whenever filters change (with debounce on text search)
  useEffect(() => {
    let isCancelled = false;
    setIsLoading(true);

    const timer = setTimeout(() => {
      api
        .searchTitles({
          q: searchTerm.trim() || undefined,
          type: selectedType !== 'all' ? selectedType : undefined,
          genre: selectedGenre !== 'all' ? selectedGenre : undefined,
          sort_by: sortBy,
          limit: 30,
        })
        .then((res) => {
          if (!isCancelled) {
            setResults(res.items);
            setTotalCount(res.total);
            setIsLoading(false);
          }
        })
        .catch((err) => {
          console.error('Search query failed', err);
          if (!isCancelled) setIsLoading(false);
        });
    }, 250);

    return () => {
      isCancelled = true;
      clearTimeout(timer);
    };
  }, [searchTerm, selectedType, selectedGenre, sortBy]);

  const clearFilters = () => {
    setSearchTerm('');
    setSelectedType('all');
    setSelectedGenre('all');
    setSortBy('popularity');
  };

  return (
    <div className="min-h-screen bg-obsidian-950 text-slate-100 py-8 px-4 sm:px-6 lg:px-8 max-w-7xl mx-auto space-y-8">
      {/* Title & Description */}
      <div>
        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-compass-500/10 border border-compass-500/20 text-compass-400 text-xs font-semibold mb-3">
          <Sparkles className="w-3.5 h-3.5" />
          <span>Catalog Discovery</span>
        </div>
        <h1 className="text-3xl sm:text-4xl font-extrabold text-white tracking-tight">
          Explore Movies & Series
        </h1>
        <p className="text-sm text-slate-400 mt-1">
          Search across titles, directors, cast members, and themes indexed in your compass catalog.
        </p>
      </div>

      {/* Search Input Bar */}
      <div className="relative">
        <Search className="w-5 h-5 text-slate-400 absolute left-4 top-1/2 -translate-y-1/2" />
        <input
          type="text"
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          placeholder="Search by title, director (Nolan, Bong Joon-ho), actor (DiCaprio, Zendaya), or plot..."
          className="w-full pl-12 pr-10 py-3.5 rounded-2xl bg-obsidian-900 border border-white/10 focus:border-compass-500 focus:ring-1 focus:ring-compass-500 text-sm text-white placeholder-slate-500 outline-none shadow-xl transition-all"
        />
        {searchTerm && (
          <button
            onClick={() => setSearchTerm('')}
            className="absolute right-4 top-1/2 -translate-y-1/2 p-1 text-slate-400 hover:text-white rounded-full hover:bg-white/10 cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        )}
      </div>

      {/* Filter Controls Row */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-4 border-b border-white/5">
        {/* Type selector (All / Movies / Series) */}
        <div className="flex items-center gap-1.5 p-1 rounded-xl bg-obsidian-900 border border-white/10 w-fit">
          <button
            onClick={() => setSelectedType('all')}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
              selectedType === 'all'
                ? 'bg-compass-500 text-obsidian-950 shadow-sm'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            All Formats
          </button>
          <button
            onClick={() => setSelectedType('movie')}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
              selectedType === 'movie'
                ? 'bg-compass-500 text-obsidian-950 shadow-sm'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <Film className="w-3 h-3" />
            Movies
          </button>
          <button
            onClick={() => setSelectedType('series')}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
              selectedType === 'series'
                ? 'bg-compass-500 text-obsidian-950 shadow-sm'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <Tv className="w-3 h-3" />
            TV Series
          </button>
        </div>

        {/* Right filters: Genre & Sort */}
        <div className="flex items-center gap-3">
          {/* Genre select */}
          <div className="relative">
            <select
              value={selectedGenre}
              onChange={(e) => setSelectedGenre(e.target.value)}
              className="px-3.5 py-2 rounded-xl bg-obsidian-900 border border-white/10 text-xs text-slate-200 focus:border-compass-500 outline-none cursor-pointer"
            >
              <option value="all">All Genres</option>
              {genres.map((g) => (
                <option key={g.id} value={g.name}>
                  {g.name}
                </option>
              ))}
            </select>
          </div>

          {/* Sort selector */}
          <div className="relative flex items-center gap-1.5 text-xs text-slate-400">
            <SlidersHorizontal className="w-3.5 h-3.5" />
            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value as any)}
              className="px-3 py-2 rounded-xl bg-obsidian-900 border border-white/10 text-xs text-slate-200 focus:border-compass-500 outline-none cursor-pointer"
            >
              <option value="popularity">Most Popular</option>
              <option value="rating">Highest Rated</option>
              <option value="newest">Release Date</option>
            </select>
          </div>
        </div>
      </div>

      {/* Result Status Counter */}
      <div className="flex items-center justify-between text-xs text-slate-400">
        <div>
          Found <span className="font-bold text-white">{totalCount}</span> titles
          {searchTerm && (
            <span>
              {' '}
              matching &ldquo;<span className="text-compass-400">{searchTerm}</span>&rdquo;
            </span>
          )}
        </div>
        {(searchTerm || selectedType !== 'all' || selectedGenre !== 'all') && (
          <button
            onClick={clearFilters}
            className="text-compass-400 hover:text-compass-300 font-medium cursor-pointer"
          >
            Reset Filters
          </button>
        )}
      </div>

      {/* Results Grid */}
      {isLoading ? (
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-6">
          {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map((i) => (
            <div key={i} className="h-80 rounded-2xl bg-obsidian-900 animate-pulse border border-white/5" />
          ))}
        </div>
      ) : results.length > 0 ? (
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-6">
          {results.map((title) => (
            <div
              key={title.id}
              onClick={() => setSelectedTitleId(title.id)}
              className="group cursor-pointer rounded-2xl overflow-hidden bg-obsidian-900 border border-white/10 hover:border-compass-500/50 transition-all hover:shadow-xl hover:shadow-compass-500/10 flex flex-col card-hover-subtle"
            >
              {/* Poster Frame */}
              <div className="aspect-[2/3] w-full relative overflow-hidden bg-obsidian-850">
                {title.poster_path ? (
                  <img
                    src={title.poster_path}
                    alt={title.title}
                    className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                  />
                ) : (
                  <div className="w-full h-full flex items-center justify-center text-slate-600 text-xs">
                    No Poster
                  </div>
                )}
                <div className="absolute inset-0 bg-gradient-to-t from-obsidian-950 via-transparent to-transparent opacity-80" />

                {/* Type Badge */}
                <div className="absolute top-2.5 left-2.5 px-2 py-0.5 rounded-md bg-obsidian-950/80 backdrop-blur-sm border border-white/10 text-[10px] uppercase font-bold text-compass-400">
                  {title.type}
                </div>

                {/* Rating Badge */}
                <div className="absolute top-2.5 right-2.5 px-2 py-0.5 rounded-md bg-obsidian-950/80 backdrop-blur-sm border border-white/10 flex items-center gap-1 text-[11px] font-bold text-amber-400">
                  <Star className="w-3 h-3 fill-amber-400" />
                  <span>{title.vote_average.toFixed(1)}</span>
                </div>
              </div>

              {/* Card Meta */}
              <div className="p-3.5 flex-1 flex flex-col justify-between">
                <div>
                  <h3
                    className="font-bold text-white text-sm truncate group-hover:text-compass-400 transition-colors"
                    title={title.title}
                  >
                    {title.title}
                  </h3>
                  <div className="flex items-center gap-2 text-[11px] text-slate-400 mt-1">
                    <span>{title.release_date?.slice(0, 4)}</span>
                    {title.runtime_minutes && (
                      <>
                        <span>•</span>
                        <span>{title.runtime_minutes}m</span>
                      </>
                    )}
                  </div>
                </div>

                <div className="flex flex-wrap gap-1 mt-2.5">
                  {title.genres.slice(0, 2).map((g) => (
                    <span
                      key={g.id}
                      className="text-[10px] px-1.5 py-0.5 rounded bg-white/5 text-slate-300 border border-white/5"
                    >
                      {g.name}
                    </span>
                  ))}
                </div>

                {/* Watched by Friend Badge */}
                <div className="mt-2">
                  <FriendWatchedBadge titleId={title.id} compact />
                </div>
              </div>
            </div>

          ))}
        </div>
      ) : (
        <div className="py-20 text-center rounded-3xl bg-obsidian-900/40 border border-white/5 p-8">
          <Film className="w-12 h-12 text-slate-600 mx-auto mb-3" />
          <h3 className="text-base font-bold text-white">No matching titles found</h3>
          <p className="text-xs text-slate-400 mt-1 max-w-sm mx-auto">
            Try adjusting your keyword or clearing selected format and genre filters.
          </p>
          <button
            onClick={clearFilters}
            className="mt-4 px-4 py-2 rounded-xl text-xs font-bold bg-compass-500 text-obsidian-950 hover:bg-compass-400 transition-colors cursor-pointer"
          >
            Clear All Filters
          </button>
        </div>
      )}

      {/* Title Details Modal */}
      <TitleDetailModal
        titleId={selectedTitleId}
        onClose={() => setSelectedTitleId(null)}
        onSelectTitle={(id) => setSelectedTitleId(id)}
      />
    </div>
  );
};
