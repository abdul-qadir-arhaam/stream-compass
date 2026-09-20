import { useState, useRef, useEffect, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { Link, useNavigate } from 'react-router-dom';
import {
  Compass,
  LogOut,
  BookOpen,
  Bookmark,
  Sparkles,
  Search,
  Activity,
  Users,
  ChevronDown,
  X,
  Bell,
  Check,
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { useFriendsWatched } from '../context/FriendsWatchedContext';
import { api } from '../services/api';
import type { FriendRequestItem } from '../types';

export const Navbar = () => {
  const { user, logout } = useAuth();
  const { refreshFriendsWatched } = useFriendsWatched();
  const navigate = useNavigate();

  const [isProfileOpen, setIsProfileOpen] = useState(false);
  const [isNotificationsOpen, setIsNotificationsOpen] = useState(false);
  const [showLogoutModal, setShowLogoutModal] = useState(false);
  const [incomingRequests, setIncomingRequests] = useState<FriendRequestItem[]>([]);
  const [actionPendingMap, setActionPendingMap] = useState<Record<string, boolean>>({});

  const profileMenuRef = useRef<HTMLDivElement>(null);
  const notificationMenuRef = useRef<HTMLDivElement>(null);

  // Load friend requests
  const loadNotifications = useCallback(async () => {
    if (!user) {
      setIncomingRequests([]);
      return;
    }
    try {
      const data = await api.getFriendRequests();
      setIncomingRequests(data.incoming || []);
    } catch (err) {
      console.error('Failed to load notifications', err);
    }
  }, [user]);

  useEffect(() => {
    loadNotifications();
  }, [loadNotifications]);

  // Periodic polling & event listeners for notifications
  useEffect(() => {
    if (!user) return;

    const interval = setInterval(() => {
      if (document.visibilityState === 'visible') {
        loadNotifications();
      }
    }, 20000);

    const handleFocus = () => loadNotifications();
    const handleCustomRefresh = () => loadNotifications();

    window.addEventListener('focus', handleFocus);
    window.addEventListener('refresh_friend_requests', handleCustomRefresh);
    window.addEventListener('friend_request_accepted', handleCustomRefresh);

    return () => {
      clearInterval(interval);
      window.removeEventListener('focus', handleFocus);
      window.removeEventListener('refresh_friend_requests', handleCustomRefresh);
      window.removeEventListener('friend_request_accepted', handleCustomRefresh);
    };
  }, [user, loadNotifications]);

  // Close menus on outside click
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      const target = e.target as Node;
      if (profileMenuRef.current && !profileMenuRef.current.contains(target)) {
        setIsProfileOpen(false);
      }
      if (notificationMenuRef.current && !notificationMenuRef.current.contains(target)) {
        setIsNotificationsOpen(false);
      }
    };
    if (isProfileOpen || isNotificationsOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isProfileOpen, isNotificationsOpen]);

  const handleAcceptRequest = async (requestId: number) => {
    const key = `accept-${requestId}`;
    setActionPendingMap((prev) => ({ ...prev, [key]: true }));
    try {
      await api.acceptFriendRequest(requestId);
      setIncomingRequests((prev) => prev.filter((r) => r.request_id !== requestId));
      await refreshFriendsWatched();
      window.dispatchEvent(new CustomEvent('friend_request_accepted', { detail: { requestId } }));
    } catch (err) {
      console.error('Failed to accept friend request', err);
    } finally {
      setActionPendingMap((prev) => ({ ...prev, [key]: false }));
    }
  };

  const handleDeclineRequest = async (requestId: number) => {
    const key = `decline-${requestId}`;
    setActionPendingMap((prev) => ({ ...prev, [key]: true }));
    try {
      await api.declineFriendRequest(requestId);
      setIncomingRequests((prev) => prev.filter((r) => r.request_id !== requestId));
      window.dispatchEvent(new CustomEvent('friend_request_declined', { detail: { requestId } }));
    } catch (err) {
      console.error('Failed to decline friend request', err);
    } finally {
      setActionPendingMap((prev) => ({ ...prev, [key]: false }));
    }
  };

  const handleConfirmLogout = () => {
    setShowLogoutModal(false);
    setIsProfileOpen(false);
    setIsNotificationsOpen(false);
    logout();
    navigate('/');
  };

  return (
    <>
      <header className="sticky top-0 z-40 backdrop-blur-md bg-obsidian-950/80 border-b border-white/5 transition-all">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
          {/* Brand */}
          <Link to="/" className="flex items-center gap-2.5 group shrink-0">
            <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-compass-400 to-compass-600 flex items-center justify-center shadow-lg shadow-compass-500/20 group-hover:scale-105 transition-transform">
              <Compass className="w-5 h-5 text-obsidian-950 stroke-[2.2]" />
            </div>
            <div>
              <span className="font-bold text-lg tracking-tight text-white flex items-center gap-1.5">
                Stream Compass
              </span>
              <span className="block text-[10px] tracking-wider uppercase text-compass-400/80 font-medium -mt-1">
                Decision Engine
              </span>
            </div>
          </Link>

          {/* Primary Navigation - De-congested */}
          <nav className="hidden md:flex items-center gap-6 text-sm font-medium text-slate-300">
            {user && (
              <Link
                to="/home"
                className="hover:text-compass-400 transition-colors flex items-center gap-1.5"
              >
                <Compass className="w-4 h-4 text-compass-400" />
                For You
              </Link>
            )}
            <Link
              to="/decision"
              className="hover:text-compass-400 transition-colors flex items-center gap-1.5"
            >
              <Sparkles className="w-4 h-4 text-compass-400" />
              Decision Engine
            </Link>
            <Link
              to="/group"
              className="hover:text-amber-400 transition-colors flex items-center gap-1.5"
            >
              <Users className="w-4 h-4 text-amber-400" />
              Group Mode
            </Link>
            <Link
              to="/search"
              className="hover:text-compass-400 transition-colors flex items-center gap-1.5"
            >
              <Search className="w-4 h-4 text-compass-400" />
              Search & Catalog
            </Link>
          </nav>

          {/* User Profile / Auth Actions */}
          <div className="flex items-center gap-3">
            <Link
              to="/search"
              className="md:hidden p-2 text-slate-400 hover:text-white rounded-lg hover:bg-white/5"
              title="Search"
            >
              <Search className="w-4 h-4" />
            </Link>

            {user ? (
              <div className="flex items-center gap-2">
                {/* Notification Bell Button & Dropdown */}
                <div className="relative" ref={notificationMenuRef}>
                  <button
                    onClick={() => {
                      setIsNotificationsOpen(!isNotificationsOpen);
                      setIsProfileOpen(false);
                    }}
                    className={`relative p-2 rounded-xl border transition-all cursor-pointer shadow-sm ${
                      isNotificationsOpen
                        ? 'bg-compass-500/20 border-compass-500/50 text-compass-300'
                        : incomingRequests.length > 0
                        ? 'bg-obsidian-900 border-emerald-500/40 text-emerald-400 hover:border-emerald-400'
                        : 'bg-obsidian-900 border-white/10 hover:border-white/20 text-slate-300 hover:text-white'
                    }`}
                    title={
                      incomingRequests.length > 0
                        ? `${incomingRequests.length} pending friend request${incomingRequests.length > 1 ? 's' : ''}`
                        : 'Notifications'
                    }
                  >
                    <Bell className="w-4 h-4" />
                    {incomingRequests.length > 0 && (
                      <span className="absolute -top-1 -right-1 min-w-[18px] h-[18px] px-1 rounded-full bg-emerald-500 text-obsidian-950 font-black text-[10px] flex items-center justify-center ring-2 ring-obsidian-950 shadow-md animate-pulse">
                        {incomingRequests.length}
                      </span>
                    )}
                  </button>

                  {/* Notification Dropdown Popover */}
                  {isNotificationsOpen && (
                    <div className="absolute right-0 top-full mt-2 w-80 sm:w-96 rounded-2xl bg-obsidian-950/95 border border-white/10 shadow-2xl p-3.5 z-50 backdrop-blur-xl animate-dropdown space-y-3">
                      {/* Header */}
                      <div className="flex items-center justify-between px-1 pb-2 border-b border-white/5">
                        <div className="flex items-center gap-2">
                          <Bell className="w-4 h-4 text-compass-400" />
                          <h3 className="text-xs font-bold text-white uppercase tracking-wider">
                            Friend Requests
                          </h3>
                        </div>
                        {incomingRequests.length > 0 ? (
                          <span className="px-2 py-0.5 rounded-full bg-emerald-500/20 border border-emerald-500/30 text-emerald-400 text-[10px] font-bold">
                            {incomingRequests.length} Pending
                          </span>
                        ) : (
                          <span className="text-[10px] text-slate-500">All caught up</span>
                        )}
                      </div>

                      {/* Request List */}
                      {incomingRequests.length === 0 ? (
                        <div className="py-6 px-3 text-center space-y-1.5">
                          <Users className="w-8 h-8 text-slate-600 mx-auto" />
                          <p className="text-xs font-semibold text-slate-300">No pending friend requests</p>
                          <p className="text-[11px] text-slate-500">
                            When another user connects with you, their request will appear here for one-click approval.
                          </p>
                        </div>
                      ) : (
                        <div className="max-h-72 overflow-y-auto space-y-2 pr-1">
                          {incomingRequests.map((req) => {
                            const isAccepting = actionPendingMap[`accept-${req.request_id}`];
                            const isDeclining = actionPendingMap[`decline-${req.request_id}`];
                            return (
                              <div
                                key={req.request_id}
                                className="p-3 rounded-xl bg-obsidian-900 border border-white/5 flex flex-col gap-2.5 hover:border-white/10 transition-colors"
                              >
                                <div className="flex items-center gap-2.5">
                                  <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-emerald-500/30 to-compass-500/20 border border-emerald-500/30 text-emerald-300 font-black flex items-center justify-center text-xs uppercase shrink-0">
                                    {req.username[0]}
                                  </div>
                                  <div className="min-w-0 flex-1">
                                    <p className="text-xs font-bold text-white truncate">{req.username}</p>
                                    <p className="text-[10px] text-emerald-400/90 truncate">
                                      {req.taste_genres?.length ? req.taste_genres.slice(0, 2).join(', ') : 'Cinephile'}
                                    </p>
                                  </div>
                                </div>

                                <div className="flex items-center gap-2 pt-1 border-t border-white/5">
                                  <button
                                    disabled={isAccepting || isDeclining}
                                    onClick={() => handleAcceptRequest(req.request_id)}
                                    className="flex-1 py-1.5 px-3 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-obsidian-950 font-bold text-xs flex items-center justify-center gap-1.5 transition-all shadow-sm cursor-pointer disabled:opacity-50"
                                  >
                                    <Check className="w-3.5 h-3.5 stroke-[2.5]" />
                                    <span>{isAccepting ? 'Accepting...' : 'Accept'}</span>
                                  </button>
                                  <button
                                    disabled={isAccepting || isDeclining}
                                    onClick={() => handleDeclineRequest(req.request_id)}
                                    className="py-1.5 px-3 rounded-xl bg-white/5 hover:bg-red-500/20 border border-white/10 hover:border-red-500/30 text-slate-300 hover:text-red-400 font-medium text-xs flex items-center justify-center transition-all cursor-pointer disabled:opacity-50"
                                  >
                                    <X className="w-3.5 h-3.5" />
                                    <span>{isDeclining ? 'Declining...' : 'Decline'}</span>
                                  </button>
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      )}

                      {/* Footer */}
                      <div className="pt-2 border-t border-white/5 flex items-center justify-between text-[11px]">
                        <Link
                          to="/friends"
                          onClick={() => setIsNotificationsOpen(false)}
                          className="text-compass-400 hover:text-compass-300 font-semibold transition-colors flex items-center gap-1"
                        >
                          <span>Manage all friends & requests</span>
                          <span>→</span>
                        </Link>
                      </div>
                    </div>
                  )}
                </div>

                {/* Single Profile Avatar Button */}
                <div className="relative" ref={profileMenuRef}>
                  <button
                    onClick={() => {
                      setIsProfileOpen(!isProfileOpen);
                      setIsNotificationsOpen(false);
                    }}
                    className="flex items-center gap-2.5 px-3 py-1.5 rounded-xl bg-obsidian-900 border border-white/10 hover:border-compass-500/40 text-slate-200 transition-all cursor-pointer shadow-sm group"
                  >
                    <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-compass-400 to-compass-600 flex items-center justify-center font-extrabold text-xs text-obsidian-950 uppercase shadow-inner">
                      {user.username[0]}
                    </div>
                    <span className="text-xs font-semibold text-white max-w-[100px] truncate hidden sm:inline">
                      {user.username}
                    </span>
                    <ChevronDown
                      className={`w-3.5 h-3.5 text-slate-400 group-hover:text-white transition-transform duration-200 ${
                        isProfileOpen ? 'rotate-180' : ''
                      }`}
                    />
                  </button>

                  {/* Profile Dropdown Menu */}
                  {isProfileOpen && (
                    <div className="absolute right-0 top-full mt-2 w-60 rounded-2xl bg-obsidian-950/95 border border-white/10 shadow-2xl p-2 z-50 backdrop-blur-xl animate-dropdown space-y-1">
                      {/* User Identity */}
                      <div className="px-3 py-2.5 border-b border-white/5">
                        <p className="text-xs font-bold text-white truncate">{user.username}</p>
                        <p className="text-[11px] text-slate-400 truncate">{user.email}</p>
                      </div>

                      {/* Consolidated Profile Links */}
                      <div className="py-1 space-y-0.5">
                        <Link
                          to="/profile"
                          onClick={() => setIsProfileOpen(false)}
                          className="flex items-center gap-2.5 px-3 py-2 rounded-xl text-xs font-medium text-slate-300 hover:text-white hover:bg-white/5 transition-colors"
                        >
                          <Activity className="w-4 h-4 text-compass-400" />
                          <span>Taste DNA</span>
                        </Link>

                        <Link
                          to="/friends"
                          onClick={() => setIsProfileOpen(false)}
                          className="flex items-center justify-between px-3 py-2 rounded-xl text-xs font-medium text-slate-300 hover:text-white hover:bg-white/5 transition-colors"
                        >
                          <div className="flex items-center gap-2.5">
                            <Users className="w-4 h-4 text-emerald-400" />
                            <span>Friends & Social</span>
                          </div>
                          {incomingRequests.length > 0 && (
                            <span className="px-1.5 py-0.2 rounded-full bg-emerald-500 text-obsidian-950 font-black text-[10px]">
                              {incomingRequests.length}
                            </span>
                          )}
                        </Link>

                        <Link
                          to="/watchlist"
                          onClick={() => setIsProfileOpen(false)}
                          className="flex items-center gap-2.5 px-3 py-2 rounded-xl text-xs font-medium text-slate-300 hover:text-white hover:bg-white/5 transition-colors"
                        >
                          <Bookmark className="w-4 h-4 text-amber-400" />
                          <span>Watchlist</span>
                        </Link>

                        <Link
                          to="/library"
                          onClick={() => setIsProfileOpen(false)}
                          className="flex items-center gap-2.5 px-3 py-2 rounded-xl text-xs font-medium text-slate-300 hover:text-white hover:bg-white/5 transition-colors"
                        >
                          <BookOpen className="w-4 h-4 text-blue-400" />
                          <span>Library & History</span>
                        </Link>
                      </div>

                      {/* Divider & Logout Action */}
                      <div className="pt-1 border-t border-white/5">
                        <button
                          onClick={() => {
                            setIsProfileOpen(false);
                            setShowLogoutModal(true);
                          }}
                          className="w-full flex items-center gap-2.5 px-3 py-2 rounded-xl text-xs font-semibold text-red-400 hover:text-red-300 hover:bg-red-500/10 transition-colors cursor-pointer text-left"
                        >
                          <LogOut className="w-4 h-4 text-red-400" />
                          <span>Log Out</span>
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            ) : (
              <div className="flex items-center gap-3">
                <Link
                  to="/login"
                  className="text-sm font-medium text-slate-300 hover:text-white px-3 py-1.5 rounded-lg transition-colors"
                >
                  Sign In
                </Link>
                <Link
                  to="/signup"
                  className="text-sm font-semibold text-obsidian-950 bg-gradient-to-r from-compass-400 to-compass-500 hover:from-compass-300 hover:to-compass-400 px-4 py-1.5 rounded-lg shadow-md shadow-compass-500/20 transition-all hover:shadow-compass-500/35"
                >
                  Get Started
                </Link>
              </div>
            )}
          </div>
        </div>
      </header>

      {/* Logout Confirmation Modal */}
      {showLogoutModal &&
        createPortal(
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 backdrop-blur-md bg-obsidian-950/80 animate-in fade-in duration-200">
            <div
              className="fixed inset-0"
              onClick={() => setShowLogoutModal(false)}
              aria-hidden="true"
            />

            <div className="relative w-full max-w-sm rounded-3xl bg-obsidian-900 border border-white/10 shadow-2xl p-6 z-10 text-center space-y-4">
              <button
                onClick={() => setShowLogoutModal(false)}
                className="absolute top-4 right-4 p-1.5 rounded-full text-slate-400 hover:text-white hover:bg-white/5 cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>

              <div className="w-12 h-12 rounded-2xl bg-red-500/10 border border-red-500/20 text-red-400 mx-auto flex items-center justify-center">
                <LogOut className="w-6 h-6 stroke-[2.2]" />
              </div>

              <div>
                <h3 className="text-lg font-extrabold text-white tracking-tight">Confirm Logout</h3>
                <p className="text-xs text-slate-400 mt-1 leading-relaxed">
                  Are you sure you want to log out of Stream Compass? Your taste preferences and watchlist remain safely stored.
                </p>
              </div>

              <div className="flex items-center gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setShowLogoutModal(false)}
                  className="flex-1 py-2.5 rounded-xl border border-white/10 hover:bg-white/5 text-xs font-bold text-slate-300 transition-colors cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleConfirmLogout}
                  className="flex-1 py-2.5 rounded-xl bg-red-500 hover:bg-red-600 text-xs font-bold text-white shadow-lg shadow-red-500/20 transition-all cursor-pointer"
                >
                  Log Out
                </button>
              </div>
            </div>
          </div>,
          document.body
        )}
    </>
  );
};
