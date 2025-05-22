#!/usr/bin/env python3
"""
Raspberry Pi Firmware Updater for CybIOT
This script handles OTA firmware updates from the CybIOT backend.
"""

import os
import sys
import time
import json
import hashlib
import logging
import threading
import argparse
import subprocess
import paho.mqtt.client as mqtt
from datetime import datetime

# Setup logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(levelname)s - %(message)s',
    handlers=[
        logging.FileHandler("firmware_updater.log"),
        logging.StreamHandler()
    ]
)

logger = logging.getLogger("firmware_updater")

class FirmwareUpdater:
    def __init__(self, broker_host="192.168.1.9", broker_port=1883, device_id=None):
        """Initialize the firmware updater with MQTT connection details"""
        self.broker_host = broker_host
        self.broker_port = broker_port
        self.device_id = device_id or self._get_device_id()
        self.client = None
        self.firmware_topic = f"cybiot/device/firmware/{self.device_id}"
        self.command_topic = f"cybiot/device/commands/{self.device_id}"
        self.heartbeat_topic = "cybiot/device/heartbeat"
        self.firmware_buffer = bytearray()
        self.firmware_info = {}
        self.receiving_firmware = False
        self.scheduled_update_time = None
        
        # Create firmware directory if it doesn't exist
        self.firmware_dir = "/home/pi/firmware"
        os.makedirs(self.firmware_dir, exist_ok=True)
        
    def _get_device_id(self):
        """Get unique device ID from Raspberry Pi serial number"""
        try:
            with open('/proc/cpuinfo', 'r') as f:
                for line in f:
                    if line.startswith('Serial'):
                        return line.split(':')[1].strip()
            # Fallback if can't get CPU serial
            return hashlib.md5(os.uname().nodename.encode()).hexdigest()[:12]
        except Exception as e:
            logger.error(f"Error getting device ID: {e}")
            return hashlib.md5(os.uname().nodename.encode()).hexdigest()[:12]
            
    def connect(self):
        """Connect to the MQTT broker and set up callbacks"""
        try:
            logger.info(f"Connecting to MQTT broker at {self.broker_host}:{self.broker_port}")
            self.client = mqtt.Client()
            self.client.on_connect = self.on_connect
            self.client.on_message = self.on_message
            self.client.on_disconnect = self.on_disconnect
            self.client.connect(self.broker_host, self.broker_port, 60)
            self.client.loop_start()
            return True
        except Exception as e:
            logger.error(f"Failed to connect to MQTT broker: {e}")
            return False
    
    def on_connect(self, client, userdata, flags, rc):
        """Handle connection to MQTT broker"""
        if rc == 0:
            logger.info("Connected to MQTT broker")
            # Subscribe to firmware and command topics
            self.client.subscribe(self.firmware_topic)
            self.client.subscribe(self.command_topic)
            
            # Send initial heartbeat
            self.send_heartbeat()
        else:
            logger.error(f"Failed to connect to MQTT broker with code {rc}")
    
    def on_disconnect(self, client, userdata, rc):
        """Handle disconnection from MQTT broker"""
        logger.warning(f"Disconnected from MQTT broker with code {rc}")
        # Try to reconnect
        if rc != 0:
            logger.info("Attempting to reconnect...")
            time.sleep(5)
            try:
                self.client.reconnect()
            except Exception as e:
                logger.error(f"Failed to reconnect: {e}")
    
    def on_message(self, client, userdata, msg):
        """Handle incoming messages"""
        try:
            if msg.topic == self.firmware_topic:
                self.handle_firmware_message(msg.payload)
            elif msg.topic == self.command_topic:
                self.handle_command_message(msg.payload)
        except Exception as e:
            logger.error(f"Error processing message: {e}")
      def handle_firmware_message(self, payload):
        """Handle incoming firmware messages"""
        try:
            # Check if this is firmware info or data
            if self.receiving_firmware:
                # We're already receiving firmware, this must be the data
                logger.info(f"Received firmware data: {len(payload)} bytes")
                
                # Store received data
                self.firmware_buffer.extend(payload)
                
                # Check if we've received all the data
                if len(self.firmware_buffer) >= self.firmware_info.get('size', 0):
                    logger.info("Firmware transfer complete")
                    
                    # Generate hash for verification
                    received_hash = hashlib.sha256(self.firmware_buffer).hexdigest()
                    expected_hash = self.firmware_info.get('hash')
                    
                    if expected_hash and received_hash != expected_hash:
                        logger.error(f"Hash mismatch: expected {expected_hash}, got {received_hash}")
                        self.send_command_response({
                            "action": "firmware_received",
                            "status": "error",
                            "error": "Hash verification failed"
                        })
                        self.receiving_firmware = False
                        return
                    
                    # Save firmware to file
                    firmware_file = os.path.join(
                        self.firmware_dir, 
                        f"{self.firmware_info.get('name', 'firmware')}_{self.firmware_info.get('version', 'unknown')}.bin"
                    )
                    
                    with open(firmware_file, 'wb') as f:
                        f.write(self.firmware_buffer)
                    
                    logger.info(f"Firmware saved to {firmware_file}")
                    
                    # Send confirmation of successful storage
                    self.send_command_response({
                        "action": "firmware_received",
                        "status": "success",
                        "message": "Firmware stored successfully", 
                        "details": {
                            "name": self.firmware_info.get('name', 'unknown'),
                            "version": self.firmware_info.get('version', 'unknown'),
                            "size": len(self.firmware_buffer),
                            "stored_at": firmware_file
                        }
                    })
                    
                    # Reset firmware receiving state
                    self.receiving_firmware = False
                    self.firmware_buffer = bytearray()
            else:
                # This must be firmware info
                try:
                    logger.info("Received firmware info")
                    self.firmware_info = json.loads(payload.decode('utf-8'))
                    self.firmware_buffer = bytearray()
                    self.receiving_firmware = True
                    
                    logger.info(f"Firmware info received: {json.dumps(self.firmware_info, indent=2)}")
                    
                    # Send acknowledgement
                    self.send_command_response({
                        "action": "firmware_info_received",
                        "status": "success",
                        "message": "Ready to receive firmware data",
                        "expected_size": self.firmware_info.get('size', 0)
                    })
                except json.JSONDecodeError as e:
                    logger.error(f"Invalid firmware info format: {e}")
                    self.send_command_response({
                        "action": "firmware_info_received",
                        "status": "error",
                        "error": "Invalid firmware info format"
                    })
        except Exception as e:
            logger.error(f"Error handling firmware message: {e}")
            self.send_command_response({
                "action": "firmware_error",
                "status": "error",
                "error": str(e)
            })
            self.receiving_firmware = False
    
    def handle_command_message(self, payload):
        """Handle command messages"""
        try:
            command = json.loads(payload)
            action = command.get('action', '')
            
            logger.info(f"Received command: {action}")
            
            if action == 'schedule_update':
                # Handle scheduled update
                delay = command.get('delay', 0)
                timestamp = command.get('timestamp', 0)
                firmware_id = command.get('firmware_id')
                
                # Calculate update time
                now = time.time()
                update_time = now + delay
                
                logger.info(f"Update scheduled for {datetime.fromtimestamp(update_time)}")
                self.scheduled_update_time = update_time
                
                # Request firmware if not already received
                if not os.path.exists(os.path.join(self.firmware_dir, 'latest.bin')):
                    self.request_firmware(firmware_id)
                
                # Acknowledge schedule
                self.send_command_response({
                    "action": "schedule_update",
                    "status": "accepted",
                    "scheduled_time": update_time
                })
                
                # Update heartbeat to include scheduled update info
                self.send_heartbeat()
                
            elif action == 'request_status':
                # Send status report
                self.send_status_report()
                
            elif action == 'restart':
                # Restart the device
                logger.info("Reboot command received")
                self.send_command_response({
                    "action": "restart",
                    "status": "accepted"
                })
                subprocess.Popen(['sudo', 'reboot'])
                
        except Exception as e:
            logger.error(f"Error handling command: {e}")
            self.send_command_response({
                "action": "error",
                "status": "error",
                "error": str(e)
            })
    
    def request_firmware(self, firmware_id=None):
        """Request firmware from server"""
        logger.info("Requesting firmware update")
        self.send_command_response({
            "action": "request_firmware",
            "device_id": self.device_id,
            "firmware_id": firmware_id
        })
    
    def apply_firmware_update(self, firmware_file):
        """Apply the firmware update"""
        try:
            logger.info(f"Applying firmware update from {firmware_file}")
            
            # Here you would typically:
            # 1. Stop any running services
            # 2. Back up current firmware
            # 3. Replace current firmware with new version
            # 4. Update version information
            # 5. Restart services
            
            # This is a placeholder implementation - customize for your needs
            # For a Raspberry Pi Zero 2W, you might update Python scripts, systemd services, etc.
            
            # Example: Copy firmware to application directory
            update_script = os.path.join(self.firmware_dir, "update.sh")
            with open(update_script, 'w') as f:
                f.write(f"""#!/bin/bash
                # This script applies the firmware update
                
                # Stop services
                sudo systemctl stop cybiot-agent
                
                # Back up current firmware
                cp /home/pi/cybiot/script.py /home/pi/cybiot/script.py.bak
                
                # Apply new firmware
                cp {firmware_file} /home/pi/cybiot/script.py
                
                # Set permissions
                chmod +x /home/pi/cybiot/script.py
                
                # Update version file
                echo "{self.firmware_info.get('version', 'unknown')}" > /home/pi/cybiot/version.txt
                
                # Restart services
                sudo systemctl start cybiot-agent
                
                echo "Update completed successfully"
                """)
            
            # Make script executable
            os.chmod(update_script, 0o755)
            
            # Execute update script
            result = subprocess.run(['sudo', 'bash', update_script], capture_output=True, text=True)
            
            if result.returncode != 0:
                logger.error(f"Update failed: {result.stderr}")
                self.send_command_response({
                    "action": "update",
                    "status": "error",
                    "error": result.stderr
                })
            else:
                logger.info("Update completed successfully")
                # Update firmware version in heartbeats
                self.current_firmware = self.firmware_info.get('version', 'unknown')
                self.scheduled_update_time = None
                
                # Notify about successful update
                self.send_command_response({
                    "action": "update",
                    "status": "success",
                    "version": self.current_firmware
                })
                
                # Send updated heartbeat
                self.send_heartbeat()
                
                # Reboot if necessary
                if self.firmware_info.get('requires_reboot', False):
                    logger.info("Rebooting system")
                    subprocess.Popen(['sudo', 'reboot'])
            
        except Exception as e:
            logger.error(f"Error applying update: {e}")
            self.send_command_response({
                "action": "update",
                "status": "error",
                "error": str(e)
            })
    
    def send_command_response(self, data):
        """Send response to command topic"""
        try:
            self.client.publish(self.command_topic, json.dumps(data))
        except Exception as e:
            logger.error(f"Error sending command response: {e}")
    
    def send_heartbeat(self):
        """Send heartbeat with device status"""
        try:
            # Get IP address
            ip = self.get_ip_address()
            
            # Get firmware version
            version = self.get_firmware_version()
            
            # Create heartbeat data
            heartbeat = {
                "device_id": self.device_id,
                "ip_address": ip,
                "firmware_version": version,
                "timestamp": time.time(),
                "update_scheduled": self.scheduled_update_time is not None,
                "scheduled_time": self.scheduled_update_time,
                "metrics": {
                    "cpu_temp": self.get_cpu_temp(),
                    "cpu_usage": self.get_cpu_usage(),
                    "memory_usage": self.get_memory_usage(),
                    "uptime": self.get_uptime()
                }
            }
            
            # Send heartbeat
            self.client.publish(self.heartbeat_topic, json.dumps(heartbeat))
            logger.debug("Heartbeat sent")
            
        except Exception as e:
            logger.error(f"Error sending heartbeat: {e}")
    
    def get_ip_address(self):
        """Get the device's IP address"""
        try:
            cmd = "hostname -I | awk '{print $1}'"
            return subprocess.check_output(cmd, shell=True).decode('utf-8').strip()
        except Exception:
            return "unknown"
    
    def get_firmware_version(self):
        """Get the current firmware version"""
        try:
            version_file = "/home/pi/cybiot/version.txt"
            if os.path.exists(version_file):
                with open(version_file, 'r') as f:
                    return f.read().strip()
            return "1.0.0"  # Default version
        except Exception:
            return "unknown"
    
    def get_cpu_temp(self):
        """Get CPU temperature"""
        try:
            temp = subprocess.check_output(['vcgencmd', 'measure_temp']).decode('utf-8')
            return float(temp.replace('temp=', '').replace("'C", ''))
        except Exception:
            return 0.0
    
    def get_cpu_usage(self):
        """Get CPU usage percentage"""
        try:
            return float(subprocess.check_output(['top', '-bn1']).decode('utf-8').split('Cpu(s):')[1].split('%')[0].strip())
        except Exception:
            return 0.0
    
    def get_memory_usage(self):
        """Get memory usage percentage"""
        try:
            total = subprocess.check_output("free | awk '/^Mem:/ {print $2}'", shell=True).decode('utf-8').strip()
            used = subprocess.check_output("free | awk '/^Mem:/ {print $3}'", shell=True).decode('utf-8').strip()
            return round((int(used) / int(total)) * 100, 2)
        except Exception:
            return 0.0
    
    def get_uptime(self):
        """Get system uptime in seconds"""
        try:
            with open('/proc/uptime', 'r') as f:
                return float(f.readline().split()[0])
        except Exception:
            return 0.0
    
    def send_status_report(self):
        """Send detailed status report"""
        try:
            # Gather system information
            status = {
                "device_id": self.device_id,
                "hostname": os.uname().nodename,
                "ip_address": self.get_ip_address(),
                "firmware_version": self.get_firmware_version(),
                "uptime": self.get_uptime(),
                "cpu_temp": self.get_cpu_temp(),
                "cpu_usage": self.get_cpu_usage(),
                "memory_usage": self.get_memory_usage(),
                "disk_usage": self.get_disk_usage(),
                "update_scheduled": self.scheduled_update_time is not None,
                "scheduled_time": self.scheduled_update_time
            }
            
            # Send status report
            self.send_command_response({
                "action": "status_report",
                "status": "success",
                "data": status
            })
            
        except Exception as e:
            logger.error(f"Error sending status report: {e}")
            self.send_command_response({
                "action": "status_report",
                "status": "error",
                "error": str(e)
            })
    
    def get_disk_usage(self):
        """Get disk usage percentage"""
        try:
            output = subprocess.check_output(['df', '-h', '/']).decode('utf-8')
            lines = output.strip().split('\n')
            if len(lines) >= 2:
                parts = lines[1].split()
                if len(parts) >= 5:
                    return parts[4].replace('%', '')
            return "unknown"
        except Exception:
            return "unknown"
    
    def start_heartbeat_timer(self, interval=60):
        """Start sending heartbeats at regular intervals"""
        self.send_heartbeat()
        threading.Timer(interval, self.start_heartbeat_timer, [interval]).start()

    def run(self):
        """Main run loop"""
        if not self.connect():
            return False
        
        try:
            # Start heartbeat timer
            self.start_heartbeat_timer(30)  # Send heartbeat every 30 seconds
            
            # Keep the script running
            while True:
                time.sleep(1)
                
        except KeyboardInterrupt:
            logger.info("Firmware updater stopped")
            self.client.loop_stop()
            self.client.disconnect()
        
        return True

def main():
    """Main entry point"""
    parser = argparse.ArgumentParser(description="Raspberry Pi Firmware Updater")
    parser.add_argument("--broker", default="localhost", help="MQTT broker hostname")
    parser.add_argument("--port", type=int, default=1883, help="MQTT broker port")
    parser.add_argument("--id", help="Device ID (default: auto-generated)")
    args = parser.parse_args()
    
    updater = FirmwareUpdater(
        broker_host=args.broker,
        broker_port=args.port,
        device_id=args.id
    )
    updater.run()

if __name__ == "__main__":
    main()
