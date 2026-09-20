import { useEffect, useState, useRef } from 'react';
import { createPortal } from 'react-dom';
import { X, Star, Clock, Calendar, Film, Tv, Plus, Check, Compass, Users, Eye, Sparkles, ExternalLink, ChevronDown } from 'lucide-react';


import type { TitleDetail, Title } from '../types';
import { api } from '../services/api';
import { useAuth } from '../context/AuthContext';
import { useFriendsWatched } from '../context/FriendsWatchedContext';


interface TitleDetailModalProps {
  titleId: number | null;
  onClose: () => void;
  onSelectTitle?: (id: number) => void;
  onInteractionChange?: () => void;
}

const RATING_REASONS = [
  'Brilliant Storytelling',
  'Masterpiece',
  'Great Acting',
  'Stunning Visuals',
  'Mind Bending',
  'Thrilling Pace',
  'Emotional Impact',
  'Disappointing',
  'Boring Pace',
];

export const TitleDetailModal = ({
  titleId,
  onClose,
  onSelectTitle,
  onInteractionChange,
}: TitleDetailModalProps) => {
  const { user } = useAuth();
  const { getFriendsForTitle } = useFriendsWatched();
  const [detail, setDetail] = useState<TitleDetail | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [inWatchlist, setInWatchlist] = useState(false);
  const [isWatched, setIsWatched] = useState(false);
  const [userRating, setUserRating] = useState<number>(0);
  const [selectedReason, setSelectedReason] = useState<string>('');
  const [isSaving, setIsSaving] = useState(false);
  const [showFriendsDropdown, setShowFriendsDropdown] = useState(false);
  const friendsDropdownRef = useRef<HTMLDivElement>(null);

  const friendsForTitle = titleId ? getFriendsForTitle(titleId) : [];

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (friendsDropdownRef.current && !friendsDropdownRef.current.contains(e.target as Node)) {
        setShowFriendsDropdown(false);
      }
    };
    if (showFriendsDropdown) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [showFriendsDropdown]);


  useEffect(() => {
    // Immediately reset interaction states so previous movie's or account's status doesn't linger
    setIsWatched(false);
    setUserRating(0);
    setSelectedReason('');
    setInWatchlist(false);

    if (!titleId) {
      setDetail(null);
      return;
    }

    let isMounted = true;
    setIsLoading(true);

    // Fetch title details
    api
      .getTitleDetails(titleId)
      .then((data) => {
        if (isMounted) {
          setDetail(data);
          setIsLoading(false);
        }
      })
      .catch((err) => {
        console.error('Failed to load title details', err);
        if (isMounted) setIsLoading(false);
      });

    // Fetch user title interaction status if authenticated
    if (user) {
      api
        .getTitleStatus(titleId)
        .then((status) => {
          if (isMounted) {
            setIsWatched(status.is_watched);
            setUserRating(status.user_rating || 0);
            setSelectedReason(status.rating_reason || '');
            setInWatchlist(status.in_watchlist);
          }
        })
        .catch((err) => console.error('Failed to load status', err));
    }

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handleKeyDown);

    return () => {
      isMounted = false;
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [titleId, onClose, user]);

  const handleRate = async (score: number, reason?: string) => {
    if (!titleId || !user) return;
    const newScore = userRating === score && !reason ? 0 : score;
    const newReason = reason !== undefined ? reason : selectedReason;

    setIsSaving(true);
    try {
      if (newScore === 0) {
        await api.rateTitle({
          title_id: titleId,
          rating: null,
          rating_reason: null,
          watched: isWatched,
        });
        setUserRating(0);
        setSelectedReason('');
      } else {
        await api.rateTitle({
          title_id: titleId,
          rating: newScore,
          rating_reason: newReason || undefined,
          watched: true,
        });
        setUserRating(newScore);
        setIsWatched(true);
        if (newReason) setSelectedReason(newReason);
      }
      onInteractionChange?.();
    } catch (err) {
      console.error('Failed to save rating', err);
    } finally {
      setIsSaving(false);
    }
  };

  const handleReasonClick = async (reason: string) => {
    const nextReason = selectedReason === reason ? '' : reason;
    setSelectedReason(nextReason);
    if (userRating > 0 && titleId) {
      await handleRate(userRating, nextReason);
    }
  };

  const handleToggleWatched = async () => {
    if (!titleId || !user) return;
    setIsSaving(true);
    try {
      const nextWatched = !isWatched;
      await api.toggleWatched({ title_id: titleId, watched: nextWatched });
      setIsWatched(nextWatched);
      if (!nextWatched) {
        setUserRating(0);
        setSelectedReason('');
      }
      onInteractionChange?.();
    } catch (err) {
      console.error('Failed to toggle watched', err);
    } finally {
      setIsSaving(false);
    }
  };

  const handleToggleWatchlist = async () => {
    if (!titleId || !user) return;
    setIsSaving(true);
    try {
      await api.toggleWatchlist({ title_id: titleId });
      setInWatchlist(!inWatchlist);
      onInteractionChange?.();
    } catch (err) {
      console.error('Failed to toggle watchlist', err);
    } finally {
      setIsSaving(false);
    }
  };

  if (!titleId) return null;

  return createPortal(
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6 overflow-y-auto backdrop-blur-md bg-obsidian-950/80 animate-in fade-in duration-200">
      <div className="fixed inset-0" onClick={onClose} aria-hidden="true" />

      <div className="relative w-full max-w-3xl rounded-3xl bg-obsidian-900 border border-white/10 shadow-2xl overflow-hidden z-10 my-4 sm:my-6 text-slate-100 flex flex-col max-h-[88vh]">
        {/* Close Button */}
        <button
          onClick={onClose}
          className="absolute top-4 right-4 z-30 p-2 rounded-full bg-obsidian-950/80 hover:bg-obsidian-900 border border-white/10 text-white transition-all cursor-pointer shadow-lg backdrop-blur-md"
          title="Close details"
        >
          <X className="w-5 h-5" />
        </button>

        {isLoading ? (
          <div className="h-96 flex flex-col items-center justify-center gap-3">
            <div className="w-8 h-8 border-2 border-compass-500 border-t-transparent rounded-full animate-spin" />
            <p className="text-xs text-slate-400">Consulting catalog coordinates...</p>
          </div>
        ) : detail ? (
          <>
            {/* Netflix-Style Hero Backdrop Banner Header */}
            <div className="relative h-72 sm:h-80 md:h-96 w-full overflow-hidden bg-obsidian-950 shrink-0">
              {detail.backdrop_path || detail.poster_path ? (
                <img
                  src={detail.backdrop_path || detail.poster_path || ''}
                  alt={detail.title}
                  className="w-full h-full object-cover object-center"
                />
              ) : (
                <div className="w-full h-full flex items-center justify-center text-slate-600">
                  <Film className="w-12 h-12 stroke-[1]" />
                </div>
              )}
              {/* Cinematic Vignette & Gradient Overlays */}
              <div className="absolute inset-0 bg-gradient-to-t from-obsidian-900 via-obsidian-900/50 to-transparent" />
              <div className="absolute inset-0 bg-gradient-to-r from-obsidian-950/70 via-transparent to-transparent opacity-80" />

              {/* Netflix Overlaid Hero Content (Bottom of Banner) */}
              <div className="absolute bottom-5 left-5 right-5 sm:bottom-6 sm:left-6 sm:right-6 z-20 space-y-3">
                {/* Badges row */}
                <div className="flex flex-wrap items-center gap-2">
                  <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md bg-compass-500/20 border border-compass-500/40 text-compass-400 text-xs font-bold uppercase tracking-wider backdrop-blur-md">
                    {detail.type === 'series' ? (
                      <>
                        <Tv className="w-3.5 h-3.5" /> Series
                      </>
                    ) : (
                      <>
                        <Film className="w-3.5 h-3.5" /> Movie
                      </>
                    )}
                  </span>
                  <span className="flex items-center gap-1 px-2.5 py-1 rounded-md bg-obsidian-950/80 backdrop-blur-md border border-white/10 text-xs font-bold text-amber-400">
                    <Star className="w-3.5 h-3.5 fill-amber-400" />
                    <span>{detail.vote_average.toFixed(1)}</span>
                    <span className="text-[10px] text-slate-400 font-normal">
                      ({detail.vote_count.toLocaleString()})
                    </span>
                  </span>

                  {/* Friends Who Watched Badge with Popover */}
                  {friendsForTitle && friendsForTitle.length > 0 && (
                    <div className="relative" ref={friendsDropdownRef}>
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          setShowFriendsDropdown(!showFriendsDropdown);
                        }}
                        className="flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-emerald-950/90 hover:bg-emerald-900/90 border border-emerald-500/40 text-xs font-bold text-emerald-300 transition-all cursor-pointer shadow-lg hover:scale-105 active:scale-95 backdrop-blur-md"
                        title="Click to view friends who watched this"
                      >
                        <Users className="w-3.5 h-3.5 text-emerald-400" />
                        <span>{friendsForTitle.length} {friendsForTitle.length === 1 ? 'Friend' : 'Friends'} Watched</span>
                        <ChevronDown className={`w-3 h-3 text-emerald-400 transition-transform ${showFriendsDropdown ? 'rotate-180' : ''}`} />
                      </button>

                      {/* Dropdown Popover */}
                      {showFriendsDropdown && (
                        <div className="absolute left-0 bottom-full mb-2 z-50 w-72 sm:w-80 max-h-60 overflow-y-auto p-3 rounded-2xl bg-obsidian-950/95 border border-emerald-500/40 shadow-2xl backdrop-blur-xl space-y-2 animate-dropdown text-left">
                          <div className="flex items-center justify-between pb-1.5 border-b border-white/10">
                            <span className="text-[10px] font-bold text-emerald-400 uppercase tracking-wider flex items-center gap-1">
                              <Users className="w-3 h-3" /> Friends Watched ({friendsForTitle.length})
                            </span>
                            <span className="text-[10px] text-slate-400">Social Radar</span>
                          </div>
                          <div className="space-y-1.5 pt-1">
                            {friendsForTitle.map((f) => (
                              <div
                                key={f.friend_id}
                                className="p-2 rounded-xl bg-obsidian-900/90 border border-white/5 flex items-center justify-between gap-2"
                              >
                                <div className="flex items-center gap-2 truncate">
                                  <div className="w-6 h-6 rounded-md bg-emerald-500/20 flex items-center justify-center font-extrabold text-[10px] text-emerald-300 uppercase shrink-0">
                                    {f.friend_username[0]}
                                  </div>
                                  <div className="truncate">
                                    <span className="text-xs font-bold text-white block truncate">{f.friend_username}</span>
                                    {f.rating_reason ? (
                                      <span className="text-[10px] text-slate-300 block truncate">"{f.rating_reason}"</span>
                                    ) : (
                                      <span className="text-[10px] text-emerald-400 block">Watched</span>
                                    )}
                                  </div>
                                </div>
                                {f.rating ? (
                                  <span className="flex items-center gap-0.5 text-xs font-bold text-amber-400 shrink-0">
                                    <Star className="w-3 h-3 fill-amber-400" />
                                    {f.rating}★
                                  </span>
                                ) : null}
                              </div>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  )}
                </div>

                {/* Big Bold Netflix Title */}
                <h2 className="text-2xl sm:text-4xl font-black text-white tracking-tight drop-shadow-md">
                  {detail.title}
                </h2>

                {/* Action Buttons Row directly on banner (Netflix Style) */}
                {user && (
                  <div className="flex flex-wrap items-center gap-2.5 pt-1">
                    {/* Watched toggle */}
                    <button
                      disabled={isSaving}
                      onClick={handleToggleWatched}
                      className={`inline-flex items-center gap-2 px-4 py-2 rounded-xl text-xs sm:text-sm font-bold transition-all cursor-pointer shadow-lg backdrop-blur-md ${
                        isWatched
                          ? 'bg-emerald-500 text-obsidian-950 font-extrabold shadow-emerald-500/20'
                          : 'bg-white/15 hover:bg-white/25 border border-white/20 text-white'
                      }`}
                      title={isWatched ? 'Mark as unwatched' : 'Mark as watched'}
                    >
                      <Eye className="w-4 h-4" />
                      <span>{isWatched ? 'Watched' : 'Mark Watched'}</span>
                    </button>

                    {/* Watchlist toggle */}
                    <button
                      disabled={isSaving}
                      onClick={handleToggleWatchlist}
                      className={`inline-flex items-center gap-2 px-4 py-2 rounded-xl text-xs sm:text-sm font-bold transition-all cursor-pointer shadow-lg backdrop-blur-md ${
                        inWatchlist
                          ? 'bg-compass-500 text-obsidian-950 font-extrabold shadow-compass-500/20'
                          : 'bg-white/15 hover:bg-white/25 border border-white/20 text-white'
                      }`}
                    >
                      {inWatchlist ? <Check className="w-4 h-4 stroke-[2.5]" /> : <Plus className="w-4 h-4" />}
                      <span>{inWatchlist ? 'In Watchlist' : 'Add to Watchlist'}</span>
                    </button>

                    {/* Quick Rating Selector */}
                    <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-obsidian-950/80 backdrop-blur-md border border-white/15 text-xs">
                      <span className="text-slate-400 mr-1 hidden sm:inline">Rate:</span>
                      {[1, 2, 3, 4, 5].map((s) => (
                        <button
                          key={s}
                          disabled={isSaving}
                          onClick={() => handleRate(s)}
                          className="p-1 hover:scale-125 transition-transform cursor-pointer"
                          title={`Rate ${s} star${s > 1 ? 's' : ''}`}
                        >
                          <Star
                            className={`w-3.5 h-3.5 ${
                              s <= userRating
                                ? 'fill-compass-400 text-compass-400'
                                : 'text-slate-600 hover:text-slate-400'
                            }`}
                          />
                        </button>
                      ))}
                      {userRating > 0 && (
                        <span className="text-xs font-bold text-compass-400 ml-1">{userRating}★</span>
                      )}
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* Content Body (Netflix 2-Column Info Layout) */}
            <div className="p-5 sm:p-7 space-y-6 overflow-y-auto flex-1">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                {/* Main 2-column info */}
                <div className="md:col-span-2 space-y-4">
                  {/* Year & Runtime line */}
                  <div className="flex flex-wrap items-center gap-3 text-xs text-slate-300 font-medium">
                    {detail.release_date && (
                      <span className="flex items-center gap-1">
                        <Calendar className="w-3.5 h-3.5 text-compass-400" />
                        {detail.release_date.slice(0, 4)}
                      </span>
                    )}
                    {detail.runtime_minutes && (
                      <span className="flex items-center gap-1">
                        <Clock className="w-3.5 h-3.5 text-compass-400" />
                        {detail.runtime_minutes} mins
                      </span>
                    )}
                    {detail.director && (
                      <span className="text-slate-400">
                        Dir. <span className="text-slate-200">{detail.director}</span>
                      </span>
                    )}
                  </div>

                  {/* Synopsis */}
                  <p className="text-sm text-slate-300 leading-relaxed">
                    {detail.overview || 'No synopsis provided for this title.'}
                  </p>

                  {/* Rating Reasons (PRD Section 4) */}
                  {user && userRating > 0 && (
                    <div className="p-3.5 rounded-2xl bg-obsidian-950/80 border border-white/5 space-y-2">
                      <div className="flex items-center gap-1.5 text-[11px] text-slate-400">
                        <Sparkles className="w-3.5 h-3.5 text-compass-400" />
                        <span>Why this rating? (Helps tailor future recommendations):</span>
                      </div>
                      <div className="flex flex-wrap gap-1.5">
                        {RATING_REASONS.map((reason) => {
                          const isSelected = selectedReason === reason;
                          return (
                            <button
                              key={reason}
                              type="button"
                              onClick={() => handleReasonClick(reason)}
                              className={`text-[11px] px-2.5 py-1 rounded-lg border transition-all cursor-pointer ${
                                isSelected
                                  ? 'bg-compass-500/20 text-compass-300 border-compass-400/50 font-semibold shadow-sm'
                                  : 'bg-obsidian-900 text-slate-400 border-white/5 hover:border-white/20 hover:text-slate-200'
                              }`}
                            >
                              {reason}
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  )}

                  {/* Deep Watch Availability Integration */}
                  {detail.watch_options && detail.watch_options.length > 0 && (
                    <div className="p-4 rounded-2xl bg-gradient-to-r from-obsidian-950 via-obsidian-900 to-obsidian-950 border border-white/10 space-y-3">
                      <div className="flex items-center justify-between">
                        <h4 className="text-xs font-bold uppercase tracking-wider text-slate-300 flex items-center gap-2">
                          <Sparkles className="w-3.5 h-3.5 text-compass-400" />
                          Stream Legally On
                        </h4>
                        <span className="text-[10px] text-slate-400 uppercase tracking-wider font-semibold">
                          Direct Legal Watch
                        </span>
                      </div>
                      <div className="flex flex-wrap items-center gap-2.5">
                        {detail.watch_options.map((opt) => (
                          <a
                            key={opt.provider_key}
                            href={opt.watch_url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-bold transition-all shadow-sm hover:scale-105 active:scale-95"
                            style={{
                              backgroundColor: opt.button_bg,
                              color: opt.button_text,
                            }}
                          >
                            <span>{opt.provider_name}</span>
                            <ExternalLink className="w-3.5 h-3.5 opacity-85" />
                          </a>
                        ))}
                      </div>
                    </div>
                  )}
                </div>

                {/* Right side metadata column (Netflix style) */}
                <div className="space-y-4 text-xs border-t md:border-t-0 md:border-l border-white/5 pt-4 md:pt-0 md:pl-6">
                  {detail.cast_members && (
                    <div>
                      <span className="text-slate-500 font-semibold block mb-1">Key Cast:</span>
                      <p className="text-slate-300 leading-relaxed">{detail.cast_members}</p>
                    </div>
                  )}

                  {detail.genres && detail.genres.length > 0 && (
                    <div>
                      <span className="text-slate-500 font-semibold block mb-1.5">Genres:</span>
                      <div className="flex flex-wrap gap-1.5">
                        {detail.genres.map((g) => (
                          <span
                            key={g.id}
                            className="px-2 py-0.5 rounded-md bg-white/5 border border-white/10 text-slate-300 text-[11px]"
                          >
                            {g.name}
                          </span>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              </div>

              {/* Similar Titles / More Like This */}
              {detail.similar_titles && detail.similar_titles.length > 0 && (
                <div className="pt-4 border-t border-white/5">
                  <h4 className="text-xs font-bold uppercase tracking-wider text-compass-400 mb-3 flex items-center gap-1.5">
                    <Compass className="w-3.5 h-3.5" />
                    More Like This
                  </h4>
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                    {detail.similar_titles.map((sim: Title) => (
                      <div
                        key={sim.id}
                        onClick={() => {
                          if (onSelectTitle) onSelectTitle(sim.id);
                        }}
                        className="group cursor-pointer rounded-xl overflow-hidden bg-obsidian-950 border border-white/5 hover:border-compass-500/50 transition-all p-2 flex flex-col"
                      >
                        <div className="aspect-[2/3] w-full rounded-lg overflow-hidden bg-obsidian-850 mb-2 relative">
                          {sim.poster_path ? (
                            <img
                              src={sim.poster_path}
                              alt={sim.title}
                              className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                            />
                          ) : (
                            <div className="w-full h-full flex items-center justify-center text-slate-700 text-[10px]">
                              No Poster
                            </div>
                          )}
                        </div>
                        <h5 className="text-xs font-bold text-white truncate group-hover:text-compass-400 transition-colors">
                          {sim.title}
                        </h5>
                        <div className="flex items-center justify-between text-[10px] text-slate-400 mt-0.5">
                          <span>{sim.release_date?.slice(0, 4)}</span>
                          <span className="flex items-center gap-0.5 text-amber-400">
                            <Star className="w-2.5 h-2.5 fill-amber-400" />
                            {sim.vote_average.toFixed(1)}
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </>
        ) : (
          <div className="p-8 text-center text-slate-400">Title details not found.</div>
        )}
      </div>
    </div>,
    document.body
  );
};
