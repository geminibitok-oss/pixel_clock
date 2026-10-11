#include <Arduino.h>
#include <ArduinoOTA.h>
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
constexpr const char* DEVICE_FRIENDLY_NAME = "Pixel Clock";
constexpr const char* FIRMWARE_VERSION = "7.1";

// Репозиторий GitHub для OTA обновлений
constexpr const char* GITHUB_OWNER = "geminibitok-oss";
constexpr const char* GITHUB_REPO  = "pixel_clock";

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

constexpr long GMT_OFFSET_SEC = 3 * 3600; // UTC+3
constexpr int DAYLIGHT_OFFSET_SEC = 0;

CRGB leds[NUM_LEDS];
WiFiClient espClient;
PubSubClient client(espClient);
WebServer server(80);
Preferences prefs;

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

bool displaySettingsDirty = false;
unsigned long lastSettingsSave = 0;

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

void updateLocalTime() {
  struct tm timeinfo;
  if (getLocalTime(&timeinfo, 50)) {
    char buf[10];
    strftime(buf, sizeof(buf), "%H:%M", &timeinfo);
    displayTime = String(buf);
  }
}

void loadSettings() {
  prefs.begin("matrix", false);
  cfgWifiSsid = prefs.getString("wifi_ssid", WIFI_SSID);
  cfgWifiPass = prefs.getString("wifi_pass", WIFI_PASS);
  cfgMqttServer = prefs.getString("mqtt_host", MQTT_SERVER);
  cfgMqttPort = prefs.getInt("mqtt_port", MQTT_PORT);
  cfgMqttUser = prefs.getString("mqtt_user", MQTT_USER);
  cfgMqttPass = prefs.getString("mqtt_pass", MQTT_PASS);
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
}

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
  Serial.println("[NVS] Настройки экрана записаны");
}

void markSettingsDirty() {
  displaySettingsDirty = true;
  lastSettingsSave = millis();
}

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

void startGitHubUpdate() {
  if (latestGithubUrl.length() == 0) {
    if (!GitHubOTA::checkForUpdate(FIRMWARE_VERSION, latestGithubVersion, latestGithubUrl)) {
      Serial.println("[GitHubOTA] Обновление не требуется");
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
                  "<title>Настройки Pixel Clock</title><style>"
                  "body{font-family:system-ui,Arial,sans-serif;margin:24px;max-width:760px;background:#101418;color:#eef2f4}"
                  "fieldset{border:1px solid #33414a;border-radius:8px;margin:0 0 16px;padding:16px}"
                  "label{display:block;margin:10px 0 4px;color:#aebbc3}input,select{box-sizing:border-box;width:100%;padding:10px;border-radius:6px;border:1px solid #54636c;background:#172027;color:#fff}"
                  "input[type=checkbox]{width:auto}.row{display:grid;grid-template-columns:1fr 1fr;gap:12px}.btn{background:#24a0ed;color:white;border:0;padding:12px 16px;border-radius:6px;cursor:pointer}.btn-gh{background:#238636}.muted{color:#9aa7af}"
                  "a{color:#69c0ff}@media(max-width:640px){.row{grid-template-columns:1fr}body{margin:14px}}</style></head><body>"
                  "<h1>Настройки Pixel Clock</h1>");
  html += "<p class='muted'>IP: " + ip + " | Версия прошивки: v" + String(FIRMWARE_VERSION) + "</p>";
  
  html += "<fieldset><legend>Обновление по воздуху (GitHub OTA)</legend>";
  html += "<p>Репозиторий: <b>geminibitok-oss/pixel_clock</b><br>";
  html += "Текущая версия: <b>v" + String(FIRMWARE_VERSION) + "</b>";
  if (latestGithubVersion.length() > 0) {
    html += " | На GitHub: <b>v" + latestGithubVersion + "</b>";
  }
  html += "</p>";
  html += "<div style='display:flex;gap:10px'>";
  html += "<a href='/check-update' class='btn'>Проверить обновления</a>";
  if (latestGithubVersion.length() > 0 && latestGithubVersion != FIRMWARE_VERSION) {
    html += "<a href='/start-update' class='btn btn-gh' onclick='return confirm(\"Начать обновление с GitHub?\")'>Обновить до v" + latestGithubVersion + "</a>";
  }
  html += "<a href='/update' style='margin-left:auto;align-self:center'>Загрузить .bin вручную</a>";
  html += "</div></fieldset>";

  html += "<form method='POST' action='/save'>";
  html += "<fieldset><legend>Сеть</legend>";
  html += "<label>WiFi SSID</label><input name='wifi_ssid' value=\"" + htmlEscape(cfgWifiSsid) + "\">";
  html += "<label>Пароль WiFi</label><input name='wifi_pass' type='password' value=\"" + htmlEscape(cfgWifiPass) + "\">";
  html += "<div class='row'><div><label>Адрес MQTT</label><input name='mqtt_host' value=\"" + htmlEscape(cfgMqttServer) + "\"></div>";
  html += "<div><label>Порт MQTT</label><input name='mqtt_port' type='number' value=\"" + String(cfgMqttPort) + "\"></div></div>";
  html += "<div class='row'><div><label>Пользователь MQTT</label><input name='mqtt_user' value=\"" + htmlEscape(cfgMqttUser) + "\"></div>";
  html += "<div><label>Пароль MQTT</label><input name='mqtt_pass' type='password' value=\"" + htmlEscape(cfgMqttPass) + "\"></div></div></fieldset>";
  html += "<fieldset><legend>Экран</legend>";
  html += "<div class='row'><div><label>Режим</label><select name='mode'>" + optionTagLabel("weather", selectedMode, "Погода") + optionTagLabel("music", selectedMode, "Бегущая строка") + "</select></div>";
  html += "<div><label>Скорость строки</label><input name='speed' type='range' min='0' max='100' value='" + String(userSpeedVal) + "'></div></div>";
  html += "<label><input name='auto_bri' type='checkbox' value='1'" + String(autoBrightness ? " checked" : "") + "> Автояркость</label>";
  html += "<label>Ручная яркость</label><input name='manual_bri' type='range' min='10' max='255' value='" + String(manualBrightness) + "'>";
  html += "<div class='row'><div><label>Цвет часов</label><select name='col_clock'>" + colorOptions(colorClockName) + "</select></div>";
  html += "<div><label>Цвет текста</label><select name='col_text'>" + colorOptions(colorTextName) + "</select></div></div>";
  html += "<label>Цвет погоды</label><select name='col_weather'>" + colorOptions(colorWeatherName) + "</select>";
  html += "<label>Текст сообщения</label><input name='message' value=\"" + htmlEscape(scrollText) + "\"></fieldset>";
  html += "<button class='btn' type='submit'>Сохранить</button></form></body></html>";
  server.send(200, "text/html", html);
}

void handleCheckUpdate() {
  if (!ensureAuth()) return;
  checkGithubReleases();
  server.sendHeader("Location", "/");
  server.send(302, "text/plain", "");
}

void handleStartUpdate() {
  if (!ensureAuth()) return;
  server.send(200, "text/html; charset=utf-8", "<h2>Обновление началось!</h2><p>Индикация выводится на матрицу 32x16. Часы перезагрузятся автоматически.</p><a href='/'>Назад</a>");
  delay(500);
  startGitHubUpdate();
}

void handleSave() {
  if (!ensureAuth()) return;
  String oldWifi = cfgWifiSsid + cfgWifiPass;
  String oldMqtt = cfgMqttServer + String(cfgMqttPort) + cfgMqttUser + cfgMqttPass;

  cfgWifiSsid = server.arg("wifi_ssid");
  cfgWifiPass = server.arg("wifi_pass");
  cfgMqttServer = server.arg("mqtt_host");
  cfgMqttPort = constrain(server.arg("mqtt_port").toInt(), 1, 65535);
  cfgMqttUser = server.arg("mqtt_user");
  cfgMqttPass = server.arg("mqtt_pass");
  isMusicMode = server.arg("mode") == "music";
  userSpeedVal = server.arg("speed").toInt();
  autoBrightness = server.hasArg("auto_bri");
  manualBrightness = constrain(server.arg("manual_bri").toInt(), 10, 255);
  colorClockName = server.arg("col_clock");
  colorTextName = server.arg("col_text");
  colorWeatherName = server.arg("col_weather");
  if (server.hasArg("message")) {
    scrollText = server.arg("message");
    scrollX = WIDTH;
  }

  applyColorSettings();
  applySpeedSetting();
  saveNetworkSettings();
  
  displaySettingsDirty = true;
  commitDisplaySettings();

  bool restartNeeded = (oldWifi != cfgWifiSsid + cfgWifiPass) ||
                       (oldMqtt != cfgMqttServer + String(cfgMqttPort) + cfgMqttUser + cfgMqttPass);
  server.send(200, "text/html; charset=utf-8", restartNeeded ? "Сохранено. Перезагрузка..." : "Сохранено. <a href='/'>Назад</a>");
  delay(200);
  if (restartNeeded) ESP.restart();
}

void handleUpdatePage() {
  if (!ensureAuth()) return;
  String html = F("<!doctype html><html lang='ru'><head><meta charset='utf-8'><meta name='viewport' content='width=device-width,initial-scale=1'>"
                  "<title>Ручная прошивка</title></head><body>"
                  "<h1>Ручная загрузка firmware.bin</h1>"
                  "<form method='POST' action='/update' enctype='multipart/form-data'>"
                  "<input type='file' name='update' accept='.bin'><input type='submit' value='Прошить'></form>"
                  "<p><a href='/'>Назад</a></p></body></html>");
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
  server.on("/check-update", HTTP_GET, handleCheckUpdate);
  server.on("/start-update", HTTP_GET, handleStartUpdate);
  server.on("/update", HTTP_GET, handleUpdatePage);
  server.on("/update", HTTP_POST, handleUpdateDone, handleUpdateUpload);
  server.begin();
}

String baseDeviceJson() {
  String url = "http://";
  url += WiFi.status() == WL_CONNECTED ? WiFi.localIP().toString() : WiFi.softAPIP().toString();
  url += "/";
  return "\"dev\":{\"ids\":[\"" + String(DEVICE_NAME) + "\"],\"name\":\"" + String(DEVICE_FRIENDLY_NAME) +
         "\",\"mdl\":\"Pixel Clock v" + String(FIRMWARE_VERSION) + "\",\"sw\":\"" + String(FIRMWARE_VERSION) + "\",\"mf\":\"DIY\",\"cu\":\"" + url + "\"}";
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

void connectWiFi() {
  WiFi.mode(WIFI_STA);
  WiFi.begin(cfgWifiSsid.c_str(), cfgWifiPass.c_str());
  unsigned long start = millis();
  while (WiFi.status() != WL_CONNECTED && millis() - start < 15000) {
    delay(200);
  }
  if (WiFi.status() != WL_CONNECTED) {
    WiFi.mode(WIFI_AP_STA);
    WiFi.softAP("MatrixSetup", OTA_PASS);
  } else {
    configTime(GMT_OFFSET_SEC, DAYLIGHT_OFFSET_SEC, "pool.ntp.org", "time.google.com");
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
  if (WiFi.status() != WL_CONNECTED && now - lastWifiReconnect > WIFI_RECONNECT_MS) {
    lastWifiReconnect = now;
    WiFi.reconnect();
  }
  if (!client.connected()) {
    if (now - lastMqttReconnect > MQTT_RECONNECT_MS) {
      lastMqttReconnect = now;
      reconnectMqtt();
    }
  } else {
    client.loop();
  }
}

void renderFrame(unsigned long now) {
  if (isOtaUpdating) return;
  if (now - lastFrame < FRAME_MS) return;
  lastFrame = now;
  fill_solid(leds, NUM_LEDS, CRGB::Black);

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

  if (now - lastNtpCheck > 10000) {
    lastNtpCheck = now;
    if (WiFi.status() == WL_CONNECTED) {
      updateLocalTime();
    }
  }

  if (now - lastGithubCheck > GITHUB_CHECK_INTERVAL_MS) {
    lastGithubCheck = now;
    checkGithubReleases();
  }

  if (displaySettingsDirty && (now - lastSettingsSave > 5000)) {
    commitDisplaySettings();
  }

  renderFrame(now);
}
