# Firmware OTA Update System

This document explains the OTA (Over-The-Air) firmware update system for CybIOT devices, particularly focusing on Raspberry Pi Zero 2W devices.

## Overview

The firmware update system allows administrators to schedule and deploy firmware updates to IoT devices in the network. The system supports:

1. Scheduling updates for specific times to minimize disruption
2. Immediate updates for critical patches
3. Secure delivery of firmware via MQTT
4. Verification of firmware integrity using SHA-256 hashes
5. Automatic rollback in case of update failures

## System Components

### Backend

The backend system consists of several components:

1. **Firmware Controller**: Manages firmware files, versions, and analysis
2. **Device MQTT Controller**: Handles device registration and update scheduling
3. **MQTT Handler**: Facilitates communication with devices over MQTT

### Device Agent

The Raspberry Pi devices run a Python agent that:

1. Connects to the MQTT broker
2. Sends regular heartbeats
3. Listens for firmware update commands
4. Downloads and applies updates at scheduled times
5. Reports update status back to the server

## Update Flow

1. **Upload & Analysis**: Admin uploads firmware to CybIOT platform where it's analyzed for security issues
2. **Schedule**: Admin schedules an update for a specific device or group of devices
3. **Notification**: The backend notifies devices of the pending update via MQTT
4. **Download**: Devices download the firmware package
5. **Verification**: Devices verify the firmware integrity using SHA-256 hash
6. **Installation**: At the scheduled time, devices install the firmware
7. **Status Report**: Devices report success/failure back to the platform

## API Endpoints

### Schedule Firmware Update

```http
POST /api/device-firmware/devices/:deviceId/firmware/schedule
{
  "scheduledTime": "2023-05-25T15:30:00Z",  // ISO date string or Unix timestamp
  "firmwareId": "6123456789abcdef12345678"  // Optional, uses latest if not specified
}
```

### Send Immediate Update

```http
POST /api/device-firmware/devices/:deviceId/firmware/update
{
  "firmwareId": "6123456789abcdef12345678"  // Optional, uses latest if not specified
}
```

### Get Available Firmware

```http
GET /api/device-firmware/devices/:deviceId/firmware
```

## MQTT Topics

- **Heartbeat**: `cybiot/device/heartbeat`
- **Commands**: `cybiot/device/commands/{device_id}`
- **Firmware**: `cybiot/device/firmware/{device_id}`

## Installation on Raspberry Pi

1. Copy the installation files to the Raspberry Pi
2. Run the installation script: `./install.sh {broker_ip}`
3. The service will start automatically and connect to the MQTT broker

## Security Considerations

- Firmware packages are verified using SHA-256 hashes
- All communication between devices and server is authenticated
- Firmware binary is encrypted during transmission
- Only authorized administrators can schedule updates

## Troubleshooting

### Device Not Receiving Updates
- Check MQTT broker connectivity
- Verify device is sending heartbeats
- Check device ID is correctly registered

### Update Failed
- Check logs at `/home/pi/cybiot/firmware_updater.log`
- Verify firmware hash matches the expected value
- Check for sufficient disk space
- Check permissions on firmware directories