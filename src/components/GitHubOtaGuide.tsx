import React, { useState } from 'react';
import { 
  RefreshCw, Globe, ShieldCheck, CheckCircle, 
  Terminal, ArrowRight, Copy, Check, FileCode, Monitor
} from 'lucide-react';
import { PROJECT_FILES } from '../data/projectFiles';

export const GitHubOtaGuide: React.FC = () => {
  const [copiedHeader, setCopiedHeader] = useState(false);
  const [activeTab, setActiveTab] = useState<'architecture' | 'methods' | 'code'>('architecture');

  const otaHeaderFile = PROJECT_FILES.find(f => f.id === 'github_ota_header');
  const headerContent = otaHeaderFile ? otaHeaderFile.content : '';

  const copyHeader = () => {
    navigator.clipboard.writeText(headerContent);
    setCopiedHeader(true);
    setTimeout(() => setCopiedHeader(false), 2000);
  };

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="pb-4 border-b border-slate-800">
        <h1 className="text-xl font-bold tracking-tight text-white">
          Прямое обновление прошивки с GitHub (GitHub OTA)
        </h1>
        <p className="text-sm text-slate-400 mt-1">
          Как научить ESP32 самостоятельно опрашивать GitHub API, скачивать скомпилированный бинарник firmware.bin и безопасно прошиваться с визуализацией шкалы на матрице.
        </p>
      </div>

      {/* Navigation tabs */}
      <div className="flex border-b border-slate-800 gap-2">
        <button
          onClick={() => setActiveTab('architecture')}
          className={`pb-3 text-xs font-semibold border-b-2 transition-colors cursor-pointer ${
            activeTab === 'architecture'
              ? 'border-emerald-500 text-white'
              : 'border-transparent text-slate-400 hover:text-slate-200'
          }`}
        >
          Архитектура и HTTPS Redirects (302)
        </button>
        <button
          onClick={() => setActiveTab('methods')}
          className={`pb-3 text-xs font-semibold border-b-2 transition-colors cursor-pointer ${
            activeTab === 'methods'
              ? 'border-emerald-500 text-white'
              : 'border-transparent text-slate-400 hover:text-slate-200'
          }`}
        >
          3 способа запуска обновления
        </button>
        <button
          onClick={() => setActiveTab('code')}
          className={`pb-3 text-xs font-semibold border-b-2 transition-colors cursor-pointer ${
            activeTab === 'code'
              ? 'border-emerald-500 text-white'
              : 'border-transparent text-slate-400 hover:text-slate-200'
          }`}
        >
          Исходный код модуля GitHubOTA.h
        </button>
      </div>

      {activeTab === 'architecture' && (
        <div className="space-y-6">
          {/* Main technical insight card */}
          <div className="bg-[#0e131a] p-6 rounded-2xl border border-slate-800 space-y-4">
            <h2 className="text-base font-bold text-white flex items-center gap-2">
              <Globe className="w-5 h-5 text-emerald-400" />
              <span>Главная техническая сложность: Перенаправление HTTP 302 на Amazon S3</span>
            </h2>
            <p className="text-sm text-slate-300 leading-relaxed">
              Многие проекты ESP32 не могут скачивать прошивку напрямую с GitHub, потому что ссылка на релиз <code className="text-emerald-400 bg-slate-900 px-1 py-0.5 rounded">github.com/.../releases/download/.../firmware.bin</code> не отдает файл напрямую.
              GitHub возвращает ответ <b className="text-amber-400 font-mono">HTTP 302 Found</b> и перенаправляет клиент на защищенный CDN Amazon AWS S3 (<code className="text-slate-300 bg-slate-900 px-1 py-0.5 rounded">objects.githubusercontent.com</code>).
            </p>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-3 pt-2">
              <div className="bg-[#080b0f] p-4 rounded-xl border border-slate-800 space-y-2">
                <span className="text-xs font-bold text-emerald-400 block font-mono">1. HTTPS + Insecure</span>
                <p className="text-xs text-slate-400 leading-relaxed">
                  Используется <code className="text-slate-200 font-mono">WiFiClientSecure</code> с флагом <code className="text-slate-200 font-mono">client.setInsecure()</code>, чтобы не прошивать сертификаты корневого центра сертификации (CA) в код.
                </p>
              </div>

              <div className="bg-[#080b0f] p-4 rounded-xl border border-slate-800 space-y-2">
                <span className="text-xs font-bold text-emerald-400 block font-mono">2. Follow Redirects</span>
                <p className="text-xs text-slate-400 leading-relaxed">
                  Включается флаг <code className="text-slate-200 font-mono">http.setFollowRedirects(HTTPC_STRICT_FOLLOW_REDIRECTS)</code>. Клиент автоматически следует по цепочке до хранилища S3.
                </p>
              </div>

              <div className="bg-[#080b0f] p-4 rounded-xl border border-slate-800 space-y-2">
                <span className="text-xs font-bold text-emerald-400 block font-mono">3. Потоковый Update</span>
                <p className="text-xs text-slate-400 leading-relaxed">
                  Файл читается чанками по 1024 байта через <code className="text-slate-200 font-mono">Update.write()</code> прямо во Flash-память, не забивая оперативную память ESP32 (RAM).
                </p>
              </div>
            </div>
          </div>

          {/* Dual Partition Safety Card */}
          <div className="bg-[#0e131a] p-6 rounded-2xl border border-slate-800 space-y-4">
            <h2 className="text-base font-bold text-white flex items-center gap-2">
              <ShieldCheck className="w-5 h-5 text-cyan-400" />
              <span>Защита от окирпичивания: Два OTA раздела (app0 и app1)</span>
            </h2>
            <p className="text-sm text-slate-300 leading-relaxed">
              В таблице разделов <code className="text-emerald-400 bg-slate-900 px-1 py-0.5 rounded">min_spiffs.csv</code> выделено два равноправных слота приложения по 1.95 МБ:
            </p>

            <div className="bg-[#080b0f] p-4 rounded-xl border border-slate-800 font-mono text-xs text-slate-300 space-y-2">
              <div className="flex items-center justify-between pb-2 border-b border-slate-800 text-slate-500">
                <span>Раздел</span>
                <span>Назначение</span>
                <span>Смещение / Размер</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-amber-400 font-bold">nvs</span>
                <span>Настройки Wi-Fi, MQTT, цвета (НЕ стираются при OTA!)</span>
                <span className="text-slate-500">0x9000 / 20 KB</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-purple-400">otadata</span>
                <span>Служебный сектор выбора активного слота</span>
                <span className="text-slate-500">0xe000 / 8 KB</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-emerald-400">app0 (ota_0)</span>
                <span>Текущая рабочая прошивка</span>
                <span className="text-slate-500">0x10000 / 1.95 MB</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-cyan-400">app1 (ota_1)</span>
                <span>Сюда загружается новая версия при обновлении с GitHub</span>
                <span className="text-slate-500">0x1F0000 / 1.95 MB</span>
              </div>
            </div>

            <div className="space-y-1.5 pt-1 text-xs text-slate-300">
              <p>
                🔒 <b className="text-emerald-400">Почему настройки Wi-Fi не стираются при OTA:</b> Обновление с GitHub пишет байты исключительно в свободный слот <code className="text-slate-200 font-mono">app0</code> или <code className="text-slate-200 font-mono">app1</code>. Раздел <b className="text-amber-400 font-mono">nvs</b> физически находится по другому адресу памяти и никогда не затрагивается!
              </p>
              <p>
                📶 <b className="text-cyan-400">При полной чистой прошивке (Full Flash):</b> Если на чистом ESP32 нет сохраненного Wi-Fi, часы поднимают точку доступа <code className="text-cyan-300 font-mono">PixelClock-Setup</code> (192.168.4.1). Как только вы ввели Wi-Fi и часы подключились к домашней сети — <b>точка доступа немедленно отключается</b>!
              </p>
            </div>
          </div>
        </div>
      )}

      {activeTab === 'methods' && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {/* Method 1: Web Interface */}
          <div className="bg-[#0e131a] p-5 rounded-2xl border border-slate-800 space-y-3 flex flex-col">
            <div className="w-10 h-10 rounded-xl bg-blue-500/10 text-blue-400 flex items-center justify-center">
              <Monitor className="w-5 h-5" />
            </div>
            <h3 className="text-base font-bold text-white">1. Веб-интерфейс часов</h3>
            <p className="text-xs text-slate-400 leading-relaxed flex-1">
              Откройте IP часов в браузере. В шапке появится блок «Обновление по воздуху (GitHub OTA)» с кнопками:
            </p>
            <div className="bg-[#080b0f] p-3 rounded-lg border border-slate-800 text-xs space-y-1.5 font-mono">
              <div className="text-slate-300">Кнопка «Проверить обновления»</div>
              <div className="text-emerald-400">Кнопка «Обновить до v7.1»</div>
            </div>
            <p className="text-xs text-slate-500">
              Одно нажатие кнопки запускает скачивание. На экране часов сразу начинает двигаться шкала процентов!
            </p>
          </div>

          {/* Method 2: Home Assistant */}
          <div className="bg-[#0e131a] p-5 rounded-2xl border border-slate-800 space-y-3 flex flex-col">
            <div className="w-10 h-10 rounded-xl bg-emerald-500/10 text-emerald-400 flex items-center justify-center">
              <RefreshCw className="w-5 h-5" />
            </div>
            <h3 className="text-base font-bold text-white">2. Home Assistant</h3>
            <p className="text-xs text-slate-400 leading-relaxed flex-1">
              Благодаря новой сущности <b className="text-white">update.esp32_matrix_firmware_update</b>:
            </p>
            <div className="bg-[#080b0f] p-3 rounded-lg border border-slate-800 text-xs space-y-1.5 font-mono">
              <div className="text-slate-300">Топик команды:</div>
              <div className="text-emerald-400 break-all">matrix/ota/update_cmd</div>
              <div className="text-slate-400">payload: INSTALL</div>
            </div>
            <p className="text-xs text-slate-500">
              Home Assistant пришлет push-уведомление на телефон при появлении нового релиза на GitHub.
            </p>
          </div>

          {/* Method 3: Automated cron */}
          <div className="bg-[#0e131a] p-5 rounded-2xl border border-slate-800 space-y-3 flex flex-col">
            <div className="w-10 h-10 rounded-xl bg-purple-500/10 text-purple-400 flex items-center justify-center">
              <Terminal className="w-5 h-5" />
            </div>
            <h3 className="text-base font-bold text-white">3. Фоновая автопроверка</h3>
            <p className="text-xs text-slate-400 leading-relaxed flex-1">
              В функции <code className="text-slate-300">loop()</code> каждые 60 минут вызывается фоновая проверка:
            </p>
            <div className="bg-[#080b0f] p-3 rounded-lg border border-slate-800 text-xs space-y-1.5 font-mono">
              <div className="text-purple-400">checkGithubReleases()</div>
              <div className="text-slate-500">// публикует статус в MQTT</div>
            </div>
            <p className="text-xs text-slate-500">
              Часы всегда знают самую актуальную версию и информируют систему умного дома.
            </p>
          </div>
        </div>
      )}

      {activeTab === 'code' && (
        <div className="bg-[#0e131a] rounded-2xl border border-slate-800 overflow-hidden space-y-0">
          <div className="p-4 bg-[#121822] border-b border-slate-800 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <FileCode className="w-4 h-4 text-emerald-400" />
              <span className="text-xs font-mono font-semibold text-white">
                include/GitHubOTA.h
              </span>
            </div>
            <button
              onClick={copyHeader}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-white bg-emerald-600 hover:bg-emerald-500 rounded-lg transition-colors cursor-pointer"
            >
              {copiedHeader ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
              <span>{copiedHeader ? 'Скопировано!' : 'Копировать C++ код'}</span>
            </button>
          </div>

          <pre className="p-5 text-xs font-mono text-slate-300 overflow-x-auto max-h-[500px] leading-relaxed bg-[#080b0f]">
            <code>{headerContent}</code>
          </pre>
        </div>
      )}
    </div>
  );
};
