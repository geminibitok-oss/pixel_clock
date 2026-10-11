import React, { useState } from 'react';
import JSZip from 'jszip';
import { Navbar } from './components/Navbar';
import { MatrixSimulator } from './components/MatrixSimulator';
import { ImprovementAudit } from './components/ImprovementAudit';
import { GitHubActionsGuide } from './components/GitHubActionsGuide';
import { GitHubOtaGuide } from './components/GitHubOtaGuide';
import { RepoIntegrationHub } from './components/RepoIntegrationHub';
import { ProjectFilesExport } from './components/ProjectFilesExport';
import { PROJECT_FILES } from './data/projectFiles';
import { Cpu, ShieldAlert, GitBranch, RefreshCw, Globe, FolderArchive } from 'lucide-react';

export default function App() {
  const [activeTab, setActiveTab] = useState<string>('repo');
  const [isZipping, setIsZipping] = useState<boolean>(false);

  const handleDownloadAllZip = async () => {
    try {
      setIsZipping(true);
      const zip = new JSZip();

      // Add all project files into correct folder hierarchy
      for (const file of PROJECT_FILES) {
        let zipPath = file.path;
        if (zipPath.startsWith('/')) {
          zipPath = zipPath.slice(1);
        }
        zip.file(zipPath, file.content);
      }

      // Add a helpful README.md
      const readme = `# ESP32 Pixel Clock (32x16 WS2812) — geminibitok-oss/pixel_clock

Репозиторий проекта: https://github.com/geminibitok-oss/pixel_clock

## Настроенная автосборка и GitHub OTA:
1. Автоматическая компиляция PlatformIO в GitHub Actions (.github/workflows/build-and-release.yml).
2. Прямое OTA обновление часов с GitHub Releases (include/GitHubOTA.h).
3. При создании тега v7.1 на GitHub автоматически собирается firmware.bin.
4. Часы опрашивают https://api.github.com/repos/geminibitok-oss/pixel_clock/releases/latest и сами обновляются по HTTPS (со следованием HTTP 302 редиректам на Amazon S3).

## Инструкция по первому запуску автосборки:
1. Распакуйте эти файлы в локальную папку проекта.
2. Привяжите ваш репозиторий:
   git remote set-url origin https://github.com/geminibitok-oss/pixel_clock.git
3. Закоммитьте изменения:
   git add .
   git commit -m "feat: настройка автосборки GitHub Actions и OTA"
   git push origin main
4. Создайте тег для первой сборки:
   git tag v7.1
   git push origin v7.1
`;
      zip.file('README.md', readme);

      const content = await zip.generateAsync({ type: 'blob' });
      const url = URL.createObjectURL(content);
      const link = document.createElement('a');
      link.href = url;
      link.download = 'pixel_clock_geminibitok_oss_v7.1.zip';
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
    } catch (err) {
      console.error('Failed to create zip:', err);
    } finally {
      setIsZipping(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#090d13] text-slate-200 flex flex-col font-sans selection:bg-emerald-500/30 selection:text-emerald-200">
      {/* Strict 3-zone Top Bar Contract */}
      <Navbar
        activeTab={activeTab}
        onSelectTab={setActiveTab}
        onDownloadZip={handleDownloadAllZip}
        isZipping={isZipping}
      />

      {/* Main Content Area */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Context Quick Bar */}
        <div className="mb-6 grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
          <button
            onClick={() => setActiveTab('repo')}
            className={`p-3 rounded-xl border text-left transition-all cursor-pointer ${
              activeTab === 'repo'
                ? 'bg-[#121822] border-emerald-500/50 shadow-sm ring-1 ring-emerald-500/20'
                : 'bg-[#0d1218] border-slate-800/80 hover:bg-[#111720]'
            }`}
          >
            <div className="flex items-center gap-2 mb-1">
              <Globe className="w-4 h-4 text-emerald-400" />
              <span className="text-xs font-semibold text-white truncate">pixel_clock GitHub</span>
            </div>
            <div className="text-[11px] text-slate-400 truncate">
              geminibitok-oss · Релиз и OTA
            </div>
          </button>

          <button
            onClick={() => setActiveTab('simulator')}
            className={`p-3 rounded-xl border text-left transition-all cursor-pointer ${
              activeTab === 'simulator'
                ? 'bg-[#121822] border-emerald-500/50 shadow-sm ring-1 ring-emerald-500/20'
                : 'bg-[#0d1218] border-slate-800/80 hover:bg-[#111720]'
            }`}
          >
            <div className="flex items-center gap-2 mb-1">
              <Cpu className="w-4 h-4 text-cyan-400" />
              <span className="text-xs font-semibold text-white truncate">Эмулятор 32×16</span>
            </div>
            <div className="text-[11px] text-slate-400 truncate">
              WS2812 · FastLED · RusFont
            </div>
          </button>

          <button
            onClick={() => setActiveTab('actions')}
            className={`p-3 rounded-xl border text-left transition-all cursor-pointer ${
              activeTab === 'actions'
                ? 'bg-[#121822] border-emerald-500/50 shadow-sm ring-1 ring-emerald-500/20'
                : 'bg-[#0d1218] border-slate-800/80 hover:bg-[#111720]'
            }`}
          >
            <div className="flex items-center gap-2 mb-1">
              <GitBranch className="w-4 h-4 text-amber-400" />
              <span className="text-xs font-semibold text-white truncate">GitHub Actions</span>
            </div>
            <div className="text-[11px] text-slate-400 truncate">
              CI/CD · pio run · firmware.bin
            </div>
          </button>

          <button
            onClick={() => setActiveTab('audit')}
            className={`p-3 rounded-xl border text-left transition-all cursor-pointer ${
              activeTab === 'audit'
                ? 'bg-[#121822] border-emerald-500/50 shadow-sm ring-1 ring-emerald-500/20'
                : 'bg-[#0d1218] border-slate-800/80 hover:bg-[#111720]'
            }`}
          >
            <div className="flex items-center gap-2 mb-1">
              <ShieldAlert className="w-4 h-4 text-rose-400" />
              <span className="text-xs font-semibold text-white truncate">Аудит и улучшения</span>
            </div>
            <div className="text-[11px] text-slate-400 truncate">
              NTP · NVS износ · Безопасность
            </div>
          </button>

          <button
            onClick={() => setActiveTab('files')}
            className={`p-3 rounded-xl border text-left transition-all cursor-pointer ${
              activeTab === 'files'
                ? 'bg-[#121822] border-emerald-500/50 shadow-sm ring-1 ring-emerald-500/20'
                : 'bg-[#0d1218] border-slate-800/80 hover:bg-[#111720]'
            }`}
          >
            <div className="flex items-center gap-2 mb-1">
              <FolderArchive className="w-4 h-4 text-purple-400" />
              <span className="text-xs font-semibold text-white truncate">Файлы проекта</span>
            </div>
            <div className="text-[11px] text-slate-400 truncate">
              Готовый код · Скачать ZIP
            </div>
          </button>
        </div>

        {/* View Content Switcher */}
        {activeTab === 'repo' && <RepoIntegrationHub />}
        {activeTab === 'simulator' && <MatrixSimulator />}
        {activeTab === 'audit' && <ImprovementAudit />}
        {activeTab === 'actions' && <GitHubActionsGuide />}
        {activeTab === 'ota' && <GitHubOtaGuide />}
        {activeTab === 'files' && (
          <ProjectFilesExport
            onDownloadAllZip={handleDownloadAllZip}
            isZipping={isZipping}
          />
        )}
      </main>

      {/* Clean Editorial Footer */}
      <footer className="mt-auto border-t border-slate-800/80 bg-[#070a0e] py-6">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex flex-col sm:flex-row items-center justify-between gap-4 text-xs text-slate-500">
          <div className="flex items-center gap-2">
            <span className="font-semibold text-slate-400">ESP32 Matrix Clock Studio</span>
            <span>·</span>
            <span>WS2812 32×16 & Home Assistant Hub</span>
          </div>

          <div className="flex items-center gap-4 text-slate-400">
            <button
              onClick={() => setActiveTab('simulator')}
              className="hover:text-white transition-colors cursor-pointer"
            >
              Эмулятор
            </button>
            <button
              onClick={() => setActiveTab('audit')}
              className="hover:text-white transition-colors cursor-pointer"
            >
              Аудит
            </button>
            <button
              onClick={() => setActiveTab('actions')}
              className="hover:text-white transition-colors cursor-pointer"
            >
              CI/CD
            </button>
            <button
              onClick={() => setActiveTab('ota')}
              className="hover:text-white transition-colors cursor-pointer"
            >
              GitHub OTA
            </button>
            <button
              onClick={() => setActiveTab('files')}
              className="hover:text-white transition-colors cursor-pointer"
            >
              Исходники
            </button>
          </div>
        </div>
      </footer>
    </div>
  );
}
