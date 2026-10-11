#pragma once
#include <Arduino.h>
#include <WiFiClientSecure.h>
#include <HTTPClient.h>
#include <Update.h>
#include <ArduinoJson.h>

/**
 * GitHubOTA: Проверка и прямое обновление прошивки ESP32 с GitHub Releases.
 * Настроено для репозитория: geminibitok-oss / pixel_clock
 */
class GitHubOTA {
public:
  typedef std::function<void(int percent, const char* status)> ProgressCallback;

  static void setRepository(const char* owner, const char* repo, const char* binName = "firmware.bin") {
    _owner = owner;
    _repo = repo;
    _binName = binName;
  }

  static bool checkForUpdate(const char* currentVersion, String& newVersion, String& downloadUrl) {
    if (WiFi.status() != WL_CONNECTED) return false;

    WiFiClientSecure client;
    client.setInsecure();
    
    HTTPClient http;
    String apiUrl = "https://api.github.com/repos/" + _owner + "/" + _repo + "/releases/latest";
    
    http.begin(client, apiUrl);
    http.setUserAgent("ESP32-Matrix-Clock-OTA");
    http.addHeader("Accept", "application/vnd.github.v3+json");
    
    int httpCode = http.GET();
    if (httpCode != HTTP_CODE_OK) {
      Serial.printf("[GitHubOTA] Ошибка запроса API: %d\n", httpCode);
      http.end();
      return false;
    }

    String payload = http.getString();
    http.end();

    DynamicJsonDocument doc(4096);
    DeserializationError err = deserializeJson(doc, payload);
    if (err) {
      Serial.printf("[GitHubOTA] Ошибка парсинга JSON: %s\n", err.c_str());
      return false;
    }

    const char* tag = doc["tag_name"];
    if (!tag) return false;

    newVersion = String(tag);
    if (newVersion.startsWith("v") || newVersion.startsWith("V")) {
      newVersion = newVersion.substring(1);
    }

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

    if (newVersion != String(currentVersion)) {
      Serial.printf("[GitHubOTA] Найдена новая версия: %s (текущая: %s)\n", newVersion.c_str(), currentVersion);
      return true;
    }

    Serial.println("[GitHubOTA] Прошивка актуальна.");
    return false;
  }

  static bool performUpdate(const String& downloadUrl, ProgressCallback onProgress = nullptr) {
    if (WiFi.status() != WL_CONNECTED) return false;

    Serial.printf("[GitHubOTA] Загрузка обновления: %s\n", downloadUrl.c_str());
    if (onProgress) onProgress(0, "CONNECTING");

    WiFiClientSecure client;
    client.setInsecure();

    HTTPClient http;
    http.setFollowRedirects(HTTPC_STRICT_FOLLOW_REDIRECTS);
    http.begin(client, downloadUrl);
    http.setUserAgent("ESP32-Matrix-Clock-OTA");

    int httpCode = http.GET();
    if (httpCode != HTTP_CODE_OK) {
      Serial.printf("[GitHubOTA] Ошибка загрузки бинарника: %d\n", httpCode);
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
          Serial.printf("[GitHubOTA] Прогресс: %d%% (%u / %d)\n", percent, written, contentLength);
          if (onProgress) onProgress(percent, "FLASHING");
        }
      }
      delay(1);
    }

    http.end();

    if (Update.end()) {
      if (Update.isFinished()) {
        Serial.println("[GitHubOTA] Обновление успешно! Перезагрузка...");
        if (onProgress) onProgress(100, "SUCCESS");
        delay(1000);
        ESP.restart();
        return true;
      }
    } else {
      Serial.printf("[GitHubOTA] Ошибка Update: #%u\n", Update.getError());
      if (onProgress) onProgress(prevPercent, "FAIL");
    }

    return false;
  }

private:
  static inline String _owner = "geminibitok-oss";
  static inline String _repo = "pixel_clock";
  static inline String _binName = "firmware.bin";
};
