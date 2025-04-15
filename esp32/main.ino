#include <WiFi.h>
#include <PubSubClient.h>
#include <ArduinoJson.h>

const char* ssid = "your-SSID";
const char* password = "your-PASSWORD";
const char* mqtt_server = "your-MQTT-SERVER";

WiFiClient espClient;
PubSubClient client(espClient);

const char* DEVICE_ID = "654e403a-6a25-4a89-bd17-fcf1d1d73d85";
const long HEARTBEAT_INTERVAL = 30000; // 30 seconds
unsigned long lastHeartbeat = 0;

void setup_wifi() {
    delay(10);
    // We start by connecting to a WiFi network
    Serial.println();
    Serial.print("Connecting to ");
    Serial.println(ssid);

    WiFi.begin(ssid, password);

    while (WiFi.status() != WL_CONNECTED) {
        delay(500);
        Serial.print(".");
    }

    Serial.println("");
    Serial.println("WiFi connected");
    Serial.println("IP address: ");
    Serial.println(WiFi.localIP());
}

void callback(char* topic, byte* payload, unsigned int length) {
    // handle message arrived
}

void reconnect() {
    // Loop until we're reconnected
    while (!client.connected()) {
        Serial.print("Attempting MQTT connection...");
        // Attempt to connect
        if (client.connect("ESP8266Client")) {
            Serial.println("connected");
            // Once connected, publish an announcement...
            client.publish("outTopic", "hello world");
            // ... and resubscribe
            client.subscribe("inTopic");
        } else {
            Serial.print("failed, rc=");
            Serial.print(client.state());
            Serial.println(" try again in 5 seconds");
            // Wait 5 seconds before retrying
            delay(5000);
        }
    }
}

void sendHeartbeat() {
    if (millis() - lastHeartbeat >= HEARTBEAT_INTERVAL) {
        String topic = String(DEVICE_ID) + "/heartbeat";
        
        // Send minimal heartbeat data
        StaticJsonDocument<200> doc;
        doc["uptime"] = millis();
        doc["memory"] = ESP.getFreeHeap();
        doc["rssi"] = WiFi.RSSI();

        String heartbeatMsg;
        serializeJson(doc, heartbeatMsg);
        
        client.publish(topic.c_str(), heartbeatMsg.c_str());
        lastHeartbeat = millis();
    }
}

void setup() {
    Serial.begin(115200);
    setup_wifi();
    client.setServer(mqtt_server, 1883);
    client.setCallback(callback);
}

void loop() {
    if (!client.connected()) {
        reconnect();
    }
    client.loop();
    
    sendHeartbeat();
    
    // ...existing code...
}