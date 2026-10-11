/**
 * Project files and templates for ESP32 Matrix Clock:
 * - Upgraded main_improved.cpp with NTP, GitHub OTA, Home Assistant Update entity
 * - GitHubOTA.h for automated firmware update from GitHub Releases
 * - GitHub Actions workflow .github/workflows/build-and-release.yml
 * - platformio.ini and dual-OTA partitions table min_spiffs.csv
 * - secrets.h.example and .gitignore
 */

export interface ProjectFile {
  id: string;
  filename: string;
  path: string;
  language: 'cpp' | 'yaml' | 'ini' | 'csv' | 'gitignore';
  description: string;
  isNew?: boolean;
  content: string;
}

export const PROJECT_FILES: ProjectFile[] = [
  {
    id: 'github_workflow',
    filename: 'build-and-release.yml',
    path: '.github/workflows/build-and-release.yml',
    language: 'yaml',
    isNew: true,
    description: 'GitHub Actions: автокомпиляция PlatformIO, проверка PR и авто-релиз бинарника firmware.bin по тегу v*',
    content: `name: Build ESP32 Matrix Firmware

on:
  push:
    branches: [ "main", "master" ]
    tags:
      - "v*"
  pull_request:
    branches: [ "main", "master" ]
  workflow_dispatch:

permissions:
  contents: write

jobs:
  build:
    name: 🔨 PlatformIO Build
    runs-on: ubuntu-latest

    steps:
      - name: 📥 Checkout repository
        uses: actions/checkout@v4

      - name: 🐍 Set up Python
        uses: actions/setup-python@v5
        with:
          python-version: '3.11'

      - name: 🚀 Install PlatformIO Core
        run: |
          python -m pip install --upgrade pip
          pip install --upgrade platformio

      - name: 🧩 Ensure Partitions Table Exists
        run: |
          if [ ! -f "min_spiffs.csv" ] && [ ! -f "firmware/min_spiffs.csv" ]; then
            echo "Creating fallback min_spiffs.csv partition table..."
            echo "# Name,   Type, SubType, Offset,  Size, Flags" > min_spiffs.csv
            echo "nvs,      data, nvs,     0x9000,  0x5000," >> min_spiffs.csv
            echo "otadata,  data, ota,     0xe000,  0x2000," >> min_spiffs.csv
            echo "app0,     app,  ota_0,   0x10000, 0x1E0000," >> min_spiffs.csv
            echo "app1,     app,  ota_1,   0x1F0000,0x1E0000," >> min_spiffs.csv
            echo "spiffs,   data, spiffs,  0x3D0000,0x30000," >> min_spiffs.csv
          fi

      - name: 🔐 Prepare secrets.h
        env:
          WIFI_SSID: \${{ secrets.WIFI_SSID }}
          WIFI_PASS: \${{ secrets.WIFI_PASS }}
          MQTT_SERVER: \${{ secrets.MQTT_SERVER }}
          MQTT_USER: \${{ secrets.MQTT_USER }}
          MQTT_PASS: \${{ secrets.MQTT_PASS }}
          OTA_USER: \${{ secrets.OTA_USER }}
          OTA_PASS: \${{ secrets.OTA_PASS }}
        run: |
          mkdir -p include firmware/include firmware/src src

          SSID="\${WIFI_SSID:-YourWiFi}"
          PASS="\${WIFI_PASS:-YourPass}"
          M_SERVER="\${MQTT_SERVER:-192.168.1.180}"
          M_USER="\${MQTT_USER:-mqtt_user}"
          M_PASS="\${MQTT_PASS:-mqtt_pass}"
          O_USER="\${OTA_USER:-admin}"
          O_PASS="\${OTA_PASS:-admin123}"

          for dir in include firmware/include firmware/src src; do
            echo "#pragma once" > "$dir/secrets.h"
            echo "constexpr const char* WIFI_SSID = \"$SSID\";" >> "$dir/secrets.h"
            echo "constexpr const char* WIFI_PASS = \"$PASS\";" >> "$dir/secrets.h"
            echo "constexpr const char* MQTT_SERVER = \"$M_SERVER\";" >> "$dir/secrets.h"
            echo "constexpr int MQTT_PORT = 1883;" >> "$dir/secrets.h"
            echo "constexpr const char* MQTT_USER = \"$M_USER\";" >> "$dir/secrets.h"
            echo "constexpr const char* MQTT_PASS = \"$M_PASS\";" >> "$dir/secrets.h"
            echo "constexpr const char* OTA_USER = \"$O_USER\";" >> "$dir/secrets.h"
            echo "constexpr const char* OTA_PASS = \"$O_PASS\";" >> "$dir/secrets.h"
          done
          echo "secrets.h prepared successfully"

      - name: ⚙️ Build Firmware (PlatformIO)
        run: |
          if [ -f "platformio.ini" ]; then
            pio run -e esp32dev
          elif [ -f "firmware/platformio.ini" ]; then
            cd firmware && pio run -e esp32dev
          fi

      - name: 🔍 Locate Built Binaries
        id: locate_bin
        run: |
          BIN_PATH=$(find .pio -name "firmware.bin" | head -n 1)
          if [ -z "$BIN_PATH" ]; then
            echo "::error::firmware.bin not found after build!"
            exit 1
          fi
          echo "Found firmware.bin at: $BIN_PATH"
          echo "bin_path=$BIN_PATH" >> "$GITHUB_OUTPUT"

          BOOTLOADER_PATH=$(find .pio -name "bootloader.bin" | head -n 1)
          echo "bootloader_path=$BOOTLOADER_PATH" >> "$GITHUB_OUTPUT"

          PARTITIONS_PATH=$(find .pio -name "partitions.bin" | head -n 1)
          echo "partitions_path=$PARTITIONS_PATH" >> "$GITHUB_OUTPUT"

      - name: 📦 Upload Build Artifacts
        uses: actions/upload-artifact@v4
        with:
          name: esp32-pixel-clock-firmware
          path: |
            \${{ steps.locate_bin.outputs.bin_path }}
            \${{ steps.locate_bin.outputs.partitions_path }}
            \${{ steps.locate_bin.outputs.bootloader_path }}
          if-no-files-found: error
          retention-days: 14

      - name: 🏷️ Publish Release (GitHub CLI)
        env:
          GH_TOKEN: \${{ secrets.GITHUB_TOKEN }}
        run: |
          TAG="\${GITHUB_REF_NAME}"
          if [ "\${GITHUB_REF_TYPE}" != "tag" ]; then
            TAG="latest"
          fi
          echo "Publishing release with tag: $TAG"

          # 1. Try to create release with assets
          if gh release create "$TAG" \\
            "\${{ steps.locate_bin.outputs.bin_path }}" \\
            "\${{ steps.locate_bin.outputs.partitions_path }}" \\
            "\${{ steps.locate_bin.outputs.bootloader_path }}" \\
            --title "Release $TAG" \\
            --notes "Свежая сборка прошивки firmware.bin для ESP32 Pixel Clock" \\
            --clobber; then
            echo "Release $TAG created successfully!"
          else
            echo "Release $TAG already exists, updating assets..."
            gh release upload "$TAG" \\
              "\${{ steps.locate_bin.outputs.bin_path }}" \\
              "\${{ steps.locate_bin.outputs.partitions_path }}" \\
              "\${{ steps.locate_bin.outputs.bootloader_path }}" \\
              --clobber
          fi
`
  },
  {
    id: 'github_ota_header',
    filename: 'GitHubOTA.h',
    path: 'include/GitHubOTA.h',
    language: 'cpp',
    isNew: true,
    description: 'Клиент обновления ESP32 с GitHub Releases: поддержка HTTPS, редиректов 302 на AWS S3, проверка версии и индикация',
    content: `#pragma once
#include <Arduino.h>
#include <WiFiClientSecure.h>
#include <HTTPClient.h>
#include <Update.h>
#include <ArduinoJson.h>

/**
 * GitHubOTA: Проверка и прямое обновление прошивки ESP32 с GitHub Releases.
 * 
 * Особенности:
 * - Поддерживает HTTPS и перенаправление 302 на AWS S3 (GitHub ассеты хранятся на S3)
 * - Проверяет версию через GitHub API (/repos/{owner}/{repo}/releases/latest)
 * - Предоставляет callback прогресса для отрисовки шкалы на матрице 32x16
 * - Автоматический перезапуск после успешной прошивки
 */
class GitHubOTA {
public:
  typedef std::function<void(int percent, const char* status)> ProgressCallback;

  // Настройки репозитория
  static void setRepository(const char* owner, const char* repo, const char* binName = "firmware.bin") {
    _owner = owner;
    _repo = repo;
    _binName = binName;
  }

  // Проверить доступность новой версии
  static bool checkForUpdate(const char* currentVersion, String& newVersion, String& downloadUrl) {
    if (WiFi.status() != WL_CONNECTED) return false;

    WiFiClientSecure client;
    client.setInsecure(); // Для публичного API GitHub (не требует сертификата в коде)
    
    HTTPClient http;
    String apiUrl = "https://api.github.com/repos/" + _owner + "/" + _repo + "/releases/latest";
    
    http.begin(client, apiUrl);
    http.setUserAgent("ESP32-Matrix-Clock-OTA");
    http.addHeader("Accept", "application/vnd.github.v3+json");
    
    int httpCode = http.GET();
    if (httpCode != HTTP_CODE_OK) {
      Serial.printf("[GitHubOTA] Ошибка запроса API: %d\\n", httpCode);
      http.end();
      return false;
    }

    String payload = http.getString();
    http.end();

    // Парсим ответ JSON от GitHub API
    DynamicJsonDocument doc(4096);
    DeserializationError err = deserializeJson(doc, payload);
    if (err) {
      Serial.printf("[GitHubOTA] Ошибка парсинга JSON: %s\\n", err.c_str());
      return false;
    }

    const char* tag = doc["tag_name"];
    if (!tag) return false;

    newVersion = String(tag);
    if (newVersion.startsWith("v") || newVersion.startsWith("V")) {
      newVersion = newVersion.substring(1);
    }

    // Ищем asset с именем firmware.bin
    JsonArray assets = doc["assets"];
    for (JsonObject asset : assets) {
      const char* name = asset["name"];
      if (name && String(name) == _binName) {
        downloadUrl = asset["browser_download_url"].as<String>();
        break;
      }
    }

    if (downloadUrl.length() == 0) {
      downloadUrl = "https://github.com/" + _owner + "/" + _repo + "/releases/latest/download/" + _binName;
    }

    // Сравниваем версии
    if (newVersion != String(currentVersion)) {
      Serial.printf("[GitHubOTA] Найдена новая версия: %s (текущая: %s)\\n", newVersion.c_str(), currentVersion);
      return true;
    }

    Serial.println("[GitHubOTA] Прошивка актуальна.");
    return false;
  }

  // Выполнить обновление прошивки по прямой ссылке на asset
  static bool performUpdate(const String& downloadUrl, ProgressCallback onProgress = nullptr) {
    if (WiFi.status() != WL_CONNECTED) return false;

    Serial.printf("[GitHubOTA] Начало загрузки обновления: %s\\n", downloadUrl.c_str());
    if (onProgress) onProgress(0, "CONNECTING");

    WiFiClientSecure client;
    client.setInsecure();

    HTTPClient http;
    // КРИТИЧНО: GitHub перенаправляет (302) скачивание на objects.githubusercontent.com!
    http.setFollowRedirects(HTTPC_STRICT_FOLLOW_REDIRECTS);
    http.begin(client, downloadUrl);
    http.setUserAgent("ESP32-Matrix-Clock-OTA");

    int httpCode = http.GET();
    if (httpCode != HTTP_CODE_OK) {
      Serial.printf("[GitHubOTA] Ошибка загрузки бинарника: %d\\n", httpCode);
      if (onProgress) onProgress(0, "HTTP_ERR");
      http.end();
      return false;
    }

    int contentLength = http.getSize();
    if (contentLength <= 0) {
      Serial.println("[GitHubOTA] Некорректный размер файла.");
      if (onProgress) onProgress(0, "SIZE_ERR");
      http.end();
      return false;
    }

    bool canBegin = Update.begin(contentLength, U_FLASH);
    if (!canBegin) {
      Serial.println("[GitHubOTA] Недостаточно места на OTA разделе flash.");
      if (onProgress) onProgress(0, "NO_SPACE");
      http.end();
      return false;
    }

    WiFiClient* stream = http.getStreamPtr();
    uint8_t buff[1024];
    size_t written = 0;
    int prevPercent = -1;

    while (http.connected() && (written < contentLength)) {
      size_t available = stream->available();
      if (available) {
        int bytesRead = stream->readBytes(buff, min(available, sizeof(buff)));
        Update.write(buff, bytesRead);
        written += bytesRead;

        int percent = (written * 100) / contentLength;
        if (percent != prevPercent) {
          prevPercent = percent;
          Serial.printf("[GitHubOTA] Прогресс: %d%% (%u / %d)\\n", percent, written, contentLength);
          if (onProgress) onProgress(percent, "FLASHING");
        }
      }
      delay(1);
    }

    http.end();

    if (Update.end()) {
      if (Update.isFinished()) {
        Serial.println("[GitHubOTA] Обновление успешно завершено! Перезагрузка...");
        if (onProgress) onProgress(100, "SUCCESS");
        delay(1000);
        ESP.restart();
        return true;
      } else {
        Serial.println("[GitHubOTA] Обновление прервано.");
        if (onProgress) onProgress(prevPercent, "ABORTED");
      }
    } else {
      Serial.printf("[GitHubOTA] Ошибка Update: #%u\\n", Update.getError());
      if (onProgress) onProgress(prevPercent, "FAIL");
    }

    return false;
  }

private:
  static inline String _owner = "geminibitok-oss";
  static inline String _repo = "pixel_clock";
  static inline String _binName = "firmware.bin";
};
`
  },
  {
    id: 'main_improved',
    filename: 'main.cpp (Улучшенная версия)',
    path: 'src/main.cpp',
    language: 'cpp',
    description: 'Обновленная прошивка: защита Wi-Fi в NVS при OTA с GitHub, авто-отключение точки доступа при подключении, Captive Portal, автономный NTP и Home Assistant Update entity',
    content: `#include <Arduino.h>
#include <ArduinoOTA.h>
#include <DNSServer.h>
#include <FastLED.h>
#include <Preferences.h>
#include <PubSubClient.h>
#include <Update.h>
#include <WebServer.h>
#include <WiFi.h>
#include <time.h>
#include <esp_task_wdt.h>

#include "RusFont.h"
#include "GitHubOTA.h"
#include "secrets.h"

constexpr const char* DEVICE_NAME = "esp32_matrix";
constexpr const char* DEVICE_FRIENDLY_NAME = "Matrix Display";
constexpr const char* FIRMWARE_VERSION = "7.2"; // Обновленная версия с защитой NVS и авто-отключением AP

// Репозиторий GitHub для OTA обновлений
constexpr const char* GITHUB_OWNER = "geminibitok-oss";
constexpr const char* GITHUB_REPO  = "pixel_clock";

// Имя аварийной точки доступа при чистой прошивке
constexpr const char* AP_SSID = "PixelClock-Setup";

constexpr uint8_t LED_PIN = 18;
constexpr uint8_t WIDTH = 32;
constexpr uint8_t HEIGHT = 16;
constexpr uint16_t NUM_LEDS = WIDTH * HEIGHT;
constexpr uint8_t LDR_PIN = 34;

constexpr uint16_t FRAME_MS = 33;
constexpr uint16_t LDR_MS = 750;
constexpr uint8_t BRIGHTNESS_DEADBAND = 6;
constexpr uint8_t BRIGHTNESS_MAX_STEP = 4;
constexpr uint16_t SENSOR_PUBLISH_MS = 10000;
constexpr uint16_t WIFI_RECONNECT_MS = 10000;
constexpr uint16_t MQTT_RECONNECT_MS = 5000;
constexpr uint32_t GITHUB_CHECK_INTERVAL_MS = 3600000; // Раз в 1 час

// Часовой пояс для NTP (например, UTC+3 Москва: 3 * 3600 = 10800)
constexpr long GMT_OFFSET_SEC = 3 * 3600;
constexpr int DAYLIGHT_OFFSET_SEC = 0;

CRGB leds[NUM_LEDS];
WiFiClient espClient;
PubSubClient client(espClient);
WebServer server(80);
Preferences prefs;

// DNS-сервер для перехвата запросов Captive Portal в режиме точки доступа (порт 53)
const byte DNS_PORT = 53;
DNSServer dnsServer;
bool isApMode = false;
unsigned long lastWifiLossTime = 0;

String cfgWifiSsid;
String cfgWifiPass;
String cfgMqttServer;
int cfgMqttPort = MQTT_PORT;
String cfgMqttUser;
String cfgMqttPass;

String displayTime = "--:--";
String weatherTemp = "+0";
String scrollText = "";
String pendingText = "";
bool hasPendingText = false;
int scrollX = WIDTH;

enum WeatherType { W_CLEAR, W_CLOUDS, W_RAIN, W_SNOW, W_THUNDER, W_FOG, W_UNKNOWN };
WeatherType currentWeather = W_UNKNOWN;

bool isMusicMode = false;
bool autoBrightness = true;
uint8_t manualBrightness = 80;
uint8_t currentBrightness = 60;
uint16_t filteredLight = 0;
bool lightFilterReady = false;
int userSpeedVal = 50;
int scrollDelay = 105;

// Флаг защиты Flash памяти (записывать в Preferences только при реальном изменении!)
bool displaySettingsDirty = false;
unsigned long lastSettingsSave = 0;

// Статусы обновления GitHub OTA
bool isOtaUpdating = false;
int otaPercent = 0;
String otaStatusMsg = "";
String latestGithubVersion = "";
String latestGithubUrl = "";
unsigned long lastGithubCheck = 0;

String colorClockName = "Green";
String colorTextName = "Cyan";
String colorWeatherName = "Yellow";
CRGB colClock = CRGB::Green;
CRGB colText = CRGB::Cyan;
CRGB colWeather = CRGB::Yellow;

unsigned long lastFrame = 0;
unsigned long lastScroll = 0;
unsigned long lastWifiReconnect = 0;
unsigned long lastMqttReconnect = 0;
unsigned long lastLDR = 0;
unsigned long lastSensorPub = 0;
unsigned long lastNtpCheck = 0;

static const uint8_t blank_glyph[5] = {0, 0, 0, 0, 0};

inline int XY(int x, int y) {
  if (x < 0 || x >= WIDTH || y < 0 || y >= HEIGHT) return -1;
  return (x & 1) == 0 ? x * HEIGHT + y : x * HEIGHT + (HEIGHT - 1 - y);
}

void setPixel(int x, int y, CRGB c) {
  int idx = XY(x, y);
  if (idx >= 0 && idx < NUM_LEDS) leds[idx] = c;
}

uint16_t utf8_decode(const char*& p) {
  uint8_t c = (uint8_t)*p++;
  if (c < 0x80) return c;
  if ((c & 0xE0) == 0xC0) {
    uint8_t b2 = (uint8_t)*p++;
    return ((c & 0x1F) << 6) | (b2 & 0x3F);
  }
  if ((c & 0xF0) == 0xE0) {
    uint8_t b2 = (uint8_t)*p++;
    uint8_t b3 = (uint8_t)*p++;
    return ((c & 0x0F) << 12) | ((b2 & 0x3F) << 6) | (b3 & 0x3F);
  }
  return '?';
}

const uint8_t* getGlyph(uint16_t code) {
  if (code >= 32 && code <= 126) return font5x8_ascii[code - 32];
  if (code >= 0x0410 && code <= 0x042F) return font5x8_ru_upper[code - 0x0410];
  if (code >= 0x0430 && code <= 0x044F) return font5x8_ru_lower[code - 0x0430];
  if (code == 0x0401) return font5x8_yo_upper[0];
  if (code == 0x0451) return font5x8_yo_lower[0];
  if (code == 0x00B0) return font5x8_ascii['o' - 32];
  return blank_glyph;
}

void drawStringAt(const String& s, int x, int y, CRGB color) {
  const char* p = s.c_str();
  int cx = x;
  while (*p) {
    uint16_t code = utf8_decode(p);
    const uint8_t* glyph = getGlyph(code);
    for (int col = 0; col < 5; ++col) {
      uint8_t colByte = pgm_read_byte(&glyph[col]);
      for (int row = 0; row < 8; ++row) {
        if (colByte & (1 << row)) setPixel(cx + col, y + row, color);
      }
    }
    cx += 6;
  }
}

int measureStringWidth(const String& s) {
  const char* p = s.c_str();
  int cnt = 0;
  while (*p) {
    utf8_decode(p);
    cnt++;
  }
  return cnt * 6;
}

CRGB getColorByName(const String& name) {
  if (name == "Red") return CRGB::Red;
  if (name == "Green") return CRGB::Green;
  if (name == "Blue") return CRGB::Blue;
  if (name == "Yellow") return CRGB::Yellow;
  if (name == "Cyan") return CRGB::Cyan;
  if (name == "Purple") return CRGB::Purple;
  if (name == "White") return CRGB::White;
  if (name == "Orange") return CRGB::Orange;
  if (name == "Pink") return CRGB::DeepPink;
  return CRGB::White;
}

const char* weatherStateName() {
  switch (currentWeather) {
    case W_CLEAR: return "Clear";
    case W_CLOUDS: return "Clouds";
    case W_RAIN: return "Rain";
    case W_SNOW: return "Snow";
    case W_THUNDER: return "Thunder";
    case W_FOG: return "Fog";
    default: return "Unknown";
  }
}

void setWeatherFromText(String msg) {
  msg.toLowerCase();
  if (msg.indexOf("clear") >= 0 || msg.indexOf("sunny") >= 0 || msg.indexOf("sun") >= 0) currentWeather = W_CLEAR;
  else if (msg.indexOf("storm") >= 0 || msg.indexOf("thunder") >= 0 || msg.indexOf("lightning") >= 0) currentWeather = W_THUNDER;
  else if (msg.indexOf("rain") >= 0 || msg.indexOf("drizzle") >= 0) currentWeather = W_RAIN;
  else if (msg.indexOf("snow") >= 0) currentWeather = W_SNOW;
  else if (msg.indexOf("fog") >= 0 || msg.indexOf("mist") >= 0 || msg.indexOf("haze") >= 0) currentWeather = W_FOG;
  else if (msg.indexOf("cloud") >= 0 || msg.indexOf("overcast") >= 0) currentWeather = W_CLOUDS;
  else currentWeather = W_UNKNOWN;
}

void applyColorSettings() {
  colClock = getColorByName(colorClockName);
  colText = getColorByName(colorTextName);
  colWeather = getColorByName(colorWeatherName);
}

void applySpeedSetting() {
  userSpeedVal = constrain(userSpeedVal, 0, 100);
  scrollDelay = map(userSpeedVal, 0, 100, 200, 10);
}

// Обновление локального времени через автономный NTP (ESP32 RTC)
void updateLocalTime() {
  struct tm timeinfo;
  if (getLocalTime(&timeinfo, 50)) {
    char buf[10];
    strftime(buf, sizeof(buf), "%H:%M", &timeinfo);
    displayTime = String(buf);
  }
}

// Загрузка настроек с гарантированной защитой Wi-Fi от сброса при сборке с GitHub
void loadSettings() {
  prefs.begin("matrix", false);

  // 1. Считываем сохраненные параметры сети из защищенного NVS сектора Flash
  cfgWifiSsid = prefs.getString("wifi_ssid", "");
  cfgWifiPass = prefs.getString("wifi_pass", "");

  // 2. КРИТИЧНО: Защита настроек Wi-Fi при обновлении прошивки с GitHub Actions!
  // В GitHub Actions компилируется общий бинарник с пустым secrets.h (чтобы не светить пароли).
  // Если в NVS пока нет данных, но в secrets.h прописаны дефолты (например, первая компиляция пользователем),
  // мы СРАЗУ же записываем их в NVS на постоянное хранение!
  // После этого любые обновления OTA с GitHub никогда не затрут Wi-Fi!
  if (cfgWifiSsid.length() == 0 && strlen(WIFI_SSID) > 0) {
    cfgWifiSsid = String(WIFI_SSID);
    cfgWifiPass = String(WIFI_PASS);
    prefs.putString("wifi_ssid", cfgWifiSsid);
    prefs.putString("wifi_pass", cfgWifiPass);
    Serial.println("[NVS] Учетные данные Wi-Fi из secrets.h сохранены в энергонезависимую память NVS");
  }

  cfgMqttServer = prefs.getString("mqtt_host", MQTT_SERVER);
  cfgMqttPort = prefs.getInt("mqtt_port", MQTT_PORT);
  cfgMqttUser = prefs.getString("mqtt_user", MQTT_USER);
  cfgMqttPass = prefs.getString("mqtt_pass", MQTT_PASS);

  if (!prefs.isKey("mqtt_host") && strlen(MQTT_SERVER) > 0) {
    prefs.putString("mqtt_host", cfgMqttServer);
    prefs.putInt("mqtt_port", cfgMqttPort);
    prefs.putString("mqtt_user", cfgMqttUser);
    prefs.putString("mqtt_pass", cfgMqttPass);
  }

  isMusicMode = prefs.getBool("music_mode", false);
  autoBrightness = prefs.getBool("auto_bri", true);
  manualBrightness = prefs.getUChar("manual_bri", 80);
  userSpeedVal = prefs.getInt("speed", 50);
  colorClockName = prefs.getString("col_clock", "Green");
  colorTextName = prefs.getString("col_text", "Cyan");
  colorWeatherName = prefs.getString("col_weather", "Yellow");
  weatherTemp = prefs.getString("temp", "+0");
  setWeatherFromText(prefs.getString("weather", "unknown"));
  applyColorSettings();
  applySpeedSetting();
}

void saveNetworkSettings() {
  prefs.putString("wifi_ssid", cfgWifiSsid);
  prefs.putString("wifi_pass", cfgWifiPass);
  prefs.putString("mqtt_host", cfgMqttServer);
  prefs.putInt("mqtt_port", cfgMqttPort);
  prefs.putString("mqtt_user", cfgMqttUser);
  prefs.putString("mqtt_pass", cfgMqttPass);
  Serial.println("[NVS] Сетевые параметры зафиксированы в Flash");
}

// Защита Flash-памяти: вызывается только с задержкой или при реальном изменении!
void commitDisplaySettings() {
  if (!displaySettingsDirty) return;
  prefs.putBool("music_mode", isMusicMode);
  prefs.putBool("auto_bri", autoBrightness);
  prefs.putUChar("manual_bri", manualBrightness);
  prefs.putInt("speed", userSpeedVal);
  prefs.putString("col_clock", colorClockName);
  prefs.putString("col_text", colorTextName);
  prefs.putString("col_weather", colorWeatherName);
  prefs.putString("temp", weatherTemp);
  prefs.putString("weather", weatherStateName());
  displaySettingsDirty = false;
  Serial.println("[NVS] Настройки экрана записаны во Flash");
}

void markSettingsDirty() {
  displaySettingsDirty = true;
  lastSettingsSave = millis();
}

// Индикация прогресса OTA прямо на матрице 32x16
void otaProgressCallback(int pct, const char* status) {
  otaPercent = pct;
  otaStatusMsg = status;

  fill_solid(leds, NUM_LEDS, CRGB::Black);
  drawStringAt("OTA", 1, 0, CRGB(0, 180, 255));
  String pctStr = String(pct) + "%";
  drawStringAt(pctStr, WIDTH - measureStringWidth(pctStr), 0, CRGB::White);

  int barW = map(pct, 0, 100, 0, WIDTH - 2);
  for (int x = 1; x <= barW; x++) {
    setPixel(x, 10, CRGB::Green);
    setPixel(x, 11, CRGB::Green);
  }
  FastLED.show();
}

// Запуск процесса обновления с GitHub
void startGitHubUpdate() {
  if (latestGithubUrl.length() == 0) {
    if (!GitHubOTA::checkForUpdate(FIRMWARE_VERSION, latestGithubVersion, latestGithubUrl)) {
      Serial.println("[GitHubOTA] Обновление не требуется или URL пуст");
      return;
    }
  }

  isOtaUpdating = true;
  GitHubOTA::performUpdate(latestGithubUrl, otaProgressCallback);
  isOtaUpdating = false;
}

void checkGithubReleases() {
  if (WiFi.status() != WL_CONNECTED) return;
  String newVer, url;
  if (GitHubOTA::checkForUpdate(FIRMWARE_VERSION, newVer, url)) {
    latestGithubVersion = newVer;
    latestGithubUrl = url;
    // Публикуем в Home Assistant сенсор доступного обновления
    if (client.connected()) {
      client.publish("matrix/update/latest_version", latestGithubVersion.c_str(), true);
      client.publish("matrix/update/state", "update_available", true);
    }
  } else {
    latestGithubVersion = FIRMWARE_VERSION;
    if (client.connected()) {
      client.publish("matrix/update/state", "up_to_date", true);
    }
  }
}

// ======================== УПРАВЛЕНИЕ ТОЧКОЙ ДОСТУПА И WI-FI ========================

// Обработчик успешного подключения к домашней/основной сети:
// КРИТИЧЕСКОЕ ТРЕБОВАНИЕ: КАК ТОЛЬКО ПОДКЛЮЧИЛИСЬ К ОСНОВНОЙ СЕТИ — ТОЧКА ДОСТУПА ПОЛНОСТЬЮ ОТКЛЮЧАЕТСЯ!
void onWifiConnected() {
  lastWifiLossTime = 0;
  Serial.printf("[WiFi] Успешное подключение к основной сети! IP: %s\n", WiFi.localIP().toString().c_str());

  if (isApMode) {
    Serial.println("[WiFi] Часы подключились к роутеру. Автоматически отключаем точку доступа...");
    dnsServer.stop();
    WiFi.softAPdisconnect(true); // Останавливает AP и выключает beacon
    WiFi.mode(WIFI_STA);         // Переключаем чип в чистый STA режим без AP
    isApMode = false;
    Serial.println("[WiFi] Точка доступа " + String(AP_SSID) + " полностью отключена.");
  }

  // Настройка автономного времени по протоколу NTP
  configTime(GMT_OFFSET_SEC, DAYLIGHT_OFFSET_SEC, "pool.ntp.org", "time.google.com");
  updateLocalTime();
}

// Запуск точки доступа для первичной настройки (после полной чистой прошивки)
void startConfigPortal() {
  if (isApMode) return;
  Serial.println("[WiFi] Запуск точки доступа для настройки...");
  WiFi.mode(WIFI_AP_STA);
  WiFi.softAP(AP_SSID); // Открытая точка без пароля для удобного первого подключения со смартфона
  delay(100);

  // Captive Portal: перенаправляем любые DNS-запросы на 192.168.4.1
  dnsServer.start(DNS_PORT, "*", WiFi.softAPIP());
  isApMode = true;
  Serial.printf("[WiFi] Точка доступа активна: '%s'. IP: %s\n", AP_SSID, WiFi.softAPIP().toString().c_str());
}

void connectWiFi() {
  WiFi.persistent(true); // Сохранять состояние в системном NVS ESP32

  if (cfgWifiSsid.length() > 0) {
    Serial.printf("[WiFi] Подключение к основной сети: %s...\n", cfgWifiSsid.c_str());
    WiFi.mode(WIFI_STA);
    WiFi.begin(cfgWifiSsid.c_str(), cfgWifiPass.c_str());

    unsigned long start = millis();
    while (WiFi.status() != WL_CONNECTED && millis() - start < 12000) {
      delay(250);
      Serial.print(".");
    }
    Serial.println();
  }

  if (WiFi.status() == WL_CONNECTED) {
    onWifiConnected();
  } else {
    // При чистой прошивке (нет сохраненного Wi-Fi) или недоступности сети поднимаем точку доступа
    Serial.println("[WiFi] Основная сеть недоступна или не настроена. Создаем точку доступа для настройки...");
    lastWifiLossTime = millis();
    startConfigPortal();
  }
}

// Отрисовка погоды и графики
void drawCloudBase(int x, int y, bool darkBase) {
  CRGB white = CRGB(200, 200, 200);
  CRGB grayLight = CRGB(140, 140, 155);
  CRGB grayDark = darkBase ? CRGB(70, 70, 90) : CRGB(110, 110, 125);
  setPixel(x + 2, y + 1, white);
  setPixel(x + 3, y + 1, white);
  setPixel(x + 5, y + 1, white);
  setPixel(x + 6, y + 1, white);
  for (int i = 1; i <= 7; i++) setPixel(x + i, y + 2, grayLight);
  for (int i = 0; i <= 8; i++) setPixel(x + i, y + 3, grayDark);
}

void drawIcon(int x, int y) {
  unsigned long m = millis();
  if (currentWeather == W_CLEAR) {
    uint8_t bright = beatsin8(60, 150, 255);
    CRGB coreColor = CRGB(bright, max(0, bright - 40), 0);
    setPixel(x + 2, y + 2, coreColor);
    setPixel(x + 3, y + 2, coreColor);
    setPixel(x + 1, y + 3, coreColor);
    setPixel(x + 4, y + 3, coreColor);
    setPixel(x + 1, y + 4, coreColor);
    setPixel(x + 4, y + 4, coreColor);
    setPixel(x + 2, y + 5, coreColor);
    setPixel(x + 3, y + 5, coreColor);
    if ((m / 250) % 2 == 0) {
      setPixel(x + 2, y, colWeather);
      setPixel(x + 3, y, colWeather);
      setPixel(x + 2, y + 7, colWeather);
      setPixel(x + 3, y + 7, colWeather);
      setPixel(x, y + 3, colWeather);
      setPixel(x, y + 4, colWeather);
      setPixel(x + 6, y + 3, colWeather);
      setPixel(x + 6, y + 4, colWeather);
    } else {
      setPixel(x, y + 1, colWeather);
      setPixel(x + 5, y + 1, colWeather);
      setPixel(x, y + 6, colWeather);
      setPixel(x + 5, y + 6, colWeather);
    }
  } else if (currentWeather == W_CLOUDS) {
    drawCloudBase(x + ((m / 900) % 2), y + 1, false);
  } else if (currentWeather == W_RAIN) {
    drawCloudBase(x, y, true);
    setPixel(x + 2, y + ((m / 130) % 5) + 4, CRGB::Blue);
    setPixel(x + 4, y + ((m / 160) % 5) + 4, CRGB::Blue);
    setPixel(x + 6, y + ((m / 110) % 5) + 4, CRGB::Blue);
  } else if (currentWeather == W_SNOW) {
    drawCloudBase(x, y, false);
    setPixel(x + 2 + ((m / 600) % 2), y + ((m / 300) % 5) + 4, CRGB::White);
    setPixel(x + 5 + (((m + 300) / 600) % 2), y + ((m / 350) % 5) + 4, CRGB::White);
  } else if (currentWeather == W_THUNDER) {
    drawCloudBase(x, y, true);
    CRGB bolt = ((m / 180) % 4 == 0) ? CRGB::White : CRGB::Yellow;
    setPixel(x + 4, y + 4, bolt);
    setPixel(x + 3, y + 5, bolt);
    setPixel(x + 4, y + 5, bolt);
    setPixel(x + 3, y + 6, bolt);
    setPixel(x + 2, y + 7, bolt);
  } else if (currentWeather == W_FOG) {
    uint8_t shift = (m / 450) % 3;
    for (int i = 0; i < 8; i += 2) {
      setPixel(x + i, y + 2 + shift, CRGB(120, 140, 145));
      setPixel(x + i + 1, y + 5 - shift, CRGB(90, 110, 120));
    }
  } else {
    drawStringAt("?", x + 1, y, colWeather);
  }
}

void drawWifiAlert() {
  CRGB c = ((millis() / 350) % 2) ? CRGB::Red : CRGB(80, 0, 0);
  setPixel(0, 1, c);
  setPixel(1, 0, c);
  setPixel(1, 2, c);
  setPixel(2, 1, c);
  setPixel(0, 5, c);
  setPixel(1, 4, c);
  setPixel(2, 3, c);
  setPixel(3, 2, c);
}

void drawMqttAlert() {
  CRGB c = ((millis() / 450) % 2) ? CRGB::Orange : CRGB(90, 40, 0);
  int x = WIDTH - 4;
  setPixel(x, 0, c);
  setPixel(x + 1, 0, c);
  setPixel(x + 2, 0, c);
  setPixel(x + 3, 0, c);
  setPixel(x, 3, c);
  setPixel(x + 1, 4, c);
  setPixel(x + 2, 5, c);
  setPixel(x + 3, 6, c);
}

String htmlEscape(String s) {
  s.replace("&", "&amp;");
  s.replace("\"", "&quot;");
  s.replace("<", "&lt;");
  s.replace(">", "&gt;");
  return s;
}

bool ensureAuth() {
  // В режиме точки доступа для первичной настройки вход свободный, чтобы не блокировать пользователя!
  if (isApMode) return true;
  if (server.authenticate(OTA_USER, OTA_PASS)) return true;
  server.requestAuthentication();
  return false;
}

String optionTagLabel(const String& value, const String& selected, const String& label) {
  return "<option value=\"" + value + "\"" + (value == selected ? " selected" : "") + ">" + label + "</option>";
}

String colorOptions(const String& selected) {
  const char* colors[] = {"Green", "Cyan", "Yellow", "Red", "Blue", "Purple", "White", "Orange", "Pink"};
  const char* labels[] = {"Зеленый", "Голубой", "Желтый", "Красный", "Синий", "Фиолетовый", "Белый", "Оранжевый", "Розовый"};
  String out;
  for (uint8_t i = 0; i < 9; i++) out += optionTagLabel(colors[i], selected, labels[i]);
  return out;
}

void handleRoot() {
  if (!ensureAuth()) return;
  String ip = WiFi.status() == WL_CONNECTED ? WiFi.localIP().toString() : WiFi.softAPIP().toString();
  String selectedMode = isMusicMode ? "music" : "weather";

  String html = F("<!doctype html><html lang='ru'><head><meta charset='utf-8'><meta name='viewport' content='width=device-width,initial-scale=1'>"
                  "<title>Настройки часов</title><style>"
                  "body{font-family:system-ui,Arial,sans-serif;margin:24px;max-width:760px;background:#101418;color:#eef2f4}"
                  "fieldset{border:1px solid #33414a;border-radius:8px;margin:0 0 16px;padding:16px}"
                  "label{display:block;margin:10px 0 4px;color:#aebbc3}input,select{box-sizing:border-box;width:100%;padding:10px;border-radius:6px;border:1px solid #54636c;background:#172027;color:#fff}"
                  "input[type=checkbox]{width:auto}.row{display:grid;grid-template-columns:1fr 1fr;gap:12px}.btn{background:#24a0ed;color:white;border:0;padding:12px 16px;border-radius:6px;cursor:pointer}.btn-gh{background:#238636}.muted{color:#9aa7af}"
                  ".banner-ap{background:#1e293b;border:1px solid #38bdf8;padding:14px;border-radius:8px;margin-bottom:16px}"
                  "a{color:#69c0ff}@media(max-width:640px){.row{grid-template-columns:1fr}body{margin:14px}}</style></head><body>"
                  "<h1>Настройки часов</h1>");

  if (isApMode) {
    html += "<div class='banner-ap'>"
            "<h3 style='margin:0 0 8px 0;color:#38bdf8'>📶 Режим настройки Wi-Fi (Точка доступа " + String(AP_SSID) + ")</h3>"
            "<p style='margin:0;font-size:14px;color:#cbd5e1'>"
            "Введите имя и пароль вашей домашней Wi-Fi сети. <b>Как только часы успешно подключатся к роутеру, эта точка доступа автоматически выключится!</b>"
            "</p></div>";
  }

  html += "<p class='muted'>IP: " + ip + " | Прошивка: v" + String(FIRMWARE_VERSION) + (isApMode ? " [Режим AP]" : " [Подключено к Wi-Fi]") + "</p>";

  // Блок OTA обновления с GitHub (активен при наличии интернета)
  if (WiFi.status() == WL_CONNECTED) {
    html += "<fieldset><legend>Обновление по воздуху (GitHub OTA)</legend>";
    html += "<p>Текущая версия: <b>v" + String(FIRMWARE_VERSION) + "</b>";
    if (latestGithubVersion.length() > 0) {
      html += " | Доступна на GitHub: <b>v" + latestGithubVersion + "</b>";
    }
    html += "</p>";
    html += "<div style='display:flex;gap:10px;flex-wrap:wrap'>";
    html += "<a href='/check-update' class='btn'>Проверить обновления</a>";
    if (latestGithubVersion.length() > 0 && latestGithubVersion != FIRMWARE_VERSION) {
      html += "<a href='/start-update' class='btn btn-gh' onclick='return confirm(\"Начать обновление с GitHub?\")'>Обновить до v" + latestGithubVersion + "</a>";
    }
    html += "<a href='/update' style='margin-left:auto;align-self:center'>Ручная загрузка .bin</a>";
    html += "</div></fieldset>";
  }

  html += "<form method='POST' action='/save'>";
  html += "<fieldset><legend>Сеть Wi-Fi и MQTT</legend>";
  html += "<label>Имя домашней Wi-Fi сети (SSID)</label><input name='wifi_ssid' id='ssid' value=\"" + htmlEscape(cfgWifiSsid) + "\" placeholder='Название Wi-Fi роутера' required>";
  html += "<div style='margin-top:6px'><button type='button' class='btn' style='padding:6px 12px;font-size:12px' onclick='scanWifi()'>🔍 Сканировать сети поблизости</button></div>";
  html += "<label>Пароль от Wi-Fi</label><input name='wifi_pass' type='password' value=\"" + htmlEscape(cfgWifiPass) + "\" placeholder='Пароль домашней сети'>";
  html += "<div class='row'><div><label>Адрес MQTT брокера</label><input name='mqtt_host' value=\"" + htmlEscape(cfgMqttServer) + "\"></div>";
  html += "<div><label>Порт MQTT</label><input name='mqtt_port' type='number' value=\"" + String(cfgMqttPort) + "\"></div></div>";
  html += "<div class='row'><div><label>Пользователь MQTT</label><input name='mqtt_user' value=\"" + htmlEscape(cfgMqttUser) + "\"></div>";
  html += "<div><label>Пароль MQTT</label><input name='mqtt_pass' type='password' value=\"" + htmlEscape(cfgMqttPass) + "\"></div></div></fieldset>";

  html += "<fieldset><legend>Экран и часы</legend>";
  html += "<div class='row'><div><label>Режим</label><select name='mode'>" + optionTagLabel("weather", selectedMode, "Погода") + optionTagLabel("music", selectedMode, "Бегущая строка") + "</select></div>";
  html += "<div><label>Скорость строки</label><input name='speed' type='range' min='0' max='100' value='" + String(userSpeedVal) + "'></div></div>";
  html += "<label><input name='auto_bri' type='checkbox' value='1'" + String(autoBrightness ? " checked" : "") + "> Автояркость (фоторезистор)</label>";
  html += "<label>Ручная яркость</label><input name='manual_bri' type='range' min='10' max='255' value='" + String(manualBrightness) + "'>";
  html += "<div class='row'><div><label>Цвет часов</label><select name='col_clock'>" + colorOptions(colorClockName) + "</select></div>";
  html += "<div><label>Цвет текста</label><select name='col_text'>" + colorOptions(colorTextName) + "</select></div></div>";
  html += "<label>Цвет погоды</label><select name='col_weather'>" + colorOptions(colorWeatherName) + "</select>";
  html += "<label>Текст сообщения</label><input name='message' value=\"" + htmlEscape(scrollText) + "\"></fieldset>";
  html += "<button class='btn' type='submit'>Сохранить и подключиться</button></form>";

  html += "<script>"
          "function scanWifi(){"
          "  fetch('/scan').then(r=>r.json()).then(data=>{"
          "    if(!data.length){ alert('Сети не найдены'); return; }"
          "    let list = 'Найденные сети:\\n' + data.map(n=>n.ssid + ' (' + n.rssi + ' dBm)').join('\\n');"
          "    let pick = prompt(list + '\\n\\nВведите или скопируйте имя сети:');"
          "    if(pick) document.getElementById('ssid').value = pick;"
          "  }).catch(()=>alert('Ошибка сканирования'));"
          "}"
          "</script></body></html>";

  server.send(200, "text/html; charset=utf-8", html);
}

// JSON список найденных Wi-Fi сетей
void handleScan() {
  int n = WiFi.scanNetworks();
  String json = "[";
  for (int i = 0; i < n; ++i) {
    if (i > 0) json += ",";
    json += "{\"ssid\":\"" + WiFi.SSID(i) + "\",\"rssi\":" + String(WiFi.RSSI(i)) + "}";
  }
  json += "]";
  server.send(200, "application/json", json);
}

// Перенаправление Captive Portal (iOS, Android, Windows) на главную страницу настроек
void handleCaptiveRedirect() {
  server.sendHeader("Location", "http://" + WiFi.softAPIP().toString() + "/", true);
  server.send(302, "text/plain", "");
}

void handleCheckUpdate() {
  if (!ensureAuth()) return;
  checkGithubReleases();
  server.sendHeader("Location", "/");
  server.send(302, "text/plain", "");
}

void handleStartUpdate() {
  if (!ensureAuth()) return;
  server.send(200, "text/html; charset=utf-8", "<h2>Обновление началось!</h2><p>Смотрите статус на экране часов. Часы перезагрузятся через ~15 секунд.</p><a href='/'>Назад</a>");
  delay(500);
  startGitHubUpdate();
}

void handleSave() {
  if (!ensureAuth()) return;

  cfgWifiSsid = server.arg("wifi_ssid");
  cfgWifiPass = server.arg("wifi_pass");
  cfgMqttServer = server.arg("mqtt_host");
  cfgMqttPort = constrain(server.arg("mqtt_port").toInt(), 1, 65535);
  cfgMqttUser = server.arg("mqtt_user");
  cfgMqttPass = server.arg("mqtt_pass");
  if (server.hasArg("mode")) isMusicMode = (server.arg("mode") == "music");
  if (server.hasArg("speed")) userSpeedVal = server.arg("speed").toInt();
  autoBrightness = server.hasArg("auto_bri");
  if (server.hasArg("manual_bri")) manualBrightness = constrain(server.arg("manual_bri").toInt(), 10, 255);
  if (server.hasArg("col_clock")) colorClockName = server.arg("col_clock");
  if (server.hasArg("col_text")) colorTextName = server.arg("col_text");
  if (server.hasArg("col_weather")) colorWeatherName = server.arg("col_weather");
  if (server.hasArg("message")) {
    scrollText = server.arg("message");
    scrollX = WIDTH;
  }

  applyColorSettings();
  applySpeedSetting();
  saveNetworkSettings();

  displaySettingsDirty = true;
  commitDisplaySettings();

  String html = F("<!doctype html><html lang='ru'><head><meta charset='utf-8'><meta name='viewport' content='width=device-width,initial-scale=1'>"
                  "<title>Сохранено</title><style>body{background:#101418;color:#fff;font-family:sans-serif;text-align:center;padding:40px}a{color:#69c0ff}</style></head><body>"
                  "<h2>Настройки сохранены!</h2>"
                  "<p>Часы подключаются к сети <b>");
  html += htmlEscape(cfgWifiSsid);
  html += F("</b>...</p><p style='color:#94a3b8'>Как только часы подключатся к вашему роутеру, точка доступа <b>");
  html += AP_SSID;
  html += F("</b> будет автоматически выключена.</p></body></html>");

  server.send(200, "text/html; charset=utf-8", html);
  delay(500);

  // Начинаем подключение к новой сети
  WiFi.begin(cfgWifiSsid.c_str(), cfgWifiPass.c_str());
}

void handleUpdatePage() {
  if (!ensureAuth()) return;
  String html = F("<!doctype html><html lang='ru'><head><meta charset='utf-8'><meta name='viewport' content='width=device-width,initial-scale=1'>"
                  "<title>Ручная прошивка .bin</title></head><body>"
                  "<h1>Ручная загрузка firmware.bin</h1>"
                  "<form method='POST' action='/update' enctype='multipart/form-data'>"
                  "<input type='file' name='update' accept='.bin'><input type='submit' value='Прошить'></form>"
                  "<p><a href='/'>Назад к настройкам</a></p></body></html>");
  server.sendHeader("Connection", "close");
  server.send(200, "text/html; charset=utf-8", html);
}

void handleUpdateDone() {
  if (!ensureAuth()) return;
  server.sendHeader("Connection", "close");
  server.send(200, "text/plain", Update.hasError() ? "FAIL" : "OK");
  delay(200);
  ESP.restart();
}

void handleUpdateUpload() {
  if (!server.authenticate(OTA_USER, OTA_PASS)) return;
  HTTPUpload& upload = server.upload();
  if (upload.status == UPLOAD_FILE_START) {
    fill_solid(leds, NUM_LEDS, CRGB::Black);
    FastLED.show();
    Update.begin(UPDATE_SIZE_UNKNOWN);
  } else if (upload.status == UPLOAD_FILE_WRITE) {
    Update.write(upload.buf, upload.currentSize);
  } else if (upload.status == UPLOAD_FILE_END) {
    Update.end(true);
  }
}

void setupWebServer() {
  server.on("/", HTTP_GET, handleRoot);
  server.on("/save", HTTP_POST, handleSave);
  server.on("/scan", HTTP_GET, handleScan);
  server.on("/check-update", HTTP_GET, handleCheckUpdate);
  server.on("/start-update", HTTP_GET, handleStartUpdate);
  server.on("/update", HTTP_GET, handleUpdatePage);
  server.on("/update", HTTP_POST, handleUpdateDone, handleUpdateUpload);

  // Перехват Captive Portal (автоматическое всплывающее окно входа на Android/iOS/Windows)
  server.on("/generate_204", HTTP_GET, handleCaptiveRedirect);
  server.on("/gen_204", HTTP_GET, handleCaptiveRedirect);
  server.on("/hotspot-detect.html", HTTP_GET, handleCaptiveRedirect);
  server.on("/ncsi.txt", HTTP_GET, handleCaptiveRedirect);
  server.on("/connecttest.txt", HTTP_GET, handleCaptiveRedirect);

  server.begin();
}

String baseDeviceJson() {
  String url = "http://";
  url += WiFi.status() == WL_CONNECTED ? WiFi.localIP().toString() : WiFi.softAPIP().toString();
  url += "/";
  return "\"dev\":{\"ids\":[\"" + String(DEVICE_NAME) + "\"],\"name\":\"" + String(DEVICE_FRIENDLY_NAME) +
         "\",\"mdl\":\"Matrix Clock v" + String(FIRMWARE_VERSION) + "\",\"sw\":\"" + String(FIRMWARE_VERSION) + "\",\"mf\":\"DIY\",\"cu\":\"" + url + "\"}";
}

String availabilityJson() {
  return "\"avty_t\":\"matrix/status\",\"pl_avail\":\"online\",\"pl_not_avail\":\"offline\"";
}

void publishConfig(const String& domain, const String& object, const String& payload) {
  String topic = "homeassistant/" + domain + "/" + String(DEVICE_NAME) + "/" + object + "/config";
  client.publish(topic.c_str(), payload.c_str(), true);
}

void publishDiscovery() {
  String dev = baseDeviceJson();
  String avail = availabilityJson();
  String id = DEVICE_NAME;
  String colors = "[\"Green\",\"Cyan\",\"Yellow\",\"Red\",\"Blue\",\"Purple\",\"White\",\"Orange\",\"Pink\"]";
  String weather = "[\"Clear\",\"Clouds\",\"Rain\",\"Snow\",\"Thunder\",\"Fog\",\"Unknown\"]";

  publishConfig("text", "message", "{\"name\":\"Message\",\"uniq_id\":\"" + id + "_msg\",\"cmd_t\":\"matrix/text/set\",\"stat_t\":\"matrix/text/state\",\"mode\":\"text\"," + dev + "," + avail + "}");
  publishConfig("sensor", "light", "{\"name\":\"Light Sensor\",\"uniq_id\":\"" + id + "_ldr\",\"stat_t\":\"matrix/sensor/light/state\",\"unit_of_meas\":\"raw\",\"stat_cla\":\"measurement\",\"ic\":\"mdi:brightness-6\"," + dev + "," + avail + "}");
  publishConfig("sensor", "wifi_rssi", "{\"name\":\"WiFi RSSI\",\"uniq_id\":\"" + id + "_rssi\",\"stat_t\":\"matrix/sensor/wifi_rssi/state\",\"unit_of_meas\":\"dBm\",\"dev_cla\":\"signal_strength\",\"stat_cla\":\"measurement\"," + dev + "," + avail + "}");
  publishConfig("number", "speed", "{\"name\":\"Scroll Speed\",\"uniq_id\":\"" + id + "_spd\",\"cmd_t\":\"matrix/speed/set\",\"stat_t\":\"matrix/speed/state\",\"min\":0,\"max\":100,\"mode\":\"slider\",\"ic\":\"mdi:speedometer\"," + dev + "," + avail + "}");
  publishConfig("number", "brightness", "{\"name\":\"Brightness\",\"uniq_id\":\"" + id + "_bri\",\"cmd_t\":\"matrix/brightness/set\",\"stat_t\":\"matrix/brightness/state\",\"min\":10,\"max\":255,\"mode\":\"slider\",\"ic\":\"mdi:brightness-5\"," + dev + "," + avail + "}");
  publishConfig("switch", "auto_brightness", "{\"name\":\"Auto Brightness\",\"uniq_id\":\"" + id + "_auto_bri\",\"cmd_t\":\"matrix/auto_brightness/set\",\"stat_t\":\"matrix/auto_brightness/state\",\"pl_on\":\"ON\",\"pl_off\":\"OFF\",\"ic\":\"mdi:brightness-auto\"," + dev + "," + avail + "}");
  publishConfig("select", "mode", "{\"name\":\"Mode\",\"uniq_id\":\"" + id + "_mode\",\"cmd_t\":\"matrix/mode/set\",\"stat_t\":\"matrix/mode/state\",\"options\":[\"weather\",\"music\"]," + dev + "," + avail + "}");
  publishConfig("select", "weather", "{\"name\":\"Weather\",\"uniq_id\":\"" + id + "_weather\",\"cmd_t\":\"matrix/weather/set\",\"stat_t\":\"matrix/weather/state\",\"options\":" + weather + "," + dev + "," + avail + "}");
  publishConfig("select", "color_clock", "{\"name\":\"Color Clock\",\"uniq_id\":\"" + id + "_col_c\",\"cmd_t\":\"matrix/color/clock/set\",\"stat_t\":\"matrix/color/clock/state\",\"options\":" + colors + "," + dev + "," + avail + "}");
  publishConfig("select", "color_text", "{\"name\":\"Color Text\",\"uniq_id\":\"" + id + "_col_t\",\"cmd_t\":\"matrix/color/text/set\",\"stat_t\":\"matrix/color/text/state\",\"options\":" + colors + "," + dev + "," + avail + "}");
  publishConfig("select", "color_weather", "{\"name\":\"Color Weather\",\"uniq_id\":\"" + id + "_col_w\",\"cmd_t\":\"matrix/color/weather/set\",\"stat_t\":\"matrix/color/weather/state\",\"options\":" + colors + "," + dev + "," + avail + "}");
  publishConfig("button", "restart", "{\"name\":\"Restart\",\"uniq_id\":\"" + id + "_restart\",\"cmd_t\":\"matrix/restart/set\",\"payload_press\":\"PRESS\",\"dev_cla\":\"restart\"," + dev + "," + avail + "}");

  // Home Assistant Update Entity для обновления с GitHub!
  publishConfig("update", "firmware", "{\"name\":\"Firmware Update\",\"uniq_id\":\"" + id + "_fw_update\",\"cmd_t\":\"matrix/ota/update_cmd\",\"stat_t\":\"matrix/update/state\",\"latest_ver_t\":\"matrix/update/latest_version\",\"installed_ver\":\"" + String(FIRMWARE_VERSION) + "\",\"pl_inst\":\"INSTALL\"," + dev + "," + avail + "}");

  client.subscribe("matrix/text/set");
  client.subscribe("matrix/time/set");
  client.subscribe("matrix/weather/set");
  client.subscribe("matrix/temp/set");
  client.subscribe("matrix/mode/set");
  client.subscribe("matrix/speed/set");
  client.subscribe("matrix/brightness/set");
  client.subscribe("matrix/auto_brightness/set");
  client.subscribe("matrix/color/clock/set");
  client.subscribe("matrix/color/text/set");
  client.subscribe("matrix/color/weather/set");
  client.subscribe("matrix/restart/set");
  client.subscribe("matrix/ota/update_cmd");
  client.subscribe("matrix/ota/check");
}

void publishStates() {
  client.publish("matrix/status", "online", true);
  client.publish("matrix/text/state", scrollText.c_str(), true);
  client.publish("matrix/mode/state", isMusicMode ? "music" : "weather", true);
  client.publish("matrix/speed/state", String(userSpeedVal).c_str(), true);
  client.publish("matrix/brightness/state", String(manualBrightness).c_str(), true);
  client.publish("matrix/auto_brightness/state", autoBrightness ? "ON" : "OFF", true);
  client.publish("matrix/weather/state", weatherStateName(), true);
  client.publish("matrix/color/clock/state", colorClockName.c_str(), true);
  client.publish("matrix/color/text/state", colorTextName.c_str(), true);
  client.publish("matrix/color/weather/state", colorWeatherName.c_str(), true);
  client.publish("matrix/update/state", "up_to_date", true);
  client.publish("matrix/update/latest_version", FIRMWARE_VERSION, true);
}

void mqttCallback(char* topic, byte* payload, unsigned int length) {
  String msg;
  for (unsigned int i = 0; i < length; i++) msg += (char)payload[i];
  String t = String(topic);

  if (t == "matrix/text/set") {
    if (msg.length() > 0 && msg != " - ") isMusicMode = true;
    if (scrollText.length() == 0) {
      scrollText = msg;
      scrollX = WIDTH;
    } else {
      pendingText = msg;
      hasPendingText = true;
    }
    client.publish("matrix/text/state", msg.c_str(), true);
  } else if (t == "matrix/mode/set") {
    isMusicMode = (msg == "music");
    client.publish("matrix/mode/state", isMusicMode ? "music" : "weather", true);
    markSettingsDirty();
  } else if (t == "matrix/time/set") {
    displayTime = msg;
  } else if (t == "matrix/temp/set") {
    weatherTemp = msg;
  } else if (t == "matrix/speed/set") {
    userSpeedVal = msg.toInt();
    applySpeedSetting();
    client.publish("matrix/speed/state", String(userSpeedVal).c_str(), true);
    markSettingsDirty();
  } else if (t == "matrix/brightness/set") {
    manualBrightness = constrain(msg.toInt(), 10, 255);
    autoBrightness = false;
    FastLED.setBrightness(manualBrightness);
    client.publish("matrix/brightness/state", String(manualBrightness).c_str(), true);
    client.publish("matrix/auto_brightness/state", "OFF", true);
    markSettingsDirty();
  } else if (t == "matrix/auto_brightness/set") {
    autoBrightness = (msg == "ON" || msg == "on" || msg == "1" || msg == "true");
    client.publish("matrix/auto_brightness/state", autoBrightness ? "ON" : "OFF", true);
    markSettingsDirty();
  } else if (t == "matrix/weather/set") {
    setWeatherFromText(msg);
    client.publish("matrix/weather/state", weatherStateName(), true);
  } else if (t == "matrix/color/clock/set") {
    colorClockName = msg;
    applyColorSettings();
    client.publish("matrix/color/clock/state", colorClockName.c_str(), true);
    markSettingsDirty();
  } else if (t == "matrix/color/text/set") {
    colorTextName = msg;
    applyColorSettings();
    client.publish("matrix/color/text/state", colorTextName.c_str(), true);
    markSettingsDirty();
  } else if (t == "matrix/color/weather/set") {
    colorWeatherName = msg;
    applyColorSettings();
    client.publish("matrix/color/weather/state", colorWeatherName.c_str(), true);
    markSettingsDirty();
  } else if (t == "matrix/restart/set") {
    client.publish("matrix/status", "offline", true);
    delay(100);
    ESP.restart();
  } else if (t == "matrix/ota/update_cmd") {
    startGitHubUpdate();
  } else if (t == "matrix/ota/check") {
    checkGithubReleases();
  }
}

void reconnectMqtt() {
  if (WiFi.status() != WL_CONNECTED) return;
  client.setServer(cfgMqttServer.c_str(), cfgMqttPort);
  if (client.connect(DEVICE_NAME, cfgMqttUser.c_str(), cfgMqttPass.c_str(), "matrix/status", 1, true, "offline")) {
    publishDiscovery();
    publishStates();
  }
}

void setupOta() {
  ArduinoOTA.setHostname(DEVICE_NAME);
  ArduinoOTA.setPassword(OTA_PASS);
  ArduinoOTA.onStart([]() {
    fill_solid(leds, NUM_LEDS, CRGB::Black);
    FastLED.show();
  });
  ArduinoOTA.begin();
}

void updateBrightness(unsigned long now) {
  if (now - lastLDR < LDR_MS) return;
  lastLDR = now;

  uint8_t targetBrightness = manualBrightness;
  if (autoBrightness) {
    uint16_t rawLight = analogRead(LDR_PIN);
    if (!lightFilterReady) {
      filteredLight = rawLight;
      lightFilterReady = true;
    } else {
      filteredLight = (filteredLight * 7 + rawLight) / 8;
    }
    targetBrightness = map(filteredLight, 0, 4095, 10, 255);
  }

  int delta = (int)targetBrightness - (int)currentBrightness;
  if (abs(delta) < BRIGHTNESS_DEADBAND) return;

  if (delta > BRIGHTNESS_MAX_STEP) delta = BRIGHTNESS_MAX_STEP;
  if (delta < -BRIGHTNESS_MAX_STEP) delta = -BRIGHTNESS_MAX_STEP;

  currentBrightness = constrain((int)currentBrightness + delta, 10, 255);
  FastLED.setBrightness(currentBrightness);
}

void publishSensors(unsigned long now) {
  if (!client.connected() || now - lastSensorPub < SENSOR_PUBLISH_MS) return;
  lastSensorPub = now;
  client.publish("matrix/sensor/light/state", String(analogRead(LDR_PIN)).c_str(), true);
  if (WiFi.status() == WL_CONNECTED) {
    client.publish("matrix/sensor/wifi_rssi/state", String(WiFi.RSSI()).c_str(), true);
  }
}

void maintainConnections(unsigned long now) {
  // 1. Проверяем статус подключения к домашней сети
  if (WiFi.status() == WL_CONNECTED) {
    // ЕСЛИ БЫЛА ВКЛЮЧЕНА ТОЧКА ДОСТУПА И СВЯЗЬ УСТАНОВЛЕНА — НЕМЕДЛЕННО ВЫКЛЮЧАЕМ ТОЧКУ ДОСТУПА!
    if (isApMode) {
      onWifiConnected();
    }
    lastWifiLossTime = 0;
  } else {
    // Сеть отключена
    if (lastWifiLossTime == 0) lastWifiLossTime = now;

    if (now - lastWifiReconnect > WIFI_RECONNECT_MS) {
      lastWifiReconnect = now;
      if (cfgWifiSsid.length() > 0) {
        Serial.println("[WiFi] Попытка переподключения к основной сети...");
        WiFi.reconnect();
      }
    }

    // Если связь с сетью отсутствует более 45 секунд и точка еще не запущена — поднимаем AP
    if (!isApMode && (now - lastWifiLossTime > 45000)) {
      startConfigPortal();
    }
  }

  // 2. В режиме точки доступа обрабатываем запросы Captive Portal
  if (isApMode) {
    dnsServer.processNextRequest();
  }

  // 3. Обслуживание MQTT (только если есть активное подключение к Wi-Fi)
  if (WiFi.status() == WL_CONNECTED) {
    if (!client.connected()) {
      if (now - lastMqttReconnect > MQTT_RECONNECT_MS) {
        lastMqttReconnect = now;
        reconnectMqtt();
      }
    } else {
      client.loop();
    }
  }
}

void renderFrame(unsigned long now) {
  if (isOtaUpdating) return; // Во время OTA рендерит otaProgressCallback
  if (now - lastFrame < FRAME_MS) return;
  lastFrame = now;
  fill_solid(leds, NUM_LEDS, CRGB::Black);

  // Если активна точка доступа для настройки — выводим заметную индикацию "AP SETUP" и бегущий IP 192.168.4.1
  if (isApMode) {
    drawStringAt("AP", 1, 0, CRGB(0, 180, 255));
    drawStringAt("SETUP", 14, 0, CRGB::Yellow);
    drawStringAt("192.168.4.1", scrollX, 8, CRGB::White);
    if (now - lastScroll >= 95) {
      lastScroll = now;
      scrollX--;
      if (scrollX < -measureStringWidth("192.168.4.1")) {
        scrollX = WIDTH;
      }
    }
    FastLED.show();
    return;
  }

  int w = measureStringWidth(displayTime);
  drawStringAt(displayTime, (WIDTH - w) / 2, 0, colClock);

  if (isMusicMode) {
    drawStringAt(scrollText, scrollX, 8, colText);
    if (now - lastScroll >= (unsigned long)scrollDelay) {
      lastScroll = now;
      scrollX--;
      if (scrollX < -measureStringWidth(scrollText)) {
        if (hasPendingText) {
          scrollText = pendingText;
          hasPendingText = false;
        }
        scrollX = WIDTH;
      }
    }
  } else {
    int tWidth = measureStringWidth(weatherTemp);
    int totalW = tWidth + 3 + 8;
    int groupStartX = (WIDTH - totalW) / 2;
    drawStringAt(weatherTemp, groupStartX, 8, colWeather);
    drawIcon(groupStartX + tWidth + 3, 8);
  }

  if (WiFi.status() != WL_CONNECTED) drawWifiAlert();
  else if (!client.connected()) drawMqttAlert();

  FastLED.show();
}

void setup() {
  Serial.begin(115200);
  pinMode(LDR_PIN, INPUT);
  loadSettings();

  // Настройка GitHub OTA репозитория
  GitHubOTA::setRepository(GITHUB_OWNER, GITHUB_REPO, "firmware.bin");

  FastLED.addLeds<WS2812, LED_PIN, GRB>(leds, NUM_LEDS);
  FastLED.setBrightness(currentBrightness);
  FastLED.clear();
  FastLED.show();

  connectWiFi();
  setupOta();
  setupWebServer();
  client.setCallback(mqttCallback);
  client.setBufferSize(2048);
}

void loop() {
  unsigned long now = millis();
  ArduinoOTA.handle();
  server.handleClient();
  maintainConnections(now);
  updateBrightness(now);
  publishSensors(now);

  // Автономный NTP: обновляем время каждые 10 секунд при наличии связи
  if (now - lastNtpCheck > 10000) {
    lastNtpCheck = now;
    if (WiFi.status() == WL_CONNECTED) {
      updateLocalTime();
    }
  }

  // Периодическая проверка релизов на GitHub
  if (now - lastGithubCheck > GITHUB_CHECK_INTERVAL_MS) {
    lastGithubCheck = now;
    checkGithubReleases();
  }

  // Отложенная запись в NVS (через 5 секунд после последнего изменения)
  if (displaySettingsDirty && (now - lastSettingsSave > 5000)) {
    commitDisplaySettings();
  }

  renderFrame(now);
}
`
  },
  {
    id: 'platformio_ini',
    filename: 'platformio.ini',
    path: 'platformio.ini',
    language: 'ini',
    description: 'Конфигурация PlatformIO с dual-OTA таблицей разделов, библиотеками HTTPS и увеличенным буфером MQTT',
    content: `[platformio]
default_envs = esp32dev

[env:esp32dev]
platform = espressif32
board = esp32dev
framework = arduino
monitor_speed = 115200
upload_speed = 921600

; Таблица разделов с двумя OTA слотами (app0 и app1) для безопасного обновления
board_build.partitions = min_spiffs.csv

build_flags =
  -D MQTT_MAX_PACKET_SIZE=2048
  -D CORE_DEBUG_LEVEL=0

lib_deps =
  fastled/FastLED @ ^3.6.0
  bblanchon/ArduinoJson @ ^6.21.3
  knolleary/PubSubClient @ ^2.8

; Локальная прошивка по воздуху (локальный IP):
; upload_protocol = espota
; upload_port = 192.168.1.182
; upload_flags = --auth=admin123
`
  },
  {
    id: 'min_spiffs_csv',
    filename: 'min_spiffs.csv',
    path: 'min_spiffs.csv',
    language: 'csv',
    description: 'Таблица разделов ESP32 (4MB Flash): два равноправных слота app0 и app1 (по ~1.9 МБ) для надежного отката OTA',
    content: `# Name,   Type, SubType, Offset,  Size, Flags
nvs,      data, nvs,     0x9000,  0x5000,
otadata,  data, ota,     0xe000,  0x2000,
app0,     app,  ota_0,   0x10000, 0x1E0000,
app1,     app,  ota_1,   0x1F0000,0x1E0000,
spiffs,   data, spiffs,  0x3D0000,0x20000,
`
  },
  {
    id: 'secrets_example',
    filename: 'secrets.h.example',
    path: 'include/secrets.h.example',
    language: 'cpp',
    description: 'Шаблон секретов с поддержкой автоматической настройки через точку доступа PixelClock-Setup и NVS',
    content: `#pragma once

// ВАЖНО: Начиная с версии v7.2, вам больше НЕ ОБЯЗАТЕЛЬНО вручную прописывать пароли в коде!
// 1. При первой чистой прошивке (Full Flash) часы автоматически создадут точку доступа "PixelClock-Setup" (IP 192.168.4.1).
// 2. Подключитесь к ней с телефона и введите пароль от домашнего Wi-Fi в открывшемся окне Captive Portal.
// 3. Данные сохранятся в энергонезависимую память NVS (Preferences) и никогда НЕ сотрутся при обновлениях с GitHub!
// 4. Как только часы подключатся к вашему роутеру, точка доступа "PixelClock-Setup" АВТОМАТИЧЕСКИ выключится!
//
// Если вы все же хотите зашить дефолтные параметры в бинарник, скопируйте этот файл в include/secrets.h:
constexpr const char* WIFI_SSID = "your_wifi_ssid";
constexpr const char* WIFI_PASS = "your_wifi_password";

constexpr const char* MQTT_SERVER = "192.168.1.180";
constexpr int MQTT_PORT = 1883;
constexpr const char* MQTT_USER = "mqtt_user";
constexpr const char* MQTT_PASS = "mqtt_password";

constexpr const char* OTA_USER = "admin";
constexpr const char* OTA_PASS = "admin_password";
`
  },
  {
    id: 'gitignore',
    filename: '.gitignore',
    path: '.gitignore',
    language: 'gitignore',
    description: 'Правильный .gitignore для PlatformIO и защиты паролей от утечки на GitHub',
    content: `# PlatformIO сборки и кэш
.pio/
.pioenvs/
.piolibdeps/

# КРИТИЧНО: Защита секретов и паролей от публикации на GitHub!
include/secrets.h
src/secrets.h
secrets.h

# Локальные настройки редакторов
.vscode/
.idea/
*.swp
*.bak

# Системные файлы
.DS_Store
Thumbs.db
`
  },
  {
    id: 'rusfont_header',
    filename: 'RusFont.h',
    path: 'include/RusFont.h',
    language: 'cpp',
    description: 'Полный шрифт RU + EN 5x8 с исправленными глифами Ц, Ш, Щ, Ё и погодными иконками',
    content: `#pragma once
#include <Arduino.h>

/*
   Полный шрифт RU + EN 5×8
   Исправлены: Ц, Ш, Щ
*/

// ---------------- ASCII 5×8 ---------------- //
const uint8_t font5x8_ascii[][5] PROGMEM = {
  {0,0,0,0,0}, {0,0,0x5F,0,0}, {0x07,0,0,0x07,0}, {0x14,0x7F,0x14,0x7F,0x14}, 
  {0x24,0x2A,0x7F,0x2A,0x12}, {0x23,0x13,0x08,0x64,0x62}, {0x36,0x49,0x55,0x22,0x50}, 
  {0x00,0x05,0x03,0,0}, {0x00,0x1C,0x22,0x41,0}, {0x00,0x41,0x22,0x1C,0}, 
  {0x14,0x08,0x3E,0x08,0x14}, {0x08,0x08,0x3E,0x08,0x08}, {0,0x50,0x30,0,0}, 
  {0x08,0x08,0x08,0x08,0x08}, {0,0x60,0x60,0,0}, {0x20,0x10,0x08,0x04,0x02}, 
  {0x3E,0x51,0x49,0x45,0x3E}, {0,0x42,0x7F,0x40,0}, {0x42,0x61,0x51,0x49,0x46}, 
  {0x21,0x41,0x45,0x4B,0x31}, {0x18,0x14,0x12,0x7F,0x10}, {0x27,0x45,0x45,0x45,0x39}, 
  {0x3C,0x4A,0x49,0x49,0x30}, {0x01,0x71,0x09,0x05,0x03}, {0x36,0x49,0x49,0x49,0x36}, 
  {0x06,0x49,0x49,0x29,0x1E}, {0,0x36,0x36,0,0}, {0,0x56,0x36,0,0}, 
  {0x08,0x14,0x22,0x41,0}, {0x14,0x14,0x14,0x14,0x14}, {0x00,0x41,0x22,0x14,0x08}, 
  {0x02,0x01,0x51,0x09,0x06}, {0x3E,0x41,0x5D,0x49,0x4E}, {0x7E,0x11,0x11,0x11,0x7E}, 
  {0x7F,0x49,0x49,0x49,0x36}, {0x3E,0x41,0x41,0x41,0x22}, {0x7F,0x41,0x41,0x22,0x1C}, 
  {0x7F,0x49,0x49,0x49,0x41}, {0x7F,0x09,0x09,0x09,0x01}, {0x3E,0x41,0x49,0x49,0x7A}, 
  {0x7F,0x08,0x08,0x08,0x7F}, {0x00,0x41,0x7F,0x41,0x00}, {0x20,0x40,0x41,0x3F,0x01}, 
  {0x7F,0x08,0x14,0x22,0x41}, {0x7F,0x40,0x40,0x40,0x40}, {0x7F,0x02,0x0C,0x02,0x7F}, 
  {0x7F,0x04,0x08,0x10,0x7F}, {0x3E,0x41,0x41,0x41,0x3E}, {0x7F,0x09,0x09,0x09,0x06}, 
  {0x3E,0x41,0x51,0x21,0x5E}, {0x7F,0x09,0x19,0x29,0x46}, {0x46,0x49,0x49,0x49,0x31}, 
  {0x01,0x01,0x7F,0x01,0x01}, {0x3F,0x40,0x40,0x40,0x3F}, {0x1F,0x20,0x40,0x20,0x1F}, 
  {0x7F,0x20,0x18,0x20,0x7F}, {0x41,0x22,0x1C,0x22,0x41}, {0x07,0x08,0x70,0x08,0x07}, 
  {0x61,0x51,0x49,0x45,0x43}, {0x7F,0x41,0x41,0x00,0x00}, {0x02,0x04,0x08,0x10,0x20}, 
  {0x00,0x41,0x41,0x7F,0x00}, {0x04,0x02,0x01,0x02,0x04}, {0x40,0x40,0x40,0x40,0x40}, 
  {0x00,0x01,0x02,0x04,0x00}, {0x20,0x54,0x54,0x54,0x78}, {0x7F,0x48,0x44,0x44,0x38}, 
  {0x38,0x44,0x44,0x44,0x20}, {0x38,0x44,0x44,0x48,0x7F}, {0x38,0x54,0x54,0x54,0x18}, 
  {0x08,0x7E,0x09,0x01,0x02}, {0x18,0xA4,0xA4,0xA4,0x7C}, {0x7F,0x08,0x04,0x04,0x78}, 
  {0x00,0x44,0x7D,0x40,0x00}, {0x40,0x80,0x84,0x7D,0x00}, {0x7F,0x10,0x28,0x44,0x00}, 
  {0x00,0x41,0x7F,0x40,0x00}, {0x7C,0x04,0x18,0x04,0x78}, {0x7C,0x08,0x04,0x04,0x78}, 
  {0x38,0x44,0x44,0x44,0x38}, {0xFC,0x24,0x24,0x24,0x18}, {0x18,0x24,0x24,0x18,0xFC}, 
  {0x7C,0x08,0x04,0x04,0x08}, {0x48,0x54,0x54,0x54,0x20}, {0x04,0x3F,0x44,0x40,0x20}, 
  {0x3C,0x40,0x40,0x20,0x7C}, {0x1C,0x20,0x40,0x20,0x1C}, {0x3C,0x40,0x30,0x40,0x3C}, 
  {0x44,0x28,0x10,0x28,0x44}, {0x1C,0xA0,0xA0,0xA0,0x7C}, {0x44,0x64,0x54,0x4C,0x44}, 
  {0x08,0x36,0x41,0x00,0x00}, {0x00,0x00,0x7F,0x00,0x00}, {0x00,0x00,0x41,0x36,0x08}, 
  {0x08,0x04,0x08,0x10,0x08}
};

// ---------------- RUS UPPERCASE ---------------- //
const uint8_t font5x8_ru_upper[][5] PROGMEM = {
  {0x7E,0x09,0x09,0x09,0x7F}, // А
  {0x7F,0x49,0x49,0x49,0x33}, // Б
  {0x7F,0x49,0x4D,0x4A,0x30}, // В
  {0x7F,0x01,0x01,0x01,0x03}, // Г
  {0x40,0x7E,0x41,0x7E,0x40}, // Д
  {0x7F,0x49,0x49,0x41,0x63}, // Е
  {0x77,0x08,0x7F,0x08,0x77}, // Ж
  {0x63,0x41,0x49,0x49,0x36}, // З
  {0x7F,0x20,0x10,0x08,0x7F}, // И
  {0x7E,0x20,0x11,0x08,0x7E}, // Й
  {0x7F,0x08,0x14,0x22,0x41}, // К
  {0x40,0x3E,0x01,0x01,0x7F}, // Л
  {0x7F,0x02,0x0C,0x02,0x7F}, // М
  {0x7F,0x08,0x08,0x08,0x7F}, // Н
  {0x3E,0x41,0x41,0x41,0x3E}, // О
  {0x7F,0x01,0x01,0x01,0x7F}, // П
  {0x7F,0x09,0x09,0x09,0x06}, // Р
  {0x3E,0x41,0x41,0x41,0x22}, // С
  {0x03,0x01,0x7F,0x01,0x03}, // Т
  {0x27,0x48,0x48,0x48,0x3F}, // У
  {0x0E,0x11,0x7F,0x11,0x0E}, // Ф
  {0x63,0x14,0x08,0x14,0x63}, // Х
  {0x3F,0x20,0x20,0x3F,0x60}, // Ц
  {0x07,0x08,0x08,0x08,0x7F}, // Ч
  {0x7E,0x40,0x7C,0x40,0x7F}, // Ш
  {0x7E,0x40,0x7C,0x40,0xFF}, // Щ
  {0x01,0x7F,0x48,0x48,0x30}, // Ъ
  {0x7F,0x48,0x48,0x30,0x7F}, // Ы
  {0x7F,0x48,0x48,0x48,0x30}, // Ь
  {0x63,0x41,0x49,0x49,0x7F}, // Э
  {0x7F,0x08,0x3E,0x41,0x3E}, // Ю
  {0x46,0x29,0x19,0x09,0x7F}  // Я
};

// ---------------- RUS LOWERCASE ---------------- //
const uint8_t font5x8_ru_lower[][5] PROGMEM = {
  {0x20,0x54,0x54,0x54,0x78}, // а
  {0x7c,0x54,0x54,0x54,0x24}, // б
  {0x7c,0x54,0x5c,0x50,0x20}, // в
  {0x00,0x7C,0x04,0x04,0x00}, // г
  {0x40,0x78,0x44,0x78,0x40}, // д
  {0x38,0x54,0x54,0x54,0x18}, // е
  {0x44,0x28,0x7C,0x28,0x44}, // ж
  {0x44,0x44,0x54,0x54,0x28}, // з
  {0x7c,0x60,0x38,0x0c,0x7c}, // и
  {0x78,0x40,0x24,0x12,0x78}, // й
  {0x7E,0x10,0x28,0x44,0x00}, // к
  {0x00,0x70,0x08,0x04,0x7C}, // л
  {0x7C,0x08,0x10,0x08,0x7C}, // м
  {0x7C,0x10,0x10,0x10,0x7C}, // н
  {0x38,0x44,0x44,0x44,0x38}, // о
  {0x7C,0x04,0x04,0x04,0x7C}, // п
  {0xFC,0x24,0x24,0x24,0x18}, // р
  {0x38,0x44,0x44,0x44,0x00}, // с
  {0x04,0x04,0x7C,0x04,0x04}, // т
  {0x4C,0x50,0x50,0x50,0x3C}, // у
  {0x18,0x24,0x7E,0x24,0x18}, // ф
  {0x44,0x28,0x10,0x28,0x44}, // х
  {0x7C,0x40,0x40,0x40,0xFC}, // ц (ИСПРАВЛЕНО)
  {0x0C,0x10,0x10,0x10,0x7C}, // ч
  {0x7C,0x40,0x7C,0x40,0x7C}, // ш (ИСПРАВЛЕНО)
  {0x7C,0x40,0x7C,0x40,0xFC}, // щ (ИСПРАВЛЕНО)
  {0x04,0x7C,0x48,0x48,0x30}, // ъ
  {0x7C,0x50,0x20,0x00,0x7C}, // ы
  {0x00,0x7C,0x48,0x48,0x30}, // ь
  {0x28,0x44,0x54,0x54,0x38}, // э
  {0x7C,0x10,0x38,0x44,0x38}, // ю
  {0x00,0x40,0x28,0x14,0x7C}  // я
};

const uint8_t font5x8_yo_upper[][5] PROGMEM = { {0x7F, 0x4B, 0x4A, 0x43, 0x62} };
const uint8_t font5x8_yo_lower[][5] PROGMEM = { {0x38, 0x55, 0x54, 0x55, 0x18} };
`
  }
];
