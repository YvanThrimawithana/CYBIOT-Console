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
MQTT_BROKER = "192.168.1.9"  # Change this to match your backend MQTT broker IP
MQTT_PORT = 1883
MQTT_USER = "your_username"  # Optional
MQTT_PASS = "your_password"  # Optional

# Generate a temporary client ID based on hostname and MAC address
import uuid
import re
import subprocess

def get_mac_address():
    try:
        # Try to get the MAC address using the uuid module
        mac = ':'.join(re.findall('..', '%012x' % uuid.getnode()))
        return mac.replace(':', '')
    except:
        try:
            # Fallback for Raspberry Pi/Linux: use ifconfig
            output = subprocess.check_output("ifconfig wlan0 | grep -o -E '([0-9a-fA-F]{2}:){5}[0-9a-fA-F]{2}'", shell=True).decode().strip()
            return output.replace(':', '')
        except:
            try:
                # Try eth0 if wlan0 fails
                output = subprocess.check_output("ifconfig eth0 | grep -o -E '([0-9a-fA-F]{2}:){5}[0-9a-fA-F]{2}'", shell=True).decode().strip()
                return output.replace(':', '')
            except:
                # Last resort: use a random ID with hostname prefix
                return f"unknown_{os.uname()[1]}_{uuid.uuid4().hex[:8]}"

# Start with a temporary ID based on MAC address
# Will be updated with server-assigned ID after registration
TEMP_CLIENT_ID = f"rasp_{get_mac_address()}"
CLIENT_ID = TEMP_CLIENT_ID  # Will be updated after registration

# Boolean to track if we've been assigned our permanent ID
REGISTERED = False
REGISTRATION_TOPIC = "cybiot/device/registration"
REGISTRATION_RESPONSE_TOPIC = "cybiot/device/registration/response"

HEARTBEAT_TOPIC = "cybiot/device/heartbeat"
COMMAND_TOPIC_BASE = "cybiot/device/commands"
COMMAND_TOPIC = f"{COMMAND_TOPIC_BASE}/{CLIENT_ID}"
FIRMWARE_TOPIC_BASE = "cybiot/device/firmware"  # Will add client ID dynamically
FIRMWARE_INFO_TOPIC = None  # Will be set after registration
FIRMWARE_DATA_TOPIC = None  # Will be set after registration
GLOBAL_TOPIC = f"{COMMAND_TOPIC_BASE}/global"  # Listen for global commands
HEARTBEAT_INTERVAL = 60  # seconds

# File paths - Updated for Kali
FIRMWARE_DIR = "/home/kali/cybiotProject/firmware/current"
CURRENT_FIRMWARE_DIR = os.path.join(FIRMWARE_DIR, "current")
BACKUP_FIRMWARE_DIR = os.path.join(FIRMWARE_DIR, "backup")
NEW_FIRMWARE_PATH = os.path.join(FIRMWARE_DIR, "new_firmware.bin")
FIRMWARE_UPDATE_SCRIPT = os.path.join(FIRMWARE_DIR, "update_script.sh")
LOG_FILE = os.path.join(FIRMWARE_DIR, "firmware_updater.log")

# Set up logging
def log_message(message):
    timestamp = time.strftime("%Y-%m-%d %H:%M:%S")
    log_entry = f"[{timestamp}] {message}\n"
    print(log_entry.strip())
    try:
        with open(LOG_FILE, 'a') as f:
            f.write(log_entry)
    except Exception as e:
        print(f"Error writing to log file: {e}")

# Global variables
firmware_update_timer = None
update_scheduled = False
scheduled_update_time = 0
firmware_info_data = {}

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
    global REGISTERED, CLIENT_ID, COMMAND_TOPIC, FIRMWARE_TOPIC_BASE, FIRMWARE_INFO_TOPIC, FIRMWARE_DATA_TOPIC
    
    log_message(f"Connected to MQTT broker with result code {rc}")
    
    # Subscribe to the registration response topic
    client.subscribe(REGISTRATION_RESPONSE_TOPIC)
    
    # Subscribe to global commands
    client.subscribe(GLOBAL_TOPIC)
    
    # Subscribe to our temporary command topic
    client.subscribe(COMMAND_TOPIC)
    
    # Create necessary directories
    os.makedirs(FIRMWARE_DIR, exist_ok=True)
    os.makedirs(CURRENT_FIRMWARE_DIR, exist_ok=True)
    os.makedirs(BACKUP_FIRMWARE_DIR, exist_ok=True)
    
    # Send registration request
    register_device()
    
    # Also send an initial heartbeat
    send_heartbeat()

def on_disconnect(client, userdata, rc, properties=None):
    log_message(f"Disconnected from MQTT broker with result code {rc}")
    
    # Try to reconnect
    if rc != 0:
        log_message("Unexpected disconnection. Attempting to reconnect...")
        try:
            client.reconnect()
        except Exception as e:
            log_message(f"Reconnect failed: {e}")

def on_message(client, userdata, msg):
    global firmware_update_timer, update_scheduled, scheduled_update_time, firmware_info_data
    global REGISTERED, CLIENT_ID, COMMAND_TOPIC, FIRMWARE_TOPIC_BASE, FIRMWARE_INFO_TOPIC, FIRMWARE_DATA_TOPIC
    
    log_message(f"Message received on {msg.topic}")
    
    # Handle registration response
    if msg.topic == REGISTRATION_RESPONSE_TOPIC:
        try:
            response = json.loads(msg.payload.decode())
            log_message(f"Registration response: {json.dumps(response)}")
            
            if response.get("success") and response.get("deviceId"):
                # Update our client ID to the one assigned by the server
                new_device_id = response.get("deviceId")
                log_message(f"Server assigned permanent device ID: {new_device_id}")
                
                # Update our client ID
                CLIENT_ID = new_device_id
                REGISTERED = True
                
                # Update topics with new device ID
                COMMAND_TOPIC = f"{COMMAND_TOPIC_BASE}/{CLIENT_ID}"
                FIRMWARE_TOPIC_BASE = f"{FIRMWARE_TOPIC_BASE}/{CLIENT_ID}"
                FIRMWARE_INFO_TOPIC = f"{FIRMWARE_TOPIC_BASE}/info"
                FIRMWARE_DATA_TOPIC = f"{FIRMWARE_TOPIC_BASE}/data"
                
                # Save device ID to a persistence file
                try:
                    with open(os.path.join(FIRMWARE_DIR, "device_id.txt"), "w") as f:
                        f.write(CLIENT_ID)
                    log_message(f"Saved permanent device ID to file: {CLIENT_ID}")
                except Exception as e:
                    log_message(f"Failed to save device ID to file: {e}")
                
                # Subscribe to our new topics
                client.subscribe(COMMAND_TOPIC)
                client.subscribe(FIRMWARE_TOPIC_BASE + "/#")
                
                log_message(f"Subscribed to new command topic: {COMMAND_TOPIC}")
                log_message(f"Subscribed to new firmware topics: {FIRMWARE_TOPIC_BASE}/#")
                
                # Send a heartbeat with our new ID
                send_heartbeat()
        except Exception as e:
            log_message(f"Error processing registration response: {e}")
    
    elif msg.topic == COMMAND_TOPIC:
        try:
            command = json.loads(msg.payload.decode())
            log_message(f"Command received: {json.dumps(command)}")
            
            if command.get("action") == "schedule_update":
                delay = command.get("delay", 0)  # in seconds
                if delay > 0:
                    log_message(f"Scheduling firmware update in {delay} seconds")
                    scheduled_update_time = time.time() + delay
                    update_scheduled = True
                    if firmware_update_timer is not None:
                        firmware_update_timer.cancel()
                    firmware_update_timer = Timer(delay, request_firmware_update)
                    firmware_update_timer.start()
                    
        except Exception as e:
            log_message(f"Error processing command: {e}")
    
    elif msg.topic.startswith(FIRMWARE_TOPIC_BASE):
        try:
            log_message(f"Processing message on topic: {msg.topic}")
            
            # Determine if this is firmware info or binary data
            if msg.topic == FIRMWARE_INFO_TOPIC:
                log_message("Firmware info received")
                try:
                    firmware_info = json.loads(msg.payload.decode())
                    
                    # Store firmware info for later use
                    firmware_info_data = firmware_info
                    
                    log_message(f"Firmware info: {json.dumps(firmware_info, indent=2)}")
                    
                    # Send confirmation back
                    client.publish(COMMAND_TOPIC, json.dumps({
                        "action": "firmware_info_received",
                        "status": "success",
                        "message": "Ready to receive firmware data",
                        "device_id": CLIENT_ID
                    }))
                except Exception as e:
                    log_message(f"Error processing firmware info: {e}")
                    client.publish(COMMAND_TOPIC, json.dumps({
                        "action": "firmware_error",
                        "status": "error",
                        "error": f"Error processing firmware info: {str(e)}",
                        "device_id": CLIENT_ID
                    }))
                
            elif msg.topic == FIRMWARE_DATA_TOPIC:
                # This is the actual firmware binary data
                log_message("Firmware data received")
                
                # Make sure firmware directory exists
                os.makedirs(FIRMWARE_DIR, exist_ok=True)
                
                timestamp = int(time.time())
                firmware_storage_path = os.path.join(
                    FIRMWARE_DIR,
                    f"firmware_{timestamp}.bin"
                )
                
                # Save the received firmware
                try:
                    with open(firmware_storage_path, 'wb') as f:
                        f.write(msg.payload)
                    
                    file_size = len(msg.payload)
                    log_message(f"Firmware data received and stored at: {firmware_storage_path} (Size: {file_size} bytes)")
                    
                    # Write info file with metadata
                    info_path = os.path.join(FIRMWARE_DIR, f"firmware_{timestamp}_info.json")
                    with open(info_path, 'w') as f:
                        json.dump({
                            "timestamp": timestamp,
                            "size": file_size,
                            "info": firmware_info_data
                        }, f, indent=2)
                    
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
                        log_message("Processing scheduled update")
                        update_scheduled = False
                        
                        # Just store the firmware without applying any updates
                        log_message("Firmware stored successfully (No update applied)")
                except Exception as e:
                    log_message(f"Error saving firmware data: {e}")
                    client.publish(COMMAND_TOPIC, json.dumps({
                        "action": "firmware_error",
                        "status": "error",
                        "error": f"Error saving firmware data: {str(e)}",
                        "device_id": CLIENT_ID
                    }))
            else:
                # Regular firmware topic (old format compatibility)
                log_message("Firmware received (legacy format). Storing...")
                
                # Make sure firmware directory exists
                os.makedirs(FIRMWARE_DIR, exist_ok=True)
                
                # Save the received firmware
                try:
                    with open(NEW_FIRMWARE_PATH, 'wb') as f:
                        f.write(msg.payload)
                    
                    log_message(f"Firmware stored at: {NEW_FIRMWARE_PATH}")
                    
                    # Send confirmation back
                    client.publish(COMMAND_TOPIC, json.dumps({
                        "action": "firmware_received",
                        "status": "success",
                        "message": "Firmware stored successfully (legacy format)",
                        "device_id": CLIENT_ID
                    }))
                except Exception as e:
                    log_message(f"Error saving legacy firmware: {e}")
                    client.publish(COMMAND_TOPIC, json.dumps({
                        "action": "firmware_error",
                        "status": "error",
                        "error": f"Error saving legacy firmware: {str(e)}",
                        "device_id": CLIENT_ID
                    }))
                
        except Exception as e:
            log_message(f"Error processing firmware: {e}")
            # Send error notification
            client.publish(COMMAND_TOPIC, json.dumps({
                "action": "firmware_error",
                "status": "error",
                "error": str(e),
                "device_id": CLIENT_ID
            }))

def send_heartbeat():
    try:
        heartbeat_msg = {
            "device_id": CLIENT_ID,
            "status": "online",
            "timestamp": int(time.time()),
            "firmware_version": get_current_firmware_version(),
            "update_scheduled": update_scheduled,
            "scheduled_time": scheduled_update_time if update_scheduled else 0,
            "ip_address": get_ip_address(),
            "mac_address": get_mac_address()  # Include MAC address for better device identification
        }
        client.publish(HEARTBEAT_TOPIC, json.dumps(heartbeat_msg))
        log_message(f"Heartbeat sent with ID: {CLIENT_ID}, IP: {heartbeat_msg['ip_address']}")
        
        # Schedule next heartbeat
        Timer(HEARTBEAT_INTERVAL, send_heartbeat).start()
    except Exception as e:
        log_message(f"Error sending heartbeat: {e}")

def register_device():
    """Send a registration request to the server"""
    try:
        # Check if we have a saved device ID
        device_id_file = os.path.join(FIRMWARE_DIR, "device_id.txt")
        saved_id = None
        
        if os.path.exists(device_id_file):
            try:
                with open(device_id_file, "r") as f:
                    saved_id = f.read().strip()
                if saved_id:
                    log_message(f"Found saved device ID: {saved_id}")
            except Exception as e:
                log_message(f"Error reading saved device ID: {e}")
        
        # Get system info
        try:
            # Get CPU info
            cpu_info = subprocess.check_output("cat /proc/cpuinfo | grep 'model name' | head -1", shell=True).decode().strip()
            cpu_info = cpu_info.split(":")[1].strip() if ":" in cpu_info else "Unknown CPU"
        except:
            cpu_info = "Unknown"
            
        try:
            # Get memory info
            mem_info = subprocess.check_output("free -h | grep Mem", shell=True).decode().strip()
            mem_total = mem_info.split()[1] if len(mem_info.split()) > 1 else "Unknown"
        except:
            mem_total = "Unknown"
            
        # Prepare registration data
        registration_data = {
            "temp_id": TEMP_CLIENT_ID,
            "saved_id": saved_id,
            "mac_address": get_mac_address(),
            "ip_address": get_ip_address(),
            "hostname": os.uname()[1],
            "device_type": "raspberrypi",
            "system_info": {
                "os": f"{os.uname()[0]} {os.uname()[2]}",
                "cpu": cpu_info,
                "memory": mem_total
            },
            "firmware_version": get_current_firmware_version(),
            "timestamp": int(time.time())
        }
        
        # Send registration request
        log_message(f"Sending registration request: {json.dumps(registration_data)}")
        client.publish(REGISTRATION_TOPIC, json.dumps(registration_data))
        
    except Exception as e:
        log_message(f"Error sending registration request: {e}")
        
def get_current_firmware_version():
    try:
        version_file = os.path.join(CURRENT_FIRMWARE_DIR, "version.txt")
        if os.path.exists(version_file):
            with open(version_file, 'r') as f:
                return f.read().strip()
    except Exception as e:
        log_message(f"Error reading firmware version: {e}")
    return "unknown"

def request_firmware_update():
    global update_scheduled
    log_message("Requesting firmware update")
    client.publish(COMMAND_TOPIC, json.dumps({
        "device_id": CLIENT_ID,
        "action": "request_firmware"
    }))
    update_scheduled = False

if __name__ == "__main__":
    log_message(f"Starting firmware update client (ID: {CLIENT_ID})")
    log_message(f"MQTT Broker: {MQTT_BROKER}:{MQTT_PORT}")
    log_message(f"Firmware directory: {FIRMWARE_DIR}")
    
    # Setup MQTT client with callback API version
    client = mqtt.Client(mqtt.CallbackAPIVersion.VERSION2, CLIENT_ID)
    client.on_connect = on_connect
    client.on_message = on_message
    client.on_disconnect = on_disconnect

    if MQTT_USER and MQTT_PASS and MQTT_USER != "your_username":
        client.username_pw_set(MQTT_USER, MQTT_PASS)

    try:
        log_message(f"Connecting to MQTT broker at {MQTT_BROKER}:{MQTT_PORT}")
        client.connect(MQTT_BROKER, MQTT_PORT, 60)
        client.loop_forever()
    except KeyboardInterrupt:
        log_message("Exiting due to keyboard interrupt...")
        if firmware_update_timer is not None:
            firmware_update_timer.cancel()
        client.disconnect()
        sys.exit(0)
    except Exception as e:
        log_message(f"MQTT connection error: {e}")
        log_message("Will retry connection in 10 seconds...")
        time.sleep(10)
        sys.exit(1)
