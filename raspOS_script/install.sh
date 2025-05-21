#!/bin/bash
# CybIOT Firmware Updater Installation Script
# This script installs the firmware updater service on a Raspberry Pi

echo "Installing CybIOT Firmware Updater..."

# Create directory structure
INSTALL_DIR="/home/pi/cybiot"
mkdir -p $INSTALL_DIR
mkdir -p $INSTALL_DIR/firmware

# Install required packages
echo "Installing dependencies..."
sudo apt-get update
sudo apt-get install -y python3-pip mosquitto-clients

# Install Python requirements
echo "Installing Python packages..."
pip3 install paho-mqtt

# Copy files to installation directory
echo "Copying files..."
cp firmware_updater.py $INSTALL_DIR/
chmod +x $INSTALL_DIR/firmware_updater.py

# Create version file (if it doesn't exist)
if [ ! -f "$INSTALL_DIR/version.txt" ]; then
    echo "1.0.0" > $INSTALL_DIR/version.txt
fi

# Install systemd service
echo "Installing service..."
cp cybiot-updater.service /tmp/
# Replace broker IP with the correct one if provided
if [ ! -z "$1" ]; then
    sed -i "s/192.168.1.7/$1/g" /tmp/cybiot-updater.service
fi
sudo cp /tmp/cybiot-updater.service /etc/systemd/system/
sudo systemctl daemon-reload
sudo systemctl enable cybiot-updater.service
sudo systemctl start cybiot-updater.service

echo "Installation complete!"
echo "The service is now running and will automatically start on boot"
echo "To check service status: sudo systemctl status cybiot-updater"
