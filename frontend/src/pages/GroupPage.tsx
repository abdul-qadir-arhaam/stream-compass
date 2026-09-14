import React, { useEffect, useState, useCallback } from 'react';
import { useSearchParams } from 'react-router-dom';
import {
  Users,
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
  Smile,
  Zap,
  Flame,
  Moon,
  Heart,
  Theater,
  UserPlus,
  ExternalLink,
  ShieldCheck,
  UserCheck,
  Search,
  X,
} from 'lucide-react';
import type {
  GroupMemberSummary,
  GroupDecisionResponse,
  DecisionItem,
} from '../types';
import { api } from '../services/api';
import { useAuth } from '../context/AuthContext';
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

export const GroupPage: React.FC = () => {
  const { user } = useAuth();
  const [searchParams] = useSearchParams();

  // Group members state
  const [availableUsers, setAvailableUsers] = useState<GroupMemberSummary[]>([]);
  const [selectedUserIds, setSelectedUserIds] = useState<number[]>([]);
  const [companionSearchQuery, setCompanionSearchQuery] = useState<string>('');
  const [isLoadingUsers, setIsLoadingUsers] = useState<boolean>(true);

  // Context filters
  const [format, setFormat] = useState<'movie' | 'series' | 'either'>('either');
  const [maxRuntime, setMaxRuntime] = useState<number | undefined>(undefined);
  const [mood, setMood] = useState<string | undefined>('chill');
  const [region, setRegion] = useState<'all' | 'bollywood' | 'hollywood'>('all');
  const [ottPlatform, setOttPlatform] = useState<'all' | 'netflix' | 'prime' | 'hotstar'>('all');
  const [cycleOffset, setCycleOffset] = useState<number>(0);

  // Results state
  const [groupDecision, setGroupDecision] = useState<GroupDecisionResponse | null>(null);
  const [isCalculating, setIsCalculating] = useState<boolean>(false);
  const [selectedTitleId, setSelectedTitleId] = useState<number | null>(null);
  const [watchlistMap, setWatchlistMap] = useState<Record<number, boolean>>({});

  // Load available users to invite
  useEffect(() => {
    let isMounted = true;
    setIsLoadingUsers(true);
    api
      .getGroupUsers()
      .then((users) => {
        if (isMounted) {
          setAvailableUsers(users);
          // Preselect friend from URL query param if provided (e.g. from Friends page)
          const paramFriendId = searchParams.get('friend_id');
          if (paramFriendId) {
            const targetId = parseInt(paramFriendId, 10);
            if (!isNaN(targetId)) {
              setSelectedUserIds([targetId]);
              setIsLoadingUsers(false);
              return;
            }
          }

          // Otherwise preselect the first friend or user if available
          if (users.length > 0 && selectedUserIds.length === 0) {
            setSelectedUserIds([users[0].id]);
          }
          setIsLoadingUsers(false);
        }
      })
      .catch((err) => {
        console.error('Failed to load group users', err);
        if (isMounted) setIsLoadingUsers(false);
      });

    return () => {
      isMounted = false;
    };
  }, [searchParams]);


  const toggleUserSelection = (userId: number) => {
    setSelectedUserIds((prev) =>
      prev.includes(userId) ? prev.filter((id) => id !== userId) : [...prev, userId]
    );
    setCycleOffset(0);
  };

  const handleCalculateGroupDecision = useCallback(
    async (offsetOverride?: number) => {
      if (selectedUserIds.length === 0) return;
      setIsCalculating(true);
      const effectiveOffset = offsetOverride !== undefined ? offsetOverride : cycleOffset;

      try {
        const res = await api.getGroupDecision({
          user_ids: selectedUserIds,
          format,
          max_runtime: maxRuntime,
          mood,
          situation: 'friends',
          region,
          ott_platform: ottPlatform,
          cycle_offset: effectiveOffset,
        });
        setGroupDecision(res);
      } catch (err) {
        console.error('Failed to calculate group decision', err);
      } finally {
        setIsCalculating(false);
      }
    },
    [selectedUserIds, format, maxRuntime, mood, region, ottPlatform, cycleOffset]
  );

  // Calculate automatically when members are selected or filters change
  useEffect(() => {
    if (selectedUserIds.length > 0) {
      handleCalculateGroupDecision(0);
    }
  }, [selectedUserIds, format, maxRuntime, mood, region, ottPlatform]);

  const handleReroll = () => {
    const nextOffset = cycleOffset + 1;
    setCycleOffset(nextOffset);
    handleCalculateGroupDecision(nextOffset);
  };

  const handleToggleWatchlist = async (titleId: number, e: React.MouseEvent) => {
    e.stopPropagation();
    try {
      await api.toggleWatchlist({ title_id: titleId });
      setWatchlistMap((prev) => ({ ...prev, [titleId]: !prev[titleId] }));
    } catch (err) {
      console.error('Watchlist error', err);
    }
  };


  const renderGroupSpotlightCard = (
    item: DecisionItem | null | undefined,
    badgeColor: string,
    badgeLabel: string,
    accentBorder: string,
    badgeSubtitle: string
  ) => {
    if (!item) return null;
    const { title, explanation, match_reasons } = item;
    const inWatchlist = watchlistMap[title.id] || false;

    return (
      <div
        onClick={() => setSelectedTitleId(title.id)}
        className={`group cursor-pointer rounded-3xl overflow-hidden bg-obsidian-900 border ${accentBorder} hover:scale-[1.01] transition-all flex flex-col shadow-2xl relative`}
      >
        {/* Tier Badge Header */}
        <div className="p-4 bg-obsidian-950/90 border-b border-white/5 flex items-center justify-between">
          <div>
            <span className={`px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wider ${badgeColor}`}>
              {badgeLabel}
            </span>
            <p className="text-[11px] text-slate-400 mt-1 font-medium">{badgeSubtitle}</p>
          </div>
          <div className="flex items-center gap-1 text-xs font-bold text-amber-400 self-start">
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
              {(title.keywords?.toLowerCase().includes('bollywood') ||
                title.keywords?.toLowerCase().includes('hindi') ||
                title.keywords?.toLowerCase().includes('indian')) && (
                <span className="text-[10px] px-2 py-0.5 rounded-md bg-orange-500/15 border border-orange-500/30 text-orange-400 font-semibold">
                  🇮🇳 Bollywood
                </span>
              )}
            </div>

            {/* Friend Watched Indicator */}
            <div className="mt-2.5">
              <FriendWatchedBadge titleId={title.id} />
            </div>

            {/* Direct Legal Streaming Options */}

            {title.watch_options && title.watch_options.length > 0 ? (
              <div className="flex flex-wrap items-center gap-1.5 mt-3">
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
                    title={`Stream directly on ${opt.provider_name}`}
                  >
                    <span>{opt.provider_name}</span>
                    <ExternalLink className="w-2.5 h-2.5 opacity-80" />
                  </a>
                ))}
              </div>
            ) : title.ott_providers ? (
              <div className="flex flex-wrap items-center gap-1.5 mt-3">
                <span className="text-[10px] text-slate-400 font-medium">Available on:</span>
                {title.ott_providers.split(',').map((prov) => {
                  const p = prov.trim();
                  return (
                    <span
                      key={p}
                      className="text-[10px] px-2 py-0.5 rounded-md border bg-white/5 border-white/10 text-slate-300"
                    >
                      {p}
                    </span>
                  );
                })}
              </div>
            ) : null}

            {/* Evidence-based Explainability Badge */}
            <div className="mt-4 p-3 rounded-xl bg-compass-500/10 border border-compass-500/20 space-y-1">
              <div className="flex items-center gap-1.5 text-xs font-bold text-compass-400">
                <Sparkles className="w-3.5 h-3.5" />
                <span>Group Harmony Alignment:</span>
              </div>
              <p className="text-xs text-slate-300 leading-relaxed">{explanation}</p>
              {match_reasons.length > 0 && (
                <ul className="list-disc list-inside text-[11px] text-slate-400 pt-1 space-y-0.5">
                  {match_reasons.map((r, i) => (
                    <li key={i}>{r}</li>
                  ))}
                </ul>
              )}
            </div>
          </div>

          {/* Watchlist Action */}
          <div className="pt-2 border-t border-white/5">
            <button
              onClick={(e) => handleToggleWatchlist(title.id, e)}
              className={`w-full flex items-center justify-center gap-1.5 py-2.5 rounded-xl text-xs font-semibold transition-all cursor-pointer ${
                inWatchlist
                  ? 'bg-compass-500 text-obsidian-950 font-bold shadow-lg shadow-compass-500/20'
                  : 'bg-obsidian-950 hover:bg-obsidian-850 text-slate-300 border border-white/10'
              }`}
            >
              {inWatchlist ? <Check className="w-4 h-4 stroke-[3]" /> : <Plus className="w-4 h-4" />}
              <span>{inWatchlist ? 'In Watchlist' : 'Add to Group Watchlist'}</span>
            </button>
          </div>
        </div>
      </div>
    );
  };

  return (
    <div className="space-y-10 pb-20">
      {/* Page Header */}
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-6 pb-6 border-b border-white/5">
        <div>
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-compass-500/10 border border-compass-500/20 text-compass-400 text-xs font-semibold tracking-wide uppercase mb-3">
            <Users className="w-3.5 h-3.5" />
            <span>Collaborative Decision Engine • Phase 5</span>
          </div>
          <h1 className="text-3xl sm:text-4xl font-extrabold text-white tracking-tight">
            Group Mode: Find The Perfect Compromise
          </h1>
          <p className="text-sm text-slate-400 max-w-2xl mt-1 leading-relaxed">
            Combine viewing preferences from two or more users into a harmonic taste consensus.
            Automatically excludes anything already watched by any member so nobody gets spoiled.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-xs font-semibold">
            <ShieldCheck className="w-4 h-4" />
            <span>Union Watched Exclusions Active</span>
          </div>
        </div>
      </div>

      {/* Step 1: Group Member Selection */}
      <section className="p-6 sm:p-8 rounded-3xl bg-obsidian-900 border border-white/10 space-y-6 shadow-xl">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-lg font-bold text-white flex items-center gap-2">
              <UserPlus className="w-5 h-5 text-compass-400" />
              <span>1. Select Watching Companions</span>
            </h2>
            <p className="text-xs text-slate-400 mt-0.5">
              Select who is in the room tonight. Their taste profiles will be harmonized with yours.
            </p>
          </div>
          <span className="text-xs font-semibold px-2.5 py-1 rounded-lg bg-white/5 border border-white/10 text-slate-300">
            {selectedUserIds.length + 1} Viewers in Room
          </span>
        </div>

        {/* Companion Search Bar */}
        <div className="relative">
          <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={companionSearchQuery}
            onChange={(e) => setCompanionSearchQuery(e.target.value)}
            placeholder="Search friends by username, email, or favorite genre..."
            className="w-full pl-10 pr-10 py-2.5 rounded-2xl bg-obsidian-950 border border-white/10 focus:border-compass-500 focus:outline-none text-xs text-white placeholder-slate-500 transition-colors"
          />
          {companionSearchQuery && (
            <button
              onClick={() => setCompanionSearchQuery('')}
              className="absolute right-3.5 top-1/2 -translate-y-1/2 p-1 text-slate-400 hover:text-white"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          )}
        </div>

        {/* Member Chips */}
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
          {/* Host (Current User) */}
          <div className="p-3.5 rounded-2xl bg-compass-500/15 border border-compass-500/40 flex items-center justify-between">
            <div className="flex items-center gap-3 truncate">
              <div className="w-9 h-9 rounded-xl bg-compass-500/30 flex items-center justify-center text-compass-300 font-extrabold text-sm uppercase">
                {user?.username?.[0] || 'U'}
              </div>
              <div className="truncate">
                <div className="flex items-center gap-1.5">
                  <span className="text-xs font-bold text-white truncate">{user?.username}</span>
                  <span className="text-[9px] px-1.5 py-0.5 rounded bg-compass-500/30 text-compass-300 font-bold uppercase">
                    Host
                  </span>
                </div>
                <span className="text-[10px] text-slate-400">Your taste DNA</span>
              </div>
            </div>
            <Check className="w-4 h-4 text-compass-400 shrink-0" />
          </div>

          {/* Other Users */}
          {isLoadingUsers ? (
            <div className="col-span-full py-4 text-center text-xs text-slate-500">
              Loading companions...
            </div>
          ) : (
            availableUsers
              .filter((u) => {
                if (!companionSearchQuery.trim()) return true;
                const q = companionSearchQuery.toLowerCase();
                return (
                  u.username.toLowerCase().includes(q) ||
                  u.email.toLowerCase().includes(q) ||
                  u.taste_genres?.some((g) => g.toLowerCase().includes(q))
                );
              })
              .map((u) => {
                const isSelected = selectedUserIds.includes(u.id);
                return (
                  <div
                    key={u.id}
                    onClick={() => toggleUserSelection(u.id)}
                    className={`p-3.5 rounded-2xl border cursor-pointer transition-all flex items-center justify-between ${
                      isSelected
                        ? 'bg-compass-500/15 border-compass-500/40 text-white shadow-sm'
                        : 'bg-obsidian-950/60 border-white/5 hover:border-white/20 text-slate-400 hover:text-slate-200'
                    }`}
                  >
                    <div className="flex items-center gap-3 truncate">
                      <div
                        className={`w-9 h-9 rounded-xl flex items-center justify-center font-extrabold text-sm uppercase ${
                          isSelected
                            ? 'bg-compass-500/30 text-compass-300'
                            : 'bg-white/5 text-slate-400'
                        }`}
                      >
                        {u.username[0]}
                      </div>
                      <div className="truncate">
                        <div className="flex items-center gap-1.5">
                          <span className="text-xs font-bold text-white truncate">{u.username}</span>
                          {u.is_friend && (
                            <span className="text-[9px] px-1.5 py-0.2 rounded bg-emerald-500/20 text-emerald-300 font-bold uppercase">
                              Friend
                            </span>
                          )}
                        </div>
                        <div className="flex items-center gap-1 text-[10px] text-slate-400 truncate">
                          {u.taste_genres && u.taste_genres.length > 0 ? (
                            <span>{u.taste_genres.slice(0, 2).join(', ')}</span>
                          ) : (
                            <span>General Taste</span>
                          )}
                        </div>
                      </div>
                    </div>

                    <div
                      className={`w-5 h-5 rounded-lg flex items-center justify-center transition-all ${
                        isSelected
                          ? 'bg-compass-500 text-obsidian-950'
                          : 'border border-white/20 text-transparent'
                      }`}
                    >
                      <Check className="w-3.5 h-3.5 stroke-[3]" />
                    </div>
                  </div>
                );
              })
          )}
        </div>

      </section>

      {/* Step 2: Shared Context Calibration */}
      <section className="p-6 sm:p-8 rounded-3xl bg-obsidian-900 border border-white/10 space-y-6 shadow-xl">
        <div>
          <h2 className="text-lg font-bold text-white flex items-center gap-2">
            <Sparkles className="w-5 h-5 text-compass-400" />
            <span>2. Shared Context & Filters</span>
          </h2>
          <p className="text-xs text-slate-400 mt-0.5">
            What is the group in the mood for together?
          </p>
        </div>

        {/* Shared Mood Grid */}
        <div className="space-y-2">
          <label className="text-xs font-semibold text-slate-300 block">Shared Group Mood</label>
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2.5">
            {MOODS.map((m) => {
              const Icon = m.icon;
              const isSelected = mood === m.id;
              return (
                <button
                  key={m.id}
                  onClick={() => {
                    setMood(isSelected ? undefined : m.id);
                    setCycleOffset(0);
                  }}
                  className={`p-3 rounded-2xl border text-left transition-all cursor-pointer ${
                    isSelected
                      ? 'bg-compass-500/20 border-compass-500/50 shadow-md shadow-compass-500/10'
                      : 'bg-obsidian-950 border-white/5 hover:border-white/20 hover:bg-obsidian-850'
                  }`}
                >
                  <div className="flex items-center gap-2">
                    <Icon
                      className={`w-4 h-4 ${
                        isSelected ? 'text-compass-400' : 'text-slate-400'
                      }`}
                    />
                    <span
                      className={`text-xs font-bold block ${
                        isSelected ? 'text-white' : 'text-slate-300'
                      }`}
                    >
                      {m.label}
                    </span>
                  </div>
                  <span className="text-[10px] text-slate-500 block mt-1 line-clamp-1">
                    {m.desc}
                  </span>
                </button>
              );
            })}
          </div>
        </div>

        {/* Filters Row: Format, Max Runtime, Region, OTT */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 pt-2 border-t border-white/5">
          {/* Format */}
          <div className="space-y-2">
            <label className="text-xs font-semibold text-slate-300 block">Format</label>
            <div className="flex rounded-xl bg-obsidian-950 p-1 border border-white/5 text-xs">
              {(['either', 'movie', 'series'] as const).map((f) => (
                <button
                  key={f}
                  onClick={() => {
                    setFormat(f);
                    setCycleOffset(0);
                  }}
                  className={`flex-1 py-2 rounded-lg font-medium transition-all capitalize cursor-pointer ${
                    format === f
                      ? 'bg-compass-500 text-obsidian-950 font-bold'
                      : 'text-slate-400 hover:text-white'
                  }`}
                >
                  {f}
                </button>
              ))}
            </div>
          </div>

          {/* Max Runtime */}
          <div className="space-y-2">
            <label className="text-xs font-semibold text-slate-300 block">Time Available</label>
            <div className="flex rounded-xl bg-obsidian-950 p-1 border border-white/5 text-xs">
              {[
                { label: 'Any', value: undefined },
                { label: '< 95m', value: 95 },
                { label: '< 120m', value: 120 },
                { label: 'Epic', value: 240 },
              ].map((t) => (
                <button
                  key={t.label}
                  onClick={() => {
                    setMaxRuntime(t.value);
                    setCycleOffset(0);
                  }}
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

          {/* Cinema / Region */}
          <div className="space-y-2">
            <label className="text-xs font-semibold text-slate-300 block">Cinema Origin</label>
            <div className="flex rounded-xl bg-obsidian-950 p-1 border border-white/5 text-xs">
              {[
                { id: 'all', label: 'All' },
                { id: 'bollywood', label: '🇮🇳 Bollywood' },
                { id: 'hollywood', label: 'Hollywood' },
              ].map((reg) => (
                <button
                  key={reg.id}
                  onClick={() => {
                    setRegion(reg.id as any);
                    setCycleOffset(0);
                  }}
                  className={`flex-1 py-2 rounded-lg font-medium transition-all cursor-pointer ${
                    region === reg.id
                      ? 'bg-orange-500/30 text-orange-300 font-bold'
                      : 'text-slate-400 hover:text-white'
                  }`}
                >
                  {reg.label}
                </button>
              ))}
            </div>
          </div>

          {/* OTT Platform */}
          <div className="space-y-2">
            <label className="text-xs font-semibold text-slate-300 block">Streaming OTT</label>
            <div className="flex rounded-xl bg-obsidian-950 p-1 border border-white/5 text-xs">
              {[
                { id: 'all', label: 'All' },
                { id: 'netflix', label: 'Netflix' },
                { id: 'prime', label: 'Prime' },
                { id: 'hotstar', label: 'Hotstar' },
              ].map((ott) => (
                <button
                  key={ott.id}
                  onClick={() => {
                    setOttPlatform(ott.id as any);
                    setCycleOffset(0);
                  }}
                  className={`flex-1 py-2 rounded-lg font-medium transition-all cursor-pointer ${
                    ottPlatform === ott.id
                      ? 'bg-sky-500/30 text-sky-300 font-bold'
                      : 'text-slate-400 hover:text-white'
                  }`}
                >
                  {ott.label}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Action Controls */}
        <div className="flex flex-col sm:flex-row items-center justify-between gap-4 pt-4 border-t border-white/5">
          <div className="text-xs text-slate-400 flex items-center gap-2">
            <UserCheck className="w-4 h-4 text-compass-400" />
            <span>
              {groupDecision?.consensus_genres && groupDecision.consensus_genres.length > 0
                ? `Consensus genres: ${groupDecision.consensus_genres.join(', ')}`
                : 'Balanced multi-user scoring with disparity dampening'}
            </span>
          </div>

          <div className="flex items-center gap-3 w-full sm:w-auto">
            <button
              onClick={handleReroll}
              disabled={isCalculating || selectedUserIds.length === 0}
              className="flex-1 sm:flex-none inline-flex items-center justify-center gap-2 px-6 py-3 rounded-2xl bg-obsidian-950 hover:bg-obsidian-850 border border-white/10 hover:border-compass-500/50 text-slate-300 hover:text-white text-xs font-bold transition-all cursor-pointer disabled:opacity-50"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${isCalculating ? 'animate-spin' : ''}`} />
              <span>Reroll Consensus</span>
            </button>

            <button
              onClick={() => handleCalculateGroupDecision(0)}
              disabled={isCalculating || selectedUserIds.length === 0}
              className="flex-1 sm:flex-none inline-flex items-center justify-center gap-2 px-7 py-3 rounded-2xl bg-gradient-to-r from-compass-500 to-amber-500 text-obsidian-950 text-xs font-extrabold transition-all shadow-lg shadow-compass-500/20 hover:scale-[1.02] cursor-pointer disabled:opacity-50"
            >
              <Sparkles className="w-4 h-4 stroke-[2.5]" />
              <span>{isCalculating ? 'Harmonizing...' : 'Calculate Group Decision'}</span>
            </button>
          </div>
        </div>
      </section>

      {/* Step 3: The Group Decision Triad Results */}
      <section className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-2xl font-extrabold text-white tracking-tight flex items-center gap-2">
              <Sparkles className="w-5 h-5 text-compass-400" />
              <span>The Group Compromise Triad</span>
            </h2>
            <p className="text-xs text-slate-400 mt-1">
              {groupDecision?.context_summary || 'Multi-user alignment calculation.'}
            </p>
          </div>
        </div>

        {isCalculating ? (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            {[1, 2, 3].map((i) => (
              <div
                key={i}
                className="h-96 rounded-3xl bg-obsidian-900 animate-pulse border border-white/5"
              />
            ))}
          </div>
        ) : groupDecision &&
          (groupDecision.consensus_pick ||
            groupDecision.compromise_choice ||
            groupDecision.group_wildcard) ? (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            {/* 1. Consensus Pick */}
            {renderGroupSpotlightCard(
              groupDecision.consensus_pick,
              'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40',
              'Consensus Pick',
              'border-emerald-500/40 shadow-emerald-500/10',
              'Zero vetoes • High joint affinity'
            )}

            {/* 2. Compromise Choice */}
            {renderGroupSpotlightCard(
              groupDecision.compromise_choice,
              'bg-amber-500/20 text-amber-300 border border-amber-500/40',
              'Compromise Choice',
              'border-amber-500/40 shadow-amber-500/10',
              'Diplomatic cross-genre bridge'
            )}

            {/* 3. Group Wildcard */}
            {renderGroupSpotlightCard(
              groupDecision.group_wildcard,
              'bg-purple-500/20 text-purple-300 border border-purple-500/40',
              'Group Wildcard',
              'border-purple-500/40 shadow-purple-500/10',
              'Blind-spot discovery for everyone'
            )}
          </div>
        ) : (
          <div className="text-center py-20 bg-obsidian-900/50 rounded-3xl border border-white/5 p-8">
            <AlertCircle className="w-10 h-10 text-slate-600 mx-auto mb-3" />
            <h3 className="text-lg font-bold text-white">No consensus titles found</h3>
            <p className="text-xs text-slate-400 max-w-sm mx-auto mt-1">
              Select at least one companion or widen runtime limits to discover titles matching the group.
            </p>
          </div>
        )}
      </section>

      {/* Modal for detailed title inspection */}
      <TitleDetailModal
        titleId={selectedTitleId}
        onClose={() => setSelectedTitleId(null)}
      />
    </div>
  );
};
export default GroupPage;
