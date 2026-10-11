import React, { useState } from 'react';
import { 
  ShieldAlert, Clock, Database, RefreshCw, 
  Home, Cpu, AlertTriangle, CheckCircle2, ChevronRight, Copy, Check, Wifi
} from 'lucide-react';

export const ImprovementAudit: React.FC = () => {
  const [selectedAuditIndex, setSelectedAuditIndex] = useState(0);
  const [copiedId, setCopiedId] = useState<string | null>(null);

  const copyToClipboard = (text: string, id: string) => {
    navigator.clipboard.writeText(text);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  const auditItems = [
    {
      id: 'secrets',
      title: 'Критическая утечка секретов в Git',
      priority: 'CRITICAL',
      icon: <ShieldAlert className="w-5 h-5 text-rose-400" />,
      tag: 'Безопасность',
      summary: 'В коде присутствуют реальные пароли Wi-Fi и MQTT. При пуше на GitHub их перехватят боты.',
      problem: `В файле secrets.h указаны реальные учетные данные домашней сети (SSID "yura", пароль, MQTT брокер 192.168.1.180). Если закоммитить этот файл в публичный репозиторий GitHub, боты за считанные секунды сохранят ваши пароли. Даже удаление файла новым коммитом оставляет пароли в истории git!`,
      solution: `1. Удалите secrets.h из отслеживания Git: git rm --cached secrets.h
2. Добавьте secrets.h в файл .gitignore.
3. Оставьте в репозитории только шаблон secrets.h.example с фиктивными данными.
4. Для автоматической сборки в GitHub Actions используйте зашифрованные секреты (GitHub Repository Secrets) или генерируйте временный файл перед компиляцией.`,
      codeBefore: `// secrets.h (ОПАСНО: реальные данные в репозитории!)
constexpr const char* WIFI_SSID = "yura";
constexpr const char* WIFI_PASS = "32543254";
constexpr const char* MQTT_SERVER = "192.168.1.180";
constexpr const char* MQTT_PASS = "my3254";`,
      codeAfter: `// .gitignore (ДОБАВИТЬ СРОЧНО):
secrets.h
include/secrets.h
src/secrets.h
.pio/

// В репозитории хранить ТОЛЬКО secrets.h.example:
constexpr const char* WIFI_SSID = "your_wifi_ssid";
constexpr const char* WIFI_PASS = "your_wifi_password";`,
    },
    {
      id: 'ntp',
      title: 'Автономный NTP вместо ожидания топика MQTT',
      priority: 'HIGH',
      icon: <Clock className="w-5 h-5 text-amber-400" />,
      tag: 'Надежность',
      summary: 'Часы показывают "--:--", если Home Assistant или брокер MQTT отключен.',
      problem: `Сейчас время на экране displayTime зависит исключительно от внешнего MQTT-сообщения в топик "matrix/time/set". Если брокер MQTT упадет, перезагрузится или отвалится сеть, часы зависают с прочерками "--:--" или старым временем. При этом ESP32 имеет встроенный аппаратный RTC и официальный сетевой стек SNTP!`,
      solution: `В функции connectWiFi() сразу после подключения к роутеру вызываем встроенную функцию Arduino/ESP-IDF:
configTime(GMT_OFFSET_SEC, 0, "pool.ntp.org", "time.google.com");
В loop() каждые 10 секунд вызываем getLocalTime(&timeinfo), форматируя часы в "%H:%M". Теперь часы абсолютно автономны и идут с точностью до секунды даже без Home Assistant!`,
      codeBefore: `// Старый подход: зависимость от внешнего брокера
void mqttCallback(...) {
  if (t == "matrix/time/set") {
    displayTime = msg; // Если брокер упал, время не идет!
  }
}`,
      codeAfter: `// Новый подход: встроенный SNTP клиент ESP32
#include <time.h>
constexpr long GMT_OFFSET = 3 * 3600; // Москва UTC+3

void connectWiFi() {
  // ... подключение к WiFi ...
  configTime(GMT_OFFSET, 0, "pool.ntp.org", "time.google.com");
}

void updateLocalTime() {
  struct tm timeinfo;
  if (getLocalTime(&timeinfo, 50)) {
    char buf[10];
    strftime(buf, sizeof(buf), "%H:%M", &timeinfo);
    displayTime = String(buf);
  }
}`,
    },
    {
      id: 'nvs_flash',
      title: 'Защита Flash-памяти от износа (NVS Wear-out)',
      priority: 'HIGH',
      icon: <Database className="w-5 h-5 text-amber-400" />,
      tag: 'Аппаратная надежность',
      summary: 'Вызов saveDisplaySettings() на каждое MQTT сообщение убивает ресурс Flash за месяцы.',
      problem: `В конце функции mqttCallback() в старом коде ВСЕГДА вызывается saveDisplaySettings(). Если Home Assistant каждые 5-10 секунд публикует показания погоды, трек плеера или сенсоры, ESP32 непрерывно перезаписывает сектор Flash-памяти в Preferences (NVS). Ресурс перезаписи NOR-Flash составляет около 100 000 циклов — через 3-6 месяцев память выйдет из строя!`,
      solution: `1. Температуру и текущий трек не нужно сохранять в постоянную память NVS: при перезагрузке они сразу обновятся по MQTT.
2. Для настроек (цвет, скорость, режим) внедряется флаг displaySettingsDirty и отложенная запись (debounce): сохранять только если прошло 5 секунд после последнего изменения и пользователь не меняет параметры дальше.
3. Прямая запись сразу выполняется только при сохранении формы в Web-интерфейсе.`,
      codeBefore: `void mqttCallback(...) {
  // ... обработка топиков ...
  saveDisplaySettings(); // ❌ ОШИБКА: пишется в Flash при ЛЮБОМ входящем сообщении!
}`,
      codeAfter: `bool displaySettingsDirty = false;
unsigned long lastSettingsChange = 0;

void markSettingsDirty() {
  displaySettingsDirty = true;
  lastSettingsChange = millis();
}

void loop() {
  // ✅ Запись только через 5 секунд после последнего изменения
  if (displaySettingsDirty && (millis() - lastSettingsChange > 5000)) {
    commitDisplaySettings();
    displaySettingsDirty = false;
  }
}`,
    },
    {
      id: 'github_ota',
      title: 'Прямое обновление прошивки с GitHub Releases',
      priority: 'FEATURE',
      icon: <RefreshCw className="w-5 h-5 text-cyan-400" />,
      tag: 'Автоматизация',
      summary: 'Часы сами проверяют наличие свежего релиза на GitHub и обновляются в один клик.',
      problem: `В оригинале для обновления нужно либо находиться в одной локальной сети и запускать espota через PlatformIO, либо открывать браузер, заходить на IP часов и вручную заливать скомпилированный firmware.bin.`,
      solution: `Модуль GitHubOTA:
1. ESP32 делает HTTPS-запрос к GitHub REST API (/repos/owner/repo/releases/latest).
2. Сравнивает версию тега с константой FIRMWARE_VERSION.
3. Скачивает firmware.bin (обрабатывая HTTPS redirect 302 на Amazon S3!).
4. Во время скачивания на матрице 32x16 отображается процент и шкала "OTA 65%".
5. Запуск обновления доступен как из Web-интерфейса часов, так и через MQTT топик matrix/ota/update_cmd.`,
      codeBefore: `// В старом коде: только ручная загрузка файла
server.on("/update", HTTP_POST, handleUpdateDone, handleUpdateUpload);`,
      codeAfter: `// В новом коде: автоматическая проверка и загрузка с GitHub
#include "GitHubOTA.h"

// В Web UI добавляются кнопки:
// - "Проверить обновления на GitHub"
// - "Обновить до v7.1"
GitHubOTA::performUpdate(downloadUrl, [](int pct, const char* st) {
  otaProgressCallback(pct, st); // Отрисовка шкалы на матрице!
});`,
    },
    {
      id: 'ha_update_entity',
      title: 'Сущность Update Entity в Home Assistant',
      priority: 'FEATURE',
      icon: <Home className="w-5 h-5 text-emerald-400" />,
      tag: 'Умный дом',
      summary: 'Home Assistant сам уведомит о выходе обновления и покажет кнопку "Установить".',
      problem: `В оригинальной MQTT Discovery регистрировались только text, sensor, number, select, switch и button. Home Assistant поддерживает официальный домен update, созданный специально для обновления прошивок умных устройств.`,
      solution: `Регистрируем сущность update в MQTT Auto-Discovery:
- topic: homeassistant/update/esp32_matrix/firmware/config
- Home Assistant автоматически проверяет текущую версию vs последнюю и выводит карточку устройства с кнопкой "Обновить прошивку".`,
      codeBefore: `// В старом коде была только кнопка перезагрузки:
publishConfig("button", "restart", "{...}");`,
      codeAfter: `// Добавляем официальную сущность обновления Home Assistant:
publishConfig("update", "firmware", 
  "{\"name\":\"Firmware Update\","
  "\"uniq_id\":\"" + id + "_fw_update\","
  "\"cmd_t\":\"matrix/ota/update_cmd\","
  "\"stat_t\":\"matrix/update/state\","
  "\"latest_ver_t\":\"matrix/update/latest_version\","
  "\"installed_ver\":\"" + String(FIRMWARE_VERSION) + "\","
  "\"pl_inst\":\"INSTALL\"," + dev + "," + avail + "}");`,
    },
    {
      id: 'freertos_blocking',
      title: 'Устранение блокирующих вызовов в цикле loop',
      priority: 'MEDIUM',
      icon: <Cpu className="w-5 h-5 text-blue-400" />,
      tag: 'Производительность',
      summary: 'При отвале Wi-Fi функция connectWiFi() блокирует loop на 15-20 секунд.',
      problem: `В connectWiFi() есть цикл while(...) delay(250) до 20 секунд. Если роутер перезагружается, анимация матрицы полностью застывает, бегущая строка останавливается, а веб-сервер не отвечает.`,
      solution: `1. Уменьшить таймаут попытки подключения до неблокирующего переподключения.
2. Использовать неблокирующий статус WiFi.status() == WL_CONNECTED.
3. Для максимальной плавности FastLED матрицу можно вынести в отдельный поток FreeRTOS на ядро Core 1, а весь сетевой стек оставить на ядре Core 0 (в ESP32 два ядра!).`,
      codeBefore: `void connectWiFi() {
  WiFi.begin(...);
  while (WiFi.status() != WL_CONNECTED && millis() - start < 20000) {
    delay(250); // ❌ Полная блокировка экрана на 20 сек!
  }
}`,
      codeAfter: `// Неблокирующее обслуживание соединений в loop()
void maintainConnections(unsigned long now) {
  if (WiFi.status() != WL_CONNECTED && now - lastWifiReconnect > 10000) {
    lastWifiReconnect = now;
    WiFi.reconnect(); // Асинхронная попытка без блокирующего while
  }
}`,
    },
    {
      id: 'dual_ota_partitions',
      title: 'Таблица разделов с безопасным откатом (Dual OTA)',
      priority: 'MEDIUM',
      icon: <AlertTriangle className="w-5 h-5 text-indigo-400" />,
      tag: 'Безопасность прошивки',
      summary: 'Разделы app0 и app1 защищают от превращения часов в «кирпич» при сбое питания.',
      problem: `Если во время OTA-обновления моргнет свет или пропадет Wi-Fi, устройство с одним разделом прошивки зависнет в полустертом состоянии и не сможет загрузиться. Придется подключать USB-кабель и прошивать вручную через COM-порт.`,
      solution: `Файл min_spiffs.csv настраивает два равных раздела app0 и app1 по 1.95 МБ каждый:
- Прошивка загружается во второй слот.
- Флаг загрузки otadata переключается только после успешного завершения записи и верификации контрольной суммы.
- Если новая прошивка повреждена, загрузчик bootloader вернется на рабочий раздел!`,
      codeBefore: `; Стандартная таблица без явной гарантии двух слотов
board_build.partitions = min_spiffs.csv`,
      codeAfter: `# min_spiffs.csv (гарантированные два слота OTA по 1.9 МБ)
nvs,      data, nvs,     0x9000,  0x5000,
otadata,  data, ota,     0xe000,  0x2000,
app0,     app,  ota_0,   0x10000, 0x1E0000,
app1,     app,  ota_1,   0x1F0000,0x1E0000,
spiffs,   data, spiffs,  0x3D0000,0x20000,`,
    },
    {
      id: 'wifi_ap_auto_off',
      title: 'Сохранение Wi-Fi при OTA и точка доступа с авто-отключением',
      priority: 'HIGH',
      icon: <Wifi className="w-5 h-5 text-emerald-400" />,
      tag: 'Wi-Fi & Сеть',
      summary: 'При обновлении с GitHub Wi-Fi не стирается, а при чистой прошивке AP отключается сразу после подключения к роутеру.',
      problem: `1. При сборке на GitHub Actions secrets.h генерируется без паролей (пустой). Если Wi-Fi не был зафиксирован в NVS Flash, часы после OTA с GitHub теряли связь.
2. При полной чистой прошивке (USB / esptool / чистый Flash) пользователь не имеет способа легко настроить Wi-Fi без перекомпиляции кода.
3. В старом коде точка доступа после запуска продолжала висеть в эфире и не отключалась даже после успешного подключения к домашнему роутеру, создавая помехи и уязвимость.`,
      solution: `1. Настройки Wi-Fi навсегда сохраняются в энергонезависимую память NVS (Preferences). При обновлении с GitHub OTA перезаписывается только раздел app, а сектор NVS остается нетронутым!
2. При чистой прошивке или недоступности сети ESP32 поднимает точку доступа PixelClock-Setup (192.168.4.1) с Captive Portal и встроенным сканером окружающих сетей.
3. Как только часы успешно подключаются к домашней сети — функция onWifiConnected() НЕМЕДЛЕННО выключает точку доступа (WiFi.softAPdisconnect(true); WiFi.mode(WIFI_STA);), освобождая радиоканал!`,
      codeBefore: `// Старый подход:
void connectWiFi() {
  if (WiFi.status() != WL_CONNECTED) {
    WiFi.softAP("MatrixSetup", OTA_PASS); // Точка висит бесконечно!
  }
}`,
      codeAfter: `// Новый подход:
void onWifiConnected() {
  if (isApMode) {
    dnsServer.stop();
    WiFi.softAPdisconnect(true); // ✅ Точка доступа выключается сразу!
    WiFi.mode(WIFI_STA);        // ✅ Только чистый клиент домашней сети
    isApMode = false;
  }
  configTime(...); // Запуск NTP
}`,
    },
  ];

  const currentItem = auditItems[selectedAuditIndex];

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="pb-4 border-b border-slate-800">
        <h1 className="text-xl font-bold tracking-tight text-white">
          Архитектурный аудит проекта часов
        </h1>
        <p className="text-sm text-slate-400 mt-1">
          7 конкретных улучшений для надежности, защиты памяти ESP32, безопасности учетных данных и поддержки автообновлений.
        </p>
      </div>

      {/* Main Grid: Selector Column + Detail Card */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left column: List of audit items */}
        <div className="lg:col-span-5 space-y-2">
          {auditItems.map((item, idx) => {
            const isSelected = selectedAuditIndex === idx;
            return (
              <button
                key={item.id}
                onClick={() => setSelectedAuditIndex(idx)}
                className={`w-full text-left p-3.5 rounded-xl border transition-all cursor-pointer flex items-start gap-3.5 ${
                  isSelected
                    ? 'bg-[#121822] border-emerald-500/60 shadow-md ring-1 ring-emerald-500/20'
                    : 'bg-[#0e131a] border-slate-800 hover:bg-[#121720] hover:border-slate-700'
                }`}
              >
                <div className="p-2 rounded-lg bg-slate-800/80 shrink-0 mt-0.5">
                  {item.icon}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between gap-2 mb-1">
                    <span className="text-xs font-semibold text-white truncate">
                      {item.title}
                    </span>
                    <span
                      className={`text-[10px] font-mono uppercase px-1.5 py-0.5 rounded ${
                        item.priority === 'CRITICAL'
                          ? 'bg-rose-950/80 text-rose-300 border border-rose-800'
                          : item.priority === 'HIGH'
                          ? 'bg-amber-950/80 text-amber-300 border border-amber-800'
                          : 'bg-emerald-950/80 text-emerald-300 border border-emerald-800'
                      }`}
                    >
                      {item.priority}
                    </span>
                  </div>
                  <p className="text-xs text-slate-400 line-clamp-2">
                    {item.summary}
                  </p>
                </div>
                <ChevronRight className={`w-4 h-4 shrink-0 text-slate-500 self-center transition-transform ${isSelected ? 'text-emerald-400 translate-x-0.5' : ''}`} />
              </button>
            );
          })}
        </div>

        {/* Right column: Deep dive of selected issue */}
        <div className="lg:col-span-7 bg-[#0e131a] p-6 rounded-2xl border border-slate-800 space-y-6">
          <div className="flex items-start justify-between gap-4 pb-4 border-b border-slate-800">
            <div className="flex items-center gap-3">
              <div className="p-2.5 rounded-xl bg-slate-800/90">
                {currentItem.icon}
              </div>
              <div>
                <span className="text-xs font-medium text-emerald-400">
                  {currentItem.tag}
                </span>
                <h2 className="text-lg font-bold text-white tracking-tight">
                  {currentItem.title}
                </h2>
              </div>
            </div>

            <span
              className={`text-xs font-mono font-semibold px-2 py-1 rounded ${
                currentItem.priority === 'CRITICAL'
                  ? 'bg-rose-950 text-rose-300 border border-rose-800'
                  : currentItem.priority === 'HIGH'
                  ? 'bg-amber-950 text-amber-300 border border-amber-800'
                  : 'bg-emerald-950 text-emerald-300 border border-emerald-800'
              }`}
            >
              {currentItem.priority}
            </span>
          </div>

          {/* Problem section */}
          <div className="space-y-2">
            <h3 className="text-xs font-semibold text-rose-400 flex items-center gap-1.5 uppercase tracking-wider">
              <AlertTriangle className="w-3.5 h-3.5" />
              <span>В чем проблема в текущем коде</span>
            </h3>
            <p className="text-sm text-slate-300 leading-relaxed bg-[#0a0d13] p-3.5 rounded-lg border border-slate-800/80">
              {currentItem.problem}
            </p>
          </div>

          {/* Solution section */}
          <div className="space-y-2">
            <h3 className="text-xs font-semibold text-emerald-400 flex items-center gap-1.5 uppercase tracking-wider">
              <CheckCircle2 className="w-3.5 h-3.5" />
              <span>Решение и архитектурный фикс</span>
            </h3>
            <p className="text-sm text-slate-300 leading-relaxed bg-[#0a0d13] p-3.5 rounded-lg border border-slate-800/80 whitespace-pre-line">
              {currentItem.solution}
            </p>
          </div>

          {/* Code comparison */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-2">
            {/* Before */}
            <div className="space-y-1.5">
              <div className="text-xs font-medium text-slate-400 flex items-center justify-between">
                <span className="text-rose-400 font-semibold">Было в проекте:</span>
                <button
                  onClick={() => copyToClipboard(currentItem.codeBefore, `${currentItem.id}_before`)}
                  className="p-1 hover:text-white transition-colors cursor-pointer"
                  title="Копировать"
                >
                  {copiedId === `${currentItem.id}_before` ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                </button>
              </div>
              <pre className="p-3 bg-[#080b0f] rounded-lg border border-red-950/60 text-xs font-mono text-slate-300 overflow-x-auto max-h-48 leading-relaxed">
                <code>{currentItem.codeBefore}</code>
              </pre>
            </div>

            {/* After */}
            <div className="space-y-1.5">
              <div className="text-xs font-medium text-slate-400 flex items-center justify-between">
                <span className="text-emerald-400 font-semibold">Стало в новой версии:</span>
                <button
                  onClick={() => copyToClipboard(currentItem.codeAfter, `${currentItem.id}_after`)}
                  className="p-1 hover:text-white transition-colors cursor-pointer"
                  title="Копировать"
                >
                  {copiedId === `${currentItem.id}_after` ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                </button>
              </div>
              <pre className="p-3 bg-[#080b0f] rounded-lg border border-emerald-950/60 text-xs font-mono text-emerald-300/90 overflow-x-auto max-h-48 leading-relaxed">
                <code>{currentItem.codeAfter}</code>
              </pre>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
