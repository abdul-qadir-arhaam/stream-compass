import React, { useEffect, useState } from 'react';
import { Compass, Star, Film, Award, BarChart3, Clock, ChevronRight } from 'lucide-react';
import { Link } from 'react-router-dom';
import type { TasteProfile } from '../types';
import { api } from '../services/api';
import { TitleDetailModal } from '../components/TitleDetailModal';

import { useAuth } from '../context/AuthContext';

export const TasteProfilePage: React.FC = () => {
  const { user } = useAuth();
  const [profile, setProfile] = useState<TasteProfile | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [selectedTitleId, setSelectedTitleId] = useState<number | null>(null);

  const fetchProfile = async () => {
    if (!user) {
      setProfile(null);
      setIsLoading(false);
      return;
    }
    try {
      setIsLoading(true);
      const data = await api.getTasteProfile();
      setProfile(data);
    } catch (err) {
      console.error('Failed to load taste profile', err);
      setProfile(null);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchProfile();
  }, [user?.id]);

  const totalGenrePoints =
    profile?.favorite_genres.reduce((acc, curr) => acc + curr.count, 0) || 1;

  return (
    <div className="min-h-screen bg-obsidian-950 text-slate-100 py-10 px-4 sm:px-6 lg:px-8 max-w-7xl mx-auto space-y-10">
      {/* Header */}
      <div className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-obsidian-900 via-obsidian-850 to-obsidian-900 border border-white/10 p-6 sm:p-10 shadow-2xl">
        <div className="absolute top-0 right-0 w-96 h-96 bg-compass-500/10 rounded-full blur-3xl pointer-events-none" />

        <div className="max-w-3xl">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-compass-500/10 border border-compass-500/20 text-compass-400 text-xs font-semibold mb-4">
            <Compass className="w-3.5 h-3.5" />
            <span>Taste Signature V2</span>
          </div>

          <h1 className="text-3xl sm:text-4xl font-extrabold text-white tracking-tight">
            Your Cinematic DNA
          </h1>
          <p className="mt-2 text-slate-400 text-sm sm:text-base leading-relaxed">
            Every rating and reason you record tunes our recommendation vectors. Here is the mathematical profile driving your personalized recommendations.
          </p>
        </div>

        {/* Metrics Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mt-8 pt-8 border-t border-white/5 max-w-2xl">
          <div className="p-4 rounded-2xl bg-obsidian-950/70 border border-white/5">
            <span className="text-xs text-slate-400">Total Watched</span>
            <div className="text-2xl font-extrabold text-white mt-1">
              {profile?.total_watched || 0}
            </div>
          </div>
          <div className="p-4 rounded-2xl bg-obsidian-950/70 border border-white/5">
            <span className="text-xs text-slate-400">Rated Titles</span>
            <div className="text-2xl font-extrabold text-compass-400 mt-1">
              {profile?.total_rated || 0}
            </div>
          </div>
          <div className="p-4 rounded-2xl bg-obsidian-950/70 border border-white/5">
            <span className="text-xs text-slate-400">Mean Rating Score</span>
            <div className="text-2xl font-extrabold text-amber-400 flex items-center gap-1 mt-1">
              <span>{profile?.average_rating ? profile.average_rating.toFixed(1) : '—'}</span>
              {profile && profile.total_rated > 0 && <Star className="w-5 h-5 fill-amber-400" />}
            </div>
          </div>
        </div>
      </div>

      {isLoading ? (
        <div className="space-y-6">
          <div className="h-48 rounded-2xl bg-obsidian-900 animate-pulse border border-white/5" />
          <div className="h-64 rounded-2xl bg-obsidian-900 animate-pulse border border-white/5" />
        </div>
      ) : profile && profile.total_rated === 0 ? (
        <div className="text-center py-16 bg-obsidian-900/40 rounded-3xl border border-white/5 p-8">
          <div className="w-14 h-14 rounded-2xl bg-compass-500/10 border border-compass-500/20 text-compass-400 flex items-center justify-center mx-auto mb-4">
            <BarChart3 className="w-7 h-7" />
          </div>
          <h3 className="text-lg font-bold text-white">Cold-Start State: No Ratings Yet</h3>
          <p className="text-xs text-slate-400 max-w-md mx-auto mt-1">
            Rate at least 3-5 titles in the cold-start feed or catalog to unlock detailed genre resonance graphs and personalized recommendation vectors.
          </p>
          <div className="mt-6">
            <Link
              to="/home"
              className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-compass-500 text-obsidian-950 font-bold text-xs shadow-lg shadow-compass-500/20 hover:bg-compass-400 transition-all"
            >
              <span>Calibrate Taste Now</span>
              <ChevronRight className="w-4 h-4" />
            </Link>
          </div>
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          {/* Favorite Genres Breakdown */}
          <div className="rounded-3xl bg-obsidian-900 border border-white/10 p-6 sm:p-8 space-y-6 shadow-xl">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-lg font-bold text-white flex items-center gap-2">
                  <BarChart3 className="w-5 h-5 text-compass-400" />
                  <span>Genre Resonance Spectrum</span>
                </h3>
                <p className="text-xs text-slate-400 mt-1">
                  Derived from titles you've rated 4.0 stars or higher.
                </p>
              </div>
            </div>

            <div className="space-y-4">
              {profile?.favorite_genres.map((fg, index) => {
                const percentage = Math.round((fg.count / totalGenrePoints) * 100);
                return (
                  <div key={fg.genre} className="space-y-1.5">
                    <div className="flex items-center justify-between text-xs">
                      <span className="font-semibold text-white flex items-center gap-2">
                        <span className="w-5 h-5 rounded-md bg-compass-500/20 text-compass-400 flex items-center justify-center text-[10px] font-bold">
                          #{index + 1}
                        </span>
                        {fg.genre}
                      </span>
                      <span className="text-slate-400">
                        {fg.count} highly-rated {fg.count === 1 ? 'title' : 'titles'} ({percentage}%)
                      </span>
                    </div>
                    <div className="w-full h-2 rounded-full bg-obsidian-950 overflow-hidden border border-white/5">
                      <div
                        className="h-full bg-gradient-to-r from-compass-500 to-compass-400 rounded-full transition-all duration-500"
                        style={{ width: `${percentage}%` }}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Hall of Fame: Top Rated Titles */}
          <div className="rounded-3xl bg-obsidian-900 border border-white/10 p-6 sm:p-8 space-y-6 shadow-xl">
            <div>
              <h3 className="text-lg font-bold text-white flex items-center gap-2">
                <Award className="w-5 h-5 text-amber-400" />
                <span>Highest Rated Masterworks</span>
              </h3>
              <p className="text-xs text-slate-400 mt-1">
                Your highest scored titles actively serving as anchors for similarity matching.
              </p>
            </div>

            <div className="space-y-3">
              {profile?.top_rated_titles.map((title) => (
                <div
                  key={title.id}
                  onClick={() => setSelectedTitleId(title.id)}
                  className="group cursor-pointer flex items-center gap-4 p-3 rounded-2xl bg-obsidian-950/60 border border-white/5 hover:border-compass-500/40 transition-all"
                >
                  <div className="w-12 h-16 rounded-lg overflow-hidden bg-obsidian-850 shrink-0 relative">
                    {title.poster_path ? (
                      <img
                        src={title.poster_path}
                        alt={title.title}
                        className="w-full h-full object-cover group-hover:scale-105 transition-transform"
                      />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center text-slate-700">
                        <Film className="w-4 h-4" />
                      </div>
                    )}
                  </div>

                  <div className="flex-1 min-w-0">
                    <h4 className="font-bold text-white text-sm truncate group-hover:text-compass-400 transition-colors">
                      {title.title}
                    </h4>
                    <div className="flex items-center gap-3 text-xs text-slate-400 mt-0.5">
                      <span>{title.release_date?.slice(0, 4)}</span>
                      {title.runtime_minutes && (
                        <span className="flex items-center gap-1">
                          <Clock className="w-3 h-3 text-compass-500" />
                          {title.runtime_minutes}m
                        </span>
                      )}
                      <span>Dir. {title.director || 'Unknown'}</span>
                    </div>
                  </div>

                  <div className="flex items-center gap-1 px-2.5 py-1 rounded-lg bg-obsidian-900 border border-white/10 text-xs font-bold text-amber-400">
                    <Star className="w-3.5 h-3.5 fill-amber-400" />
                    <span>{title.vote_average.toFixed(1)}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Title Details Modal */}
      <TitleDetailModal
        titleId={selectedTitleId}
        onClose={() => setSelectedTitleId(null)}
        onInteractionChange={fetchProfile}
      />
    </div>
  );
};
