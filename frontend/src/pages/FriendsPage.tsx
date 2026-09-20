import React, { useEffect, useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Users,
  Search,
  UserPlus,
  UserCheck,
  Star,
  Film,
  Sparkles,
  ArrowRight,
  Trash2,
  X,
  Compass,
  Check,
  Clock,
  Mail,
} from 'lucide-react';
import type {
  FriendSummary,
  FriendUserSearchItem,
  FriendProfile,
  FriendRequestItem,
} from '../types';
import { api } from '../services/api';
import { useFriendsWatched } from '../context/FriendsWatchedContext';
import { TitleDetailModal } from '../components/TitleDetailModal';

export const FriendsPage: React.FC = () => {
  const navigate = useNavigate();
  const { refreshFriendsWatched } = useFriendsWatched();

  // Friends state
  const [friends, setFriends] = useState<FriendSummary[]>([]);
  const [isLoadingFriends, setIsLoadingFriends] = useState<boolean>(true);

  // Requests state
  const [incomingRequests, setIncomingRequests] = useState<FriendRequestItem[]>([]);
  const [outgoingRequests, setOutgoingRequests] = useState<FriendRequestItem[]>([]);
  const [isLoadingRequests, setIsLoadingRequests] = useState<boolean>(false);
  const [actionPendingMap, setActionPendingMap] = useState<Record<string, boolean>>({});

  // Search state
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [searchResults, setSearchResults] = useState<FriendUserSearchItem[]>([]);
  const [isSearching, setIsSearching] = useState<boolean>(false);

  // Friend Detail / Taste DNA modal
  const [selectedFriendId, setSelectedFriendId] = useState<number | null>(null);
  const [friendProfile, setFriendProfile] = useState<FriendProfile | null>(null);
  const [isLoadingProfile, setIsLoadingProfile] = useState<boolean>(false);
  const [activeTitleModalId, setActiveTitleModalId] = useState<number | null>(null);

  // Load connected friends
  const loadFriends = useCallback(async () => {
    setIsLoadingFriends(true);
    try {
      const data = await api.getFriends();
      setFriends(data);
    } catch (err) {
      console.error('Failed to load friends', err);
    } finally {
      setIsLoadingFriends(false);
    }
  }, []);

  // Load pending friend requests
  const loadRequests = useCallback(async () => {
    setIsLoadingRequests(true);
    try {
      const data = await api.getFriendRequests();
      setIncomingRequests(data.incoming || []);
      setOutgoingRequests(data.outgoing || []);
    } catch (err) {
      console.error('Failed to load friend requests', err);
    } finally {
      setIsLoadingRequests(false);
    }
  }, []);

  useEffect(() => {
    loadFriends();
    loadRequests();
  }, [loadFriends, loadRequests]);

  // Sync when requests are accepted/declined elsewhere (e.g. from Navbar notification popover)
  useEffect(() => {
    const handleRemoteChange = () => {
      loadFriends();
      loadRequests();
    };
    window.addEventListener('friend_request_accepted', handleRemoteChange);
    window.addEventListener('friend_request_declined', handleRemoteChange);
    return () => {
      window.removeEventListener('friend_request_accepted', handleRemoteChange);
      window.removeEventListener('friend_request_declined', handleRemoteChange);
    };
  }, [loadFriends, loadRequests]);

  // Handle Search users
  useEffect(() => {
    if (!searchQuery.trim()) {
      setSearchResults([]);
      return;
    }

    const timer = setTimeout(async () => {
      setIsSearching(true);
      try {
        const results = await api.searchUsers(searchQuery);
        setSearchResults(results);
      } catch (err) {
        console.error('Failed to search users', err);
      } finally {
        setIsSearching(false);
      }
    }, 300);

    return () => clearTimeout(timer);
  }, [searchQuery]);

  // Send friend request
  const handleSendFriendRequest = async (friendId: number) => {
    const key = `send-${friendId}`;
    setActionPendingMap((prev) => ({ ...prev, [key]: true }));
    try {
      const res = await api.sendFriendRequest(friendId);
      if (res.status === 'friends') {
        // Auto-accepted mutual
        setSearchResults((prev) =>
          prev.map((u) => (u.id === friendId ? { ...u, is_friend: true, relationship_status: 'friends' } : u))
        );
        await Promise.all([loadFriends(), refreshFriendsWatched(), loadRequests()]);
      } else {
        setSearchResults((prev) =>
          prev.map((u) => (u.id === friendId ? { ...u, relationship_status: 'pending_sent' } : u))
        );
        await loadRequests();
      }
      window.dispatchEvent(new CustomEvent('refresh_friend_requests'));
    } catch (err) {
      console.error('Failed to send friend request', err);
    } finally {
      setActionPendingMap((prev) => ({ ...prev, [key]: false }));
    }
  };

  // Accept incoming friend request
  const handleAcceptRequest = async (requestId: number, senderId?: number) => {
    const key = `accept-${requestId}`;
    setActionPendingMap((prev) => ({ ...prev, [key]: true }));

    // Optimistic UI update
    const acceptedReq = incomingRequests.find((r) => r.request_id === requestId);
    setIncomingRequests((prev) => prev.filter((r) => r.request_id !== requestId));

    try {
      await api.acceptFriendRequest(requestId);
      if (senderId) {
        setSearchResults((prev) =>
          prev.map((u) => (u.id === senderId ? { ...u, is_friend: true, relationship_status: 'friends' } : u))
        );
      }
      await Promise.all([loadFriends(), loadRequests(), refreshFriendsWatched()]);
      window.dispatchEvent(new CustomEvent('refresh_friend_requests'));
    } catch (err) {
      console.error('Failed to accept friend request', err);
      if (acceptedReq) {
        setIncomingRequests((prev) => [acceptedReq, ...prev]);
      }
    } finally {
      setActionPendingMap((prev) => ({ ...prev, [key]: false }));
    }
  };

  // Decline incoming friend request
  const handleDeclineRequest = async (requestId: number, senderId?: number) => {
    const key = `decline-${requestId}`;
    setActionPendingMap((prev) => ({ ...prev, [key]: true }));

    // Optimistic UI update
    const declinedReq = incomingRequests.find((r) => r.request_id === requestId);
    setIncomingRequests((prev) => prev.filter((r) => r.request_id !== requestId));

    try {
      await api.declineFriendRequest(requestId);
      if (senderId) {
        setSearchResults((prev) =>
          prev.map((u) => (u.id === senderId ? { ...u, relationship_status: 'none' } : u))
        );
      }
      await loadRequests();
      window.dispatchEvent(new CustomEvent('refresh_friend_requests'));
    } catch (err) {
      console.error('Failed to decline friend request', err);
      if (declinedReq) {
        setIncomingRequests((prev) => [declinedReq, ...prev]);
      }
    } finally {
      setActionPendingMap((prev) => ({ ...prev, [key]: false }));
    }
  };

  // Cancel outgoing friend request
  const handleCancelRequest = async (requestId: number, recipientId?: number) => {
    const key = `cancel-${requestId}`;
    setActionPendingMap((prev) => ({ ...prev, [key]: true }));
    try {
      await api.cancelFriendRequest(requestId);
      await loadRequests();
      if (recipientId) {
        setSearchResults((prev) =>
          prev.map((u) => (u.id === recipientId ? { ...u, relationship_status: 'none' } : u))
        );
      }
    } catch (err) {
      console.error('Failed to cancel friend request', err);
    } finally {
      setActionPendingMap((prev) => ({ ...prev, [key]: false }));
    }
  };

  // Remove friend
  const handleRemoveFriend = async (friendId: number, e: React.MouseEvent) => {
    e.stopPropagation();
    try {
      await api.removeFriend(friendId);
      setFriends((prev) => prev.filter((f) => f.id !== friendId));
      setSearchResults((prev) =>
        prev.map((u) => (u.id === friendId ? { ...u, is_friend: false, relationship_status: 'none' } : u))
      );
      if (selectedFriendId === friendId) {
        setSelectedFriendId(null);
        setFriendProfile(null);
      }
      await refreshFriendsWatched();
    } catch (err) {
      console.error('Failed to remove friend', err);
    }
  };

  // Inspect Friend Taste Profile
  const handleInspectFriend = async (friendId: number) => {
    setSelectedFriendId(friendId);
    setIsLoadingProfile(true);
    try {
      const profile = await api.getFriendTasteProfile(friendId);
      setFriendProfile(profile);
    } catch (err) {
      console.error('Failed to load friend taste profile', err);
    } finally {
      setIsLoadingProfile(false);
    }
  };

  const handleLaunchGroupModeWithFriend = (friendId: number) => {
    navigate(`/group?friend_id=${friendId}`);
  };

  return (
    <div className="space-y-10 pb-24">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-4 pb-6 border-b border-white/5">
        <div>
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-xs font-semibold tracking-wide uppercase mb-3">
            <Users className="w-3.5 h-3.5" />
            <span>Social Discovery & Taste DNA</span>
          </div>
          <h1 className="text-3xl sm:text-4xl font-extrabold text-white tracking-tight">
            Friends & Social Cinema
          </h1>
          <p className="text-sm text-slate-400 max-w-2xl mt-1 leading-relaxed">
            Search and add friends who use Stream Compass. See their taste profiles, explore the movies they’ve rated, and collaborate in Group Mode.
          </p>
        </div>

        <button
          onClick={() => navigate('/group')}
          className="inline-flex items-center gap-2 px-5 py-2.5 rounded-2xl bg-compass-500 text-obsidian-950 text-xs font-bold shadow-lg shadow-compass-500/20 hover:scale-[1.02] transition-all cursor-pointer self-start md:self-auto"
        >
          <Compass className="w-4 h-4" />
          <span>Launch Group Mode</span>
        </button>
      </div>

      {/* Incoming Friend Requests Section */}
      {incomingRequests.length > 0 && (
        <section className="p-6 rounded-3xl bg-gradient-to-r from-emerald-950/50 via-obsidian-900 to-obsidian-900 border border-emerald-500/30 space-y-4 shadow-xl animate-in fade-in">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-xl bg-emerald-500/20 text-emerald-400 flex items-center justify-center font-bold">
                <Mail className="w-4 h-4" />
              </div>
              <div>
                <h2 className="text-base font-bold text-white flex items-center gap-2">
                  <span>Pending Friend Requests</span>
                  <span className="px-2 py-0.5 rounded-full bg-emerald-500 text-obsidian-950 font-extrabold text-[11px]">
                    {incomingRequests.length}
                  </span>
                  {isLoadingRequests && (
                    <span className="text-[10px] text-emerald-300 animate-pulse font-normal">Updating...</span>
                  )}
                </h2>
                <p className="text-xs text-slate-400">
                  These users want to connect and compare movie tastes with you.
                </p>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3 pt-1">
            {incomingRequests.map((req) => (
              <div
                key={req.request_id}
                className="p-4 rounded-2xl bg-obsidian-950/90 border border-emerald-500/20 flex flex-col justify-between gap-3 shadow-md"
              >
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-emerald-500/20 text-emerald-300 font-extrabold flex items-center justify-center text-sm uppercase shrink-0">
                    {req.username[0]}
                  </div>
                  <div className="truncate">
                    <span className="text-sm font-bold text-white block truncate">{req.username}</span>
                    <span className="text-[11px] text-emerald-400/90 truncate block">
                      {req.taste_genres?.length ? req.taste_genres.slice(0, 2).join(', ') : 'Movie Explorer'}
                    </span>
                  </div>
                </div>

                <div className="flex items-center gap-2 pt-1 border-t border-white/5">
                  <button
                    disabled={actionPendingMap[`accept-${req.request_id}`]}
                    onClick={() => handleAcceptRequest(req.request_id, req.user_id)}
                    className="flex-1 py-1.5 px-3 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-obsidian-950 font-bold text-xs flex items-center justify-center gap-1.5 transition-all shadow-sm cursor-pointer disabled:opacity-50"
                  >
                    <Check className="w-3.5 h-3.5 stroke-[2.5]" />
                    <span>Accept</span>
                  </button>
                  <button
                    disabled={actionPendingMap[`decline-${req.request_id}`]}
                    onClick={() => handleDeclineRequest(req.request_id, req.user_id)}
                    className="py-1.5 px-3 rounded-xl bg-white/5 hover:bg-red-500/20 border border-white/10 hover:border-red-500/30 text-slate-300 hover:text-red-400 font-medium text-xs flex items-center justify-center transition-all cursor-pointer disabled:opacity-50"
                  >
                    <X className="w-3.5 h-3.5" />
                    <span>Decline</span>
                  </button>
                </div>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* Section 1: Find & Add Friends Search Bar */}
      <section className="p-6 sm:p-8 rounded-3xl bg-obsidian-900 border border-white/10 space-y-4 shadow-xl">
        <div>
          <h2 className="text-lg font-bold text-white flex items-center gap-2">
            <Search className="w-5 h-5 text-compass-400" />
            <span>Find Friends on Stream Compass</span>
          </h2>
          <p className="text-xs text-slate-400 mt-0.5">
            Search registered users by username or email to connect and share your taste DNA.
          </p>
        </div>

        <div className="relative">
          <Search className="w-5 h-5 text-slate-400 absolute left-4 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Type a friend's username or email address..."
            className="w-full pl-12 pr-4 py-3 rounded-2xl bg-obsidian-950 border border-white/10 focus:border-compass-500 focus:outline-none text-sm text-white placeholder-slate-500 transition-colors"
          />
          {searchQuery && (
            <button
              onClick={() => setSearchQuery('')}
              className="absolute right-4 top-1/2 -translate-y-1/2 p-1 text-slate-400 hover:text-white"
            >
              <X className="w-4 h-4" />
            </button>
          )}
        </div>

        {/* Search Results */}
        {isSearching ? (
          <div className="py-4 text-center text-xs text-slate-500 animate-pulse">
            Searching users...
          </div>
        ) : searchResults.length > 0 ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3 pt-2">
            {searchResults.map((u) => {
              const isFriend = u.is_friend || u.relationship_status === 'friends';
              const isPendingSent = u.relationship_status === 'pending_sent';
              const isPendingReceived = u.relationship_status === 'pending_received';
              const isActionLoading = actionPendingMap[`send-${u.id}`];

              return (
                <div
                  key={u.id}
                  className="p-3.5 rounded-2xl bg-obsidian-950 border border-white/5 flex items-center justify-between gap-2"
                >
                  <div className="flex items-center gap-3 truncate">
                    <div className="w-9 h-9 rounded-xl bg-compass-500/20 text-compass-400 font-extrabold flex items-center justify-center text-sm uppercase shrink-0">
                      {u.username[0]}
                    </div>
                    <div className="truncate">
                      <span className="text-xs font-bold text-white block truncate">
                        {u.username}
                      </span>
                      <span className="text-[10px] text-slate-400 truncate block">
                        {u.taste_genres?.length ? u.taste_genres.slice(0, 2).join(', ') : 'Cinephile'}
                      </span>
                    </div>
                  </div>

                  <div className="shrink-0">
                    {isFriend ? (
                      <span className="inline-flex items-center gap-1 text-[11px] font-bold text-emerald-400 bg-emerald-500/15 border border-emerald-500/30 px-2.5 py-1 rounded-xl">
                        <UserCheck className="w-3.5 h-3.5" />
                        <span>Friend</span>
                      </span>
                    ) : isPendingSent ? (
                      <div className="flex items-center gap-1.5">
                        <span className="inline-flex items-center gap-1 text-[11px] font-bold text-amber-400 bg-amber-500/15 border border-amber-500/30 px-2.5 py-1 rounded-xl">
                          <Clock className="w-3.5 h-3.5" />
                          <span>Pending</span>
                        </span>
                        {outgoingRequests.find((o) => o.user_id === u.id) && (
                          <button
                            type="button"
                            onClick={() =>
                              handleCancelRequest(
                                outgoingRequests.find((o) => o.user_id === u.id)!.request_id,
                                u.id
                              )
                            }
                            className="p-1 rounded-lg text-slate-400 hover:text-red-400 hover:bg-white/5 transition-colors cursor-pointer"
                            title="Cancel Request"
                          >
                            <X className="w-3 h-3" />
                          </button>
                        )}
                      </div>
                    ) : isPendingReceived ? (
                      <span className="inline-flex items-center gap-1 text-[11px] font-bold text-emerald-400 bg-emerald-500/15 border border-emerald-500/30 px-2.5 py-1 rounded-xl">
                        <Mail className="w-3.5 h-3.5" />
                        <span>Check Requests</span>
                      </span>
                    ) : (
                      <button
                        disabled={isActionLoading}
                        onClick={() => handleSendFriendRequest(u.id)}
                        className="inline-flex items-center gap-1 text-[11px] font-bold text-obsidian-950 bg-compass-500 hover:bg-compass-400 px-3 py-1.5 rounded-xl transition-all shadow-md shadow-compass-500/20 cursor-pointer disabled:opacity-50"
                      >
                        <UserPlus className="w-3.5 h-3.5" />
                        <span>{isActionLoading ? 'Sending...' : 'Add Friend'}</span>
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        ) : searchQuery.trim() ? (
          <div className="py-4 text-center text-xs text-slate-500">
            No registered users found matching "{searchQuery}".
          </div>
        ) : null}
      </section>

      {/* Section 2: Connected Friends Directory */}
      <section className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-2xl font-extrabold text-white tracking-tight flex items-center gap-2">
              <Users className="w-6 h-6 text-compass-400" />
              <span>Your Friends ({friends.length})</span>
            </h2>
            <p className="text-xs text-slate-400 mt-1">
              Click on any friend to inspect their Taste DNA and recent movie ratings.
            </p>
          </div>
        </div>

        {isLoadingFriends ? (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {[1, 2, 3].map((i) => (
              <div
                key={i}
                className="h-44 rounded-3xl bg-obsidian-900 animate-pulse border border-white/5"
              />
            ))}
          </div>
        ) : friends.length > 0 ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {friends.map((friend) => (
              <div
                key={friend.id}
                onClick={() => handleInspectFriend(friend.id)}
                className="group p-6 rounded-3xl bg-obsidian-900 border border-white/5 hover:border-compass-500/40 transition-all flex flex-col justify-between shadow-xl cursor-pointer hover:scale-[1.01]"
              >
                <div>
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex items-center gap-3">
                      <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-compass-500/30 to-amber-500/20 border border-compass-500/30 flex items-center justify-center text-white font-extrabold text-lg uppercase shadow-inner">
                        {friend.username[0]}
                      </div>
                      <div>
                        <h3 className="text-base font-bold text-white group-hover:text-compass-400 transition-colors">
                          {friend.username}
                        </h3>
                        <span className="text-xs text-slate-400">Stream Compass Member</span>
                      </div>
                    </div>

                    <button
                      onClick={(e) => handleRemoveFriend(friend.id, e)}
                      className="p-2 text-slate-500 hover:text-red-400 hover:bg-red-500/10 rounded-xl transition-colors cursor-pointer"
                      title="Remove friend"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>

                  {/* Stats Row */}
                  <div className="grid grid-cols-2 gap-2 mt-4 p-3 rounded-2xl bg-obsidian-950/70 border border-white/5 text-center">
                    <div>
                      <span className="text-[10px] text-slate-500 uppercase font-semibold block">
                        Watched
                      </span>
                      <span className="text-sm font-extrabold text-white">
                        {friend.total_watched} titles
                      </span>
                    </div>
                    <div>
                      <span className="text-[10px] text-slate-500 uppercase font-semibold block">
                        Avg Rating
                      </span>
                      <span className="text-sm font-extrabold text-amber-400 flex items-center justify-center gap-1">
                        <Star className="w-3.5 h-3.5 fill-amber-400" />
                        {friend.average_rating > 0 ? friend.average_rating.toFixed(1) : 'N/A'}
                      </span>
                    </div>
                  </div>

                  {/* Top Genres */}
                  <div className="mt-4">
                    <span className="text-[10px] text-slate-400 font-semibold uppercase tracking-wider block mb-1.5">
                      Top Taste Affinities
                    </span>
                    <div className="flex flex-wrap gap-1.5">
                      {friend.taste_genres && friend.taste_genres.length > 0 ? (
                        friend.taste_genres.map((g) => (
                          <span
                            key={g}
                            className="text-[11px] px-2.5 py-0.5 rounded-full bg-white/5 border border-white/10 text-slate-300 font-medium"
                          >
                            {g}
                          </span>
                        ))
                      ) : (
                        <span className="text-xs text-slate-500">General taste</span>
                      )}
                    </div>
                  </div>
                </div>

                {/* Card Action */}
                <div className="pt-4 mt-5 border-t border-white/5 flex items-center justify-between text-xs font-semibold text-compass-400 group-hover:translate-x-0.5 transition-transform">
                  <span>Inspect Taste DNA & Rated Titles</span>
                  <ArrowRight className="w-4 h-4" />
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="text-center py-16 bg-obsidian-900/50 rounded-3xl border border-white/5 p-8 space-y-3">
            <Users className="w-12 h-12 text-slate-600 mx-auto" />
            <h3 className="text-lg font-bold text-white">No friends connected yet</h3>
            <p className="text-xs text-slate-400 max-w-md mx-auto">
              Use the search bar above to search for other users on Stream Compass and add them to compare taste and see what they've watched.
            </p>
          </div>
        )}
      </section>

      {/* Friend Taste DNA Modal / Drawer */}
      {selectedFriendId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6 overflow-y-auto backdrop-blur-md bg-obsidian-950/80 animate-in fade-in duration-200">
          <div
            className="fixed inset-0"
            onClick={() => {
              setSelectedFriendId(null);
              setFriendProfile(null);
            }}
            aria-hidden="true"
          />

          <div className="relative w-full max-w-3xl rounded-3xl bg-obsidian-900 border border-white/10 shadow-2xl z-10 overflow-hidden max-h-[90vh] flex flex-col text-slate-100">
            {/* Modal Header */}
            <div className="p-6 sm:p-8 bg-obsidian-950/80 border-b border-white/5 flex items-start justify-between">
              <div className="flex items-center gap-4">
                <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-compass-500 to-amber-500 text-obsidian-950 font-black text-2xl flex items-center justify-center uppercase shadow-lg shadow-compass-500/20">
                  {friendProfile?.username?.[0] || 'F'}
                </div>
                <div>
                  <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-emerald-500/15 border border-emerald-500/30 text-emerald-400 text-[11px] font-bold mb-1">
                    <UserCheck className="w-3 h-3" />
                    <span>Friend’s Taste Profile</span>
                  </div>
                  <h2 className="text-2xl font-extrabold text-white tracking-tight">
                    {friendProfile?.username}
                  </h2>
                </div>
              </div>

              <button
                onClick={() => {
                  setSelectedFriendId(null);
                  setFriendProfile(null);
                }}
                className="p-2 text-slate-400 hover:text-white hover:bg-white/5 rounded-full transition-colors cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Modal Body */}
            <div className="p-6 sm:p-8 overflow-y-auto space-y-8 flex-1">
              {isLoadingProfile || !friendProfile ? (
                <div className="py-20 text-center text-xs text-slate-500 animate-pulse">
                  Loading {friendProfile?.username || 'friend'}’s taste DNA...
                </div>
              ) : (
                <>
                  {/* Top Stats */}
                  <div className="grid grid-cols-3 gap-3">
                    <div className="p-4 rounded-2xl bg-obsidian-950 border border-white/5 text-center">
                      <span className="text-[11px] text-slate-400 block uppercase font-medium">
                        Total Watched
                      </span>
                      <span className="text-2xl font-black text-white mt-1 block">
                        {friendProfile.total_watched}
                      </span>
                    </div>
                    <div className="p-4 rounded-2xl bg-obsidian-950 border border-white/5 text-center">
                      <span className="text-[11px] text-slate-400 block uppercase font-medium">
                        Total Rated
                      </span>
                      <span className="text-2xl font-black text-white mt-1 block">
                        {friendProfile.total_rated}
                      </span>
                    </div>
                    <div className="p-4 rounded-2xl bg-obsidian-950 border border-white/5 text-center">
                      <span className="text-[11px] text-slate-400 block uppercase font-medium">
                        Average Rating
                      </span>
                      <span className="text-2xl font-black text-amber-400 mt-1 flex items-center justify-center gap-1">
                        <Star className="w-5 h-5 fill-amber-400" />
                        {friendProfile.average_rating > 0
                          ? friendProfile.average_rating.toFixed(1)
                          : 'N/A'}
                      </span>
                    </div>
                  </div>

                  {/* Favorite Genres */}
                  <div>
                    <h3 className="text-sm font-bold text-white uppercase tracking-wider mb-3 flex items-center gap-2">
                      <Sparkles className="w-4 h-4 text-compass-400" />
                      <span>Favorite Genres</span>
                    </h3>
                    <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                      {friendProfile.favorite_genres.map((fg) => (
                        <div
                          key={fg.genre}
                          className="p-3 rounded-2xl bg-obsidian-950 border border-white/5 flex items-center justify-between"
                        >
                          <span className="text-xs font-bold text-slate-200">{fg.genre}</span>
                          <span className="text-xs font-semibold px-2 py-0.5 rounded-md bg-compass-500/20 text-compass-300">
                            {fg.count}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Watched & Rated Titles */}
                  <div>
                    <h3 className="text-sm font-bold text-white uppercase tracking-wider mb-3 flex items-center gap-2">
                      <Film className="w-4 h-4 text-compass-400" />
                      <span>Titles Watched & Rated by {friendProfile.username}</span>
                    </h3>

                    {friendProfile.recent_watched.length > 0 ? (
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        {friendProfile.recent_watched.map((item) => (
                          <div
                            key={item.title_id}
                            onClick={() => setActiveTitleModalId(item.title_id)}
                            className="p-3 rounded-2xl bg-obsidian-950 border border-white/5 hover:border-compass-500/40 transition-all flex gap-3 cursor-pointer group"
                          >
                            <div className="w-14 h-20 rounded-xl overflow-hidden bg-obsidian-850 shrink-0 relative">
                              {item.poster_path ? (
                                <img
                                  src={item.poster_path}
                                  alt={item.title}
                                  className="w-full h-full object-cover group-hover:scale-105 transition-transform"
                                />
                              ) : (
                                <div className="w-full h-full flex items-center justify-center text-slate-700 text-[10px]">
                                  No poster
                                </div>
                              )}
                            </div>

                            <div className="flex-1 flex flex-col justify-between truncate">
                              <div>
                                <h4 className="text-xs font-bold text-white group-hover:text-compass-400 transition-colors truncate">
                                  {item.title}
                                </h4>
                                {item.rating ? (
                                  <div className="flex items-center gap-1 text-xs font-bold text-amber-400 mt-1">
                                    <Star className="w-3.5 h-3.5 fill-amber-400" />
                                    <span>{item.rating}★</span>
                                    <span className="text-[10px] text-slate-500 font-normal">
                                      ({friendProfile.username}'s rating)
                                    </span>
                                  </div>
                                ) : (
                                  <span className="text-[10px] text-emerald-400 font-semibold block mt-1">
                                    ✓ Watched
                                  </span>
                                )}
                              </div>

                              {item.rating_reason && (
                                <div className="mt-1">
                                  <span className="text-[10px] px-2 py-0.5 rounded bg-compass-500/20 text-compass-300 font-medium line-clamp-1">
                                    "{item.rating_reason}"
                                  </span>
                                </div>
                              )}
                            </div>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <div className="p-6 rounded-2xl bg-obsidian-950 border border-white/5 text-center text-xs text-slate-500">
                        {friendProfile.username} has not marked any titles as watched yet.
                      </div>
                    )}
                  </div>
                </>
              )}
            </div>

            {/* Modal Footer */}
            <div className="p-6 bg-obsidian-950 border-t border-white/5 flex items-center justify-between">
              <span className="text-xs text-slate-400">
                Want to watch together tonight?
              </span>

              <button
                onClick={() => handleLaunchGroupModeWithFriend(selectedFriendId)}
                className="inline-flex items-center gap-2 px-6 py-2.5 rounded-2xl bg-gradient-to-r from-compass-500 to-amber-500 text-obsidian-950 text-xs font-extrabold shadow-lg shadow-compass-500/20 hover:scale-[1.02] transition-all cursor-pointer"
              >
                <Compass className="w-4 h-4" />
                <span>Watch with {friendProfile?.username || 'Friend'} in Group Mode</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Inspect title details */}
      <TitleDetailModal
        titleId={activeTitleModalId}
        onClose={() => setActiveTitleModalId(null)}
      />
    </div>
  );
};
export default FriendsPage;
