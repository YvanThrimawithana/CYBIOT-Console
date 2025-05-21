const DeviceModel = require('../models/deviceModel');
const FirmwareModel = require('../models/firmwareModel');
const UnregisteredDeviceModel = require('../models/unregisteredDeviceModel');
const { getInstance: getMqttHandler } = require('../mqtt/mqttHandler');

/**
 * Update or register a device via MQTT
 * Now with support for unregistered devices
 */
exports.updateOrRegisterDevice = async (deviceData) => {
    try {
        // Check if device exists by deviceId
        const deviceResult = await DeviceModel.getDeviceByDeviceId(deviceData.deviceId);
        
        // If device exists, just update it
        if (deviceResult.success) {
            const device = deviceResult.device;
            console.log(`Updating existing device: ${deviceData.deviceId}`);
            
            const updateData = {
                ipAddress: deviceData.ipAddress,
                status: deviceData.status,
                lastSeen: new Date(),
                'connectionDetails.lastConnected': new Date(),
                firmwareVersion: deviceData.firmwareVersion || device.firmwareVersion,
                updateScheduled: deviceData.updateScheduled,
                scheduledUpdateTime: deviceData.scheduledUpdateTime,
                metrics: deviceData.metrics || {}
            };
            
            const result = await DeviceModel.updateDevice(device._id, updateData);
            if (result.success) {
                return { success: true, device: result.device, isNew: false };
            } else {
                return { success: false, error: result.error };
            }
        } 
        
        // Device doesn't exist in registered devices
        // Instead of auto-registering, track it as an unregistered device
        console.log(`Device ${deviceData.deviceId} not registered, adding to unregistered devices`);
        
        // Update or create in the unregistered devices collection
        const unregisteredResult = await UnregisteredDeviceModel.updateOrCreateUnregisteredDevice({
            deviceId: deviceData.deviceId,
            ipAddress: deviceData.ipAddress,
            firmwareVersion: deviceData.firmwareVersion,
            metrics: deviceData.metrics || {}
        });
        
        if (unregisteredResult.success) {
            console.log(`Device ${deviceData.deviceId} added to unregistered devices`);
            return { 
                success: true, 
                device: unregisteredResult.device, 
                isNew: false, 
                isUnregistered: true 
            };
        } else {
            return { success: false, error: unregisteredResult.error };
        }    } catch (error) {
        console.error('Error updating/registering device:', error);
        return { success: false, error: error.message };
    }
};

/**
 * Register an unregistered device
 */
exports.registerUnregisteredDevice = async (deviceId, name) => {
    try {
        // Get the unregistered device data
        const unregisteredResult = await UnregisteredDeviceModel.getUnregisteredDeviceByDeviceId(deviceId);
        if (!unregisteredResult.success) {
            return { success: false, error: 'Unregistered device not found' };
        }
        
        const unregisteredDevice = unregisteredResult.device;
        
        // Create a new registered device
        const newDeviceData = {
            name: name || `Device ${deviceId.substring(0, 8)}`,
            deviceId: deviceId,
            description: 'Raspberry Pi IoT Device',
            deviceType: 'raspberrypi',
            ipAddress: unregisteredDevice.ipAddress,
            status: 'online',
            lastSeen: new Date(),
            connectionDetails: {
                lastConnected: new Date(),
                protocol: 'mqtt'
            },
            firmwareVersion: unregisteredDevice.firmwareVersion,
            metrics: unregisteredDevice.metrics || {}
        };
        
        const registrationResult = await DeviceModel.addDevice(newDeviceData);
        
        if (registrationResult.success) {
            // Remove from unregistered devices
            await UnregisteredDeviceModel.removeUnregisteredDevice(deviceId);
            
            return { 
                success: true, 
                device: registrationResult.device,
                message: 'Device registered successfully'
            };
        } else {
            return { success: false, error: registrationResult.error };
        }
    } catch (error) {
        console.error('Error registering unregistered device:', error);
        return { success: false, error: error.message };
    }
};

/**
 * Schedule a firmware update for a device
 */
exports.scheduleFirmwareUpdate = async (deviceId, scheduledTime, firmwareId) => {
    try {
        const device = await DeviceModel.getDeviceByDeviceId(deviceId);
        if (!device.success) {
            return { success: false, error: 'Device not found' };
        }

        // Get firmware details
        const firmware = await FirmwareModel.getFirmwareById(firmwareId);
        if (!firmware.success) {
            return { success: false, error: 'Firmware not found' };
        }

        // Send schedule command to device
        const mqttHandler = getMqttHandler();
        if (!mqttHandler) {
            return { success: false, error: 'MQTT handler not available' };
        }

        const scheduleCommand = {
            action: 'schedule_update',
            firmware_id: firmwareId,
            scheduled_time: scheduledTime
        };

        mqttHandler.client.publish(
            `cybiot/device/commands/${deviceId}`,
            JSON.stringify(scheduleCommand),
            { qos: 1 }
        );

        // Update device record
        await DeviceModel.updateDevice(deviceId, {
            updateScheduled: true,
            scheduledUpdateTime: new Date(scheduledTime * 1000),
            scheduledFirmwareId: firmwareId
        });

        return { 
            success: true, 
            message: 'Firmware update scheduled successfully',
            scheduledTime: new Date(scheduledTime * 1000)
        };
    } catch (error) {
        console.error('Error scheduling firmware update:', error);
        return { success: false, error: error.message };
    }
};

/**
 * Send firmware update to a device immediately
 */
exports.sendFirmwareNow = async (deviceId, firmwareId) => {
    try {
        const mqttHandler = getMqttHandler();
        if (!mqttHandler) {
            return { success: false, error: 'MQTT handler not available' };
        }

        await mqttHandler.sendFirmwareToDevice(deviceId, firmwareId);

        return { 
            success: true, 
            message: 'Firmware update sent successfully' 
        };
    } catch (error) {
        console.error('Error sending firmware update:', error);
        return { success: false, error: error.message };
    }
};