#include <WiFi.h>
#include <HTTPClient.h>
#include <ArduinoJson.h>
#include <Wire.h>
#include <U8g2lib.h>
#include <WiFiClientSecure.h>
#include <time.h>
#include <DHT.h>
#include <BH1750.h>

// ===== NEW: DS18B20 =====
#include <OneWire.h>
#include <DallasTemperature.h>

#define SOIL_A_PIN 34
#define SOIL_B_PIN 35
#define SOIL_C_PIN 32
#define DHT_PIN 13
#define DHT_TYPE DHT11
#define TEMP_PIN 5   // DS18B20 DATA PIN
#define PH_A_PIN 33   // choose your actual pin
#define LIGHT_ADDR 0x23   // BH1750 default I2C address

TwoWire I2CBH = TwoWire(1);
BH1750 lightMeter;

DHT dht(DHT_PIN, DHT_TYPE);

// ================= WIFI =================
const char* ssid = "Keehouse@2.4Ghz";
const char* password = "kee8429a";

// ================= FIREBASE =================
String firebaseHost = "https://agritwin-mrv-default-rtdb.firebaseio.com";
String basePath = "/users/N8HUYS5jzCdVEh32vZEnagneGnP2/live";

// ================= SENSOR INFO =================
String zone_a = "zone_bed_a";
String zone_b = "zone_bed_b";
String zone_c = "zone_bed_c";
String zone_air = "zone_air";

String soilA_id = "bed_a_moisture";
String soilB_id = "bed_b_moisture";
String soilC_id = "bed_c_moisture";
String temp_id  = "bed_a_temp";
String tempB_id = "bed_b_temp";
String tempC_id = "bed_c_temp";
String air_hum_id = "air_rh_2";
String air_temp_id = "air_temp_1";
String phA_id = "bed_a_ph";
String light_id = "air_light_1";

// ================= OLED =================
U8G2_SH1106_128X64_NONAME_F_HW_I2C u8g2(U8G2_R0, U8X8_PIN_NONE);

// ================= SOIL CALIBRATION =================
int dryValue = 3200;
int wetValue = 1400;

unsigned long lastSend = 0;
int lastMoistureA = -1;
int lastMoistureB = -1;
int lastMoistureC = -1;
int lastAirHum = -1;
int lastAirTemp = -1000;
int lastTemp = -1000;
int lastTempB = -1000;
int lastTempC = -1000;
float lastPhA = -1;
float lastLight = -1;

// ================= DS18B20 SETUP =================
OneWire oneWire(TEMP_PIN);
DallasTemperature sensors(&oneWire);
DeviceAddress tempAAddr;
DeviceAddress tempBAddr;
DeviceAddress tempCAddr;

// ================= TIME =================
void setupTime() {
  configTime(8 * 3600, 0, "pool.ntp.org", "time.nist.gov");
  while (time(nullptr) < 100000) delay(500);
}

//Light
float readLight() {
  float lux = lightMeter.readLightLevel();

  if (lux < 0) {
    Serial.println("BH1750 ERROR → reinit");

    if (lightMeter.begin(BH1750::CONTINUOUS_HIGH_RES_MODE, 0x23, &I2CBH)) {
      Serial.println("BH1750 RECOVERED");
      delay(50);
    } else {
      Serial.println("BH1750 REINIT FAILED");
    }

    return 0;
  }

  return lux;
}

//PH value
float readPH(int pin) {
  long sum = 0;

  analogRead(pin); // discard first read

  for (int i = 0; i < 20; i++) {
    sum += analogRead(pin);
    delay(5);
  }

  float avg = sum / 20.0;

  // Convert ADC → voltage (ESP32 12-bit)
  float voltage = avg * (3.3 / 4095.0);

  // Convert voltage → pH (approximate formula)
  float ph = 7 + ((2.5 - voltage) / 0.18);

  return ph;
}

// ================= SOIL =================
int readSoil(int pin) {
  long sum = 0;
  for (int i = 0; i < 20; i++) {
    sum += analogRead(pin);
    delay(5);
  }
  return sum / 20;
}

int toPercent(int value) {
  int percent = map(value, dryValue, wetValue, 0, 100);
  return constrain(percent, 0, 100);
}

// ================= TEMP (FIXED) =================
void readAllTemp(int &tempA, int &tempB, int &tempC) {
  sensors.requestTemperatures();

  float tA = sensors.getTempC(tempAAddr);
  float tB = sensors.getTempC(tempBAddr);
  float tC = sensors.getTempC(tempCAddr);

  tempA = (tA == DEVICE_DISCONNECTED_C || tA < -50) ? -127 : (int)tA;
  tempB = (tB == DEVICE_DISCONNECTED_C || tB < -50) ? -127 : (int)tB;
  tempC = (tC == DEVICE_DISCONNECTED_C || tC < -50) ? -127 : (int)tC;
}

void readDHT(int &humidity, int &temperature) {
  float h = dht.readHumidity();
  float t = dht.readTemperature();

  if (isnan(h) || isnan(t)) {
    humidity = -1;
    temperature = -1000;
    return;
  }

  humidity = (int)h;
  temperature = (int)t;
}

// ================= FIREBASE SOIL A =================
void sendSoilA(int moisture) {
  WiFiClientSecure client;
  client.setInsecure();
  HTTPClient http;

  time_t now = time(nullptr);

  StaticJsonDocument<256> doc;
  doc["quality"] = 1;
  doc["sensor_id"] = soilA_id;
  doc["sensor_type"] = "soil_moisture";
  doc["timestamp"] = now;
  doc["unit"] = "%";
  doc["value"] = moisture;
  doc["zone_id"] = zone_a;

  String jsonData;
  serializeJson(doc, jsonData);

  if (lastMoistureA != -1) {
    String historyPath = firebaseHost + basePath + "/history/" + zone_a + "/" + soilA_id + ".json";
    http.begin(client, historyPath);
    http.POST(jsonData);
    http.end();
  }

  String latestPath = firebaseHost + basePath + "/latest/" + zone_a + ":" + soilA_id + ".json";
  http.begin(client, latestPath);
  http.PUT(jsonData);
  http.end();

  lastMoistureA = moisture;
}

// ================= FIREBASE SOIL B =================
void sendSoilB(int moisture) {
  WiFiClientSecure client;
  client.setInsecure();
  HTTPClient http;

  time_t now = time(nullptr);

  StaticJsonDocument<256> doc;
  doc["quality"] = 1;
  doc["sensor_id"] = soilB_id;
  doc["sensor_type"] = "soil_moisture";
  doc["timestamp"] = now;
  doc["unit"] = "%";
  doc["value"] = moisture;
  doc["zone_id"] = zone_b;

  String jsonData;
  serializeJson(doc, jsonData);

  if (lastMoistureB != -1) {
    String historyPath = firebaseHost + basePath + "/history/" + zone_b + "/" + soilB_id + ".json";
    http.begin(client, historyPath);
    http.POST(jsonData);
    http.end();
  }

  String latestPath = firebaseHost + basePath + "/latest/" + zone_b + ":" + soilB_id + ".json";
  http.begin(client, latestPath);
  http.PUT(jsonData);
  http.end();

  lastMoistureB = moisture;
}

// ================= FIREBASE SOIL C =================
void sendSoilC(int moisture) {
  WiFiClientSecure client;
  client.setInsecure();
  HTTPClient http;

  time_t now = time(nullptr);

  StaticJsonDocument<256> doc;
  doc["quality"] = 1;
  doc["sensor_id"] = soilC_id;
  doc["sensor_type"] = "soil_moisture";
  doc["timestamp"] = now;
  doc["unit"] = "%";
  doc["value"] = moisture;
  doc["zone_id"] = zone_c;

  String jsonData;
  serializeJson(doc, jsonData);

  if (lastMoistureC != -1) {
    String historyPath = firebaseHost + basePath + "/history/" + zone_c + "/" + soilC_id + ".json";
    http.begin(client, historyPath);
    http.POST(jsonData);
    http.end();
  }

  String latestPath = firebaseHost + basePath + "/latest/" + zone_c + ":" + soilC_id + ".json";
  http.begin(client, latestPath);
  http.PUT(jsonData);
  http.end();

  lastMoistureC = moisture;
}


// ================= FIREBASE Air Humidity =================
void sendAirHumidity(int humidity) {
  WiFiClientSecure client;
  client.setInsecure();
  HTTPClient http;

  time_t now = time(nullptr);

  StaticJsonDocument<256> doc;
  doc["quality"] = 1;
  doc["sensor_id"] = air_hum_id;
  doc["sensor_type"] = "humidity";
  doc["timestamp"] = now;
  doc["unit"] = "%";
  doc["value"] = humidity;
  doc["zone_id"] = zone_air;

  String jsonData;
  serializeJson(doc, jsonData);

  if (lastAirHum != -1) {
    String historyPath = firebaseHost + basePath + "/history/" + zone_air + "/" + air_hum_id + ".json";
    http.begin(client, historyPath);
    http.POST(jsonData);
    http.end();
  }

  String latestPath = firebaseHost + basePath + "/latest/" + zone_air + ":" + air_hum_id + ".json";
  http.begin(client, latestPath);
  http.PUT(jsonData);
  http.end();

  lastAirHum = humidity;
}

// ================= FIREBASE Air Temperature =================
void sendAirTemp(int temperature) {
  WiFiClientSecure client;
  client.setInsecure();
  HTTPClient http;

  time_t now = time(nullptr);

  StaticJsonDocument<256> doc;
  doc["quality"] = 1;
  doc["sensor_id"] = air_temp_id;
  doc["sensor_type"] = "temperature";
  doc["timestamp"] = now;
  doc["unit"] = "C";
  doc["value"] = temperature;
  doc["zone_id"] = zone_air;

  String jsonData;
  serializeJson(doc, jsonData);

  if (lastAirTemp != -1000) {
    String historyPath = firebaseHost + basePath + "/history/" + zone_air + "/" + air_temp_id + ".json";
    http.begin(client, historyPath);
    http.POST(jsonData);
    http.end();
  }

  String latestPath = firebaseHost + basePath + "/latest/" + zone_air + ":" + air_temp_id + ".json";
  http.begin(client, latestPath);
  http.PUT(jsonData);
  http.end();

  lastAirTemp = temperature;
}

// ================= FIREBASE TEMP A=================
void sendTemp(int temp) {
  WiFiClientSecure client;
  client.setInsecure();
  HTTPClient http;

  time_t now = time(nullptr);

  StaticJsonDocument<256> doc;
  doc["quality"] = 1;
  doc["sensor_id"] = temp_id;
  doc["sensor_type"] = "soil_temperature";
  doc["timestamp"] = now;
  doc["unit"] = "C";
  doc["value"] = temp;
  doc["zone_id"] = zone_a;

  String jsonData;
  serializeJson(doc, jsonData);

  if (lastTemp != -1000) {
    String historyPath = firebaseHost + basePath + "/history/" + zone_a + "/" + temp_id + ".json";
    http.begin(client, historyPath);
    http.POST(jsonData);
    http.end();
  }

  String latestPath = firebaseHost + basePath + "/latest/" + zone_a + ":" + temp_id + ".json";
  http.begin(client, latestPath);
  http.PUT(jsonData);
  http.end();

  lastTemp = temp;
}

// ================= FIREBASE TEMP B=================
void sendTempB(int tempB) {
  WiFiClientSecure client;
  client.setInsecure();
  HTTPClient http;

  time_t now = time(nullptr);

  StaticJsonDocument<256> doc;
  doc["quality"] = 1;
  doc["sensor_id"] = tempB_id;
  doc["sensor_type"] = "soil_temperature";
  doc["timestamp"] = now;
  doc["unit"] = "C";
  doc["value"] = tempB;
  doc["zone_id"] = zone_b;

  String jsonData;
  serializeJson(doc, jsonData);

  if (lastTempB != -1000) {
    String historyPath = firebaseHost + basePath + "/history/" + zone_b + "/" + tempB_id + ".json";
    http.begin(client, historyPath);
    http.POST(jsonData);
    http.end();
  }

  String latestPath = firebaseHost + basePath + "/latest/" + zone_b + ":" + tempB_id + ".json";
  http.begin(client, latestPath);
  http.PUT(jsonData);
  http.end();

  lastTempB = tempB;
}


// ================= FIREBASE TEMP C=================
void sendTempC(int tempC) {
  WiFiClientSecure client;
  client.setInsecure();
  HTTPClient http;

  time_t now = time(nullptr);

  StaticJsonDocument<256> doc;
  doc["quality"] = 1;
  doc["sensor_id"] = tempC_id;
  doc["sensor_type"] = "soil_temperature";
  doc["timestamp"] = now;
  doc["unit"] = "C";
  doc["value"] = tempC;
  doc["zone_id"] = zone_c;

  String jsonData;
  serializeJson(doc, jsonData);

  if (lastTempC != -1000) {
    String historyPath = firebaseHost + basePath + "/history/" + zone_c + "/" + tempC_id + ".json";
    http.begin(client, historyPath);
    http.POST(jsonData);
    http.end();
  }

  String latestPath = firebaseHost + basePath + "/latest/" + zone_c + ":" + tempC_id + ".json";
  http.begin(client, latestPath);
  http.PUT(jsonData);
  http.end();

  lastTempC = tempC;
}

// ================= FIREBASE PH Value A=================
void sendPHA(float ph) {
  WiFiClientSecure client;
  client.setInsecure();
  HTTPClient http;

  time_t now = time(nullptr);

  StaticJsonDocument<256> doc;
  doc["quality"] = 1;
  doc["sensor_id"] = phA_id;
  doc["sensor_type"] = "soil_ph";
  doc["timestamp"] = now;
  doc["unit"] = "pH";
  doc["value"] = ph;
  doc["zone_id"] = zone_a;

  String jsonData;
  serializeJson(doc, jsonData);

  // History
  if (lastPhA != -1) {
    String historyPath = firebaseHost + basePath + "/history/" + zone_a + "/" + phA_id + ".json";
    http.begin(client, historyPath);
    http.POST(jsonData);
    http.end();
  }

  // Latest
  String latestPath = firebaseHost + basePath + "/latest/" + zone_a + ":" + phA_id + ".json";
  http.begin(client, latestPath);
  http.PUT(jsonData);
  http.end();

  lastPhA = ph;
}

void sendLight(float lux) {
  WiFiClientSecure client;
  client.setInsecure();
  HTTPClient http;

  time_t now = time(nullptr);

  StaticJsonDocument<256> doc;
  doc["quality"] = 1;
  doc["sensor_id"] = light_id;
  doc["sensor_type"] = "light_intensity";
  doc["timestamp"] = now;
  doc["unit"] = "lux";
  doc["value"] = lux;
  doc["zone_id"] = zone_air;

  String jsonData;
  serializeJson(doc, jsonData);

  // History
  if (lastLight != -1) {
    String historyPath = firebaseHost + basePath + "/history/" + zone_air + "/" + light_id + ".json";
    http.begin(client, historyPath);
    http.POST(jsonData);
    http.end();
  }

  // Latest
  String latestPath = firebaseHost + basePath + "/latest/" + zone_air + ":" + light_id + ".json";
  http.begin(client, latestPath);
  http.PUT(jsonData);
  http.end();

  lastLight = lux;
}

// ================= SETUP =================
void setup() {

  bool bh1750_ok = false;

  Serial.begin(115200);

  I2CBH.begin(18, 19);
  I2CBH.setClock(10000);  // slower = more stable

  if (lightMeter.begin(BH1750::CONTINUOUS_HIGH_RES_MODE, 0x23, &I2CBH)) {
    Serial.println("BH1750 INIT OK on GPIO 18/19");
    delay(200);   // ⭐ IMPORTANT
  } else {
    Serial.println("BH1750 INIT FAILED");
  }


  Wire.begin(21, 22);
  u8g2.begin();
  dht.begin();


  analogReadResolution(12);

  // START DS18B20
  sensors.begin();  
  if (sensors.getDeviceCount() >= 1)
  sensors.getAddress(tempAAddr, 0);

  if (sensors.getDeviceCount() >= 2)
    sensors.getAddress(tempBAddr, 1);

  if (sensors.getDeviceCount() >= 3)
    sensors.getAddress(tempCAddr, 2);

  WiFi.begin(ssid, password);
  while (WiFi.status() != WL_CONNECTED) delay(500);

  setupTime();
}

// ================= LOOP =================
void loop() {

  int moistureA = toPercent(readSoil(SOIL_A_PIN));
  int moistureB = toPercent(readSoil(SOIL_B_PIN));
  int moistureC = toPercent(readSoil(SOIL_C_PIN));
  int airHum, airTemp;
  int tempA, tempB, tempC;
  readAllTemp(tempA, tempB, tempC);
  readDHT(airHum, airTemp);
  float phA = readPH(PH_A_PIN);
  delay(10);  // before readLight()
  float lightLux = readLight();

  Serial.print("A: "); Serial.print(moistureA);
  Serial.print("% | B: "); Serial.print(moistureB);
  Serial.print("% | C: "); Serial.print(moistureC);
  Serial.print("% | TA: "); Serial.print(tempA);
  Serial.print(" | TB: "); Serial.print(tempB);
  Serial.print(" | TC: "); Serial.print(tempC);
  Serial.print(" | AirH: "); Serial.print(airHum);
  Serial.print("% | AirT: "); Serial.print(airTemp);
  Serial.print(" | pH: "); Serial.print(phA);
  Serial.print(" | Light: "); Serial.print(lightLux); Serial.print(" lux");
  Serial.println("C");

  u8g2.clearBuffer();
  u8g2.setFont(u8g2_font_ncenB08_tr);

  char line1[20];
  sprintf(line1, "A:%d B:%d C:%d", moistureA, moistureB, moistureC);
  u8g2.drawStr(0, 25, line1);

  char line2[20];
  sprintf(line2, "Temp:%dC", tempA);
  u8g2.drawStr(0, 50, line2);

  char line3[20];
  sprintf(line3, "Lux:%.0f", lightLux);
  u8g2.drawStr(0, 63, line3);

  u8g2.sendBuffer();

  if (millis() - lastSend >= 5000) {
    lastSend = millis();

    sendSoilA(moistureA);
    sendSoilB(moistureB);
    sendSoilC(moistureC);
    sendTemp(tempA);
    sendTempB(tempB);
    sendTempC(tempC);
    sendAirHumidity(airHum);
    sendAirTemp(airTemp);
    sendPHA(phA);
    sendLight(lightLux);
  }

  delay(1000);
}