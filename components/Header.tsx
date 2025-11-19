import React from 'react';
import { AppView } from '../types';

interface HeaderProps {
  currentView: AppView;
  setView: (view: AppView) => void;
  hasUser: boolean;
}

export const Header: React.FC<HeaderProps> = ({ currentView, setView, hasUser }) => {
  const navItems = [
    { id: AppView.INPUT, label: 'Diario de Sueños' },
    { id: AppView.VISUALIZER, label: 'Visualizador' },
    { id: AppView.CHAT, label: 'Psicoanalista (SOS)' },
  ];

  return (
    <header className="sticky top-0 z-50 w-full border-b border-white/10 bg-black/40 backdrop-blur-md">
      <div className="container mx-auto px-4 h-16 flex items-center justify-between">
        <div className="flex items-center gap-2" role="button" onClick={() => hasUser && setView(AppView.INPUT)}>
          <span className="text-2xl">👁️</span>
          <h1 className="text-xl font-serif font-bold bg-clip-text text-transparent bg-gradient-to-r from-purple-200 to-indigo-200">
            ONEIROS
          </h1>
        </div>

        {hasUser && (
          <nav className="hidden md:flex gap-1">
            {navItems.map((item) => (
              <button
                key={item.id}
                onClick={() => setView(item.id)}
                className={`px-4 py-2 rounded-full text-sm font-medium transition-all ${
                  currentView === item.id 
                    ? 'bg-white/10 text-white shadow-[0_0_15px_rgba(139,92,246,0.3)]' 
                    : 'text-gray-400 hover:text-white hover:bg-white/5'
                }`}
              >
                {item.label}
              </button>
            ))}
          </nav>
        )}
        
        {/* Mobile Nav Toggle could go here */}
      </div>
      
      {hasUser && (
        <div className="md:hidden flex justify-around border-t border-white/5 py-2 bg-black/60">
            {navItems.map((item) => (
              <button
                key={item.id}
                onClick={() => setView(item.id)}
                className={`text-xs p-2 ${currentView === item.id ? 'text-purple-300' : 'text-gray-500'}`}
              >
                {item.label}
              </button>
            ))}
        </div>
      )}
    </header>
  );
};
