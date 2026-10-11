import React, { useState } from 'react';
import JSZip from 'jszip';
import { Navbar } from './components/Navbar';
import { MatrixSimulator } from './components/MatrixSimulator';
import { ImprovementAudit } from './components/ImprovementAudit';
import { GitHubActionsGuide } from './components/GitHubActionsGuide';
import { GitHubOtaGuide } from './components/GitHubOtaGuide';
import { ProjectFilesExport } from './components/ProjectFilesExport';
import { PROJECT_FILES } from './data/projectFiles';
import { Cpu, ShieldAlert, GitBranch, RefreshCw, Terminal } from 'lucide-react';

export default function App() {
  const [activeTab, setActiveTab] = useState<string>('simulator');
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
      const readme = `# ESP32 Matrix Clock (32x16 WS2812) — Upgraded v7.1

## Что нового в этой версии:
1. Автономный NTP: точное время с pool.ntp.org без обязательной зависимости от топика MQTT.
2. Прямое OTA обновление с GitHub Releases: функция GitHubOTA с поддержкой HTTPS и редиректов 302 на Amazon S3.
3. Автосборка GitHub Actions: файл .github/workflows/build-and-release.yml автоматически компилирует firmware.bin и крепит его к релизам по тегу v*.
4. Защита Flash-памяти: устранен износ Flash через отложенную запись NVS (debounce) и отказ от сохранения временной температуры.
5. Защищенный secrets.h.example: реальные пароли добавлены в .gitignore для предотвращения утечки на GitHub.
6. Home Assistant Update Entity: официальный компонент update для автоматического уведомления о новых релизах.

## Быстрый старт:
1. Откройте проект в VS Code с расширением PlatformIO.
2. Скопируйте include/secrets.h.example в include/secrets.h и укажите данные своей сети.
3. Прошейте ESP32 через USB или espota.
4. Создайте репозиторий на GitHub и отправьте код:
   git init
   git add .
   git commit -m "Initial commit"
   git remote add origin https://github.com/ВАШ_ЛОГИН/esp32-matrix-clock.git
   git push -u origin main
5. Для выпуска обновления скомпилируйте релиз:
   git tag v7.1
   git push origin v7.1
`;
      zip.file('README.md', readme);

      const content = await zip.generateAsync({ type: 'blob' });
      const url = URL.createObjectURL(content);
      const link = document.createElement('a');
      link.href = url;
      link.download = 'esp32_matrix_clock_v7.1_complete.zip';
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
        <div className="mb-6 grid grid-cols-2 md:grid-cols-4 gap-3">
          <button
            onClick={() => setActiveTab('simulator')}
            className={`p-3 rounded-xl border text-left transition-all cursor-pointer ${
              activeTab === 'simulator'
                ? 'bg-[#121822] border-emerald-500/50 shadow-sm'
                : 'bg-[#0d1218] border-slate-800/80 hover:bg-[#111720]'
            }`}
          >
            <div className="flex items-center gap-2 mb-1">
              <Cpu className="w-4 h-4 text-emerald-400" />
              <span className="text-xs font-semibold text-white">Матрица 32×16</span>
            </div>
            <div className="text-[11px] text-slate-400">
              WS2812 · FastLED · Шрифт RusFont
            </div>
          </button>

          <button
            onClick={() => setActiveTab('audit')}
            className={`p-3 rounded-xl border text-left transition-all cursor-pointer ${
              activeTab === 'audit'
                ? 'bg-[#121822] border-emerald-500/50 shadow-sm'
                : 'bg-[#0d1218] border-slate-800/80 hover:bg-[#111720]'
            }`}
          >
            <div className="flex items-center gap-2 mb-1">
              <ShieldAlert className="w-4 h-4 text-rose-400" />
              <span className="text-xs font-semibold text-white">Аудит и улучшения</span>
            </div>
            <div className="text-[11px] text-slate-400">
              NTP · NVS износ · Защита секретов
            </div>
          </button>

          <button
            onClick={() => setActiveTab('actions')}
            className={`p-3 rounded-xl border text-left transition-all cursor-pointer ${
              activeTab === 'actions'
                ? 'bg-[#121822] border-emerald-500/50 shadow-sm'
                : 'bg-[#0d1218] border-slate-800/80 hover:bg-[#111720]'
            }`}
          >
            <div className="flex items-center gap-2 mb-1">
              <GitBranch className="w-4 h-4 text-cyan-400" />
              <span className="text-xs font-semibold text-white">Автосборка CI/CD</span>
            </div>
            <div className="text-[11px] text-slate-400">
              PlatformIO · Actions · Releases
            </div>
          </button>

          <button
            onClick={() => setActiveTab('ota')}
            className={`p-3 rounded-xl border text-left transition-all cursor-pointer ${
              activeTab === 'ota'
                ? 'bg-[#121822] border-emerald-500/50 shadow-sm'
                : 'bg-[#0d1218] border-slate-800/80 hover:bg-[#111720]'
            }`}
          >
            <div className="flex items-center gap-2 mb-1">
              <RefreshCw className="w-4 h-4 text-purple-400" />
              <span className="text-xs font-semibold text-white">Обновление с GitHub</span>
            </div>
            <div className="text-[11px] text-slate-400">
              HTTPS 302 Redirects · Dual OTA
            </div>
          </button>
        </div>

        {/* View Content Switcher */}
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
