import React from 'react';
import { Download, Cpu } from 'lucide-react';

interface NavbarProps {
  activeTab: string;
  onSelectTab: (tabId: string) => void;
  onDownloadZip: () => void;
  isZipping: boolean;
}

export const Navbar: React.FC<NavbarProps> = ({
  activeTab,
  onSelectTab,
  onDownloadZip,
  isZipping,
}) => {
  const navItems = [
    { id: 'simulator', label: 'Эмулятор 32×16' },
    { id: 'audit', label: 'Аудит и улучшения' },
    { id: 'actions', label: 'GitHub CI/CD' },
    { id: 'ota', label: 'Обновление с GitHub' },
    { id: 'files', label: 'Файлы проекта' },
  ];

  return (
    <header className="sticky top-0 z-50 bg-[#0c1015]/95 backdrop-blur-md border-b border-slate-800/80">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between gap-8 h-16">
          {/* Zone 1: Single text element wordmark */}
          <div className="flex items-center gap-2.5 shrink-0">
            <div className="w-8 h-8 rounded-lg bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-center text-emerald-400">
              <Cpu className="w-4 h-4" />
            </div>
            <button
              onClick={() => onSelectTab('simulator')}
              className="text-left group cursor-pointer focus-visible:outline-none"
            >
              <span className="text-base font-bold tracking-tight text-white group-hover:text-emerald-400 transition-colors whitespace-nowrap">
                ESP32 Matrix Clock Studio
              </span>
            </button>
          </div>

          {/* Zone 2: 4–5 clean single-line navigation links */}
          <nav className="hidden md:flex items-center gap-1 shrink-0">
            {navItems.map((item) => {
              const isActive = activeTab === item.id;
              return (
                <button
                  key={item.id}
                  onClick={() => onSelectTab(item.id)}
                  className={`px-3 py-2 text-sm font-medium rounded-md transition-all whitespace-nowrap shrink-0 cursor-pointer ${
                    isActive
                      ? 'text-white bg-slate-800/90 shadow-sm border border-slate-700/60'
                      : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/40'
                  }`}
                >
                  {item.label}
                </button>
              );
            })}
          </nav>

          {/* Zone 3: 1 primary action */}
          <div className="flex items-center gap-3 shrink-0">
            <button
              onClick={onDownloadZip}
              disabled={isZipping}
              className="inline-flex items-center gap-2 px-4 py-2 text-xs font-semibold text-white bg-emerald-600 hover:bg-emerald-500 active:bg-emerald-700 rounded-lg transition-colors whitespace-nowrap shadow-sm disabled:opacity-50 cursor-pointer"
            >
              <Download className="w-3.5 h-3.5" />
              <span>{isZipping ? 'Сборка архива...' : 'Скачать проект .zip'}</span>
            </button>
          </div>
        </div>
      </div>

      {/* Mobile nav strip */}
      <div className="md:hidden flex overflow-x-auto border-t border-slate-800/60 px-4 py-2 gap-1.5 scrollbar-none bg-[#0a0d11]">
        {navItems.map((item) => {
          const isActive = activeTab === item.id;
          return (
            <button
              key={item.id}
              onClick={() => onSelectTab(item.id)}
              className={`px-3 py-1.5 text-xs font-medium rounded-md whitespace-nowrap shrink-0 cursor-pointer ${
                isActive
                  ? 'bg-slate-800 text-white border border-slate-700'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              {item.label}
            </button>
          );
        })}
      </div>
    </header>
  );
};
