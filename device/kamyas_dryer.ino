/*
 * ESP8266 — Kamyas dryer: I2C LCD 20x4, DHT22, SSR from Realtime Database
 *
 * Wiring:
 *   LCD I2C: SDA -> D2 (GPIO4), SCL -> D1 (GPIO5)
 *   SSR DC+  -> D5 (GPIO14); SSR DC- -> GND (FOTEK-style input)
 *   DHT22:   DATA -> D4; VCC 3.3 V; GND; module or 4.7k–10k DATA–3.3 V
 *
 * Control:
 *   `setpoint` (°C) — target temperature from RTDB or serial.
 *   `thermostat` (0/1) — when 1, firmware holds temperature near `setpoint` using the DHT reading (SSR on/off
 *     with hysteresis KAMYAS_THERM_HYST_C). When 0, SSR follows `heater` / `ssr` only (manual).
 *   `heater` / `ssr` — ignored while `thermostat` is 1. `heat_secs` is ignored.
 *
 * RTDB: KAMYAS_RTDB_PATH — device writes sensors; edit setpoint / thermostat / heater / ssr on the same path.
 *        KAMYAS_RTDB_CONTROL_PATH — polled for overrides (setpoint, thermostat, heater, ssr).
 * Telemetry: t, h, setpoint, heater_actual, thermostat (echo 0/1), heat_remaining_sec (0), heat_total_sec (0),
 *   dry_progress_pct (0), dhtOk, uptime_ms
 *
 * Libraries: LiquidCrystal_I2C, DHTesp, FirebaseESP8266 (do not add a second FirebaseJson library).
 * Board: esp8266 by ESP8266 Community — Serial 115200
 */

#include <Wire.h>
#include <LiquidCrystal_I2C.h>
#include <DHTesp.h>
#include <stdio.h>
#include <stdlib.h>
#include <string.h>
#include <stdint.h>

/* -------------------- CONFIG — edit only this block -------------------- */
#define KAMYAS_USE_FIREBASE 1

#define KAMYAS_WIFI_SSID "FTTx_63E4"
#define KAMYAS_WIFI_PASSWORD "E4AA63E4"

#define FIREBASE_HOST "kamyasdryer-dae01-default-rtdb.firebaseio.com"
#define FIREBASE_AUTH "LFVjN0TfCg9afAJUPI1nswwNXrGbXquLdYRWmog8"

#define KAMYAS_RTDB_PATH "/kamyas_dryer/latest"
#define KAMYAS_RTDB_CONTROL_PATH "/kamyas_dryer/control"

#define KAMYAS_RTDB_SOFT_POLL_MS 2000UL

/* --------------- end CONFIG ------------------------------------------- */

#define TEMP_SP_DEFAULT 45.0f
#define TEMP_SP_MIN 20.0f
#define TEMP_SP_MAX 90.0f
/** Half-band around setpoint (°C) to reduce SSR chatter; heat if T < sp−h, cool if T > sp+h. */
#define KAMYAS_THERM_HYST_C 0.5f

static unsigned long lastDhtReadMs = 0;
static bool heaterOn = false;
static float setpointC = TEMP_SP_DEFAULT;
/** Last DHT sample (used before first read = 0; thermostat waits until valid sample). */
static float s_lcdLastT = 0.f;
static float s_lcdLastH = 0.f;
static bool s_lcdDhtOk = false;
static bool s_lcdHaveSample = false;
/** 1 = closed-loop on DHT vs setpoint; 0 = open-loop from heater/ssr. */
static bool s_thermostatMode = false;

static void setHeater(bool on);

#if KAMYAS_USE_FIREBASE
#include <ESP8266WiFi.h>
#include <FirebaseESP8266.h>

FirebaseData firebaseData;
static FirebaseData firebaseStreamOnly;
static volatile bool s_streamWantsLcdRefresh = false;

#define KAMYAS_RTDB_INGEST_MS 15000UL
static uint32_t s_lastRtdbMs = 0;

/** Bang-bang vs setpointC; if DHT bad, heater stays off. */
static void kamThermostatTick(float tempC, bool dhtOk) {
  if (!s_thermostatMode) {
    return;
  }
  if (!dhtOk) {
    if (heaterOn) {
      setHeater(false);
      s_streamWantsLcdRefresh = true;
    }
    return;
  }
  const float h = KAMYAS_THERM_HYST_C;
  bool wantOn = heaterOn;
  if (tempC < setpointC - h) {
    wantOn = true;
  } else if (tempC > setpointC + h) {
    wantOn = false;
  }
  if (wantOn != heaterOn) {
    setHeater(wantOn);
    s_streamWantsLcdRefresh = true;
  }
}

/** Map RTDB heater/ssr when not in thermostat mode. */
static void kamHeaterIntApply(int v) {
  if (s_thermostatMode) {
    return;
  }
  if (v < 0) {
    return;
  }
  if (v == 0) {
    setHeater(false);
  } else {
    setHeater(true);
  }
  s_streamWantsLcdRefresh = true;
}

static String kamNormalizeStreamLeaf(const String &pathIn) {
  String s(pathIn);
  while (s.length() > 0 && s.charAt(0) == '/') {
    s.remove(0, 1);
  }
  const int slash = s.lastIndexOf('/');
  if (slash >= 0 && slash < (int)s.length() - 1) {
    return s.substring(slash + 1);
  }
  return s;
}

static void kamApplyJsonSetpointLeaf(const FirebaseJsonData &r) {
  float sp = 0.f;
  switch (r.typeNum) {
  case FirebaseJsonBase::JSON_INT:
    sp = (float)r.intValue;
    break;
  case FirebaseJsonBase::JSON_FLOAT:
    sp = r.floatValue;
    break;
  case FirebaseJsonBase::JSON_DOUBLE:
    sp = (float)r.doubleValue;
    break;
  default:
    return;
  }
  if (sp >= (float)TEMP_SP_MIN && sp <= (float)TEMP_SP_MAX) {
    setpointC = sp;
  }
}

static void kamApplyJsonHeaterOnLeaf(const FirebaseJsonData &r) {
  if (s_thermostatMode) {
    return;
  }
  switch (r.typeNum) {
  case FirebaseJsonBase::JSON_INT:
    kamHeaterIntApply(r.intValue);
    break;
  case FirebaseJsonBase::JSON_FLOAT:
    kamHeaterIntApply((int)r.floatValue);
    break;
  case FirebaseJsonBase::JSON_DOUBLE:
    kamHeaterIntApply((int)r.doubleValue);
    break;
  case FirebaseJsonBase::JSON_BOOL:
    kamHeaterIntApply(r.boolValue ? 1 : 0);
    break;
  default:
    break;
  }
}

static void kamApplyJsonThermostatLeaf(const FirebaseJsonData &r) {
  switch (r.typeNum) {
  case FirebaseJsonBase::JSON_INT:
    s_thermostatMode = (r.intValue != 0);
    break;
  case FirebaseJsonBase::JSON_FLOAT:
    s_thermostatMode = (r.floatValue != 0.0f);
    break;
  case FirebaseJsonBase::JSON_DOUBLE:
    s_thermostatMode = (r.doubleValue != 0.0);
    break;
  case FirebaseJsonBase::JSON_BOOL:
    s_thermostatMode = r.boolValue;
    break;
  default:
    return;
  }
}

static bool kamApplyEditableKeysFromLatestJson(FirebaseJson &j) {
  bool any = false;
  FirebaseJsonData r;
  if (j.get(r, "setpoint") && r.success) {
    kamApplyJsonSetpointLeaf(r);
    any = true;
  }
  if (j.get(r, "thermostat") && r.success) {
    kamApplyJsonThermostatLeaf(r);
    any = true;
  }
  if (j.get(r, "heater") && r.success) {
    kamApplyJsonHeaterOnLeaf(r);
    any = true;
  } else if (j.get(r, "ssr") && r.success) {
    kamApplyJsonHeaterOnLeaf(r);
    any = true;
  }
  if (s_thermostatMode && s_lcdHaveSample) {
    kamThermostatTick(s_lcdLastT, s_lcdDhtOk);
  }
  return any;
}

static void hydrateRtdbUserValuesOnce() {
  FirebaseJson latest;
  if (Firebase.getJSON(firebaseData, String(KAMYAS_RTDB_PATH), &latest)) {
    kamApplyEditableKeysFromLatestJson(latest);
  }
  FirebaseJson ctl;
  if (Firebase.getJSON(firebaseData, String(KAMYAS_RTDB_CONTROL_PATH), &ctl)) {
    kamApplyEditableKeysFromLatestJson(ctl);
  }
}

static void kamRtdbStreamTimeoutCb(bool timeout) {
  (void)timeout;
}

static void kamRtdbStreamDataCb(StreamData data) {
  if (data.dataTypeEnum() == (uint8_t)fb_esp_data_type::d_json) {
    if (kamApplyEditableKeysFromLatestJson(data.jsonObject())) {
      s_streamWantsLcdRefresh = true;
    }
    return;
  }

  const String leaf = kamNormalizeStreamLeaf(data.dataPath());
  if (!leaf.equals("setpoint") && !leaf.equals("heater") && !leaf.equals("ssr") &&
      !leaf.equals("thermostat")) {
    return;
  }

  String dt(data.dataType());
  dt.toLowerCase();

  if (leaf.equals("thermostat")) {
    if (dt == "int") {
      s_thermostatMode = (data.intData() != 0);
    } else if (dt == "float") {
      s_thermostatMode = (data.floatData() != 0.0f);
    } else if (dt == "double") {
      s_thermostatMode = (data.doubleData() != 0.0);
    } else if (dt == "boolean") {
      s_thermostatMode = data.boolData();
    }
    if (s_lcdHaveSample) {
      kamThermostatTick(s_lcdLastT, s_lcdDhtOk);
    }
    s_streamWantsLcdRefresh = true;
    return;
  }

  if (leaf.equals("setpoint")) {
    if (dt == "int") {
      const float sp = (float)data.intData();
      if (sp >= (float)TEMP_SP_MIN && sp <= (float)TEMP_SP_MAX) {
        setpointC = sp;
      }
    } else if (dt == "float") {
      const float sp = data.floatData();
      if (sp >= (float)TEMP_SP_MIN && sp <= (float)TEMP_SP_MAX) {
        setpointC = sp;
      }
    } else if (dt == "double") {
      const float sp = (float)data.doubleData();
      if (sp >= (float)TEMP_SP_MIN && sp <= (float)TEMP_SP_MAX) {
        setpointC = sp;
      }
    }
    if (s_lcdHaveSample && s_thermostatMode) {
      kamThermostatTick(s_lcdLastT, s_lcdDhtOk);
    }
    s_streamWantsLcdRefresh = true;
    return;
  }

  if (s_thermostatMode && (leaf.equals("heater") || leaf.equals("ssr"))) {
    return;
  }

  if (dt == "int") {
    kamHeaterIntApply(data.intData());
  } else if (dt == "float") {
    kamHeaterIntApply((int)data.floatData());
  } else if (dt == "double") {
    kamHeaterIntApply((int)data.doubleData());
  } else if (dt == "boolean") {
    kamHeaterIntApply(data.boolData() ? 1 : 0);
  }

  s_streamWantsLcdRefresh = true;
}

static bool s_rtdbStreamActive = false;

static void kamStartRtdbStreamForLatestNode() {
  s_rtdbStreamActive = false;
  firebaseStreamOnly.setBSSLBufferSize(2048, 512);
  Firebase.setStreamCallback(firebaseStreamOnly, kamRtdbStreamDataCb, kamRtdbStreamTimeoutCb);
  if (!Firebase.beginStream(firebaseStreamOnly, String(KAMYAS_RTDB_PATH))) {
    Serial.printf("RTDB stream begin failed: %s\n", firebaseStreamOnly.errorReason().c_str());
    return;
  }
  s_rtdbStreamActive = true;
  Serial.println(F("RTDB stream: latest paths setpoint | thermostat | heater | ssr."));
}

static uint32_t s_lastRtdbSoftPollMs = 0;
static uint16_t s_streamLatestCatchupCtr = 0;

static void maybePollRtdbUserValuesForUi() {
  unsigned long now = millis();
  if (WiFi.status() != WL_CONNECTED) {
    return;
  }
  if ((uint32_t)(now - s_lastRtdbSoftPollMs) < KAMYAS_RTDB_SOFT_POLL_MS) {
    return;
  }
  s_lastRtdbSoftPollMs = now;

  const float prevSp = setpointC;
  const bool prevH = heaterOn;
  const bool prevTherm = s_thermostatMode;

  if (!s_rtdbStreamActive) {
    FirebaseJson latest;
    if (Firebase.getJSON(firebaseData, String(KAMYAS_RTDB_PATH), &latest)) {
      kamApplyEditableKeysFromLatestJson(latest);
      yield();
    }
  } else {
    if (++s_streamLatestCatchupCtr >= 24U) {
      s_streamLatestCatchupCtr = 0;
      FirebaseJson latest;
      if (Firebase.getJSON(firebaseData, String(KAMYAS_RTDB_PATH), &latest)) {
        kamApplyEditableKeysFromLatestJson(latest);
      }
      yield();
    }
  }

  FirebaseJson ctl;
  if (Firebase.getJSON(firebaseData, String(KAMYAS_RTDB_CONTROL_PATH), &ctl)) {
    kamApplyEditableKeysFromLatestJson(ctl);
  }

  if (prevSp != setpointC || prevH != heaterOn || prevTherm != s_thermostatMode) {
    s_streamWantsLcdRefresh = true;
  }
}

static void connectWifiAtBoot() {
  if (KAMYAS_WIFI_SSID[0] == '\0') {
    Serial.println(F("Set KAMYAS_WIFI_SSID in CONFIG at top of sketch"));
    return;
  }
  if (FIREBASE_HOST[0] == '\0' || FIREBASE_AUTH[0] == '\0') {
    Serial.println(F("Set FIREBASE_HOST and FIREBASE_AUTH in CONFIG"));
    return;
  }
  WiFi.mode(WIFI_STA);
  WiFi.hostname("KamyasDryer");
  WiFi.setAutoReconnect(true);
  WiFi.setSleepMode(WIFI_NONE_SLEEP);
  WiFi.persistent(true);
  WiFi.begin(KAMYAS_WIFI_SSID, KAMYAS_WIFI_PASSWORD);
  const uint32_t t0 = millis();
  while (WiFi.status() != WL_CONNECTED && millis() - t0 < 30000U) {
    delay(200);
    yield();
  }
  if (WiFi.status() == WL_CONNECTED) {
    Serial.printf("WiFi OK, IP %s, RSSI %d dBm\n", WiFi.localIP().toString().c_str(), WiFi.RSSI());
    Firebase.begin(FIREBASE_HOST, FIREBASE_AUTH);
    Firebase.reconnectWiFi(true);
    Serial.println(F("Firebase Realtime Database ready"));
    firebaseData.setBSSLBufferSize(2048, 512);
    hydrateRtdbUserValuesOnce();
    kamStartRtdbStreamForLatestNode();
  } else {
    Serial.println(F("WiFi: no connection; fix SSID/password or move closer to AP"));
  }
}

static bool rtdbPostReading(unsigned long now, DHTesp &d, bool dhtOk, const TempAndHumidity *data) {
  const String path = String(KAMYAS_RTDB_PATH);
  bool ok = true;
  ok &= Firebase.setInt(firebaseData, path + "/heat_remaining_sec", 0);
  ok &= Firebase.setInt(firebaseData, path + "/heat_total_sec", 0);
  ok &= Firebase.setInt(firebaseData, path + "/dry_progress_pct", 0);

  if (dhtOk && data != nullptr) {
    ok &= Firebase.setFloat(firebaseData, path + "/t", data->temperature);
    ok &= Firebase.setFloat(firebaseData, path + "/h", data->humidity);
    ok &= Firebase.setFloat(firebaseData, path + "/setpoint", setpointC);
    ok &= Firebase.setInt(firebaseData, path + "/heater_actual", heaterOn ? 1 : 0);
    ok &= Firebase.setInt(firebaseData, path + "/thermostat", s_thermostatMode ? 1 : 0);
    ok &= Firebase.setInt(firebaseData, path + "/dhtOk", 1);
  } else {
    ok &= Firebase.setInt(firebaseData, path + "/dhtOk", 0);
    ok &= Firebase.setInt(firebaseData, path + "/dhtStatus", (int)d.getStatus());
    ok &= Firebase.setFloat(firebaseData, path + "/setpoint", setpointC);
    ok &= Firebase.setInt(firebaseData, path + "/heater_actual", heaterOn ? 1 : 0);
    ok &= Firebase.setInt(firebaseData, path + "/thermostat", s_thermostatMode ? 1 : 0);
  }
  ok &= Firebase.setFloat(firebaseData, path + "/uptime_ms", (float)now);
  return ok;
}

static void tryRtdbPost(unsigned long now, DHTesp &dhtRef, bool dhtOk, const TempAndHumidity *d) {
  if (FIREBASE_HOST[0] == '\0' || FIREBASE_AUTH[0] == '\0') {
    return;
  }
  if (s_lastRtdbMs != 0U && (uint32_t)(now - s_lastRtdbMs) < KAMYAS_RTDB_INGEST_MS) {
    return;
  }
  s_lastRtdbMs = now;
  if (WiFi.status() != WL_CONNECTED) {
    WiFi.mode(WIFI_STA);
    WiFi.setAutoReconnect(true);
    WiFi.setSleepMode(WIFI_NONE_SLEEP);
    WiFi.begin(KAMYAS_WIFI_SSID, KAMYAS_WIFI_PASSWORD);
    for (int i = 0; i < 60 && WiFi.status() != WL_CONNECTED; i++) {
      delay(200);
      yield();
    }
  }
  if (WiFi.status() != WL_CONNECTED) {
    static uint32_t s_lastWiFiLog;
    if ((uint32_t)(now - s_lastWiFiLog) > 120000U) {
      s_lastWiFiLog = now;
      Serial.println(F("RTDB: WiFi down; retrying later"));
    }
    return;
  }
  if (rtdbPostReading(now, dhtRef, dhtOk, d)) {
    Serial.println(F("RTDB: write ok"));
  } else {
    static uint32_t s_lastFailLog;
    if ((uint32_t)(now - s_lastFailLog) > 60000U) {
      s_lastFailLog = now;
      Serial.println(firebaseData.errorReason());
    }
  }
}
#endif

#define I2C_SDA D2
#define I2C_SCL D1
#define SSR_PIN D5
#define DHT_PIN D4

#define LCD_COLS 20
#define LCD_ROWS 4

DHTesp dht;

static LiquidCrystal_I2C *lcd = nullptr;

static bool i2cPing(uint8_t addr) {
  Wire.beginTransmission(addr);
  return Wire.endTransmission() == 0;
}

static void initWireForLcd() {
  Wire.begin(I2C_SDA, I2C_SCL);
  Wire.setClock(50000);
}

static void lcdPrintPadded(uint8_t col, uint8_t row, const char *text) {
  if (!lcd) {
    return;
  }
  lcd->setCursor(col, row);
  lcd->print(text);
  uint8_t end = col + (uint8_t)strlen(text);
  while (end < LCD_COLS) {
    lcd->write(' ');
    end++;
  }
}

static const char *networkStatusWord() {
#if KAMYAS_USE_FIREBASE
  return (WiFi.status() == WL_CONNECTED) ? "OK" : "FAIL";
#else
  return "N/A";
#endif
}

static void lcdDrawDashboard(float tempC, float humPct, bool tempHumOk) {
  if (!lcd) {
    return;
  }
  char buf[24];
  if (s_thermostatMode) {
    snprintf(buf, sizeof(buf), "Sp:%.1f AUTO:%s", setpointC, heaterOn ? "HEAT" : "idle");
  } else {
    snprintf(buf, sizeof(buf), "Sp:%.1f SSR:%s", setpointC, heaterOn ? "ON" : "OFF");
  }
  lcdPrintPadded(4, 0, buf);

  if (tempHumOk) {
    snprintf(buf, sizeof(buf), "Temp:%.2fC", tempC);
    lcdPrintPadded(5, 1, buf);
    snprintf(buf, sizeof(buf), "Humidity:%.2f%%", humPct);
    lcdPrintPadded(2, 2, buf);
  } else {
    lcdPrintPadded(5, 1, "Temp:ERROR");
    lcdPrintPadded(2, 2, "Humidity:--");
  }
  snprintf(buf, sizeof(buf), "Network Status:%s", networkStatusWord());
  lcdPrintPadded(1, 3, buf);
}

static void setHeater(bool on) {
  heaterOn = on;
  digitalWrite(SSR_PIN, on ? HIGH : LOW);
}

static void pollSerialSetpoint() {
  static char lineBuf[24];
  static uint8_t len = 0;

  while (Serial.available()) {
    char c = (char)Serial.read();
    if (c == '\n' || c == '\r') {
      if (len > 0) {
        lineBuf[len] = '\0';
        char *end = nullptr;
        double v = strtod(lineBuf, &end);
        if (end != lineBuf && v >= (double)TEMP_SP_MIN && v <= (double)TEMP_SP_MAX) {
          setpointC = (float)v;
          Serial.printf("Setpoint -> %.1f C\n", setpointC);
        } else {
          Serial.printf("Invalid or out of range (%.0f-%.0f C).\n", TEMP_SP_MIN, TEMP_SP_MAX);
        }
        len = 0;
      }
    } else if (len + 1 < sizeof(lineBuf)) {
      if (c == ' ' || c == '\t') {
        continue;
      }
      lineBuf[len++] = c;
    }
  }
}

void setup() {
  pinMode(SSR_PIN, OUTPUT);
  setHeater(false);

  Serial.begin(115200);
  delay(200);
  Serial.println();
  Serial.println(F("========== Kamyas dryer =========="));
  Serial.printf("SSR=D5 DHT=D4 | LCD I2C 20x4 SDA=D2 SCL=D1\n");
#if KAMYAS_USE_FIREBASE
  connectWifiAtBoot();
  Serial.printf("Realtime: %s stream + %s poll\n", KAMYAS_RTDB_PATH, KAMYAS_RTDB_CONTROL_PATH);
#endif
  Serial.printf("Display Sp %.1f C (serial: %.0f–%.0f until RTDB setpoint replaces)\n", setpointC, TEMP_SP_MIN,
                TEMP_SP_MAX);
  Serial.println(F("==================================\n"));

  dht.setup(DHT_PIN, DHTesp::DHT22);
  Serial.printf("DHT22 on D4 (check DATA wiring)\n\n");

  const unsigned long tMin = (unsigned long)dht.getMinimumSamplingPeriod();
  delay(tMin < 2500UL ? 2500UL : tMin);
  yield();
  (void)dht.getTempAndHumidity();
  Serial.printf("DHT after power-up wait: %s\n", dht.getStatusString());

  delay(tMin < 2500UL ? 2500UL : tMin);
  yield();
  (void)dht.getTempAndHumidity();
  Serial.printf("DHT 2nd sample (discard): %s\n", dht.getStatusString());
  lastDhtReadMs = millis();

  initWireForLcd();

  bool ok27 = i2cPing(0x27);
  bool ok3f = i2cPing(0x3F);
  Serial.printf("I2C: 0x27 %s  0x3F %s\n", ok27 ? "ACK" : "--", ok3f ? "ACK" : "--");

  uint8_t lcdAddr = 0;
  if (ok27) {
    lcdAddr = 0x27;
  } else if (ok3f) {
    lcdAddr = 0x3F;
  }

  if (lcdAddr != 0) {
    lcd = new LiquidCrystal_I2C(lcdAddr, LCD_COLS, LCD_ROWS);
    lcd->init();
    lcd->backlight();
    lcd->clear();
    lcdPrintPadded(4, 0, "Kamyas dryer");
    lcdPrintPadded(5, 1, "Starting...");
    lcdPrintPadded(2, 2, "Sensor init...");
    {
      char nb[24];
      snprintf(nb, sizeof(nb), "Network Status:%s", networkStatusWord());
      lcdPrintPadded(1, 3, nb);
    }
    Serial.printf("LCD OK 0x%02X (20x4)\n", (unsigned)lcdAddr);
  } else {
    Serial.println(F("No LCD at 0x27/0x3F — check SDA=D2 SCL=D1."));
  }

  Serial.println(F("\nLoop running.\n"));
}

#if KAMYAS_USE_FIREBASE
static void kamFlushRtdbLcdIfNeeded() {
  if (!s_streamWantsLcdRefresh || lcd == nullptr) {
    return;
  }
  s_streamWantsLcdRefresh = false;
  if (s_lcdHaveSample) {
    lcdDrawDashboard(s_lcdLastT, s_lcdLastH, s_lcdDhtOk);
  } else {
    lcdDrawDashboard(0.f, 0.f, false);
  }
}
#endif

void loop() {
  pollSerialSetpoint();
  unsigned long now = millis();

#if KAMYAS_USE_FIREBASE
  if (s_rtdbStreamActive) {
    Firebase.readStream(firebaseStreamOnly);
    yield();
  }
  maybePollRtdbUserValuesForUi();
  kamFlushRtdbLcdIfNeeded();
#endif

  unsigned long dhtPeriod = (unsigned long)dht.getMinimumSamplingPeriod();
  if (dhtPeriod < 2300UL) {
    dhtPeriod = 2300UL;
  }

  if (now - lastDhtReadMs >= dhtPeriod) {
    lastDhtReadMs = now;

    yield();
    TempAndHumidity data = dht.getTempAndHumidity();

    if (dht.getStatus() != DHTesp::ERROR_NONE) {
      s_lcdDhtOk = false;
      s_lcdHaveSample = true;
#if KAMYAS_USE_FIREBASE
      if (s_thermostatMode) {
        kamThermostatTick(0.f, false);
      }
#endif
      lcdDrawDashboard(0.f, 0.f, false);
      Serial.printf("[%lu] DHT: %s (SSR unchanged)\n", now, dht.getStatusString());
#if KAMYAS_USE_FIREBASE
      tryRtdbPost(now, dht, false, nullptr);
#endif
    } else {
      float t = data.temperature;
      s_lcdLastT = t;
      s_lcdLastH = data.humidity;
      s_lcdDhtOk = true;
      s_lcdHaveSample = true;
#if KAMYAS_USE_FIREBASE
      if (s_thermostatMode) {
        kamThermostatTick(t, true);
      }
#endif
      lcdDrawDashboard(t, data.humidity, true);

      Serial.printf("[%lu] T=%.1f C H=%.1f %% Sp=%.1f SSR=%s\n", now, t, data.humidity, setpointC,
                    heaterOn ? "ON" : "OFF");
#if KAMYAS_USE_FIREBASE
      tryRtdbPost(now, dht, true, &data);
#endif
    }
  }
}
