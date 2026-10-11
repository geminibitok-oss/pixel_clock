import React, { useState, useEffect } from 'react';
import { 
  GitBranch, Check, Copy, ExternalLink, RefreshCw, 
  Terminal, Sparkles, CheckCircle2, AlertCircle, FileDown, 
  Globe, ShieldCheck, Box, AlertTriangle, ArrowRight
} from 'lucide-react';
import { PROJECT_FILES } from '../data/projectFiles';

export const RepoIntegrationHub: React.FC = () => {
  const repoOwner = 'geminibitok-oss';
  const repoName = 'pixel_clock';
  const repoUrl = `https://github.com/${repoOwner}/${repoName}`;
  const apiUrl = `https://api.github.com/repos/${repoOwner}/${repoName}/releases/latest`;
  const actionsRunsUrl = `https://api.github.com/repos/${repoOwner}/${repoName}/actions/runs`;
  const directDownloadUrl = `https://github.com/${repoOwner}/${repoName}/releases/latest/download/firmware.bin`;
  const createWorkflowDirectUrl = `https://github.com/${repoOwner}/${repoName}/new/main?filename=.github/workflows/build-and-release.yml`;

  const [isChecking, setIsChecking] = useState(false);
  const [copiedCommand, setCopiedCommand] = useState<string | null>(null);
  const [repoDiagnosis, setRepoDiagnosis] = useState<{
    hasWorkflowFile: boolean;
    hasPartitionFile: boolean;
    runsCount: number;
    latestRunStatus?: string;
    latestReleaseTag?: string;
    checked: boolean;
  }>({
    hasWorkflowFile: false,
    hasPartitionFile: false,
    runsCount: 0,
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
        hasWorkflow = false;
      }

      // 2. Check if min_spiffs.csv or platformio.ini exists
      let hasPart = false;
      try {
        const partRes = await fetch(`https://api.github.com/repos/${repoOwner}/${repoName}/contents/min_spiffs.csv`);
        hasPart = partRes.status === 200;
      } catch {
        hasPart = false;
      }

      // 3. Check actions runs
      let runsCount = 0;
      let latestRunStatus: string | undefined;
      try {
        const runsRes = await fetch(actionsRunsUrl);
        if (runsRes.status === 200) {
          const runsData = await runsRes.json();
          runsCount = runsData.total_count || 0;
          if (runsData.workflow_runs && runsData.workflow_runs.length > 0) {
            const latest = runsData.workflow_runs[0];
            latestRunStatus = `${latest.conclusion || latest.status} (${latest.name})`;
          }
        }
      } catch {
        // ignore
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
        runsCount,
        latestRunStatus,
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
cd /путь/к/папке/проекта

# 2. Добавьте файл воркфлоу и файлы прошивки:
git add .
git commit -m "feat: добавить автосборку прошивки и GitHub Actions"

# 3. Отправьте изменения на GitHub в ветку main:
git push origin main

# 4. Создайте тег релиза (или сборка начнется сразу по пушу в main!):
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
              Мониторинг автоматической сборки прошивки на серверах GitHub и доставки обновлений по воздуху.
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
              <span>Репозиторий на GitHub</span>
            </a>

            <button
              onClick={runDiagnosis}
              disabled={isChecking}
              className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-semibold text-white bg-emerald-600 hover:bg-emerald-500 rounded-lg transition-colors cursor-pointer shadow-sm disabled:opacity-50"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${isChecking ? 'animate-spin' : ''}`} />
              <span>{isChecking ? 'Диагностика...' : 'Обновить статус'}</span>
            </button>
          </div>
        </div>

        {/* Live Diagnostics Card */}
        {repoDiagnosis.checked && (
          <div className="mt-6 pt-5 border-t border-slate-800 space-y-4">
            <div className="text-xs font-semibold uppercase tracking-wider text-slate-400">
              Результат онлайн-диагностики репозитория:
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs">
              <div className={`p-3.5 rounded-xl border flex items-center gap-2.5 ${
                repoDiagnosis.hasWorkflowFile
                  ? 'bg-emerald-950/30 border-emerald-500/40 text-emerald-300'
                  : 'bg-rose-950/30 border-rose-800/60 text-rose-300'
              }`}>
                {repoDiagnosis.hasWorkflowFile ? <CheckCircle2 className="w-4 h-4 shrink-0 text-emerald-400" /> : <AlertTriangle className="w-4 h-4 shrink-0 text-rose-400" />}
                <div>
                  <div className="font-semibold">Файл .github/workflows/</div>
                  <div className="text-[11px] opacity-80">
                    {repoDiagnosis.hasWorkflowFile ? 'Обнаружен в репозитории' : 'Не найден в pixel_clock'}
                  </div>
                </div>
              </div>

              <div className="p-3.5 rounded-xl border bg-slate-900 border-slate-800 text-slate-300 flex items-center gap-2.5">
                <GitBranch className="w-4 h-4 shrink-0 text-cyan-400" />
                <div>
                  <div className="font-semibold">Запусков Actions: {repoDiagnosis.runsCount}</div>
                  <div className="text-[11px] text-slate-400">
                    {repoDiagnosis.latestRunStatus || 'Еще не запускались'}
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
                  <div className="font-semibold">Релиз прошивки</div>
                  <div className="text-[11px] opacity-80">
                    {repoDiagnosis.latestReleaseTag ? `Версия: ${repoDiagnosis.latestReleaseTag}` : 'Релиз еще не создан'}
                  </div>
                </div>
              </div>
            </div>

            {/* Why firmware wasn't created explanation */}
            <div className="p-4 rounded-xl bg-amber-950/40 border border-amber-600/50 space-y-3 text-xs text-amber-200">
              <div className="font-bold text-sm text-white flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <AlertCircle className="w-4 h-4 text-amber-400" />
                  <span>Причина: сборка в коммите e4ae9c4 упала с ошибкой синтаксиса</span>
                </div>
                <span className="text-[10px] font-mono bg-rose-950 text-rose-300 border border-rose-800 px-2 py-0.5 rounded">
                  Run 38124392277 failed
                </span>
              </div>
              <p className="leading-relaxed">
                На скриншоте виден коммит <b className="text-white font-mono">e4ae9c4</b>. В нем на 57-й строке файла <code className="text-white font-mono">build-and-release.yml</code> была опечатка в выражении GitHub Actions: двойные кавычки внутри кавычек. Из-за этого сервер GitHub прервал сборку до компиляции.
              </p>
              <div className="pt-1 flex flex-wrap items-center gap-2.5">
                <a
                  href="https://github.com/geminibitok-oss/pixel_clock/edit/main/.github/workflows/build-and-release.yml"
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white font-semibold rounded-lg shadow-sm"
                >
                  <span>1. Открыть и заменить файл build-and-release.yml на GitHub (в 1 клик)</span>
                  <ExternalLink className="w-3.5 h-3.5" />
                </a>
                <button
                  onClick={() => copyToClipboard(workflowYaml, 'yaml_popup')}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 font-medium rounded-lg border border-slate-700 cursor-pointer"
                >
                  {copiedCommand === 'yaml_popup' ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                  <span>2. Скопировать исправленный код YAML</span>
                </button>
                <a
                  href="https://github.com/geminibitok-oss/pixel_clock/settings/actions"
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-purple-950 hover:bg-purple-900 text-purple-200 font-medium rounded-lg border border-purple-800"
                >
                  <span>3. Проверить права: Read and write permissions</span>
                  <ExternalLink className="w-3.5 h-3.5" />
                </a>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* 2 Ways to Trigger Build */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Method 1: Web Interface GitHub in 1 minute */}
        <div className="bg-[#0e131a] p-5 rounded-2xl border border-slate-800 space-y-4">
          <div className="pb-3 border-b border-slate-800 flex items-center justify-between">
            <div className="flex items-center gap-2 text-white font-semibold text-sm">
              <Globe className="w-4 h-4 text-emerald-400" />
              <span>Способ 1. Без терминала (прямо на сайте GitHub)</span>
            </div>
            <span className="text-[11px] font-mono text-emerald-400 uppercase bg-emerald-950 px-2 py-0.5 rounded">
              Быстрее всего
            </span>
          </div>

          <ol className="list-decimal list-inside space-y-2 text-xs text-slate-300 leading-relaxed">
            <li>
              Нажмите кнопку:
              <a
                href={createWorkflowDirectUrl}
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center gap-1 text-emerald-400 hover:underline font-semibold ml-1.5"
              >
                <span>Создать файл воркфлоу на GitHub</span>
                <ExternalLink className="w-3 h-3" />
              </a>
            </li>
            <li>
              В поле имени файла введите:
              <code className="text-white bg-slate-900 px-1.5 py-0.5 rounded ml-1 font-mono">
                .github/workflows/build-and-release.yml
              </code>
            </li>
            <li>
              Скопируйте готовый YAML код ниже и вставьте его в редактор на сайте.
            </li>
            <li>
              Внизу страницы нажмите зеленую кнопку <b className="text-white">«Commit changes...»</b>.
            </li>
            <li>
              Перейдите во вкладку <b className="text-white">Settings</b> → <b className="text-white">Actions</b> → <b className="text-white">General</b> и внизу в разделе <b className="text-white">Workflow permissions</b> выберите <b className="text-emerald-400">Read and write permissions</b>.
            </li>
          </ol>

          <button
            onClick={() => copyToClipboard(workflowYaml, 'yaml_box')}
            className="w-full inline-flex items-center justify-center gap-2 py-2.5 px-4 text-xs font-semibold text-white bg-emerald-600 hover:bg-emerald-500 rounded-xl transition-colors cursor-pointer shadow-sm"
          >
            {copiedCommand === 'yaml_box' ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
            <span>{copiedCommand === 'yaml_box' ? 'YAML код скопирован!' : 'Скопировать код YAML для GitHub'}</span>
          </button>
        </div>

        {/* Method 2: Terminal */}
        <div className="bg-[#0e131a] p-5 rounded-2xl border border-slate-800 space-y-4 flex flex-col">
          <div className="pb-3 border-b border-slate-800 flex items-center justify-between">
            <div className="flex items-center gap-2 text-white font-semibold text-sm">
              <Terminal className="w-4 h-4 text-cyan-400" />
              <span>Способ 2. Через Git в терминале</span>
            </div>
            <button
              onClick={() => copyToClipboard(gitPushScript, 'full_script')}
              className="inline-flex items-center gap-1.5 px-2.5 py-1 text-xs text-emerald-400 bg-emerald-950/60 hover:bg-emerald-900 rounded-md border border-emerald-800/80 transition-colors cursor-pointer"
            >
              {copiedCommand === 'full_script' ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
              <span>Копировать команды</span>
            </button>
          </div>

          <p className="text-xs text-slate-400 leading-relaxed">
            Если вы скачали ZIP-архив проекта, распакуйте его в папку репозитория и выполните эти команды:
          </p>

          <pre className="p-4 rounded-xl bg-[#080b0f] border border-slate-800/80 text-xs font-mono text-slate-300 overflow-x-auto leading-relaxed flex-1">
            <code>{gitPushScript}</code>
          </pre>

          <div className="p-3 bg-[#111722] rounded-xl border border-slate-800 text-xs text-slate-400 space-y-1">
            <span className="text-cyan-400 font-semibold block">⚡ Обновленная логика автосборки:</span>
            <div>
              Теперь сборка запускается <b>не только по тегам</b>, но и при <b>каждом пуше в ветку main</b>, автоматически обновляя релиз <code className="text-emerald-400 font-mono">latest</code>!
            </div>
          </div>
        </div>
      </div>

      {/* Critical Setting Reminder: Workflow Permissions */}
      <div className="bg-[#0e131a] p-5 rounded-2xl border border-slate-800 flex items-start gap-4">
        <div className="p-3 rounded-xl bg-purple-500/10 text-purple-400 shrink-0 mt-0.5">
          <ShieldCheck className="w-6 h-6" />
        </div>
        <div className="space-y-1.5 text-xs text-slate-300">
          <h3 className="text-sm font-bold text-white flex items-center gap-2">
            <span>Важная настройка на GitHub: Права на запись для Actions</span>
            <span className="text-[10px] bg-purple-950 text-purple-300 px-2 py-0.5 rounded font-mono">
              ОБЯЗАТЕЛЬНО
            </span>
          </h3>
          <p className="leading-relaxed">
            В новых репозиториях GitHub по умолчанию запрещает автоматическим скриптам создавать Релизы.
            Чтобы сборка успешно создала файл в релизах, откройте:
          </p>
          <div className="font-mono text-emerald-400 bg-[#080b0f] p-2.5 rounded-lg border border-slate-800">
            {repoUrl}/settings/actions
          </div>
          <p className="text-slate-400">
            Прокрутите вниз до раздела <b className="text-white">Workflow permissions</b> и переключите чекбокс на <b className="text-white">«Read and write permissions»</b> → нажмите <b className="text-white">Save</b>.
          </p>
        </div>
      </div>
    </div>
  );
};
