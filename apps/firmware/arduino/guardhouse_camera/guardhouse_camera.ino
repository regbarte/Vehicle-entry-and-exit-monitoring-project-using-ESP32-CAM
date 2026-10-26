#include <Arduino.h>
#include <WebServer.h>
#include <WiFi.h>
#include "esp_camera.h"
#include "wifi_secrets.h"

// AI-Thinker ESP32-CAM with OV2640.
#define PWDN_GPIO_NUM 32
#define RESET_GPIO_NUM -1
#define XCLK_GPIO_NUM 0
#define SIOD_GPIO_NUM 26
#define SIOC_GPIO_NUM 27
#define Y9_GPIO_NUM 35
#define Y8_GPIO_NUM 34
#define Y7_GPIO_NUM 39
#define Y6_GPIO_NUM 36
#define Y5_GPIO_NUM 21
#define Y4_GPIO_NUM 19
#define Y3_GPIO_NUM 18
#define Y2_GPIO_NUM 5
#define VSYNC_GPIO_NUM 25
#define HREF_GPIO_NUM 23
#define PCLK_GPIO_NUM 22
#define FLASH_LED_GPIO_NUM 4
#define FLASH_LED_DUTY 96

WebServer server(80);
framesize_t currentFrameSize = FRAMESIZE_UXGA;
bool flashOn = false;

void setFlash(bool on) {
  flashOn = on;
  analogWrite(FLASH_LED_GPIO_NUM, on ? FLASH_LED_DUTY : 0);
}

bool setFrameSize(framesize_t frameSize) {
  if (currentFrameSize == frameSize) return true;
  sensor_t *sensor = esp_camera_sensor_get();
  if (sensor == nullptr || sensor->set_framesize(sensor, frameSize) != 0) return false;
  currentFrameSize = frameSize;
  delay(80);
  return true;
}

void sendJpeg(framesize_t frameSize, size_t expectedWidth, size_t expectedHeight) {
  bool resolutionChanged = currentFrameSize != frameSize;
  if (!setFrameSize(frameSize)) {
    server.send(500, "text/plain", "Could not set camera resolution");
    return;
  }

  // The first frame after changing the OV2640 resolution can have the new JPEG
  // dimensions but incomplete image data. Always discard that settling frame.
  if (resolutionChanged) {
    camera_fb_t *settlingFrame = esp_camera_fb_get();
    if (settlingFrame != nullptr) esp_camera_fb_return(settlingFrame);
    delay(80);
  }

  // Also reject any frame that does not have the requested dimensions.
  camera_fb_t *frame = nullptr;
  for (int attempt = 0; attempt < 4; ++attempt) {
    frame = esp_camera_fb_get();
    if (frame == nullptr) break;
    if (frame->width == expectedWidth && frame->height == expectedHeight) break;
    esp_camera_fb_return(frame);
    frame = nullptr;
    delay(40);
  }
  if (frame == nullptr) {
    server.send(503, "text/plain", "Camera did not produce the requested resolution");
    return;
  }
  WiFiClient client = server.client();
  client.printf(
      "HTTP/1.1 200 OK\r\nContent-Type: image/jpeg\r\nContent-Length: %u\r\n"
      "Cache-Control: no-store\r\nConnection: close\r\n\r\n",
      static_cast<unsigned int>(frame->len));
  client.write(frame->buf, frame->len);
  client.flush();
  esp_camera_fb_return(frame);
}

void handleStatus() {
  String json = "{\"uptimeSeconds\":";
  json += String(millis() / 1000UL);
  json += ",\"signalDbm\":";
  json += String(WiFi.RSSI());
  json += ",\"flashOn\":";
  json += flashOn ? "true" : "false";
  json += "}";
  server.sendHeader("Cache-Control", "no-store");
  server.send(200, "application/json", json);
}

void initialiseCamera() {
  camera_config_t config = {};
  config.ledc_channel = LEDC_CHANNEL_0;
  config.ledc_timer = LEDC_TIMER_0;
  config.pin_d0 = Y2_GPIO_NUM;
  config.pin_d1 = Y3_GPIO_NUM;
  config.pin_d2 = Y4_GPIO_NUM;
  config.pin_d3 = Y5_GPIO_NUM;
  config.pin_d4 = Y6_GPIO_NUM;
  config.pin_d5 = Y7_GPIO_NUM;
  config.pin_d6 = Y8_GPIO_NUM;
  config.pin_d7 = Y9_GPIO_NUM;
  config.pin_xclk = XCLK_GPIO_NUM;
  config.pin_pclk = PCLK_GPIO_NUM;
  config.pin_vsync = VSYNC_GPIO_NUM;
  config.pin_href = HREF_GPIO_NUM;
  config.pin_sccb_sda = SIOD_GPIO_NUM;
  config.pin_sccb_scl = SIOC_GPIO_NUM;
  config.pin_pwdn = PWDN_GPIO_NUM;
  config.pin_reset = RESET_GPIO_NUM;
  config.xclk_freq_hz = 20000000;
  config.pixel_format = PIXFORMAT_JPEG;
  config.frame_size = FRAMESIZE_UXGA;
  config.jpeg_quality = 10;
  config.fb_count = 1;
  config.grab_mode = CAMERA_GRAB_WHEN_EMPTY;
  config.fb_location = CAMERA_FB_IN_PSRAM;

  if (!psramFound()) {
    Serial.println("ERROR: PSRAM not found; UXGA capture requires PSRAM.");
    while (true) delay(1000);
  }
  esp_err_t result = esp_camera_init(&config);
  if (result != ESP_OK) {
    Serial.printf("ERROR: Camera initialization failed: 0x%x\n", result);
    while (true) delay(1000);
  }
  currentFrameSize = FRAMESIZE_UXGA;
  sensor_t *sensor = esp_camera_sensor_get();
  // Keep automatic exposure enabled, lift shadows slightly, and avoid the
  // high contrast setting that made normal indoor light look nearly black.
  sensor->set_brightness(sensor, 1);
  sensor->set_contrast(sensor, 0);
  sensor->set_saturation(sensor, -1);
  sensor->set_sharpness(sensor, 1);
  sensor->set_denoise(sensor, 1);
  sensor->set_whitebal(sensor, 1);
  sensor->set_awb_gain(sensor, 1);
  sensor->set_wb_mode(sensor, 0);
  sensor->set_exposure_ctrl(sensor, 1);
  sensor->set_aec2(sensor, 1);
  sensor->set_ae_level(sensor, 1);
  sensor->set_gain_ctrl(sensor, 1);
  sensor->set_agc_gain(sensor, 0);
  sensor->set_gainceiling(sensor, GAINCEILING_8X);
  sensor->set_bpc(sensor, 1);
  sensor->set_wpc(sensor, 1);
  sensor->set_raw_gma(sensor, 1);
  sensor->set_lenc(sensor, 1);
  // Uncomment if needed for the final mounting orientation.
  // sensor->set_vflip(sensor, 1);
  // sensor->set_hmirror(sensor, 1);
}

void connectWifi() {
  WiFi.mode(WIFI_STA);
  WiFi.setSleep(false);
  WiFi.begin(WIFI_SSID, WIFI_PASSWORD);
  Serial.print("Connecting to the guardhouse network");
  unsigned long started = millis();
  while (WiFi.status() != WL_CONNECTED && millis() - started < 30000UL) {
    delay(500);
    Serial.print(".");
  }
  if (WiFi.status() != WL_CONNECTED) {
    Serial.println("\nERROR: Wi-Fi connection timed out. Check wifi_secrets.h.");
    while (true) delay(1000);
  }
  Serial.println();
  Serial.print("Gate camera address: http://");
  Serial.println(WiFi.localIP());
}

void setup() {
  Serial.begin(115200);
  Serial.setDebugOutput(true);
  pinMode(FLASH_LED_GPIO_NUM, OUTPUT);
  setFlash(false);
  initialiseCamera();
  connectWifi();

  server.on("/", HTTP_GET, []() {
    server.send(200, "text/plain", "Guardhouse gate camera: /capture /preview /status");
  });
  server.on("/capture", HTTP_GET, []() { sendJpeg(FRAMESIZE_UXGA, 1600, 1200); });
  server.on("/preview", HTTP_GET, []() { sendJpeg(FRAMESIZE_VGA, 640, 480); });
  server.on("/status", HTTP_GET, handleStatus);
  server.on("/flash/on", HTTP_GET, []() {
    setFlash(true);
    server.send(200, "application/json", "{\"flashOn\":true}");
  });
  server.on("/flash/off", HTTP_GET, []() {
    setFlash(false);
    server.send(200, "application/json", "{\"flashOn\":false}");
  });
  server.onNotFound([]() { server.send(404, "text/plain", "Not found"); });
  server.begin();
  Serial.println("HTTP camera server started.");
}

void loop() {
  if (WiFi.status() != WL_CONNECTED) {
    WiFi.reconnect();
    delay(250);
  }
  server.handleClient();
  delay(2);
}
