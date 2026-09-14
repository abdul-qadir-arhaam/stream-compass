import React, { useEffect, useState, useCallback } from 'react';
import {
  Compass,
  Sparkles,
  Star,
  Clock,
  Calendar,
  Film,
  Tv,
  Check,
  Plus,
  RefreshCw,
  AlertCircle,
  HelpCircle,
  Smile,
  Zap,
  Flame,
  Moon,
  Heart,
  Theater,
  User,
  Users,
  Home,
  Sliders,
  ExternalLink,
} from 'lucide-react';

import type { DecisionContext, DecisionResponse, DecisionItem } from '../types';
import { api } from '../services/api';
import { TitleDetailModal } from '../components/TitleDetailModal';
import { FriendWatchedBadge } from '../components/FriendWatchedBadge';


const MOODS = [
  { id: 'chill', label: 'Chill & Relaxed', icon: Smile, desc: 'Light, breezy, easy-going entertainment' },
  { id: 'mind_bending', label: 'Mind-Bending', icon: Zap, desc: 'Cerebral, layered, twisty plots' },
  { id: 'action_packed', label: 'High Octane', icon: Flame, desc: 'Kinetic pacing and high adrenaline' },
  { id: 'dark_suspense', label: 'Dark Suspense', icon: Moon, desc: 'Taut thrillers and psychological tension' },
  { id: 'feel_good', label: 'Feel-Good', icon: Heart, desc: 'Uplifting stories with heart and warmth' },
  { id: 'deep_drama', label: 'Deep Drama', icon: Theater, desc: 'Rich emotional depth and character study' },
];

const SITUATIONS = [
  { id: 'solo', label: 'Solo', icon: User },
  { id: 'date_night', label: 'Date Night', icon: Heart },
  { id: 'friends', label: 'Friends / Group', icon: Users },
  { id: 'family', label: 'Family', icon: Home },
];

const FEEDBACK_OPTIONS = [
  { id: 'too_long', label: 'Too Long', icon: Clock },
  { id: 'too_serious', label: 'Too Serious', icon: Theater },
  { id: 'predictable', label: 'Predictable', icon: HelpCircle },
  { id: 'wrong_genre', label: 'Wrong Genre', icon: Film },
  { id: 'not_in_mood', label: 'Not in the Mood', icon: Moon },
  { id: 'want_something_different', label: 'Want Something Different', icon: Sparkles },
];

export const DecisionPage: React.FC = () => {
  // Context filters
  const [format, setFormat] = useState<'movie' | 'series' | 'either'>('either');
  const [maxRuntime, setMaxRuntime] = useState<number | undefined>(undefined);
  const [mood, setMood] = useState<string | undefined>(undefined);
  const [situation, setSituation] = useState<string | undefined>(undefined);
  const [novelty, setNovelty] = useState<'familiar' | 'balanced' | 'adventurous'>('balanced');
  const [region, setRegion] = useState<'all' | 'bollywood' | 'hollywood'>('all');
  const [ottPlatform, setOttPlatform] = useState<'all' | 'netflix' | 'prime' | 'hotstar'>('all');
  const [rejectedIds, setRejectedIds] = useState<number[]>([]);
  const [cycleOffset, setCycleOffset] = useState<number>(0);
  const [cycledIds, setCycledIds] = useState<number[]>([]);

  // Results state
  const [decision, setDecision] = useState<DecisionResponse | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isReranking, setIsReranking] = useState(false);
  const [selectedTitleId, setSelectedTitleId] = useState<number | null>(null);
  const [showFeedbackModal, setShowFeedbackModal] = useState(false);
  const [activeFeedbackTarget, setActiveFeedbackTarget] = useState<DecisionItem | null>(null);
  const [watchlistMap, setWatchlistMap] = useState<Record<number, boolean>>({});

  const fetchDecision = useCallback(
    async (feedbackOverride?: string, offsetOverride?: number, cycledOverride?: number[]) => {
      try {
        if (feedbackOverride || offsetOverride !== undefined) {
          setIsReranking(true);
        } else {
          setIsLoading(true);
        }

        const effectiveOffset = offsetOverride !== undefined ? offsetOverride : cycleOffset;
        const effectiveCycled = cycledOverride !== undefined ? cycledOverride : cycledIds;

        const context: DecisionContext = {
          format,
          max_runtime: maxRuntime,
          mood,
          situation,
          novelty,
          region,
          ott_platform: ottPlatform,
          cycle_offset: effectiveOffset,
          rejected_title_ids: [...rejectedIds, ...effectiveCycled],
          feedback: feedbackOverride,
        };

        const res = await api.getDecision(context);
        setDecision(res);
      } catch (err) {
        console.error('Failed to calculate decision', err);
      } finally {
        setIsLoading(false);
        setIsReranking(false);
      }
    },
    [format, maxRuntime, mood, situation, novelty, region, ottPlatform, cycleOffset, cycledIds, rejectedIds]
  );

  const resetCycle = useCallback(() => {
    setCycleOffset(0);
    setCycledIds([]);
  }, []);

  const handleRecalculate = () => {
    const currentIds = [
      decision?.best_match?.title.id,
      decision?.safe_choice?.title.id,
      decision?.wildcard?.title.id,
    ].filter(Boolean) as number[];

    const nextCycled = [...cycledIds, ...currentIds];
    const nextOffset = cycleOffset + 1;
    setCycledIds(nextCycled);
    setCycleOffset(nextOffset);
    fetchDecision(undefined, nextOffset, nextCycled);
  };

  useEffect(() => {
    fetchDecision();
  }, [fetchDecision]);

  const handleToggleWatchlist = async (titleId: number, e: React.MouseEvent) => {
    e.stopPropagation();
    try {
      await api.toggleWatchlist({ title_id: titleId });
      setWatchlistMap((prev) => ({
        ...prev,
        [titleId]: !prev[titleId],
      }));
    } catch (err) {
      console.error('Failed to toggle watchlist', err);
    }
  };

  const handleFeedbackSelect = async (feedbackReason: string) => {
    if (!decision) return;
    const targetTitleId =
      activeFeedbackTarget?.title.id ||
      decision.best_match?.title.id ||
      decision.safe_choice?.title.id ||
      decision.wildcard?.title.id;

    if (!targetTitleId) return;

    const nextRejected = [...rejectedIds, targetTitleId];
    setRejectedIds(nextRejected);
    setShowFeedbackModal(false);
    setActiveFeedbackTarget(null);

    try {
      setIsReranking(true);
      const res = await api.submitDecisionFeedback({
        title_id: targetTitleId,
        feedback: feedbackReason,
        log_id: activeFeedbackTarget?.log_id,
        context: {
          format,
          max_runtime: maxRuntime,
          mood,
          situation,
          novelty,
          region,
          ott_platform: ottPlatform,
          rejected_title_ids: nextRejected,
          feedback: feedbackReason,
        },
      });
      setDecision(res);
    } catch (err) {
      console.error('Failed to rerank with feedback', err);
    } finally {
      setIsReranking(false);
    }
  };

  const renderSpotlightCard = (
    item: DecisionItem | null | undefined,
    badgeColor: string,
    badgeLabel: string,
    accentBorder: string
  ) => {
    if (!item) return null;
    const { title, explanation, match_reasons } = item;
    const inWatchlist = watchlistMap[title.id] || false;

    return (
      <div
        onClick={() => setSelectedTitleId(title.id)}
        className={`group cursor-pointer rounded-3xl overflow-hidden bg-obsidian-900 border ${accentBorder} card-hover-subtle hover:scale-[1.01] transition-all flex flex-col shadow-2xl relative`}
      >
        {/* Tier Badge Header */}
        <div className="p-4 bg-obsidian-950/90 border-b border-white/5 flex items-center justify-between">
          <span className={`px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wider ${badgeColor}`}>
            {badgeLabel}
          </span>
          <div className="flex items-center gap-1 text-xs font-bold text-amber-400">
            <Star className="w-3.5 h-3.5 fill-amber-400" />
            <span>{title.vote_average.toFixed(1)}</span>
            <span className="text-[10px] text-slate-400 font-normal">
              ({title.vote_count.toLocaleString()})
            </span>
          </div>
        </div>

        {/* Poster & Backdrop */}
        <div className="aspect-[16/10] sm:aspect-[16/9] w-full relative overflow-hidden bg-obsidian-850">
          {title.backdrop_path || title.poster_path ? (
            <img
              src={title.backdrop_path || title.poster_path}
              alt={title.title}
              onError={(e) => {
                (e.target as HTMLImageElement).style.display = 'none';
              }}
              className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
            />
          ) : (
            <div className="w-full h-full flex items-center justify-center text-slate-600">
              <Film className="w-10 h-10 stroke-[1]" />
            </div>
          )}
          <div className="absolute inset-0 bg-gradient-to-t from-obsidian-900 via-obsidian-900/40 to-transparent" />

          {/* Type Badge */}
          <div className="absolute top-3 left-3 px-2 py-0.5 rounded-md bg-obsidian-950/80 backdrop-blur-md border border-white/10 text-[10px] font-bold text-slate-300 uppercase tracking-wider flex items-center gap-1">
            {title.type === 'series' ? <Tv className="w-3 h-3" /> : <Film className="w-3 h-3" />}
            <span>{title.type}</span>
          </div>

          {/* Runtime & Year */}
          <div className="absolute bottom-3 left-4 right-4 flex items-center justify-between text-xs text-slate-300 font-medium">
            <span className="flex items-center gap-1">
              <Calendar className="w-3.5 h-3.5 text-compass-400" />
              {title.release_date?.slice(0, 4)}
            </span>
            {title.runtime_minutes && (
              <span className="flex items-center gap-1">
                <Clock className="w-3.5 h-3.5 text-compass-400" />
                {title.runtime_minutes} mins
              </span>
            )}
          </div>
        </div>

        {/* Content Body */}
        <div className="p-6 flex-1 flex flex-col justify-between space-y-4">
          <div>
            <h3 className="text-xl font-bold text-white group-hover:text-compass-400 transition-colors">
              {title.title}
            </h3>
            <p className="text-xs text-slate-400 mt-0.5">Dir. {title.director || 'Unknown'}</p>

            <div className="flex flex-wrap gap-1.5 mt-2.5">
              {title.genres.map((g) => (
                <span
                  key={g.id}
                  className="text-[10px] px-2 py-0.5 rounded-md bg-white/5 border border-white/5 text-slate-300 font-medium"
                >
                  {g.name}
                </span>
              ))}
              {(title.keywords?.toLowerCase().includes('bollywood') || title.keywords?.toLowerCase().includes('hindi') || title.keywords?.toLowerCase().includes('indian')) && (
                <span className="text-[10px] px-2 py-0.5 rounded-md bg-orange-500/15 border border-orange-500/30 text-orange-400 font-semibold">
                  🇮🇳 Bollywood
                </span>
              )}
            </div>

            {/* Friend Watched Badge */}
            <div className="mt-2.5">
              <FriendWatchedBadge titleId={title.id} />
            </div>

            {/* Direct Legal Streaming Options */}

            {title.watch_options && title.watch_options.length > 0 ? (
              <div className="flex flex-wrap items-center gap-1.5 mt-2.5">
                <span className="text-[10px] text-slate-400 font-medium">Stream on:</span>
                {title.watch_options.map((opt) => (
                  <a
                    key={opt.provider_key}
                    href={opt.watch_url}
                    target="_blank"
                    rel="noopener noreferrer"
                    onClick={(e) => e.stopPropagation()}
                    className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-[11px] font-bold transition-all shadow-sm hover:scale-105"
                    style={{
                      backgroundColor: opt.badge_bg,
                      color: opt.badge_text,
                      border: `1px solid ${opt.badge_border}`,
                    }}
                    title={`Watch directly on ${opt.provider_name}`}
                  >
                    <span>{opt.provider_name}</span>
                    <ExternalLink className="w-2.5 h-2.5 opacity-80" />
                  </a>
                ))}
              </div>
            ) : title.ott_providers ? (
              <div className="flex flex-wrap items-center gap-1.5 mt-2.5">
                <span className="text-[10px] text-slate-400 font-medium">Available on:</span>
                {title.ott_providers.split(',').map((prov) => {
                  const p = prov.trim();
                  let badgeColor = 'bg-white/5 border-white/10 text-slate-300';
                  if (p.toLowerCase().includes('netflix')) {
                    badgeColor = 'bg-red-500/15 border-red-500/30 text-red-400 font-semibold';
                  } else if (p.toLowerCase().includes('prime')) {
                    badgeColor = 'bg-sky-500/15 border-sky-500/30 text-sky-400 font-semibold';
                  } else if (p.toLowerCase().includes('hotstar') || p.toLowerCase().includes('disney')) {
                    badgeColor = 'bg-amber-500/15 border-amber-500/30 text-amber-300 font-semibold';
                  }
                  return (
                    <span key={p} className={`text-[10px] px-2 py-0.5 rounded-md border ${badgeColor}`}>
                      {p}
                    </span>
                  );
                })}
              </div>
            ) : null}


            {/* Evidence-based Explainability Badge (PRD Section 4 & 6) */}
            <div className="mt-4 p-3 rounded-xl bg-compass-500/10 border border-compass-500/20 space-y-1">
              <div className="flex items-center gap-1.5 text-xs font-bold text-compass-400">
                <Sparkles className="w-3.5 h-3.5" />
                <span>Why Stream Compass chose this:</span>
              </div>
              <p className="text-xs text-slate-300 leading-relaxed">{explanation}</p>
              {match_reasons.length > 1 && (
                <ul className="text-[11px] text-slate-400 pt-1 space-y-1">
                  {match_reasons.slice(1, 3).map((r, i) => {
                    const isCollab =
                      r.toLowerCase().includes('viewer') ||
                      r.toLowerCase().includes('cinephile') ||
                      r.toLowerCase().includes('community') ||
                      r.toLowerCase().includes('matching taste');
                    return (
                      <li key={i} className="flex items-center gap-1.5">
                        {isCollab ? (
                          <span className="inline-flex items-center gap-1 text-[10px] font-semibold text-indigo-300 bg-indigo-500/20 border border-indigo-500/30 px-1.5 py-0.5 rounded-md shrink-0">
                            <Users className="w-2.5 h-2.5 text-indigo-400" />
                            Community Match
                          </span>
                        ) : (
                          <span className="w-1.5 h-1.5 rounded-full bg-compass-400/60 shrink-0" />
                        )}
                        <span className="truncate">{r}</span>
                      </li>
                    );
                  })}
                </ul>
              )}
            </div>
          </div>

          {/* Actions */}
          <div className="pt-2 border-t border-white/5 flex items-center justify-between gap-3">
            <button
              onClick={(e) => handleToggleWatchlist(title.id, e)}
              className={`flex-1 flex items-center justify-center gap-1.5 py-2.5 rounded-xl text-xs font-semibold transition-all cursor-pointer ${
                inWatchlist
                  ? 'bg-compass-500 text-obsidian-950 font-bold shadow-lg shadow-compass-500/20'
                  : 'bg-obsidian-950 hover:bg-obsidian-850 text-slate-300 border border-white/10'
              }`}
            >
              {inWatchlist ? <Check className="w-4 h-4 stroke-[3]" /> : <Plus className="w-4 h-4" />}
              <span>{inWatchlist ? 'In Watchlist' : 'Watchlist'}</span>
            </button>

            <button
              onClick={(e) => {
                e.stopPropagation();
                setActiveFeedbackTarget(item);
                setShowFeedbackModal(true);
              }}
              className="p-2.5 rounded-xl bg-obsidian-950 hover:bg-red-500/10 text-slate-400 hover:text-red-400 border border-white/10 hover:border-red-500/30 text-xs transition-colors cursor-pointer"
              title="Not in the mood for this title"
            >
              <AlertCircle className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>
    );
  };

  return (
    <div className="min-h-screen bg-obsidian-950 text-slate-100 py-10 px-4 sm:px-6 lg:px-8 max-w-7xl mx-auto space-y-10">
      {/* Header Banner */}
      <div className="relative overflow-hidden rounded-3xl bg-gradient-to-r from-obsidian-900 via-obsidian-850 to-obsidian-900 border border-compass-500/30 p-6 sm:p-10 shadow-2xl">
        <div className="absolute top-0 right-0 w-96 h-96 bg-compass-500/10 rounded-full blur-3xl pointer-events-none" />

        <div className="max-w-3xl">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-compass-500/15 border border-compass-500/30 text-compass-400 text-xs font-semibold mb-3">
            <Compass className="w-4 h-4" />
            <span>Decision Engine</span>
          </div>

          <h1 className="text-3xl sm:text-5xl font-extrabold text-white tracking-tight">
            What Should I Watch?
          </h1>
          <p className="mt-2 text-slate-300 text-sm sm:text-base leading-relaxed">
            Eliminate endless scrolling. The decision engine evaluates your viewing taste, context, and mood to deliver three definitive choices.
          </p>
        </div>
      </div>

      {/* Contextual Filters: Fast, non-mandatory controls (PRD Section 4) */}
      <div className="p-6 rounded-3xl bg-obsidian-900 border border-white/10 shadow-xl space-y-6">
        <div className="flex items-center justify-between pb-4 border-b border-white/5">
          <div className="flex items-center gap-2">
            <Sliders className="w-4 h-4 text-compass-400" />
            <h2 className="text-sm font-bold uppercase tracking-wider text-white">
              Viewing Context (Optional)
            </h2>
          </div>
          <button
            onClick={() => {
              setFormat('either');
              setMaxRuntime(undefined);
              setMood(undefined);
              setSituation(undefined);
              setNovelty('balanced');
              setRegion('all');
              setOttPlatform('all');
              setRejectedIds([]);
              fetchDecision();
            }}
            className="text-xs text-slate-400 hover:text-compass-400 transition-colors cursor-pointer"
          >
            Reset Filters
          </button>
        </div>

        {/* Grid of context selectors */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          {/* Format Selector */}
          <div className="space-y-2">
            <label className="text-xs font-semibold text-slate-300 block">Format</label>
            <div className="flex rounded-xl bg-obsidian-950 p-1 border border-white/5 text-xs">
              {(['either', 'movie', 'series'] as const).map((fmt) => (
                <button
                  key={fmt}
                  onClick={() => setFormat(fmt)}
                  className={`flex-1 py-2 rounded-lg font-medium transition-all capitalize cursor-pointer ${
                    format === fmt
                      ? 'bg-compass-500 text-obsidian-950 font-bold'
                      : 'text-slate-400 hover:text-white'
                  }`}
                >
                  {fmt}
                </button>
              ))}
            </div>
          </div>

          {/* Time Limit */}
          <div className="space-y-2">
            <label className="text-xs font-semibold text-slate-300 block">Available Time</label>
            <div className="flex rounded-xl bg-obsidian-950 p-1 border border-white/5 text-xs">
              {[
                { label: 'Any', value: undefined },
                { label: '< 90m', value: 95 },
                { label: '< 120m', value: 125 },
                { label: 'Epic', value: 240 },
              ].map((t) => (
                <button
                  key={t.label}
                  onClick={() => setMaxRuntime(t.value)}
                  className={`flex-1 py-2 rounded-lg font-medium transition-all cursor-pointer ${
                    maxRuntime === t.value
                      ? 'bg-compass-500 text-obsidian-950 font-bold'
                      : 'text-slate-400 hover:text-white'
                  }`}
                >
                  {t.label}
                </button>
              ))}
            </div>
          </div>

          {/* Viewing Situation */}
          <div className="space-y-2">
            <label className="text-xs font-semibold text-slate-300 block">Viewing Company</label>
            <div className="flex rounded-xl bg-obsidian-950 p-1 border border-white/5 text-xs">
              {SITUATIONS.map((sit) => {
                const Icon = sit.icon;
                return (
                  <button
                    key={sit.id}
                    onClick={() => setSituation(situation === sit.id ? undefined : sit.id)}
                    className={`flex-1 py-2 rounded-lg font-medium transition-all flex items-center justify-center gap-1 cursor-pointer ${
                      situation === sit.id
                        ? 'bg-compass-500 text-obsidian-950 font-bold'
                        : 'text-slate-400 hover:text-white'
                    }`}
                    title={sit.label}
                  >
                    <Icon className="w-3.5 h-3.5" />
                    <span className="hidden sm:inline">{sit.label}</span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Novelty / Adventurousness */}
          <div className="space-y-2">
            <label className="text-xs font-semibold text-slate-300 block">Novelty Horizon</label>
            <div className="flex rounded-xl bg-obsidian-950 p-1 border border-white/5 text-xs">
              {(['familiar', 'balanced', 'adventurous'] as const).map((nov) => (
                <button
                  key={nov}
                  onClick={() => setNovelty(nov)}
                  className={`flex-1 py-2 rounded-lg font-medium transition-all capitalize cursor-pointer ${
                    novelty === nov
                      ? 'bg-compass-500 text-obsidian-950 font-bold'
                      : 'text-slate-400 hover:text-white'
                  }`}
                >
                  {nov}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Cinema / Region Selector */}
        <div className="space-y-2 pt-2 border-t border-white/5">
          <label className="text-xs font-semibold text-slate-300 block">Cinema & Origin</label>
          <div className="flex flex-wrap gap-2">
            {[
              { id: 'all', label: '🌐 All Cinema' },
              { id: 'bollywood', label: '🇮🇳 Bollywood & Indian Cinema' },
              { id: 'hollywood', label: '🎬 Hollywood & Global' },
            ].map((reg) => (
              <button
                key={reg.id}
                onClick={() => {
                  resetCycle();
                  setRegion(reg.id as any);
                }}
                className={`px-3.5 py-2 rounded-xl text-xs font-medium border transition-all cursor-pointer ${
                  region === reg.id
                    ? 'bg-orange-500/20 text-orange-300 border-orange-500/50 shadow-sm font-bold'
                    : 'bg-obsidian-950 text-slate-400 border-white/5 hover:border-white/20 hover:text-white'
                }`}
              >
                {reg.label}
              </button>
            ))}
          </div>
        </div>

        {/* Streaming Platform Selector */}
        <div className="space-y-2 pt-2 border-t border-white/5">
          <label className="text-xs font-semibold text-slate-300 block">Stream On (OTT Platform)</label>
          <div className="flex flex-wrap gap-2">
            {[
              { id: 'all', label: '🌐 All Platforms', color: 'bg-compass-500/20 text-compass-300 border-compass-500/50' },
              { id: 'netflix', label: '🔴 Netflix', color: 'bg-red-600/20 text-red-400 border-red-500/50' },
              { id: 'prime', label: '🔵 Amazon Prime Video', color: 'bg-sky-600/20 text-sky-300 border-sky-500/50' },
              { id: 'hotstar', label: '🟡 Disney+ Hotstar', color: 'bg-amber-600/20 text-amber-300 border-amber-500/50' },
            ].map((p) => (
              <button
                key={p.id}
                onClick={() => {
                  resetCycle();
                  setOttPlatform(p.id as any);
                }}
                className={`px-3.5 py-2 rounded-xl text-xs font-medium border transition-all cursor-pointer ${
                  ottPlatform === p.id
                    ? `${p.color} shadow-sm font-bold`
                    : 'bg-obsidian-950 text-slate-400 border-white/5 hover:border-white/20 hover:text-white'
                }`}
              >
                {p.label}
              </button>
            ))}
          </div>
        </div>

        {/* Mood Chips Row */}
        <div className="space-y-2 pt-2 border-t border-white/5">
          <label className="text-xs font-semibold text-slate-300 block">Current Mood / Vibe</label>
          <div className="flex flex-wrap gap-2">
            {MOODS.map((m) => {
              const Icon = m.icon;
              const isSelected = mood === m.id;
              return (
                <button
                  key={m.id}
                  onClick={() => {
                    resetCycle();
                    setMood(isSelected ? undefined : m.id);
                  }}
                  className={`inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-medium border transition-all cursor-pointer ${
                    isSelected
                      ? 'bg-compass-500/20 text-compass-300 border-compass-500/50 shadow-sm font-bold'
                      : 'bg-obsidian-950 text-slate-400 border-white/5 hover:border-white/20 hover:text-white'
                  }`}
                  title={m.desc}
                >
                  <Icon className="w-3.5 h-3.5 text-compass-400" />
                  <span>{m.label}</span>
                </button>
              );
            })}
          </div>
        </div>

        {/* Calculate Action */}
        <div className="pt-2 flex justify-end">
          <button
            onClick={handleRecalculate}
            disabled={isLoading || isReranking}
            className="inline-flex items-center gap-2 px-6 py-3 rounded-xl bg-gradient-to-r from-compass-400 to-compass-500 hover:from-compass-300 hover:to-compass-400 text-obsidian-950 font-bold text-sm shadow-xl shadow-compass-500/25 transition-all cursor-pointer disabled:opacity-50"
          >
            <Compass className={`w-4 h-4 ${isReranking || isLoading ? 'animate-spin' : ''}`} />
            <span>
              {isReranking
                ? 'Exploring Next Choices...'
                : cycleOffset > 0
                ? `Discover Next Triad (Set #${cycleOffset + 1})`
                : 'Recalculate Decision'}
            </span>
          </button>
        </div>
      </div>

      {/* Decision Results (The Triad: Best Match, Safe Choice, Wildcard) */}
      <section className="space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
          <div>
            <h2 className="text-2xl font-extrabold text-white tracking-tight flex items-center gap-2">
              <Sparkles className="w-5 h-5 text-compass-400" />
              <span>Recommended Decision Triad</span>
            </h2>
            <p className="text-xs text-slate-400 mt-1">
              {decision?.context_summary || 'Curated decision for your evening.'}
            </p>
          </div>

          <button
            onClick={() => setShowFeedbackModal(true)}
            className="inline-flex items-center gap-1.5 text-xs text-slate-400 hover:text-compass-400 transition-colors self-start sm:self-auto cursor-pointer"
          >
            <RefreshCw className="w-3.5 h-3.5" />
            <span>None of these fit? Rerank with feedback</span>
          </button>
        </div>

        {isLoading ? (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            {[1, 2, 3].map((i) => (
              <div key={i} className="h-96 rounded-3xl bg-obsidian-900 animate-pulse border border-white/5" />
            ))}
          </div>
        ) : decision && (decision.best_match || decision.safe_choice || decision.wildcard) ? (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            {/* Best Match */}
            {renderSpotlightCard(
              decision.best_match,
              'bg-compass-500/20 text-compass-300 border border-compass-500/40',
              'Best Match',
              'border-compass-500/40 shadow-compass-500/10'
            )}

            {/* Safe Choice */}
            {renderSpotlightCard(
              decision.safe_choice,
              'bg-amber-500/20 text-amber-300 border border-amber-500/40',
              'Safe Choice',
              'border-amber-500/30'
            )}

            {/* Wildcard */}
            {renderSpotlightCard(
              decision.wildcard,
              'bg-purple-500/20 text-purple-300 border border-purple-500/40',
              'Wildcard',
              'border-purple-500/30'
            )}
          </div>
        ) : (
          <div className="text-center py-20 bg-obsidian-900/50 rounded-3xl border border-white/5 p-8">
            <h3 className="text-lg font-bold text-white">No matches found</h3>
            <p className="text-xs text-slate-400 max-w-sm mx-auto mt-1">
              Try widening your runtime limit or resetting rejected titles to explore more catalog candidates.
            </p>
          </div>
        )}
      </section>

      {/* Feedback Reranking Modal (PRD Section 4: Feedback Loop) */}
      {showFeedbackModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 backdrop-blur-md bg-obsidian-950/80 animate-in fade-in duration-200">
          <div
            className="fixed inset-0"
            onClick={() => setShowFeedbackModal(false)}
            aria-hidden="true"
          />

          <div className="relative w-full max-w-lg rounded-3xl bg-obsidian-900 border border-white/10 p-6 sm:p-8 shadow-2xl z-10 space-y-6 text-slate-100">
            <div>
              <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-compass-500/15 border border-compass-500/30 text-compass-400 text-xs font-semibold mb-2">
                <RefreshCw className="w-3.5 h-3.5" />
                <span>Decision Reranker</span>
              </div>
              <h3 className="text-xl font-bold text-white tracking-tight">
                {activeFeedbackTarget
                  ? `Why doesn't "${activeFeedbackTarget.title.title}" fit?`
                  : 'What feels off about these choices?'}
              </h3>
              <p className="text-xs text-slate-400 mt-1">
                Tell the compass why these options missed the mark. The engine will adapt its weights and rerank candidate titles immediately.
              </p>
            </div>

            <div className="grid grid-cols-2 gap-3">
              {FEEDBACK_OPTIONS.map((opt) => {
                const Icon = opt.icon;
                return (
                  <button
                    key={opt.id}
                    onClick={() => handleFeedbackSelect(opt.id)}
                    className="flex items-center gap-2.5 p-3 rounded-2xl bg-obsidian-950 border border-white/5 hover:border-compass-500/50 hover:bg-compass-500/10 text-slate-300 hover:text-white transition-all text-xs font-medium cursor-pointer"
                  >
                    <Icon className="w-4 h-4 text-compass-400 shrink-0" />
                    <span>{opt.label}</span>
                  </button>
                );
              })}
            </div>

            <div className="pt-2 border-t border-white/5 flex justify-end">
              <button
                onClick={() => setShowFeedbackModal(false)}
                className="px-4 py-2 rounded-xl bg-obsidian-800 text-xs text-slate-400 hover:text-white transition-colors cursor-pointer"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Title Details Modal */}
      <TitleDetailModal
        titleId={selectedTitleId}
        onClose={() => setSelectedTitleId(null)}
        onInteractionChange={() => fetchDecision()}
      />
    </div>
  );
};
