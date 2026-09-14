import { useState, useRef, useEffect } from 'react';
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
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';

export const Navbar = () => {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  const [isProfileOpen, setIsProfileOpen] = useState(false);
  const [showLogoutModal, setShowLogoutModal] = useState(false);
  const profileMenuRef = useRef<HTMLDivElement>(null);

  // Close profile dropdown on outside click
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (profileMenuRef.current && !profileMenuRef.current.contains(e.target as Node)) {
        setIsProfileOpen(false);
      }
    };
    if (isProfileOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isProfileOpen]);

  const handleConfirmLogout = () => {
    setShowLogoutModal(false);
    setIsProfileOpen(false);
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
              <div className="relative" ref={profileMenuRef}>
                {/* Single Profile Avatar Button */}
                <button
                  onClick={() => setIsProfileOpen(!isProfileOpen)}
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
                        className="flex items-center gap-2.5 px-3 py-2 rounded-xl text-xs font-medium text-slate-300 hover:text-white hover:bg-white/5 transition-colors"
                      >
                        <Users className="w-4 h-4 text-emerald-400" />
                        <span>Friends & Social</span>
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
