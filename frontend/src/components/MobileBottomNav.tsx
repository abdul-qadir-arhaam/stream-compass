import React from 'react';
import { Link, useLocation } from 'react-router-dom';
import { Compass, Sparkles, Users, Search, Bookmark } from 'lucide-react';
import { useAuth } from '../context/AuthContext';

export const MobileBottomNav: React.FC = () => {
  const location = useLocation();
  const { user } = useAuth();

  const navItems = [
    {
      to: user ? '/home' : '/',
      label: 'For You',
      icon: Compass,
      isActive: location.pathname === '/' || location.pathname === '/home',
    },
    {
      to: '/decision',
      label: 'Decision',
      icon: Sparkles,
      isActive: location.pathname === '/decision',
    },
    {
      to: '/group',
      label: 'Group',
      icon: Users,
      isActive: location.pathname === '/group',
    },
    {
      to: '/search',
      label: 'Search',
      icon: Search,
      isActive: location.pathname === '/search',
    },
    {
      to: user ? '/watchlist' : '/login',
      label: 'Watchlist',
      icon: Bookmark,
      isActive: location.pathname === '/watchlist' || location.pathname === '/library',
    },
  ];

  return (
    <nav
      className="md:hidden fixed bottom-0 left-0 right-0 z-40 bg-obsidian-950/95 backdrop-blur-2xl border-t border-white/10 px-1 py-1.5 flex items-center justify-around text-[10px] select-none"
      style={{ paddingBottom: 'max(0.375rem, env(safe-area-inset-bottom))' }}
      aria-label="Mobile Bottom Navigation"
    >
      {navItems.map((item) => {
        const Icon = item.icon;
        const active = item.isActive;
        return (
          <Link
            key={item.to}
            to={item.to}
            className={`flex flex-col items-center justify-center py-1 px-3 rounded-xl transition-all cursor-pointer ${
              active
                ? 'text-compass-400 font-bold scale-105'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <Icon className={`w-5 h-5 mb-0.5 ${active ? 'stroke-[2.4]' : 'stroke-[1.8]'}`} />
            <span className="tracking-tight">{item.label}</span>
          </Link>
        );
      })}
    </nav>
  );
};
