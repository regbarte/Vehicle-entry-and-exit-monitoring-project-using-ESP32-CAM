/* GatePass camera firmware — AI Thinker-compatible ESP32-CAM + OV2640.
   IMPORTANT: USB Type-C is not a camera pinout. Verify your exact board first.
   Requires Espressif Arduino ESP32 core 3.x. No external Arduino libraries.
   A guard click requests one JPEG. OCR runs on the PC, not this board.
*/
#include "esp_camera.h"
#include <WiFi.h>
#include <WebServer.h>

const char* WIFI_SSID = "YOUR_2_4_GHZ_WIFI";
const char* WIFI_PASSWORD = "YOUR_WIFI_PASSWORD";
const char* CAMERA_KEY = "PASTE_camera_key_FROM_config.json";
WebServer server(80);
unsigned long reconnectAt = 0;

void capture() {
  if (server.header("X-Camera-Key") != CAMERA_KEY) {
    server.send(401,"text/plain","Unauthorized"); return;
  }
  // Discard a buffered image so the next frame is recent.
  camera_fb_t* old = esp_camera_fb_get();
  if (old) esp_camera_fb_return(old);
  camera_fb_t* fb = esp_camera_fb_get();
  if (!fb) { server.send(503,"text/plain","Capture failed"); return; }
  server.sendHeader("Cache-Control","no-store");
  server.setContentLength(fb->len);
  server.send(200,"image/jpeg","");
  WiFiClient client = server.client();
  size_t sent=0;
  unsigned long started=millis();
  while(sent<fb->len && client.connected() && millis()-started<10000) {
    size_t count=client.write(fb->buf+sent, min((size_t)4096,fb->len-sent));
    if(count==0){delay(1);continue;}
    sent+=count;
  }
  esp_camera_fb_return(fb);
  if(sent==0) Serial.println("Image transfer failed.");
}
void setup() {
  Serial.begin(115200);
  camera_config_t c = {};
  c.ledc_channel=LEDC_CHANNEL_0; c.ledc_timer=LEDC_TIMER_0;
  // AI Thinker ESP32-CAM camera pin mapping ONLY.
  c.pin_d0=5; c.pin_d1=18; c.pin_d2=19; c.pin_d3=21;
  c.pin_d4=36; c.pin_d5=39; c.pin_d6=34; c.pin_d7=35;
  c.pin_xclk=0; c.pin_pclk=22; c.pin_vsync=25; c.pin_href=23;
  c.pin_sccb_sda=26; c.pin_sccb_scl=27;
  c.pin_pwdn=32; c.pin_reset=-1;
  c.xclk_freq_hz=20000000; c.pixel_format=PIXFORMAT_JPEG;
  c.frame_size=psramFound()?FRAMESIZE_SVGA:FRAMESIZE_VGA;
  c.jpeg_quality=10; c.fb_count=1;
  c.fb_location=psramFound()?CAMERA_FB_IN_PSRAM:CAMERA_FB_IN_DRAM;
  c.grab_mode=CAMERA_GRAB_WHEN_EMPTY;
  esp_err_t err=esp_camera_init(&c);
  if(err!=ESP_OK){Serial.printf("Camera initialization failed: 0x%x. Verify model, ribbon and power.\n",err);while(true)delay(1000);}
  WiFi.mode(WIFI_STA); WiFi.setAutoReconnect(true); WiFi.persistent(false);
  WiFi.begin(WIFI_SSID,WIFI_PASSWORD);
  Serial.println("Connecting to 2.4 GHz Wi-Fi...");
  const char* headers[]={"X-Camera-Key"}; server.collectHeaders(headers,1);
  server.on("/capture",HTTP_GET,capture);
  server.on("/",HTTP_GET,[]{server.send(200,"text/plain","GatePass camera ready. Capture requires the application key.");});
  server.begin();
}
void loop() {
  static bool reported=false;
  if(WiFi.status()==WL_CONNECTED){
    if(!reported){Serial.print("Camera URL: http://");Serial.println(WiFi.localIP());reported=true;}
    server.handleClient();
  }else{
    reported=false;
    if(millis()-reconnectAt>15000){reconnectAt=millis();WiFi.reconnect();Serial.println("Retrying Wi-Fi...");}
  }
  delay(2);
}
