# CybIoT Platform

CybIoT is an IoT device management and security monitoring platform designed to help manage, monitor, and secure IoT devices on your network. This README provides instructions for setting up and running the platform.

## System Requirements

- Node.js (v16.x or higher)
- MongoDB (v5.x or higher)
- MQTT Broker (Mosquitto recommended)
- A modern web browser
- npm or yarn package manager

## Project Structure

The project consists of three main components:

- **Backend**: Express.js API server with MongoDB integration
- **Frontend**: Next.js web application 
- **RaspOS Scripts**: Scripts for IoT device management and firmware updates

## Installation

### 1. Clone the Repository

```bash
cd Project
```

### 2. Backend Setup

Navigate to the backend directory and install dependencies:

```bash
cd backend
npm install
```

Create a `.env` file in the backend directory with the following variables:

```
# Server Configuration
PORT=5000

# MongoDB Configuration
MONGO_URI=mongodb://localhost:27017/cybiot

# JWT Configuration
JWT_SECRET=your_secret_key_here

# Email Configuration (Optional - for alerts)
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_SECURE=false
SMTP_USER=your_email@gmail.com
SMTP_PASS=your_email_password
EMAIL_FROM=cybiot.alert@example.com
ADMIN_EMAIL=admin@example.com
```

### 3. MQTT Broker Setup

Install and configure Mosquitto MQTT broker:

#### On Windows:
```bash
# Download and install from: https://mosquitto.org/download/
# Start the service
net start mosquitto
```

#### On Linux:
```bash
sudo apt-get install mosquitto mosquitto-clients
sudo systemctl start mosquitto
```

#### Configure MQTT Handler

Open `backend/mqtt/mqttHandler.js` and update the MQTT broker address to match your local setup:

```javascript
// Change from
this.client = mqtt.connect('mqtt://localhost:1883');

// To your MQTT broker address if different
this.client = mqtt.connect('mqtt://<your-mqtt-broker-ip>:1883');
```

### 4. Frontend Setup

Navigate to the frontend directory and install dependencies:

```bash
cd ../frontend
npm install
```

## Running the Application

### 1. Start MongoDB

Ensure MongoDB is running:

```bash
# On Windows (if installed as a service)
net start mongodb

# On Linux
sudo systemctl start mongod
```

### 2. Start the Backend Server

```bash
cd backend
npm run dev
```

This will start the backend server on http://localhost:5000.

### 3. Start the Frontend Application

```bash
cd frontend
npm run dev
```

This will start the frontend application on http://localhost:3000.

## First Time Setup

When you first run the application, a default admin user will be created:

- Username: admin
- Password: admin123

**Important**: Change this password immediately after your first login.

## Feature Overview

- **Device Management**: Register, monitor, and manage IoT devices
- **Network Scanning**: Discover and monitor devices on your network
- **Firmware Updates**: Deploy firmware updates to IoT devices
- **Traffic Monitoring**: Monitor network traffic to detect anomalies
- **Alerts & Notifications**: Receive alerts for suspicious activities
- **User Management**: Manage platform users with role-based access control

## Device Integration

To connect devices to the platform, they need to:

1. Connect to the same MQTT broker as the platform
2. Send heartbeat messages on the topic `cybiot/device/heartbeat`
3. Listen for commands on the topic `cybiot/device/commands/{device_id}`
4. Handle firmware updates from `cybiot/device/firmware/{device_id}`

For Raspberry Pi or other Linux-based devices, use the provided scripts in the `raspOS_script/` directory:

```bash
cd raspOS_script
chmod +x install.sh
./install.sh
```

## Troubleshooting

### Backend Connection Issues

- Verify MongoDB is running: `mongo --eval "db.version()"`
- Check MQTT broker connection: `mosquitto_sub -t cybiot/# -v`
- Ensure the `.env` file is correctly configured

### Frontend Connection Issues

- Verify the backend server is running and accessible
- Check browser console for any CORS or connection errors
- Ensure you're accessing the correct URL (http://localhost:3000)

## Security Considerations

- Change the default admin credentials immediately
- Use a strong JWT_SECRET in the .env file
- Configure proper firewall rules for the MQTT broker
- Enable HTTPS for production deployments
