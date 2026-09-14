import React, { useEffect, useState, useCallback } from 'react';
import { Compass, Sparkles, Star, Check, Plus, Clock, Sliders, ChevronRight, Zap } from 'lucide-react';
import { Link } from 'react-router-dom';
import type { Title, RecommendationItem } from '../types';
import { api } from '../services/api';
import { useAuth } from '../context/AuthContext';
import { TitleDetailModal } from '../components/TitleDetailModal';

export const HomePage: React.FC = () => {
  const { user } = useAuth();
  const [starterTitles, setStarterTitles] = useState<Title[]>([]);
  const [recommendations, setRecommendations] = useState<RecommendationItem[]>([]);
  const [ratings, setRatings] = useState<Record<number, number>>({});
  const [watchlist, setWatchlist] = useState<Record<number, boolean>>({});
  const [isLoading, setIsLoading] = useState(true);
  const [isRecsLoading, setIsRecsLoading] = useState(true);
  const [selectedTitleId, setSelectedTitleId] = useState<number | null>(null);

  const loadUserData = useCallback(async () => {
    try {
      const [watchedData, watchlistData] = await Promise.all([
        api.getWatched(),
        api.getWatchlist(),
      ]);

      const ratingMap: Record<number, number> = {};
      watchedData.forEach((item) => {
        if (item.rating) {
          ratingMap[item.title_id] = item.rating;
        }
      });
      setRatings(ratingMap);

      const wlMap: Record<number, boolean> = {};
      watchlistData.forEach((item) => {
        wlMap[item.title_id] = true;
      });
      setWatchlist(wlMap);
    } catch (err) {
      console.error('Failed to load user interaction data', err);
    }
  }, []);

  const loadRecommendations = useCallback(async () => {
    try {
      setIsRecsLoading(true);
      const recs = await api.getRecommendations(8);
      setRecommendations(recs);
    } catch (err) {
      console.error('Failed to load recommendations', err);
    } finally {
      setIsRecsLoading(false);
    }
  }, []);

  useEffect(() => {
    const init = async () => {
      setIsLoading(true);
      try {
        const titles = await api.getStarterTitles(8);
        setStarterTitles(titles);
      } catch (err) {
        console.error('Failed to load starter titles', err);
      } finally {
        setIsLoading(false);
      }

      await loadUserData();
      await loadRecommendations();
    };

    init();
  }, [loadUserData, loadRecommendations]);

  const handleRate = async (titleId: number, score: number) => {
    const currentScore = ratings[titleId] || 0;
    const newScore = currentScore === score ? 0 : score;

    // Optimistic UI update
    setRatings((prev) => ({
      ...prev,
      [titleId]: newScore,
    }));

    try {
      if (newScore === 0) {
        await api.rateTitle({ title_id: titleId, rating: null, watched: true });
      } else {
        await api.rateTitle({ title_id: titleId, rating: newScore, watched: true });
      }
      // Refresh recommendations to reflect updated taste weights
      loadRecommendations();
    } catch (err) {
      console.error('Failed to submit rating', err);
    }
  };

  const handleToggleWatchlist = async (titleId: number) => {
    const isSaved = watchlist[titleId] || false;
    setWatchlist((prev) => ({
      ...prev,
      [titleId]: !isSaved,
    }));

    try {
      await api.toggleWatchlist({ title_id: titleId });
    } catch (err) {
      console.error('Failed to toggle watchlist', err);
    }
  };

  const ratedCount = Object.values(ratings).filter((score) => score > 0).length;
  const targetRatings = 5;
  const progressPct = Math.min(100, Math.round((ratedCount / targetRatings) * 100));

  return (
    <div className="min-h-screen bg-obsidian-950 text-slate-100 py-10 px-4 sm:px-6 lg:px-8 max-w-7xl mx-auto space-y-12">
      {/* Top Welcome / Status Hero */}
      <div className="relative overflow-hidden rounded-3xl bg-gradient-to-r from-obsidian-900 via-obsidian-850 to-obsidian-900 border border-white/10 p-6 sm:p-10 shadow-2xl">
        <div className="absolute top-0 right-0 w-80 h-80 bg-compass-500/10 rounded-full blur-3xl pointer-events-none" />

        <div className="max-w-3xl">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-compass-500/10 border border-compass-500/20 text-compass-400 text-xs font-semibold mb-4">
            <Compass className="w-3.5 h-3.5" />
            <span>Taste Engine Active</span>
          </div>

          <h1 className="text-3xl sm:text-4xl font-extrabold text-white tracking-tight">
            Welcome back, <span className="text-compass-400">{user?.username}</span>.
          </h1>
          <p className="mt-2 text-slate-400 text-sm sm:text-base leading-relaxed">
            {ratedCount >= targetRatings || user?.onboarding_completed
              ? 'Stream Compass has calibrated your individual movie DNA. Explore your custom recommendations below or find your next watch with the Decision Engine.'
              : 'Stream Compass is calibrating your individual movie DNA. Rate titles below to sharpen your recommendation precision and eliminate decision paralysis.'}
          </p>

          {/* Progress bar - only visible during calibration */}
          {ratedCount < targetRatings && !user?.onboarding_completed && (
            <div className="mt-6 pt-6 border-t border-white/5 max-w-xl">
              <div className="flex items-center justify-between text-xs font-medium mb-2">
                <span className="text-slate-300">Cold-Start Calibration</span>
                <span className="text-compass-400 font-bold">
                  {ratedCount} of {targetRatings} titles rated ({progressPct}%)
                </span>
              </div>
              <div className="w-full h-2.5 rounded-full bg-obsidian-950 border border-white/10 overflow-hidden">
                <div
                  className="h-full bg-gradient-to-r from-compass-500 to-compass-400 transition-all duration-500 rounded-full"
                  style={{ width: `${progressPct}%` }}
                />
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Recommendations Feed (PRD Phase 3: Content-Based Recommendations with Explainability) */}
      <section className="space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
          <div>
            <div className="flex items-center gap-2">
              <span className="p-1 rounded-lg bg-compass-500/20 text-compass-400">
                <Zap className="w-4 h-4" />
              </span>
              <h2 className="text-xl font-bold text-white tracking-tight">
                Recommended For You
              </h2>
            </div>
            <p className="text-xs text-slate-400 mt-1">
              Personalized selections dynamically scored against your ratings with explainable rationale.
            </p>
          </div>

          <Link
            to="/profile"
            className="text-xs font-semibold text-compass-400 hover:text-compass-300 flex items-center gap-1 transition-colors self-start sm:self-auto"
          >
            <span>View Taste DNA</span>
            <ChevronRight className="w-3.5 h-3.5" />
          </Link>
        </div>

        {isRecsLoading ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-6">
            {[1, 2, 3, 4].map((i) => (
              <div key={i} className="h-84 rounded-2xl bg-obsidian-900 animate-pulse border border-white/5" />
            ))}
          </div>
        ) : recommendations.length === 0 ? (
          <div className="p-8 rounded-2xl bg-obsidian-900/50 border border-white/5 text-center text-slate-400 text-xs">
            No unwatched recommendations found at this time.
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-6">
            {recommendations.map((rec) => {
              const inWl = watchlist[rec.title.id] || false;
              const currentRating = ratings[rec.title.id] || 0;

              return (
                <div
                  key={rec.title.id}
                  className="rounded-2xl overflow-hidden bg-obsidian-900 border border-white/10 hover:border-compass-500/50 transition-all flex flex-col shadow-lg group"
                >
                  {/* Poster */}
                  <div
                    onClick={() => setSelectedTitleId(rec.title.id)}
                    className="aspect-[2/3] w-full relative overflow-hidden bg-obsidian-850 cursor-pointer"
                  >
                    {rec.title.poster_path ? (
                      <img
                        src={rec.title.poster_path}
                        alt={rec.title.title}
                        className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                      />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center text-slate-600 text-xs">
                        No Poster
                      </div>
                    )}
                    <div className="absolute inset-0 bg-gradient-to-t from-obsidian-950 via-transparent to-transparent opacity-85" />

                    {/* Quick Watchlist Toggle */}
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        handleToggleWatchlist(rec.title.id);
                      }}
                      className={`absolute top-3 left-3 p-1.5 rounded-lg backdrop-blur-md border text-xs transition-all cursor-pointer ${
                        inWl
                          ? 'bg-compass-500 text-obsidian-950 border-compass-400 font-bold'
                          : 'bg-obsidian-950/70 text-slate-300 border-white/10 hover:text-white'
                      }`}
                      title={inWl ? 'In Watchlist' : 'Add to Watchlist'}
                    >
                      {inWl ? <Check className="w-3.5 h-3.5 stroke-[3]" /> : <Plus className="w-3.5 h-3.5" />}
                    </button>

                    {/* TMDB Rating */}
                    <div className="absolute top-3 right-3 bg-obsidian-950/80 backdrop-blur-md px-2 py-1 rounded-md border border-white/10 flex items-center gap-1 text-xs font-bold text-amber-400">
                      <Star className="w-3 h-3 fill-amber-400" />
                      <span>{rec.title.vote_average.toFixed(1)}</span>
                    </div>

                    {/* Runtime & Year */}
                    <div className="absolute bottom-2 left-3 right-3 flex items-center justify-between text-[11px] text-slate-400">
                      <span>{rec.title.release_date?.slice(0, 4)}</span>
                      {rec.title.runtime_minutes && (
                        <span className="flex items-center gap-1">
                          <Clock className="w-3 h-3" />
                          {rec.title.runtime_minutes}m
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Body & Explainability Reason */}
                  <div className="p-4 flex-1 flex flex-col justify-between space-y-3">
                    <div>
                      <h3
                        onClick={() => setSelectedTitleId(rec.title.id)}
                        className="font-bold text-white text-sm truncate hover:text-compass-400 transition-colors cursor-pointer"
                        title={rec.title.title}
                      >
                        {rec.title.title}
                      </h3>
                      <p className="text-xs text-slate-400 mt-0.5 truncate">
                        Dir. {rec.title.director || 'Unknown'}
                      </p>

                      {/* Evidence-based Explainability Badge (PRD Section 6) */}
                      <div className="mt-2.5 p-2 rounded-xl bg-compass-500/10 border border-compass-500/20 text-compass-300 text-[11px] leading-snug flex items-start gap-1.5">
                        <Sparkles className="w-3.5 h-3.5 text-compass-400 shrink-0 mt-0.5" />
                        <span className="line-clamp-2">{rec.explanation}</span>
                      </div>
                    </div>

                    {/* Interactive Star Rating */}
                    <div className="pt-2 border-t border-white/5">
                      <div className="flex items-center justify-between bg-obsidian-950 px-2 py-1.5 rounded-xl border border-white/5">
                        {[1, 2, 3, 4, 5].map((star) => (
                          <button
                            key={star}
                            onClick={() => handleRate(rec.title.id, star)}
                            className="p-1 hover:scale-125 transition-transform cursor-pointer"
                            title={`Rate ${star} star${star > 1 ? 's' : ''}`}
                          >
                            <Star
                              className={`w-3.5 h-3.5 transition-colors ${
                                star <= currentRating
                                  ? 'fill-compass-400 text-compass-400'
                                  : 'text-slate-600 hover:text-slate-400'
                              }`}
                            />
                          </button>
                        ))}
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </section>

      {/* Decision Engine Trigger Banner */}
      <div className="rounded-2xl bg-gradient-to-br from-obsidian-900 to-obsidian-850 border border-compass-500/30 p-6 flex flex-col md:flex-row items-start md:items-center justify-between gap-6 shadow-xl">
        <div className="flex items-start gap-4">
          <div className="w-12 h-12 rounded-xl bg-compass-500/15 border border-compass-500/30 flex items-center justify-center text-compass-400 shrink-0">
            <Sparkles className="w-6 h-6" />
          </div>
          <div>
            <div className="text-xs uppercase font-bold tracking-wider text-compass-400">Core Decision Engine</div>
            <h2 className="text-xl font-bold text-white mt-0.5">What Should I Watch?</h2>
            <p className="text-xs sm:text-sm text-slate-400 mt-1 max-w-xl">
              Tell the engine your available time, current mood, and viewing situation to get your Best Match, Safe Choice, and Wildcard.
            </p>
          </div>
        </div>

        <Link
          to="/decision"
          className="inline-flex items-center gap-2 px-5 py-3 rounded-xl font-bold text-sm text-obsidian-950 bg-gradient-to-r from-compass-400 to-compass-500 hover:from-compass-300 hover:to-compass-400 shadow-lg shadow-compass-500/20 transition-all shrink-0 cursor-pointer"
        >
          <Sliders className="w-4 h-4" />
          <span>Launch Decision</span>
          <ChevronRight className="w-4 h-4" />
        </Link>
      </div>

      {/* Cold Start Movie Rating Cards */}
      <section className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-xl font-bold text-white tracking-tight">
              Calibrate with Curated Masterworks
            </h2>
            <p className="text-xs text-slate-400 mt-0.5">
              Click the stars to rate titles you've seen (1-5), or save them to your watchlist.
            </p>
          </div>
        </div>

        {isLoading ? (
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-6">
            {[1, 2, 3, 4, 5, 6, 7, 8].map((i) => (
              <div key={i} className="h-80 rounded-2xl bg-obsidian-900 animate-pulse border border-white/5" />
            ))}
          </div>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-2 md:grid-cols-4 gap-3 sm:gap-6">
            {starterTitles.map((title) => {
              const currentRating = ratings[title.id] || 0;
              const inWl = watchlist[title.id] || false;

              return (
                <div
                  key={title.id}
                  className="rounded-2xl overflow-hidden bg-obsidian-900 border border-white/10 hover:border-white/20 transition-all flex flex-col shadow-lg card-hover-subtle"
                >
                  {/* Poster Image */}
                  <div
                    onClick={() => setSelectedTitleId(title.id)}
                    className="aspect-[2/3] w-full relative overflow-hidden bg-obsidian-850 cursor-pointer group"
                  >
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
                    <div className="absolute inset-0 bg-gradient-to-t from-obsidian-950 via-transparent to-transparent opacity-90" />

                    {/* Quick Watchlist Toggle */}
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        handleToggleWatchlist(title.id);
                      }}
                      className={`absolute top-3 left-3 p-1.5 rounded-lg backdrop-blur-md border text-xs transition-all cursor-pointer ${
                        inWl
                          ? 'bg-compass-500 text-obsidian-950 border-compass-400 font-bold'
                          : 'bg-obsidian-950/70 text-slate-300 border-white/10 hover:text-white'
                      }`}
                      title={inWl ? 'In Watchlist' : 'Add to Watchlist'}
                    >
                      {inWl ? <Check className="w-3.5 h-3.5 stroke-[3]" /> : <Plus className="w-3.5 h-3.5" />}
                    </button>

                    {/* TMDB Rating */}
                    <div className="absolute top-3 right-3 bg-obsidian-950/80 backdrop-blur-md px-2 py-1 rounded-md border border-white/10 flex items-center gap-1 text-xs font-bold text-amber-400">
                      <Star className="w-3 h-3 fill-amber-400" />
                      <span>{title.vote_average.toFixed(1)}</span>
                    </div>

                    {/* Runtime & Year at bottom of poster */}
                    <div className="absolute bottom-2 left-3 right-3 flex items-center justify-between text-[11px] text-slate-400">
                      <span>{title.release_date?.slice(0, 4)}</span>
                      {title.runtime_minutes && (
                        <span className="flex items-center gap-1">
                          <Clock className="w-3 h-3" />
                          {title.runtime_minutes}m
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Metadata and Rating Controls */}
                  <div className="p-4 flex-1 flex flex-col justify-between">
                    <div>
                      <h3
                        onClick={() => setSelectedTitleId(title.id)}
                        className="font-bold text-white text-sm truncate hover:text-compass-400 transition-colors cursor-pointer"
                        title={title.title}
                      >
                        {title.title}
                      </h3>
                      <p className="text-xs text-slate-400 mt-0.5 truncate">
                        Dir. {title.director || 'Unknown'}
                      </p>

                      <div className="flex flex-wrap gap-1 mt-2">
                        {title.genres.map((g) => (
                          <span
                            key={g.id}
                            className="text-[10px] px-1.5 py-0.5 rounded bg-white/5 text-slate-300 border border-white/5"
                          >
                            {g.name}
                          </span>
                        ))}
                      </div>
                    </div>

                    {/* Interactive 5-star rating */}
                    <div className="mt-4 pt-3 border-t border-white/5">
                      <div className="flex items-center justify-between mb-1.5">
                        <span className="text-[10px] uppercase font-semibold text-slate-400">Your Rating</span>
                        <span className="text-xs font-bold text-compass-400">
                          {currentRating > 0 ? `${currentRating} ★` : 'Not Rated'}
                        </span>
                      </div>
                      <div className="flex items-center justify-between bg-obsidian-950 px-2 py-1.5 rounded-xl border border-white/5">
                        {[1, 2, 3, 4, 5].map((star) => (
                          <button
                            key={star}
                            onClick={() => handleRate(title.id, star)}
                            className="p-1 hover:scale-125 transition-transform cursor-pointer"
                            title={`Rate ${star} star${star > 1 ? 's' : ''}`}
                          >
                            <Star
                              className={`w-4 h-4 transition-colors ${
                                star <= currentRating
                                  ? 'fill-compass-400 text-compass-400'
                                  : 'text-slate-600 hover:text-slate-400'
                              }`}
                            />
                          </button>
                        ))}
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </section>

      {/* Title Details Modal */}
      <TitleDetailModal
        titleId={selectedTitleId}
        onClose={() => setSelectedTitleId(null)}
        onSelectTitle={(id) => setSelectedTitleId(id)}
        onInteractionChange={() => {
          loadUserData();
          loadRecommendations();
        }}
      />
    </div>
  );
};
