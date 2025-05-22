#!/usr/bin/env python3
import os
import time
import json
import paho.mqtt.client as mqtt
import hashlib
import subprocess
from threading import Timer
import shutil
import sys
import socket
import fcntl
import struct

# Configuration
MQTT_BROKER = "192.168.1.5"  # Make sure this matches your backend MQTT broker IP
MQTT_PORT = 1883
MQTT_USER = "your_username"  # Optional
MQTT_PASS = "your_password"  # Optional
CLIENT_ID = "raspberrypi2w_" + os.uname()[1]  # Unique client ID
HEARTBEAT_TOPIC = "cybiot/device/heartbeat"
FIRMWARE_TOPIC_BASE = "cybiot/device/firmware/" + CLIENT_ID
FIRMWARE_INFO_TOPIC = FIRMWARE_TOPIC_BASE + "/info"
FIRMWARE_DATA_TOPIC = FIRMWARE_TOPIC_BASE + "/data"
COMMAND_TOPIC = "cybiot/device/commands/" + CLIENT_ID
HEARTBEAT_INTERVAL = 60  # seconds

# File paths
CURRENT_FIRMWARE_DIR = "/home/pi/firmware/current"
BACKUP_FIRMWARE_DIR = "/home/pi/firmware/backup"
NEW_FIRMWARE_PATH = "/home/pi/firmware/new_firmware.bin"
FIRMWARE_UPDATE_SCRIPT = "/home/pi/firmware/update_script.sh"

# Global variables
firmware_update_timer = None
update_scheduled = False
scheduled_update_time = 0

def get_ip_address(interface='wlan0'):
    """Get the IP address of a specific network interface"""
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

def on_connect(client, userdata, flags, rc, properties=None):
    print("Connected to MQTT broker with result code " + str(rc))
    # Subscribe to the base topic for all firmware messages using wildcard
    client.subscribe(FIRMWARE_TOPIC_BASE + "/#")
    client.subscribe(COMMAND_TOPIC)
    print(f"Subscribed to firmware topics: {FIRMWARE_TOPIC_BASE}/#")
    print(f"Subscribed to command topic: {COMMAND_TOPIC}")
    send_heartbeat()

def on_message(client, userdata, msg):
    global firmware_update_timer, update_scheduled, scheduled_update_time
    
    print(f"Message received on {msg.topic}")
    
    if msg.topic == COMMAND_TOPIC:
        try:
            command = json.loads(msg.payload.decode())
            if command.get("action") == "schedule_update":
                delay = command.get("delay", 0)  # in seconds
                if delay > 0:
                    print(f"Scheduling firmware update in {delay} seconds")
                    scheduled_update_time = time.time() + delay
                    update_scheduled = True
                    if firmware_update_timer is not None:
                        firmware_update_timer.cancel()
                    firmware_update_timer = Timer(delay, request_firmware_update)
                    firmware_update_timer.start()
                    
        except Exception as e:
            print(f"Error processing command: {e}")
      elif msg.topic.startswith(FIRMWARE_TOPIC_BASE):
        try:
            print(f"Processing message on topic: {msg.topic}")
            
            # Determine if this is firmware info or binary data
            if msg.topic == FIRMWARE_INFO_TOPIC:
                print("Firmware info received")
                try:
                    firmware_info = json.loads(msg.payload.decode())
                    
                    # Store firmware info for later use
                    global firmware_info_data
                    firmware_info_data = firmware_info
                    
                    print(f"Firmware info: {json.dumps(firmware_info, indent=2)}")
                    
                    # Send confirmation back
                    client.publish(COMMAND_TOPIC, json.dumps({
                        "action": "firmware_info_received",
                        "status": "success",
                        "message": "Ready to receive firmware data",
                        "device_id": CLIENT_ID
                    }))
                except Exception as e:
                    print(f"Error processing firmware info: {e}")
                    client.publish(COMMAND_TOPIC, json.dumps({
                        "action": "firmware_error",
                        "status": "error",
                        "error": f"Error processing firmware info: {str(e)}",
                        "device_id": CLIENT_ID
                    }))
                
            elif msg.topic == FIRMWARE_DATA_TOPIC:
                # This is the actual firmware binary data
                print("Firmware data received")
                
                # Make sure firmware directory exists
                os.makedirs(os.path.dirname(NEW_FIRMWARE_PATH), exist_ok=True)
                
                firmware_storage_path = os.path.join(
                    os.path.dirname(NEW_FIRMWARE_PATH),
                    f"firmware_{int(time.time())}.bin"
                )
                
                # Save the received firmware
                with open(firmware_storage_path, 'wb') as f:
                    f.write(msg.payload)
                
                file_size = len(msg.payload)
                print(f"Firmware data received and stored at: {firmware_storage_path} (Size: {file_size} bytes)")
                
                # Send confirmation back
                client.publish(COMMAND_TOPIC, json.dumps({
                    "action": "firmware_received",
                    "status": "success",
                    "message": "Firmware stored successfully",
                    "device_id": CLIENT_ID,
                    "storage_path": firmware_storage_path,
                    "size": file_size
                }))
                
                # If update is scheduled for now, process it
                if update_scheduled and time.time() >= scheduled_update_time:
                    print("Processing scheduled update")
                    update_scheduled = False
                    
                    # Just store the firmware without applying any updates
                    print("Firmware stored successfully (No update applied)")
            else:
                # Regular firmware topic (old format compatibility)
                print("Firmware received (legacy format). Storing...")
                
                # Make sure firmware directory exists
                os.makedirs(os.path.dirname(NEW_FIRMWARE_PATH), exist_ok=True)
                
                # Save the received firmware
                with open(NEW_FIRMWARE_PATH, 'wb') as f:
                    f.write(msg.payload)
                
                print(f"Firmware stored at: {NEW_FIRMWARE_PATH}")
                
                # Send confirmation back
                client.publish(COMMAND_TOPIC, json.dumps({
                    "action": "firmware_received",
                    "status": "success",
                    "message": "Firmware stored successfully (legacy format)",
                    "device_id": CLIENT_ID
                }))
                
                
        except Exception as e:
            print(f"Error processing firmware: {e}")
            # Send error notification
            client.publish(COMMAND_TOPIC, json.dumps({
                "action": "firmware_error",
                "status": "error",
                "error": str(e),
                "device_id": CLIENT_ID
            }))

def send_heartbeat():
    heartbeat_msg = {
        "device_id": CLIENT_ID,
        "status": "online",
        "timestamp": int(time.time()),
        "firmware_version": get_current_firmware_version(),
        "update_scheduled": update_scheduled,
        "scheduled_time": scheduled_update_time if update_scheduled else 0,
        "ip_address": get_ip_address()
    }
    client.publish(HEARTBEAT_TOPIC, json.dumps(heartbeat_msg))
    print("Heartbeat sent with IP:", heartbeat_msg["ip_address"])
    
    # Schedule next heartbeat
    Timer(HEARTBEAT_INTERVAL, send_heartbeat).start()

def get_current_firmware_version():
    try:
        version_file = os.path.join(CURRENT_FIRMWARE_DIR, "version.txt")
        if os.path.exists(version_file):
            with open(version_file, 'r') as f:
                return f.read().strip()
    except:
        pass
    return "unknown"

def request_firmware_update():
    global update_scheduled
    print("Requesting firmware update")
    client.publish(COMMAND_TOPIC, json.dumps({
        "device_id": CLIENT_ID,
        "action": "request_firmware"
    }))
    update_scheduled = False

def prepare_update():
    print("Preparing firmware update...")
    
    # Create backup directory if it doesn't exist
    os.makedirs(BACKUP_FIRMWARE_DIR, exist_ok=True)
    
    # Backup current firmware
    if os.path.exists(CURRENT_FIRMWARE_DIR):
        print("Backing up current firmware")
        backup_dir = os.path.join(BACKUP_FIRMWARE_DIR, f"backup_{int(time.time())}")
        shutil.copytree(CURRENT_FIRMWARE_DIR, backup_dir)
    
    # Apply update
    apply_update()

def apply_update():
    print("Applying firmware update...")
    
    try:
        # Create update script
        update_script = f"""#!/bin/bash
# Stop services if needed
# systemctl stop myservice

# Remove old firmware
rm -rf {CURRENT_FIRMWARE_DIR}/*

# Extract new firmware
mkdir -p {CURRENT_FIRMWARE_DIR}
# Assuming the firmware is a tar.gz file
tar -xzf {NEW_FIRMWARE_PATH} -C {CURRENT_FIRMWARE_DIR}

# Set permissions
chmod -R 755 {CURRENT_FIRMWARE_DIR}

# Restart services
# systemctl start myservice
"""

        with open(FIRMWARE_UPDATE_SCRIPT, 'w') as f:
            f.write(update_script)
        
        # Make script executable and run it
        os.chmod(FIRMWARE_UPDATE_SCRIPT, 0o755)
        subprocess.run([FIRMWARE_UPDATE_SCRIPT], check=True)
        
        print("Firmware update applied successfully")
        send_heartbeat()  # Update status
        
        # Clean up
        os.remove(NEW_FIRMWARE_PATH)
        os.remove(FIRMWARE_UPDATE_SCRIPT)
        
    except Exception as e:
        print(f"Failed to apply update: {e}")
        rollback_update()

def rollback_update():
    print("Attempting to rollback to previous firmware...")
    
    try:
        # Find the most recent backup
        backups = [d for d in os.listdir(BACKUP_FIRMWARE_DIR) if d.startswith("backup_")]
        if backups:
            backups.sort(reverse=True)
            latest_backup = os.path.join(BACKUP_FIRMWARE_DIR, backups[0])
            
            # Restore backup
            shutil.rmtree(CURRENT_FIRMWARE_DIR)
            shutil.copytree(latest_backup, CURRENT_FIRMWARE_DIR)
            
            print("Rollback successful")
        else:
            print("No backup available for rollback")
            
    except Exception as e:
        print(f"Rollback failed: {e}")
    
    send_heartbeat()  # Update status after rollback attempt

# Setup MQTT client with callback API version
client = mqtt.Client(mqtt.CallbackAPIVersion.VERSION2, CLIENT_ID)
client.on_connect = on_connect
client.on_message = on_message

if MQTT_USER and MQTT_PASS:
    client.username_pw_set(MQTT_USER, MQTT_PASS)

try:
    client.connect(MQTT_BROKER, MQTT_PORT, 60)
    client.loop_forever()
except KeyboardInterrupt:
    print("Exiting...")
    if firmware_update_timer is not None:
        firmware_update_timer.cancel()
    client.disconnect()
    sys.exit(0)
except Exception as e:
    print(f"MQTT connection error: {e}")
    sys.exit(1)