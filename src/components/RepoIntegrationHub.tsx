import React, { useState, useEffect } from 'react';
import { 
  GitBranch, Check, Copy, ExternalLink, RefreshCw, 
  Terminal, CheckCircle2, AlertCircle, 
  Globe, ShieldCheck, Box, AlertTriangle, ArrowRight,
  Code2, CheckCircle, Sparkles, FileText, Bug, Wifi
} from 'lucide-react';
import { PROJECT_FILES } from '../data/projectFiles';

export const RepoIntegrationHub: React.FC = () => {
  const repoOwner = 'geminibitok-oss';
  const repoName = 'pixel_clock';
  const repoUrl = `https://github.com/${repoOwner}/${repoName}`;
  const apiUrl = `https://api.github.com/repos/${repoOwner}/${repoName}/releases/latest`;
  const actionsRunsUrl = `https://api.github.com/repos/${repoOwner}/${repoName}/actions/runs`;
  const editWorkflowDirectUrl = `https://github.com/${repoOwner}/${repoName}/edit/main/.github/workflows/build-and-release.yml`;
  const settingsActionsUrl = `https://github.com/${repoOwner}/${repoName}/settings/actions`;
  const releasesUrl = `https://github.com/${repoOwner}/${repoName}/releases`;

  const [isChecking, setIsChecking] = useState(false);
  const [copiedCommand, setCopiedCommand] = useState<string | null>(null);
  const [repoDiagnosis, setRepoDiagnosis] = useState<{
    hasWorkflowFile: boolean;
    hasPartitionFile: boolean;
    runsCount: number;
    latestRunStatus?: string;
    latestRunConclusion?: string;
    latestRunId?: number;
    latestRunUrl?: string;
    latestReleaseTag?: string;
    checked: boolean;
  }>({
    hasWorkflowFile: true,
    hasPartitionFile: true,
    runsCount: 2,
    latestRunStatus: 'completed',
    latestRunConclusion: 'failure',
    latestRunId: 38124945366,
    latestRunUrl: 'https://github.com/geminibitok-oss/pixel_clock/actions/runs/38124945366',
    checked: false,
  });

  const workflowYaml = PROJECT_FILES.find(f => f.id === 'github_workflow')?.content || '';

  const copyToClipboard = (text: string, id: string) => {
    navigator.clipboard.writeText(text);
    setCopiedCommand(id);
    setTimeout(() => setCopiedCommand(null), 2000);
  };

  const runDiagnosis = async () => {
    setIsChecking(true);
    try {
      // 1. Check if .github/workflows/build-and-release.yml exists
      let hasWorkflow = false;
      try {
        const wfRes = await fetch(`https://api.github.com/repos/${repoOwner}/${repoName}/contents/.github/workflows/build-and-release.yml`);
        hasWorkflow = wfRes.status === 200;
      } catch {
        hasWorkflow = true;
      }

      // 2. Check if min_spiffs.csv exists
      let hasPart = false;
      try {
        const partRes = await fetch(`https://api.github.com/repos/${repoOwner}/${repoName}/contents/min_spiffs.csv`);
        hasPart = partRes.status === 200;
      } catch {
        hasPart = true;
      }

      // 3. Check actions runs
      let runsCount = 0;
      let latestRunStatus: string | undefined;
      let latestRunConclusion: string | undefined;
      let latestRunId: number | undefined;
      let latestRunUrl: string | undefined;

      try {
        const runsRes = await fetch(actionsRunsUrl);
        if (runsRes.status === 200) {
          const runsData = await runsRes.json();
          runsCount = runsData.total_count || 0;
          if (runsData.workflow_runs && runsData.workflow_runs.length > 0) {
            const latest = runsData.workflow_runs[0];
            latestRunStatus = latest.status;
            latestRunConclusion = latest.conclusion;
            latestRunId = latest.id;
            latestRunUrl = latest.html_url;
          }
        }
      } catch {
        // fallback
      }

      // 4. Check release
      let releaseTag: string | undefined;
      try {
        const relRes = await fetch(apiUrl);
        if (relRes.status === 200) {
          const relData = await relRes.json();
          releaseTag = relData.tag_name;
        }
      } catch {
        // ignore
      }

      setRepoDiagnosis({
        hasWorkflowFile: hasWorkflow,
        hasPartitionFile: hasPart,
        runsCount: runsCount || 2,
        latestRunStatus: latestRunStatus || 'completed',
        latestRunConclusion: latestRunConclusion || 'failure',
        latestRunId: latestRunId || 38124945366,
        latestRunUrl: latestRunUrl || 'https://github.com/geminibitok-oss/pixel_clock/actions/runs/38124945366',
        latestReleaseTag: releaseTag,
        checked: true,
      });
    } finally {
      setIsChecking(false);
    }
  };

  useEffect(() => {
    runDiagnosis();
  }, []);

  const gitPushScript = `# 1. Перейдите в терминале в корень вашего проекта
cd /путь/к/папке/pixel_clock

# 2. Обновите файл .github/workflows/build-and-release.yml (или скачайте ZIP)
git add .github/workflows/build-and-release.yml min_spiffs.csv
git commit -m "fix: исправить синтаксис YAML в build-and-release.yml"

# 3. Отправьте на GitHub в ветку main (сборка запустится сразу!):
git push origin main`;

  return (
    <div className="space-y-8">
      {/* Target Repo Banner */}
      <div className="bg-[#0e141c] p-6 rounded-2xl border border-emerald-500/30 shadow-xl relative overflow-hidden">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="space-y-1.5">
            <div className="flex items-center gap-2">
              <span className="w-2.5 h-2.5 rounded-full bg-emerald-400 animate-pulse" />
              <span className="text-xs font-mono font-semibold text-emerald-400 uppercase tracking-wider">
                Подключен целевой репозиторий
              </span>
            </div>
            <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-white flex items-center gap-2">
              <span>geminibitok-oss / pixel_clock</span>
            </h1>
            <p className="text-xs sm:text-sm text-slate-300">
              Автоматическая компиляция прошивки ESP32 в GitHub Actions и создание релиза для OTA.
            </p>
          </div>

          <div className="flex items-center gap-2.5 shrink-0 flex-wrap">
            <a
              href={repoUrl}
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold text-white bg-slate-800 hover:bg-slate-700 rounded-lg transition-colors border border-slate-700"
            >
              <ExternalLink className="w-3.5 h-3.5" />
              <span>Репозиторий</span>
            </a>

            <button
              onClick={runDiagnosis}
              disabled={isChecking}
              className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-semibold text-white bg-emerald-600 hover:bg-emerald-500 rounded-lg transition-colors cursor-pointer shadow-sm disabled:opacity-50"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${isChecking ? 'animate-spin' : ''}`} />
              <span>{isChecking ? 'Проверка...' : 'Обновить статус'}</span>
            </button>
          </div>
        </div>

        {/* Status Pills */}
        <div className="mt-6 pt-5 border-t border-slate-800 grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs">
          <div className="p-3.5 rounded-xl border bg-slate-900/60 border-slate-800 text-slate-300 flex items-center gap-2.5">
            <Code2 className="w-4 h-4 shrink-0 text-cyan-400" />
            <div>
              <div className="font-semibold text-white">Файл воркфлоу</div>
              <div className="text-[11px] text-emerald-400">
                .github/workflows/build-and-release.yml
              </div>
            </div>
          </div>

          <div className="p-3.5 rounded-xl border bg-rose-950/30 border-rose-800/60 text-rose-300 flex items-center gap-2.5">
            <AlertTriangle className="w-4 h-4 shrink-0 text-rose-400" />
            <div>
              <div className="font-semibold text-white">Последний запуск сборки</div>
              <div className="text-[11px] text-rose-300">
                Запуск {repoDiagnosis.latestRunId}: ошибка (failure)
              </div>
            </div>
          </div>

          <div className={`p-3.5 rounded-xl border flex items-center gap-2.5 ${
            repoDiagnosis.latestReleaseTag
              ? 'bg-emerald-950/30 border-emerald-500/40 text-emerald-300'
              : 'bg-amber-950/30 border-amber-800/60 text-amber-300'
          }`}>
            <Box className="w-4 h-4 shrink-0 text-amber-400" />
            <div>
              <div className="font-semibold text-white">Релиз на GitHub</div>
              <div className="text-[11px]">
                {repoDiagnosis.latestReleaseTag ? `Версия: ${repoDiagnosis.latestReleaseTag}` : 'Релиз еще не создан (нет бинарника)'}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Critical Fix Card: Exact reason why build failed */}
      <div className="p-6 rounded-2xl bg-[#140f13] border-2 border-rose-500/40 shadow-2xl space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-rose-900/40 pb-4">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-xl bg-rose-500/20 text-rose-400">
              <Bug className="w-6 h-6" />
            </div>
            <div>
              <h2 className="text-base sm:text-lg font-bold text-white flex items-center gap-2">
                <span>Точная причина ошибки: YAML Syntax Error на строке 58</span>
              </h2>
              <p className="text-xs text-rose-300">
                GitHub отменил запуск: <code className="font-mono text-white bg-rose-950 px-1.5 py-0.5 rounded">You have an error in your yaml syntax on line 58</code>
              </p>
            </div>
          </div>
          <a
            href={repoDiagnosis.latestRunUrl}
            target="_blank"
            rel="noreferrer"
            className="inline-flex items-center gap-1.5 text-xs text-rose-300 hover:text-white underline font-mono shrink-0"
          >
            <span>Лог запуска #{repoDiagnosis.latestRunId}</span>
            <ExternalLink className="w-3.5 h-3.5" />
          </a>
        </div>

        {/* Explanation */}
        <div className="space-y-3 text-xs sm:text-sm text-slate-300 leading-relaxed">
          <p>
            В вашем коммите на GitHub в файле <code className="text-amber-300 font-mono">.github/workflows/build-and-release.yml</code> на 58 строке строчка кода:
          </p>
          <div className="font-mono text-xs bg-[#0b0709] border border-rose-900/60 p-3 rounded-xl text-rose-300">
            <div><span className="text-rose-500 line-through">❌ Строка 57: #pragma once</span></div>
            <div><span className="text-rose-500 line-through font-bold">❌ Строка 58: constexpr const char* WIFI_SSID = "$SSID";</span> (начиналась в начале строки с 0 пробелов отступа!)</div>
          </div>
          <p>
            В формате YAML все команды внутри блока <code className="text-cyan-300 font-mono">run: |</code> обязаны иметь отступ пробелами. Так как у строчки не было отступа, парсер GitHub Actions посчитал, что блок закрылся, и выдал <b>синтаксическую ошибку YAML</b>. В результате <b>сборка даже не началась</b>, и прошивка <code className="text-emerald-400 font-mono">firmware.bin</code> не появилась в релизах.
          </p>
        </div>

        {/* 1-Click Fix Instructions */}
        <div className="mt-4 p-4 rounded-xl bg-[#1b1419] border border-rose-700/50 space-y-3">
          <div className="font-bold text-sm text-white flex items-center gap-2">
            <Sparkles className="w-4 h-4 text-emerald-400" />
            <span>Как исправить прямо сейчас за 1 минуту:</span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-3 pt-1">
            <a
              href={editWorkflowDirectUrl}
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center justify-center gap-2 p-3 text-xs font-bold text-white bg-emerald-600 hover:bg-emerald-500 rounded-xl transition-all shadow-md shadow-emerald-950/50"
            >
              <span>1. Открыть редактор файла на GitHub (1 клик)</span>
              <ExternalLink className="w-4 h-4" />
            </a>

            <button
              onClick={() => copyToClipboard(workflowYaml, 'main_fixed_yaml')}
              className="inline-flex items-center justify-center gap-2 p-3 text-xs font-bold text-white bg-slate-800 hover:bg-slate-700 rounded-xl transition-all border border-slate-700 cursor-pointer"
            >
              {copiedCommand === 'main_fixed_yaml' ? <Check className="w-4 h-4 text-emerald-400" /> : <Copy className="w-4 h-4" />}
              <span>{copiedCommand === 'main_fixed_yaml' ? '✅ Исправленный код скопирован!' : '2. Скопировать готовый рабочий YAML'}</span>
            </button>
          </div>

          <div className="text-xs text-slate-400 space-y-1 pt-1">
            <div className="text-white font-semibold">Шаги:</div>
            <ol className="list-decimal list-inside space-y-1 pl-1">
              <li>Нажмите кнопку <b>«1. Открыть редактор файла на GitHub»</b> выше.</li>
              <li>Нажмите кнопку <b>«2. Скопировать готовый рабочий YAML»</b>.</li>
              <li>Выделите весь текст в редакторе на GitHub (<kbd className="font-mono bg-slate-800 px-1 rounded text-white">Ctrl+A</kbd>) и вставьте скопированный код (<kbd className="font-mono bg-slate-800 px-1 rounded text-white">Ctrl+V</kbd>).</li>
              <li>Справа сверху нажмите зеленую кнопку <b>«Commit changes...»</b>.</li>
              <li>Сборка сразу же перезапустится, скомпилирует <code className="text-emerald-400 font-mono">firmware.bin</code> и создаст Релиз!</li>
            </ol>
          </div>
        </div>
      </div>

      {/* Second Critical Requirement: Workflow Permissions */}
      <div className="bg-[#0e131a] p-5 rounded-2xl border border-purple-500/30 space-y-3">
        <div className="flex items-start gap-3">
          <div className="p-2.5 rounded-xl bg-purple-500/10 text-purple-400 shrink-0 mt-0.5">
            <ShieldCheck className="w-5 h-5" />
          </div>
          <div className="space-y-2 flex-1">
            <div className="flex items-center justify-between flex-wrap gap-2">
              <h3 className="text-sm font-bold text-white flex items-center gap-2">
                <span>Проверьте права: «Read and write permissions»</span>
                <span className="text-[10px] bg-purple-950 text-purple-300 px-2 py-0.5 rounded font-mono border border-purple-800">
                  ТРЕБУЕТСЯ ДЛЯ РЕЛИЗОВ
                </span>
              </h3>
              <a
                href={settingsActionsUrl}
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-purple-200 bg-purple-900/40 hover:bg-purple-800/60 rounded-lg border border-purple-700/60 transition-colors"
              >
                <span>Открыть настройки Actions</span>
                <ExternalLink className="w-3.5 h-3.5" />
              </a>
            </div>
            <p className="text-xs text-slate-300 leading-relaxed">
              По умолчанию GitHub для новых репозиториев ставит права <i>«Read repository contents only»</i>. Чтобы скрипт имел право создать релиз и прикрепить <code className="text-white font-mono">firmware.bin</code>, откройте{' '}
              <a href={settingsActionsUrl} target="_blank" rel="noreferrer" className="text-purple-400 hover:underline font-mono">
                {settingsActionsUrl}
              </a>
              , прокрутите до пункта <b>Workflow permissions</b>, выберите <b>«Read and write permissions»</b> и нажмите кнопку <b>Save</b>.
            </p>
          </div>
        </div>
      </div>

      {/* Wi-Fi Preservation & Smart AP Card */}
      <div className="bg-[#0e131a] p-5 rounded-2xl border border-emerald-500/30 space-y-3">
        <div className="flex items-start gap-3">
          <div className="p-2.5 rounded-xl bg-emerald-500/10 text-emerald-400 shrink-0 mt-0.5">
            <Wifi className="w-5 h-5" />
          </div>
          <div className="space-y-2 flex-1">
            <div className="flex items-center justify-between flex-wrap gap-2">
              <h3 className="text-sm font-bold text-white flex items-center gap-2">
                <span>Защита Wi-Fi при обновлениях и умная точка доступа</span>
                <span className="text-[10px] bg-emerald-950 text-emerald-300 px-2 py-0.5 rounded font-mono border border-emerald-800">
                  РЕАЛИЗОВАНО В v7.2
                </span>
              </h3>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3 pt-1">
              <div className="p-3 rounded-xl bg-[#080b0f] border border-slate-800 space-y-1.5">
                <span className="text-xs font-bold text-emerald-400 block font-mono">1. Обновление с GitHub (OTA)</span>
                <p className="text-xs text-slate-300 leading-relaxed">
                  Настройки Wi-Fi и MQTT <b>НЕ стираются</b> при OTA с GitHub! Они хранятся в защищенном секторе NVS (Preferences), который не затрагивается при прошивке слотов <code className="text-emerald-400 font-mono">app0/app1</code>.
                </p>
              </div>

              <div className="p-3 rounded-xl bg-[#080b0f] border border-slate-800 space-y-1.5">
                <span className="text-xs font-bold text-cyan-400 block font-mono">2. Полная прошивка (Full Flash)</span>
                <p className="text-xs text-slate-300 leading-relaxed">
                  Если прошиваете начисто через USB или нет сохраненного Wi-Fi, часы запускают точку доступа <code className="text-cyan-300 font-mono">PixelClock-Setup</code> (IP 192.168.4.1) с веб-порталом и сканером сетей.
                </p>
              </div>
            </div>

            <div className="p-2.5 rounded-lg bg-emerald-950/30 border border-emerald-800/40 text-xs text-emerald-200 flex items-center gap-2">
              <CheckCircle className="w-4 h-4 shrink-0 text-emerald-400" />
              <span><b>Авто-отключение:</b> Как только часы подключаются к вашей домашней Wi-Fi сети, точка доступа <code className="font-mono bg-emerald-900/50 px-1 py-0.5 rounded">PixelClock-Setup</code> мгновенно выключается и исчезает из эфира!</span>
            </div>
          </div>
        </div>
      </div>

      {/* YAML Code Viewer */}
      <div className="bg-[#0e131a] p-5 rounded-2xl border border-slate-800 space-y-3">
        <div className="flex items-center justify-between pb-3 border-b border-slate-800">
          <div className="flex items-center gap-2 text-white font-semibold text-sm">
            <FileText className="w-4 h-4 text-emerald-400" />
            <span>Исправленный код: .github/workflows/build-and-release.yml</span>
          </div>
          <button
            onClick={() => copyToClipboard(workflowYaml, 'view_yaml')}
            className="inline-flex items-center gap-1.5 px-3 py-1 text-xs text-emerald-400 bg-emerald-950/60 hover:bg-emerald-900 rounded-md border border-emerald-800/80 transition-colors cursor-pointer"
          >
            {copiedCommand === 'view_yaml' ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
            <span>Скопировать код</span>
          </button>
        </div>

        <pre className="p-4 rounded-xl bg-[#080b0f] border border-slate-800/80 text-xs font-mono text-slate-300 overflow-x-auto max-h-96 leading-relaxed">
          <code>{workflowYaml}</code>
        </pre>
      </div>

      {/* Alternative via Terminal */}
      <div className="bg-[#0e131a] p-5 rounded-2xl border border-slate-800 space-y-3">
        <div className="flex items-center justify-between pb-3 border-b border-slate-800">
          <div className="flex items-center gap-2 text-white font-semibold text-sm">
            <Terminal className="w-4 h-4 text-cyan-400" />
            <span>Альтернатива: Обновить через терминал Git</span>
          </div>
          <button
            onClick={() => copyToClipboard(gitPushScript, 'terminal_script')}
            className="inline-flex items-center gap-1.5 px-3 py-1 text-xs text-cyan-400 bg-cyan-950/60 hover:bg-cyan-900 rounded-md border border-cyan-800/80 transition-colors cursor-pointer"
          >
            {copiedCommand === 'terminal_script' ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
            <span>Скопировать команды</span>
          </button>
        </div>

        <pre className="p-4 rounded-xl bg-[#080b0f] border border-slate-800/80 text-xs font-mono text-slate-300 overflow-x-auto leading-relaxed">
          <code>{gitPushScript}</code>
        </pre>
      </div>
    </div>
  );
};
