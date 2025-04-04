"use client";

import React, { useState } from "react";
import { addDevice } from "../services/deviceService";
import Notification from "./Notification";

const AddDevice = () => {
    const [name, setName] = useState("");
    const [ip, setIp] = useState("");
    const [message, setMessage] = useState(null);
    const [isError, setIsError] = useState(false);

    const handleSubmit = async (e) => {
        e.preventDefault();
        setMessage(null);
        setIsError(false);
        try {
            const response = await addDevice(name, ip);
            setMessage(response.message);
            setName("");
            setIp("");
        } catch (error) {
            setMessage(error.message || "Failed to add device.");
            setIsError(true);
        }
    };

    return (
        <div className="bg-gray-800 text-white p-6 rounded-lg shadow-lg">
            <h3 className="text-xl font-bold text-blue-300 mb-4 text-center">Add New Device</h3>

            {message && <Notification message={message} isError={isError} />}

            <form onSubmit={handleSubmit} className="flex flex-col space-y-4">
                <input 
                    type="text" 
                    placeholder="Device Name" 
                    value={name} 
                    onChange={(e) => setName(e.target.value)}
                    className="w-full px-4 py-2 bg-gray-700 text-white border border-gray-600 rounded-lg focus:outline-none focus:border-blue-400"
                />

                <input 
                    type="text" 
                    placeholder="IP Address" 
                    value={ip} 
                    onChange={(e) => setIp(e.target.value)}
                    className="w-full px-4 py-2 bg-gray-700 text-white border border-gray-600 rounded-lg focus:outline-none focus:border-blue-400"
                />

                <button 
                    type="submit" 
                    className="w-full px-4 py-2 bg-blue-500 hover:bg-blue-600 text-white font-semibold rounded-lg shadow-md transition-all duration-300"
                >
                    Add Device
                </button>
            </form>
        </div>
    );
};

export default AddDevice;
