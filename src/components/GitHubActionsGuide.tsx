import React, { useState } from 'react';
import { 
  GitBranch, CheckCircle, Terminal, 
  Copy, Check, FileCode, Play, Sparkles
} from 'lucide-react';
import { PROJECT_FILES } from '../data/projectFiles';

export const GitHubActionsGuide: React.FC = () => {
  const [copied, setCopied] = useState(false);
  const [activeStep, setActiveStep] = useState(1);
  const [useSecrets, setUseSecrets] = useState(true);
  const [cacheEnabled, setCacheEnabled] = useState(true);

  const workflowFile = PROJECT_FILES.find(f => f.id === 'github_workflow');
  const yamlContent = workflowFile ? workflowFile.content : '';

  const copyYaml = () => {
    navigator.clipboard.writeText(yamlContent);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const steps = [
    {
      num: 1,
      title: 'Создание файла workflow в репозитории',
      desc: 'Создайте в корне проекта папку .github/workflows/ и файл build-and-release.yml',
      details: (
        <div className="space-y-3 text-sm text-slate-300">
          <p>
            GitHub автоматически ищет файлы CI/CD в директории <code className="text-emerald-400 bg-slate-900 px-1.5 py-0.5 rounded">.github/workflows/</code>.
            Любой файл с расширением <code className="text-emerald-400 bg-slate-900 px-1.5 py-0.5 rounded">.yml</code> становится рабочим процессом (Workflow).
          </p>
          <div className="bg-[#080b0f] p-3 rounded-lg border border-slate-800 font-mono text-xs text-slate-400 space-y-1">
            <div className="text-slate-500"># Создание структуры папок через терминал в папке проекта:</div>
            <div>mkdir -p .github/workflows</div>
            <div>touch .github/workflows/build-and-release.yml</div>
          </div>
        </div>
      )
    },
    {
      num: 2,
      title: 'Настройка GitHub Secrets (Безопасность)',
      desc: 'Добавьте зашифрованные секреты репозитория, чтобы не хранить пароли в коде',
      details: (
        <div className="space-y-3 text-sm text-slate-300">
          <p>
            Чтобы GitHub собрал прошивку с вашим домашним Wi-Fi и MQTT, но при этом пароли не утекли в открытый доступ, добавьте их в GitHub Secrets:
          </p>
          <ol className="list-decimal list-inside space-y-1.5 text-xs text-slate-300 ml-1">
            <li>Откройте ваш репозиторий на GitHub.</li>
            <li>Перейдите во вкладку <b className="text-white">Settings</b> → <b className="text-white">Secrets and variables</b> → <b className="text-white">Actions</b>.</li>
            <li>Нажмите <b className="text-emerald-400">New repository secret</b> и добавьте:</li>
          </ol>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 font-mono text-xs">
            <div className="bg-[#080b0f] p-2.5 rounded-lg border border-slate-800">
              <span className="text-emerald-400 font-semibold block">WIFI_SSID</span>
              <span className="text-slate-500">Имя вашей Wi-Fi сети</span>
            </div>
            <div className="bg-[#080b0f] p-2.5 rounded-lg border border-slate-800">
              <span className="text-emerald-400 font-semibold block">WIFI_PASS</span>
              <span className="text-slate-500">Пароль от вашей Wi-Fi сети</span>
            </div>
            <div className="bg-[#080b0f] p-2.5 rounded-lg border border-slate-800">
              <span className="text-emerald-400 font-semibold block">MQTT_SERVER</span>
              <span className="text-slate-500">IP или адрес брокера (192.168.1.180)</span>
            </div>
            <div className="bg-[#080b0f] p-2.5 rounded-lg border border-slate-800">
              <span className="text-emerald-400 font-semibold block">MQTT_PASS</span>
              <span className="text-slate-500">Пароль пользователя MQTT</span>
            </div>
          </div>
          <p className="text-xs text-slate-400">
            * Если секреты не заданы, GitHub Actions подставит безопасные значения по умолчанию для проверки компиляции.
          </p>
        </div>
      )
    },
    {
      num: 3,
      title: 'Публикация релиза и сборка (Триггер)',
      desc: 'Создайте Git Tag для автоматической сборки и публикации готового firmware.bin',
      details: (
        <div className="space-y-3 text-sm text-slate-300">
          <p>
            Автосборка запускается при каждом обычном пуше в ветку <code className="text-emerald-400 bg-slate-900 px-1 py-0.5 rounded">main</code> (проверка компиляции).
            А когда вы хотите выпустить новую прошивку и прикрепить <code className="text-emerald-400 bg-slate-900 px-1 py-0.5 rounded">firmware.bin</code> к Релизам GitHub — создайте тег версии:
          </p>
          <div className="bg-[#080b0f] p-3 rounded-lg border border-slate-800 font-mono text-xs text-slate-300 space-y-1.5">
            <div className="text-slate-500"># 1. Зафиксируйте изменения</div>
            <div>git add .</div>
            <div>git commit -m "feat: добавлено обновление по воздуху с GitHub"</div>
            <div className="text-slate-500 pt-1"># 2. Создайте тег новой версии и отправьте на GitHub</div>
            <div className="text-emerald-400 font-semibold">git tag v7.1</div>
            <div className="text-emerald-400 font-semibold">git push origin v7.1</div>
          </div>
          <p className="text-xs text-slate-400">
            После этого GitHub Actions автоматически создаст релиз с заголовком <b className="text-white">Release v7.1</b> и прикрепит готовый <b className="text-white">firmware.bin</b>!
          </p>
        </div>
      )
    },
    {
      num: 4,
      title: 'Где скачать скомпилированный бинарник',
      desc: 'Файлы доступны во вкладке Releases и во вкладке Actions Artifacts',
      details: (
        <div className="space-y-3 text-sm text-slate-300">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-xs">
            <div className="bg-[#080b0f] p-3.5 rounded-lg border border-slate-800 space-y-1.5">
              <span className="font-semibold text-white flex items-center gap-1.5">
                <Sparkles className="w-4 h-4 text-emerald-400" />
                <span>GitHub Releases (Для OTA обновления)</span>
              </span>
              <p className="text-slate-400">
                Вкладка <b className="text-white">Releases</b> на главной странице вашего репозитория. Там всегда доступен прямой постоянный URL:
              </p>
              <code className="text-slate-300 block bg-[#0e1319] p-2 rounded break-all">
                https://github.com/OWNER/REPO/releases/latest/download/firmware.bin
              </code>
            </div>

            <div className="bg-[#080b0f] p-3.5 rounded-lg border border-slate-800 space-y-1.5">
              <span className="font-semibold text-white flex items-center gap-1.5">
                <FileCode className="w-4 h-4 text-cyan-400" />
                <span>Actions Artifacts (Для тестовых коммитов)</span>
              </span>
              <p className="text-slate-400">
                Вкладка <b className="text-white">Actions</b> → клик по любому завершенному пайплайну → секция <b className="text-white">Artifacts</b> внизу страницы.
              </p>
              <span className="text-slate-500 block">
                Содержит zip-архив с firmware.bin, bootloader.bin и partitions.bin.
              </span>
            </div>
          </div>
        </div>
      )
    }
  ];

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="pb-4 border-b border-slate-800">
        <h1 className="text-xl font-bold tracking-tight text-white">
          Автосборка прошивки через GitHub Actions (CI/CD)
        </h1>
        <p className="text-sm text-slate-400 mt-1">
          Облачная компиляция PlatformIO на серверах GitHub: автоматическая проверка кода, сборка firmware.bin и публикация релизов без необходимости ставить тяжелое окружение на ПК.
        </p>
      </div>

      {/* Visual Pipeline Flow Diagram */}
      <div className="bg-[#0a0e14] p-5 rounded-2xl border border-slate-800">
        <div className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-4 flex items-center justify-between">
          <span>Схема пайплайна автоматической сборки</span>
          <span className="text-emerald-400 font-mono lowercase">github actions flow</span>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-5 gap-3 relative">
          <div className="bg-[#10151f] p-3 rounded-xl border border-slate-800 flex flex-col items-center text-center">
            <div className="w-8 h-8 rounded-lg bg-blue-500/10 text-blue-400 flex items-center justify-center mb-2">
              <GitBranch className="w-4 h-4" />
            </div>
            <span className="text-xs font-semibold text-white">1. Git Push / Tag</span>
            <span className="text-[11px] text-slate-400 mt-0.5 font-mono">tag v7.1</span>
          </div>

          <div className="bg-[#10151f] p-3 rounded-xl border border-slate-800 flex flex-col items-center text-center">
            <div className="w-8 h-8 rounded-lg bg-purple-500/10 text-purple-400 flex items-center justify-center mb-2">
              <Play className="w-4 h-4" />
            </div>
            <span className="text-xs font-semibold text-white">2. Runner VM</span>
            <span className="text-[11px] text-slate-400 mt-0.5 font-mono">ubuntu-latest</span>
          </div>

          <div className="bg-[#10151f] p-3 rounded-xl border border-slate-800 flex flex-col items-center text-center">
            <div className="w-8 h-8 rounded-lg bg-amber-500/10 text-amber-400 flex items-center justify-center mb-2">
              <Terminal className="w-4 h-4" />
            </div>
            <span className="text-xs font-semibold text-white">3. PlatformIO Core</span>
            <span className="text-[11px] text-slate-400 mt-0.5 font-mono">pio run -e esp32dev</span>
          </div>

          <div className="bg-[#10151f] p-3 rounded-xl border border-slate-800 flex flex-col items-center text-center">
            <div className="w-8 h-8 rounded-lg bg-cyan-500/10 text-cyan-400 flex items-center justify-center mb-2">
              <FileCode className="w-4 h-4" />
            </div>
            <span className="text-xs font-semibold text-white">4. Генерация BIN</span>
            <span className="text-[11px] text-slate-400 mt-0.5 font-mono">firmware.bin</span>
          </div>

          <div className="bg-[#10151f] p-3 rounded-xl border border-emerald-500/30 bg-emerald-950/20 flex flex-col items-center text-center">
            <div className="w-8 h-8 rounded-lg bg-emerald-500/20 text-emerald-400 flex items-center justify-center mb-2">
              <CheckCircle className="w-4 h-4" />
            </div>
            <span className="text-xs font-semibold text-white">5. GitHub Release</span>
            <span className="text-[11px] text-emerald-400 mt-0.5 font-mono">готово к OTA!</span>
          </div>
        </div>
      </div>

      {/* 4 Interactive Setup Steps */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-base font-bold text-white tracking-tight">
            Пошаговая настройка в вашем репозитории
          </h2>
          <span className="text-xs text-slate-400">Шаг {activeStep} из 4</span>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
          {steps.map((s) => (
            <button
              key={s.num}
              onClick={() => setActiveStep(s.num)}
              className={`p-3 rounded-xl border text-left transition-all cursor-pointer ${
                activeStep === s.num
                  ? 'bg-[#121822] border-emerald-500/60 shadow-sm'
                  : 'bg-[#0e131a] border-slate-800 text-slate-400 hover:text-slate-200 hover:border-slate-700'
              }`}
            >
              <div className="text-xs font-mono font-semibold text-emerald-400 mb-0.5">
                0{s.num}.
              </div>
              <div className="text-xs font-semibold text-white truncate">
                {s.title}
              </div>
            </button>
          ))}
        </div>

        {/* Selected Step Card */}
        <div className="bg-[#0e131a] p-5 rounded-2xl border border-slate-800">
          <div className="flex items-center gap-3 mb-3">
            <div className="w-7 h-7 rounded-lg bg-emerald-500/10 text-emerald-400 flex items-center justify-center text-xs font-bold font-mono">
              {steps[activeStep - 1].num}
            </div>
            <div>
              <h3 className="text-sm font-bold text-white">
                {steps[activeStep - 1].title}
              </h3>
              <p className="text-xs text-slate-400">
                {steps[activeStep - 1].desc}
              </p>
            </div>
          </div>
          <div className="pt-3 border-t border-slate-800/80">
            {steps[activeStep - 1].details}
          </div>
        </div>
      </div>

      {/* Complete Workflow YAML Code Block */}
      <div className="bg-[#0e131a] rounded-2xl border border-slate-800 overflow-hidden">
        <div className="p-4 bg-[#121822] border-b border-slate-800 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <FileCode className="w-4 h-4 text-emerald-400" />
            <span className="text-xs font-mono font-semibold text-white">
              .github/workflows/build-and-release.yml
            </span>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={copyYaml}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-white bg-emerald-600 hover:bg-emerald-500 rounded-lg transition-colors cursor-pointer"
            >
              {copied ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
              <span>{copied ? 'Скопировано!' : 'Копировать YAML'}</span>
            </button>
          </div>
        </div>

        <pre className="p-4 sm:p-5 text-xs font-mono text-slate-300 overflow-x-auto max-h-[480px] leading-relaxed bg-[#080b0f]">
          <code>{yamlContent}</code>
        </pre>
      </div>
    </div>
  );
};
