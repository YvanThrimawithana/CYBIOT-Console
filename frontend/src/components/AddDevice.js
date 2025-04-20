"use client";

import React, { useState } from "react";
import { addDevice } from "../services/deviceService";
import Notification from "./Notification";
import { theme } from "../styles/theme";
import { MdAdd } from "react-icons/md";

const AddDevice = ({ onSuccess }) => {
    const [name, setName] = useState("");
    const [ip, setIp] = useState("");
    const [message, setMessage] = useState(null);
    const [isError, setIsError] = useState(false);
    const [isSubmitting, setIsSubmitting] = useState(false);

    const handleSubmit = async (e) => {
        e.preventDefault();
        setMessage(null);
        setIsError(false);
        setIsSubmitting(true);
        
        try {
            const response = await addDevice(name, ip);
            setMessage(response.message);
            setName("");
            setIp("");
            
            // Call onSuccess callback if provided
            if (onSuccess && typeof onSuccess === 'function') {
                onSuccess();
            }
        } catch (error) {
            setMessage(error.message || "Failed to add device.");
            setIsError(true);
        } finally {
            setIsSubmitting(false);
        }
    };

    return (
        <div className="rounded-lg shadow-lg p-6" style={{ background: theme.colors.background.surface }}>
            <h3 className="text-xl font-bold mb-4 flex items-center" style={{ color: theme.colors.primary.main }}>
                <MdAdd className="mr-2" />
                Add New Device
            </h3>

            {message && <Notification message={message} isError={isError} />}

            <form onSubmit={handleSubmit} className="space-y-4">
                <div>
                    <label 
                        htmlFor="deviceName" 
                        className="block mb-1 text-sm font-medium"
                        style={{ color: theme.colors.text.secondary }}
                    >
                        Device Name
                    </label>
                    <input
                        id="deviceName"
                        type="text"
                        value={name}
                        onChange={(e) => setName(e.target.value)}
                        placeholder="Enter device name"
                        required
                        className="w-full px-4 py-2 border rounded-lg focus:outline-none focus:ring-2"
                        style={{ 
                            backgroundColor: theme.colors.background.card,
                            color: theme.colors.text.primary,
                            borderColor: theme.colors.background.card
                        }}
                    />
                </div>

                <div>
                    <label 
                        htmlFor="deviceIp" 
                        className="block mb-1 text-sm font-medium"
                        style={{ color: theme.colors.text.secondary }}
                    >
                        IP Address
                    </label>
                    <input
                        id="deviceIp"
                        type="text"
                        value={ip}
                        onChange={(e) => setIp(e.target.value)}
                        placeholder="192.168.1.x"
                        required
                        pattern="^(?:[0-9]{1,3}\.){3}[0-9]{1,3}$"
                        title="Please enter a valid IPv4 address"
                        className="w-full px-4 py-2 border rounded-lg focus:outline-none focus:ring-2"
                        style={{ 
                            backgroundColor: theme.colors.background.card,
                            color: theme.colors.text.primary,
                            borderColor: theme.colors.background.card
                        }}
                    />
                    <p className="mt-1 text-xs" style={{ color: theme.colors.text.secondary }}>
                        Use format: 192.168.1.x
                    </p>
                </div>

                <button
                    type="submit"
                    disabled={isSubmitting}
                    className="w-full px-4 py-2 rounded-lg transition-colors flex items-center justify-center"
                    style={{
                        backgroundColor: theme.colors.primary.main,
                        color: theme.colors.text.primary,
                        opacity: isSubmitting ? 0.7 : 1
                    }}
                >
                    {isSubmitting ? 'Adding...' : 'Add Device'}
                </button>
            </form>
        </div>
    );
};

export default AddDevice;
