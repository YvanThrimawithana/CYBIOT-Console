#!/usr/bin/env python3
"""
CybIOT Device ID Troubleshooter
------------------------------
This script helps identify and fix device ID issues in the CybIOT firmware update system.
It will:
1. Test connectivity to the MQTT broker
2. Check what device IDs are registered in the backend
3. Send test heartbeats with the correct device ID
4. Subscribe to firmware topics and verify receipt

Usage:
python3 device_id_troubleshooter.py
"""

import os
import time
import json
import paho.mqtt.client as mqtt
import socket
import sys
import fcntl
import struct

# Configuration
MQTT_BROKER = "192.168.1.9"  # Update this to your broker IP
MQTT_PORT = 1883
MQTT_USER = ""  # Fill in if your broker requires auth
MQTT_PASS = ""  # Fill in if your broker requires auth

# Two possible device IDs - for testing
DEVICE_ID_FROM_PI = "raspberrypi2w_" + socket.gethostname()
DEVICE_ID_FROM_BACKEND = "000000009566e5eb"  # This is what the backend is using

# Topics to subscribe to
HEARTBEAT_TOPIC = "cybiot/device/heartbeat"
FIRMWARE_TOPIC_BACKEND = f"cybiot/device/firmware/{DEVICE_ID_FROM_BACKEND}/#"
FIRMWARE_TOPIC_PI = f"cybiot/device/firmware/{DEVICE_ID_FROM_PI}/#"
COMMAND_TOPIC_BACKEND = f"cybiot/device/commands/{DEVICE_ID_FROM_BACKEND}"
COMMAND_TOPIC_PI = f"cybiot/device/commands/{DEVICE_ID_FROM_PI}"

# Get IP address
def get_ip_address(interface='wlan0'):
    try:
        sock = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)
        ip_addr = socket.inet_ntoa(fcntl.ioctl(
            sock.fileno(),
            0x8915,  # SIOCGIFADDR
            struct.pack('256s', interface[:15].encode('utf-8'))
        )[20:24])
        return ip_addr
    except:
        try:
            # Fallback to hostname method
            s = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)
            s.connect(("8.8.8.8", 80))
            ip_addr = s.getsockname()[0]
            s.close()
            return ip_addr
        except:
            return "unknown"

def log_message(message):
    timestamp = time.strftime("%Y-%m-%d %H:%M:%S")
    log_entry = f"[{timestamp}] {message}"
    print(log_entry)

# MQTT callbacks
def on_connect(client, userdata, flags, rc, properties=None):
    log_message(f"Connected to MQTT broker with result code {rc}")
    
    # Subscribe to both device ID variants to see which one works
    client.subscribe(FIRMWARE_TOPIC_BACKEND)
    client.subscribe(FIRMWARE_TOPIC_PI)
    client.subscribe(COMMAND_TOPIC_BACKEND)
    client.subscribe(COMMAND_TOPIC_PI)
    
    log_message(f"Subscribed to backend device ID topics: {FIRMWARE_TOPIC_BACKEND}")
    log_message(f"Subscribed to Pi device ID topics: {FIRMWARE_TOPIC_PI}")
    
    # Send heartbeats with both device IDs
    send_heartbeat_test(client)

def on_message(client, userdata, msg):
    log_message(f"Message received on topic: {msg.topic}")
    log_message(f"Message content: {msg.payload.decode() if len(msg.payload) < 1000 else '[Binary data]'}")

def on_disconnect(client, userdata, rc, properties=None):
    log_message(f"Disconnected from MQTT broker with result code {rc}")

def send_heartbeat_test(client):
    ip_address = get_ip_address()
    
    # First send heartbeat with Raspberry Pi's generated ID
    heartbeat_pi = {
        "device_id": DEVICE_ID_FROM_PI,
        "status": "online",
        "timestamp": int(time.time()),
        "firmware_version": "unknown",
        "ip_address": ip_address
    }
    
    # Send heartbeat with Backend's expected ID
    heartbeat_backend = {
        "device_id": DEVICE_ID_FROM_BACKEND,
        "status": "online",
        "timestamp": int(time.time()),
        "firmware_version": "unknown",
        "ip_address": ip_address
    }
    
    # Send both heartbeats
    log_message(f"Sending heartbeat with Pi device ID: {DEVICE_ID_FROM_PI}")
    client.publish(HEARTBEAT_TOPIC, json.dumps(heartbeat_pi))
    
    time.sleep(1)
    
    log_message(f"Sending heartbeat with backend device ID: {DEVICE_ID_FROM_BACKEND}")
    client.publish(HEARTBEAT_TOPIC, json.dumps(heartbeat_backend))
    
    log_message(f"Heartbeats sent with IP: {ip_address}")
    log_message(f"Now listening for firmware messages on both device ID topics...")
    log_message("Please try initiating a firmware update now.")

if __name__ == "__main__":
    log_message(f"Starting CybIOT Device ID Troubleshooter")
    log_message(f"MQTT Broker: {MQTT_BROKER}:{MQTT_PORT}")
    log_message(f"Testing with two device IDs:")
    log_message(f"  - Pi's ID: {DEVICE_ID_FROM_PI}")
    log_message(f"  - Backend's ID: {DEVICE_ID_FROM_BACKEND}")
    
    # Setup MQTT client
    client = mqtt.Client(mqtt.CallbackAPIVersion.VERSION2, "device_id_troubleshooter")
    client.on_connect = on_connect
    client.on_message = on_message
    client.on_disconnect = on_disconnect
    
    # Connect and wait for messages
    try:
        if MQTT_USER and MQTT_PASS:
            client.username_pw_set(MQTT_USER, MQTT_PASS)
        
        client.connect(MQTT_BROKER, MQTT_PORT, 60)
        client.loop_forever()
    except KeyboardInterrupt:
        log_message("Test ended by user")
        client.disconnect()
    except Exception as e:
        log_message(f"Error: {e}")
        sys.exit(1)
