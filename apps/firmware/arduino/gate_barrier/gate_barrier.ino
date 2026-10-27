#include <Servo.h>
const int SERVO_PIN = 8;
const int ANGLE_CLOSE = 0;
const int ANGLE_OPEN = 100;

int currentAngle = ANGLE_CLOSE;
const int STEP_DELAY_MS = 5;

const int BUTTON_PIN = 2;


Servo barrier;

void setup() {
  // Runs once, when the board powers on or resets.

  // Servo setup: start closed, matching isOpen and currentAngle.
  barrier.attach(SERVO_PIN);
  barrier.write(ANGLE_CLOSE);

  // Button Setup
  pinMode(BUTTON_PIN, INPUT_PULLUP);
  Serial.begin(9600);
  reportState();
}

void loop() {
  // Runs over and over, forever, as fast as it can.
  checkSerial();
  checkButton();
}

void moveTo(int target) {
  int step = (target > currentAngle) ? 1 : -1;
  while (currentAngle != target) {
    currentAngle += step;
    barrier.write(currentAngle);
    delay(STEP_DELAY_MS);
  }
}

bool isOpen = false;

void setBarrier(bool open) {
  if (open != isOpen) {
    isOpen = open;
    moveTo(isOpen ? ANGLE_OPEN : ANGLE_CLOSE);
  }
  reportState();
}

const unsigned long DEBOUNCE_MS = 50;

int lastReading = HIGH;          // the raw reading from the previous loop
int buttonState = HIGH;          // the accepted, debounced state
unsigned long lastChangeTime = 0;

void checkButton() {
  int reading = digitalRead(BUTTON_PIN);

  if (reading != lastReading) {
    lastChangeTime = millis();   // it flickered: restart the 50 ms timer
  }

  if (millis() - lastChangeTime > DEBOUNCE_MS && reading != buttonState) {
    buttonState = reading;       // steady for 50 ms: accept it
    if (buttonState == LOW) {
      // A real press happened. Step 6 fills this in.
      setBarrier(!isOpen);
    }
  }

  lastReading = reading;
}

void reportState() {
  Serial.println(isOpen ? "STATE:OPEN" : "STATE:CLOSED");
}

void checkSerial() {
  if (Serial.available()) {
    String cmd = Serial.readStringUntil('\n');
    cmd.trim();
    if (cmd == "OPEN") setBarrier(true);
    else if (cmd == "CLOSE") setBarrier(false);
    else if (cmd == "STATUS") reportState();
  }
}
