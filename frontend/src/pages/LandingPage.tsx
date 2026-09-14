import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Compass, Sparkles, Flame, Shield, Dna, ArrowRight, Star } from 'lucide-react';
import type { Title } from '../types';
import { api } from '../services/api';
import { useAuth } from '../context/AuthContext';
import { TitleDetailModal } from '../components/TitleDetailModal';

export const LandingPage: React.FC = () => {
  const { user } = useAuth();
  const [featuredTitles, setFeaturedTitles] = useState<Title[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [selectedTitleId, setSelectedTitleId] = useState<number | null>(null);

  useEffect(() => {
    const loadTitles = async () => {
      try {
        const titles = await api.getStarterTitles(4);
        setFeaturedTitles(titles);
      } catch (err) {
        console.error('Failed to load starter titles', err);
      } finally {
        setIsLoading(false);
      }
    };
    loadTitles();
  }, []);

  return (
    <div className="min-h-screen bg-obsidian-950 text-slate-100 selection:bg-compass-500 selection:text-obsidian-950">
      {/* Background glow accents */}
      <div className="absolute top-0 left-1/2 -translate-x-1/2 w-full max-w-7xl h-96 bg-compass-500/5 blur-[120px] pointer-events-none -z-10 rounded-full" />

      {/* Hero Section */}
      <section className="relative pt-20 pb-16 px-4 sm:px-6 lg:px-8 max-w-7xl mx-auto text-center">
        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-obsidian-800 border border-compass-500/30 text-compass-300 text-xs font-semibold mb-8 animate-pulse">
          <Sparkles className="w-3.5 h-3.5" />
          <span>Stop Scrolling. Start Watching.</span>
        </div>

        <h1 className="text-4xl sm:text-6xl lg:text-7xl font-extrabold tracking-tight text-white max-w-4xl mx-auto leading-[1.1]">
          The intelligent compass for your{' '}
          <span className="bg-gradient-to-r from-compass-300 via-compass-400 to-compass-500 bg-clip-text text-transparent">
            next watch.
          </span>
        </h1>

        <p className="mt-6 text-lg sm:text-xl text-slate-400 max-w-2xl mx-auto leading-relaxed">
          Not another endless library catalog. Stream Compass understands your mood, available time, and distinct taste profile to deliver the 3 exact titles you actually want to watch.
        </p>

        <div className="mt-10 flex flex-col sm:flex-row items-center justify-center gap-4">
          <Link
            to={user ? "/home" : "/signup"}
            className="w-full sm:w-auto inline-flex items-center justify-center gap-2.5 px-7 py-3.5 rounded-xl font-bold text-obsidian-950 bg-gradient-to-r from-compass-400 to-compass-500 hover:from-compass-300 hover:to-compass-400 shadow-xl shadow-compass-500/25 transition-all transform hover:-translate-y-0.5"
          >
            <Compass className="w-5 h-5 text-obsidian-950 stroke-[2.2]" />
            <span>{user ? "Go to My Compass" : "Calibrate Your Taste"}</span>
            <ArrowRight className="w-4 h-4" />
          </Link>

          <a
            href="#philosophy"
            className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-6 py-3.5 rounded-xl font-medium text-slate-300 bg-obsidian-900 border border-white/10 hover:border-white/20 hover:text-white transition-all"
          >
            How it Decides
          </a>
        </div>
      </section>

      {/* Decision Engine Triad Philosophy */}
      <section id="philosophy" className="py-16 px-4 sm:px-6 lg:px-8 max-w-7xl mx-auto border-t border-white/5">
        <div className="text-center mb-12">
          <h2 className="text-xs uppercase tracking-widest text-compass-400 font-semibold mb-2">
            The Stream Compass Triad
          </h2>
          <p className="text-2xl sm:text-3xl font-bold text-white">
            Three focused choices. Always explained.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {/* Best Match */}
          <div className="relative p-6 rounded-2xl bg-obsidian-900/60 border border-compass-500/30 hover:border-compass-500/60 transition-all group">
            <div className="w-12 h-12 rounded-xl bg-compass-500/10 text-compass-400 flex items-center justify-center mb-4 group-hover:scale-110 transition-transform">
              <Dna className="w-6 h-6" />
            </div>
            <div className="text-xs font-bold uppercase tracking-wider text-compass-400 mb-1">01 / Precise Fit</div>
            <h3 className="text-xl font-bold text-white mb-2">Best Match</h3>
            <p className="text-sm text-slate-400 leading-relaxed">
              Mathematical alignment with your highest-rated directors, narrative themes, and immediate context needs.
            </p>
          </div>

          {/* Safe Choice */}
          <div className="relative p-6 rounded-2xl bg-obsidian-900/60 border border-white/10 hover:border-white/20 transition-all group">
            <div className="w-12 h-12 rounded-xl bg-emerald-500/10 text-emerald-400 flex items-center justify-center mb-4 group-hover:scale-110 transition-transform">
              <Shield className="w-6 h-6" />
            </div>
            <div className="text-xs font-bold uppercase tracking-wider text-emerald-400 mb-1">02 / High Confidence</div>
            <h3 className="text-xl font-bold text-white mb-2">Safe Choice</h3>
            <p className="text-sm text-slate-400 leading-relaxed">
              Critically acclaimed comfort picks guaranteed to satisfy without cognitive load or pacing fatigue.
            </p>
          </div>

          {/* Wildcard */}
          <div className="relative p-6 rounded-2xl bg-obsidian-900/60 border border-white/10 hover:border-white/20 transition-all group">
            <div className="w-12 h-12 rounded-xl bg-purple-500/10 text-purple-400 flex items-center justify-center mb-4 group-hover:scale-110 transition-transform">
              <Flame className="w-6 h-6" />
            </div>
            <div className="text-xs font-bold uppercase tracking-wider text-purple-400 mb-1">03 / Serendipity</div>
            <h3 className="text-xl font-bold text-white mb-2">The Wildcard</h3>
            <p className="text-sm text-slate-400 leading-relaxed">
              An unexpected genre or foreign discovery sharing subtle tonal DNA with what you love.
            </p>
          </div>
        </div>
      </section>

      {/* Preview of Curated Starter Titles */}
      <section className="py-16 px-4 sm:px-6 lg:px-8 max-w-7xl mx-auto border-t border-white/5">
        <div className="flex flex-col sm:flex-row items-start sm:items-end justify-between mb-8 gap-4">
          <div>
            <h2 className="text-2xl font-bold text-white tracking-tight">Curated Seed Catalog</h2>
            <p className="text-sm text-slate-400 mt-1">
              Pre-indexed cinematic masterworks ready for instant calibration.
            </p>
          </div>
          <Link
            to={user ? "/home" : "/signup"}
            className="text-sm font-medium text-compass-400 hover:text-compass-300 flex items-center gap-1"
          >
            <span>Calibrate full library</span>
            <ArrowRight className="w-4 h-4" />
          </Link>
        </div>

        {isLoading ? (
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-6">
            {[1, 2, 3, 4].map((i) => (
              <div key={i} className="h-72 rounded-2xl bg-obsidian-900 animate-pulse border border-white/5" />
            ))}
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-6">
            {featuredTitles.map((title) => (
              <div
                key={title.id}
                onClick={() => setSelectedTitleId(title.id)}
                className="group relative rounded-2xl overflow-hidden bg-obsidian-900 border border-white/10 hover:border-compass-500/50 transition-all hover:shadow-xl hover:shadow-compass-500/10 cursor-pointer"
              >
                <div className="aspect-[2/3] w-full relative overflow-hidden bg-obsidian-850">
                  {title.poster_path ? (
                    <img
                      src={title.poster_path}
                      alt={title.title}
                      className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                    />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center text-slate-600">
                      No Poster
                    </div>
                  )}
                  <div className="absolute inset-0 bg-gradient-to-t from-obsidian-950 via-transparent to-transparent opacity-90" />
                  
                  {/* Rating badge */}
                  <div className="absolute top-3 right-3 bg-obsidian-950/80 backdrop-blur-md px-2 py-1 rounded-md border border-white/10 flex items-center gap-1 text-xs font-bold text-amber-400">
                    <Star className="w-3 h-3 fill-amber-400" />
                    <span>{title.vote_average.toFixed(1)}</span>
                  </div>
                </div>

                <div className="p-4 relative">
                  <h3 className="font-bold text-white text-base truncate group-hover:text-compass-400 transition-colors">
                    {title.title}
                  </h3>
                  <div className="flex items-center gap-2 text-xs text-slate-400 mt-1">
                    <span>{title.release_date?.slice(0, 4)}</span>
                    {title.runtime_minutes && (
                      <>
                        <span>•</span>
                        <span>{title.runtime_minutes}m</span>
                      </>
                    )}
                  </div>
                  <div className="flex flex-wrap gap-1 mt-2.5">
                    {title.genres.slice(0, 2).map((g) => (
                      <span key={g.id} className="text-[10px] px-2 py-0.5 rounded bg-white/5 text-slate-300 border border-white/5">
                        {g.name}
                      </span>
                    ))}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </section>

      {/* Call to action */}
      <section className="py-20 px-4 sm:px-6 lg:px-8 max-w-5xl mx-auto text-center border-t border-white/5">
        <div className="p-8 sm:p-12 rounded-3xl bg-gradient-to-b from-obsidian-900 to-obsidian-950 border border-compass-500/20 relative overflow-hidden">
          <div className="absolute -right-20 -bottom-20 w-64 h-64 bg-compass-500/10 rounded-full blur-3xl pointer-events-none" />
          <h2 className="text-3xl font-extrabold text-white tracking-tight sm:text-4xl mb-4">
            Never spend 40 minutes choosing again.
          </h2>
          <p className="text-slate-400 max-w-xl mx-auto text-sm sm:text-base mb-8">
            Create your taste profile in under 2 minutes. Rate what you love, skip what you don't.
          </p>
          <Link
            to={user ? "/home" : "/signup"}
            className="inline-flex items-center gap-2 px-8 py-3.5 rounded-xl font-bold text-obsidian-950 bg-compass-400 hover:bg-compass-300 shadow-xl shadow-compass-500/20 transition-all transform hover:scale-105"
          >
            <span>{user ? "Enter Compass Engine" : "Get Started Free"}</span>
            <ArrowRight className="w-4 h-4" />
          </Link>
        </div>
      </section>

      {/* Title Details Modal */}
      <TitleDetailModal
        titleId={selectedTitleId}
        onClose={() => setSelectedTitleId(null)}
        onSelectTitle={(id) => setSelectedTitleId(id)}
      />
    </div>
  );
};
