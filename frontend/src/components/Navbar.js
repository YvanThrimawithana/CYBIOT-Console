"use client";

import React from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { 
    MdDashboard, 
    MdDevices, 
    MdTimeline, 
    MdLogout,
    MdSystemUpdate // Add this import
} from "react-icons/md";

const Navbar = () => {
    const location = useLocation();
    const navigate = useNavigate();

    const navigationItems = [
        { path: '/dashboard', label: 'Dashboard', icon: <MdDashboard size={20} /> },
        { path: '/device-console', label: 'Devices', icon: <MdDevices size={20} /> },
        { path: '/logs', label: 'Traffic', icon: <MdTimeline size={20} /> },
        { path: '/firmware-management', label: 'Firmware', icon: <MdSystemUpdate size={20} /> }
    ];

    const handleLogout = () => {
        localStorage.removeItem("token");
        window.dispatchEvent(new Event("storage"));
        navigate("/login");
    };

    return (
        <div className="flex min-h-screen bg-background-surface">
            {/* Sidebar Navigation */}
            <div className="w-64 fixed left-0 top-0 h-screen p-4 flex flex-col border-r border-gray-800">
                <div className="mb-8 p-4">
                    <h1 className="text-xl font-bold text-primary-main">NetTraffic Monitor</h1>
                </div>

                <nav className="flex-1">
                    {navigationItems.map((item) => (
                        <Link
                            key={item.path}
                            to={item.path}
                            className={`flex items-center gap-3 p-3 rounded-md mb-2 transition-colors
                                ${location.pathname === item.path 
                                    ? 'bg-primary-main text-white' 
                                    : 'text-text-secondary hover:bg-background-card'}`}
                        >
                            {item.icon}
                            <span>{item.label}</span>
                        </Link>
                    ))}
                </nav>

                <button
                    onClick={handleLogout}
                    className="flex items-center gap-3 p-3 text-error hover:bg-error/10 rounded-md transition-colors"
                >
                    <MdLogout />
                    <span>Logout</span>
                </button>
            </div>

            {/* Main Content Area */}
            <div className="flex-1 ml-64 p-0">
                {/* Page content will be rendered here */}
            </div>
        </div>
    );
};

export default Navbar;
