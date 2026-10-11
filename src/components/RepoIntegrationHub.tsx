import React, { useState } from 'react';
import { 
  GitBranch, Check, Copy, ExternalLink, RefreshCw, 
  Terminal, Sparkles, CheckCircle2, AlertCircle, FileDown, 
  Globe, ShieldCheck, Box
} from 'lucide-react';

export const RepoIntegrationHub: React.FC = () => {
  const repoOwner = 'geminibitok-oss';
  const repoName = 'pixel_clock';
  const repoUrl = `https://github.com/${repoOwner}/${repoName}`;
  const apiUrl = `https://api.github.com/repos/${repoOwner}/${repoName}/releases/latest`;
  const directDownloadUrl = `https://github.com/${repoOwner}/${repoName}/releases/latest/download/firmware.bin`;

  const [isChecking, setIsChecking] = useState(false);
  const [checkResult, setCheckResult] = useState<{
    status: 'idle' | 'success' | 'no_releases' | 'not_found' | 'error';
    tagName?: string;
    publishedAt?: string;
    hasFirmwareBin?: boolean;
    assetsCount?: number;
    downloadUrl?: string;
    message?: string;
  }>({ status: 'idle' });

  const [copiedCommand, setCopiedCommand] = useState<string | null>(null);

  const copyToClipboard = (text: string, id: string) => {
    navigator.clipboard.writeText(text);
    setCopiedCommand(id);
    setTimeout(() => setCopiedCommand(null), 2000);
  };

  const checkGitHubReleases = async () => {
    setIsChecking(true);
    try {
      const response = await fetch(apiUrl, {
        headers: {
          Accept: 'application/vnd.github.v3+json',
        },
      });

      if (response.status === 200) {
        const data = await response.json();
        const assets = data.assets || [];
        const binAsset = assets.find((a: { name: string }) => a.name === 'firmware.bin');

        setCheckResult({
          status: 'success',
          tagName: data.tag_name,
          publishedAt: new Date(data.published_at).toLocaleString('ru-RU'),
          hasFirmwareBin: !!binAsset,
          assetsCount: assets.length,
          downloadUrl: binAsset?.browser_download_url || directDownloadUrl,
        });
      } else if (response.status === 404) {
        // Either no releases exist yet, or repo is private / empty
        setCheckResult({
          status: 'no_releases',
          message: 'Релизов пока не создано или репозиторий приватный. Создайте первый тег v7.1 с помощью команд ниже!',
        });
      } else {
        setCheckResult({
          status: 'error',
          message: `Ответ GitHub API: HTTP ${response.status}. Возможно превышен лимит запросов без авторизации.`,
        });
      }
    } catch {
      setCheckResult({
        status: 'error',
        message: 'Не удалось выполнить запрос к GitHub API. Проверьте интернет-соединение.',
      });
    } finally {
      setIsChecking(false);
    }
  };

  const gitPushScript = `# 1. Перейдите в папку вашего проекта
cd /путь/к/проекту

# 2. Убедитесь, что удаленный репозиторий настроен на pixel_clock:
git remote set-url origin https://github.com/geminibitok-oss/pixel_clock.git

# 3. Добавьте обновленные файлы (Actions, GitHubOTA.h, и т.д.):
git add .
git commit -m "feat: настроена автосборка в GitHub Actions и OTA-обновление"

# 4. Отправьте код в основную ветку:
git push origin main

# 5. Выпустите первый релиз v7.1 (это запустит сборку и публикацию прошивки!):
git tag v7.1
git push origin v7.1`;

  return (
    <div className="space-y-8">
      {/* Target Repo Banner */}
      <div className="bg-[#0e141c] p-6 rounded-2xl border border-emerald-500/30 shadow-xl relative overflow-hidden">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="space-y-1.5">
            <div className="flex items-center gap-2">
              <span className="w-2.5 h-2.5 rounded-full bg-emerald-400 animate-pulse" />
              <span className="text-xs font-mono font-semibold text-emerald-400 uppercase tracking-wider">
                Целевой репозиторий привязан
              </span>
            </div>
            <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-white flex items-center gap-2">
              <span>geminibitok-oss / pixel_clock</span>
            </h1>
            <p className="text-xs sm:text-sm text-slate-300">
              Прошивка автоматически компилируется при создании тегов версий и забирается часами ESP32 по HTTPS.
            </p>
          </div>

          <div className="flex items-center gap-2.5 shrink-0">
            <a
              href={repoUrl}
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold text-white bg-slate-800 hover:bg-slate-700 rounded-lg transition-colors border border-slate-700"
            >
              <ExternalLink className="w-3.5 h-3.5" />
              <span>Открыть на GitHub</span>
            </a>

            <button
              onClick={checkGitHubReleases}
              disabled={isChecking}
              className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-semibold text-white bg-emerald-600 hover:bg-emerald-500 rounded-lg transition-colors cursor-pointer shadow-sm disabled:opacity-50"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${isChecking ? 'animate-spin' : ''}`} />
              <span>{isChecking ? 'Опрос GitHub...' : 'Проверить статус релиза'}</span>
            </button>
          </div>
        </div>

        {/* Live Status Response Box */}
        {checkResult.status !== 'idle' && (
          <div className="mt-5 pt-4 border-t border-slate-800/80">
            {checkResult.status === 'success' && (
              <div className="p-4 rounded-xl bg-emerald-950/40 border border-emerald-500/40 flex items-start gap-3">
                <CheckCircle2 className="w-5 h-5 text-emerald-400 shrink-0 mt-0.5" />
                <div className="space-y-1 text-xs text-slate-200">
                  <div className="text-sm font-bold text-white flex items-center gap-2">
                    <span>Найден активный релиз: {checkResult.tagName}</span>
                    <span className="text-[10px] bg-emerald-900 text-emerald-300 px-2 py-0.5 rounded font-mono">
                      АКТИВЕН
                    </span>
                  </div>
                  <p className="text-slate-400">
                    Опубликован: {checkResult.publishedAt} · Файлов в релизе: {checkResult.assetsCount}
                  </p>
                  <div className="pt-2 flex items-center gap-3">
                    <span className="text-emerald-400 font-medium">
                      {checkResult.hasFirmwareBin ? '✓ firmware.bin готов к OTA скачиванию' : '⚠️ firmware.bin не найден среди файлов'}
                    </span>
                    <a
                      href={checkResult.downloadUrl}
                      target="_blank"
                      rel="noreferrer"
                      className="text-xs text-cyan-400 hover:underline flex items-center gap-1"
                    >
                      <span>Скачать бинарник напрямую</span>
                      <FileDown className="w-3.5 h-3.5" />
                    </a>
                  </div>
                </div>
              </div>
            )}

            {checkResult.status === 'no_releases' && (
              <div className="p-4 rounded-xl bg-amber-950/40 border border-amber-600/40 flex items-start gap-3">
                <AlertCircle className="w-5 h-5 text-amber-400 shrink-0 mt-0.5" />
                <div className="space-y-1 text-xs text-slate-200">
                  <div className="text-sm font-bold text-white">Релизы еще не созданы в pixel_clock</div>
                  <p className="text-slate-300">
                    {checkResult.message}
                  </p>
                </div>
              </div>
            )}

            {checkResult.status === 'error' && (
              <div className="p-4 rounded-xl bg-slate-900 border border-slate-800 flex items-start gap-3">
                <AlertCircle className="w-5 h-5 text-slate-400 shrink-0 mt-0.5" />
                <div className="text-xs text-slate-300">
                  {checkResult.message}
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Step-by-Step Execution Plan */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Left Column: Terminal commands to publish first release */}
        <div className="bg-[#0e131a] p-5 rounded-2xl border border-slate-800 space-y-4 flex flex-col">
          <div className="flex items-center justify-between pb-3 border-b border-slate-800">
            <div className="flex items-center gap-2 text-white font-semibold text-sm">
              <Terminal className="w-4 h-4 text-emerald-400" />
              <span>Команды для терминала (запуск автосборки)</span>
            </div>
            <button
              onClick={() => copyToClipboard(gitPushScript, 'full_script')}
              className="inline-flex items-center gap-1.5 px-2.5 py-1 text-xs text-emerald-400 bg-emerald-950/60 hover:bg-emerald-900 rounded-md border border-emerald-800/80 transition-colors cursor-pointer"
            >
              {copiedCommand === 'full_script' ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
              <span>Скопировать всё</span>
            </button>
          </div>

          <p className="text-xs text-slate-400 leading-relaxed">
            Выполните эти команды один раз в терминале вашего проекта. Создание тега <code className="text-emerald-400 font-mono">v7.1</code> автоматически инициирует GitHub Actions для репозитория <b className="text-slate-200">geminibitok-oss/pixel_clock</b>:
          </p>

          <pre className="p-4 rounded-xl bg-[#080b0f] border border-slate-800/80 text-xs font-mono text-slate-300 overflow-x-auto leading-relaxed flex-1">
            <code>{gitPushScript}</code>
          </pre>

          <div className="p-3 bg-[#111722] rounded-xl border border-slate-800 text-xs text-slate-400 space-y-1">
            <span className="text-emerald-400 font-semibold block">Что произойдет на серверах GitHub:</span>
            <div>1. Запустится виртуальная машина Ubuntu в GitHub Actions.</div>
            <div>2. PlatformIO скомпилирует <code className="text-white font-mono">.pio/build/esp32dev/firmware.bin</code>.</div>
            <div>3. Создастся релиз на странице <code className="text-white font-mono">/releases/tag/v7.1</code>.</div>
          </div>
        </div>

        {/* Right Column: How the Clock pulls the update */}
        <div className="bg-[#0e131a] p-5 rounded-2xl border border-slate-800 space-y-4">
          <div className="pb-3 border-b border-slate-800 flex items-center gap-2 text-white font-semibold text-sm">
            <Globe className="w-4 h-4 text-cyan-400" />
            <span>Как часы обновляются с pixel_clock</span>
          </div>

          <div className="space-y-3 text-xs">
            {/* Step A */}
            <div className="p-3.5 rounded-xl bg-[#080b0f] border border-slate-800 space-y-1.5">
              <div className="flex items-center justify-between">
                <span className="font-semibold text-white flex items-center gap-1.5">
                  <Box className="w-3.5 h-3.5 text-emerald-400" />
                  <span>1. Проверка версии через GitHub API</span>
                </span>
                <span className="text-[10px] text-slate-500 font-mono">HTTPS GET</span>
              </div>
              <code className="text-[11px] text-slate-400 block bg-[#0c1015] p-2 rounded break-all font-mono">
                {apiUrl}
              </code>
              <p className="text-slate-400">
                ESP32 сравнивает <code className="text-emerald-400">"tag_name"</code> в JSON с текущей версией в коде (<code className="text-white">FIRMWARE_VERSION = "7.0"</code>). Если на GitHub лежит <code className="text-emerald-400">7.1</code> — запускается скачивание.
              </p>
            </div>

            {/* Step B */}
            <div className="p-3.5 rounded-xl bg-[#080b0f] border border-slate-800 space-y-1.5">
              <div className="flex items-center justify-between">
                <span className="font-semibold text-white flex items-center gap-1.5">
                  <ShieldCheck className="w-3.5 h-3.5 text-cyan-400" />
                  <span>2. Скачивание firmware.bin (302 Redirect)</span>
                </span>
                <span className="text-[10px] text-slate-500 font-mono">AWS S3 CDN</span>
              </div>
              <code className="text-[11px] text-slate-400 block bg-[#0c1015] p-2 rounded break-all font-mono">
                {directDownloadUrl}
              </code>
              <p className="text-slate-400">
                Модуль <code className="text-white font-mono">GitHubOTA.h</code> переходит по редиректу 302 на Amazon S3 и чанками по 1 Кб прошивает Flash-память.
              </p>
            </div>

            {/* Step C */}
            <div className="p-3.5 rounded-xl bg-[#080b0f] border border-slate-800 space-y-1.5">
              <div className="flex items-center justify-between">
                <span className="font-semibold text-white flex items-center gap-1.5">
                  <Sparkles className="w-3.5 h-3.5 text-purple-400" />
                  <span>3. Индикация на светодиодах и перезагрузка</span>
                </span>
                <span className="text-[10px] text-emerald-400 font-mono">32×16 LED</span>
              </div>
              <p className="text-slate-400">
                Во время прошивки на часах горит шкала <b className="text-emerald-400">OTA 0% → 100%</b>, после чего ESP32 перезагружается в слот <code className="text-white font-mono">app1</code> уже на новой версии прошивки.
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
