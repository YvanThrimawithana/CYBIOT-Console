"use client";

import React from "react";
import AddDevice from "../components/AddDevice";
import DeviceList from "../components/DeviceList";
import { theme } from "../styles/theme";

const DeviceConsole = () => {
    return (
        <div className="p-8" style={{ background: theme.colors.background.main }}>
            <div className="max-w-7xl mx-auto">
                <h1 className="text-3xl font-bold mb-8" style={{ color: theme.colors.text.primary }}>
                    Device Management
                </h1>
                
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                    <div className="lg:col-span-1">
                        <AddDevice />
                    </div>
                    
                    <div className="lg:col-span-2">
                        <DeviceList />
                    </div>
                </div>
            </div>
        </div>
    );
};

export default DeviceConsole;
