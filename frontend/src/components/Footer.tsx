import React from 'react';
import { Compass, ShieldCheck } from 'lucide-react';

export const Footer: React.FC = () => {
  return (
    <footer className="border-t border-white/5 bg-obsidian-950/60 py-10 text-slate-400 text-xs">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex flex-col md:flex-row items-center justify-between gap-6">
        <div className="flex items-center gap-2">
          <Compass className="w-4 h-4 text-compass-500" />
          <span className="font-semibold text-slate-300">Stream Compass</span>
          <span className="text-slate-600">|</span>
          <span className="text-slate-500">Personalized Movie & TV Discovery Engine</span>
        </div>

        <div className="flex items-center gap-6 text-slate-500">
          <span className="flex items-center gap-1.5 text-slate-400">
            <ShieldCheck className="w-3.5 h-3.5 text-compass-500/80" />
            Zero endless scrolling. Just decisions.
          </span>
          <span>© {new Date().getFullYear()} Stream Compass.</span>
        </div>
      </div>
    </footer>
  );
};
