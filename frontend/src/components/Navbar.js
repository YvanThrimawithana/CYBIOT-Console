"use client";

import React, { useState, useEffect } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { 
    MdDashboard, 
    MdDevices, 
    MdTimeline, 
    MdLogout,
    MdSystemUpdate,
    MdExpandMore,
    MdExpandLess,
    MdNotifications
} from "react-icons/md";
import { RiShieldFill } from "react-icons/ri";
import { getAllSystemAlerts } from "../services/trafficService";

const Navbar = () => {
    const location = useLocation();
    const navigate = useNavigate();
    const [expandedMenu, setExpandedMenu] = useState('');
    const [activeAlertCount, setActiveAlertCount] = useState(0);

    useEffect(() => {
        // Traffic submenu should be expanded by default if on a traffic related page
        const trafficPages = ['/logs', '/alert-rules', '/offenses'];
        if (trafficPages.some(page => location.pathname === page)) {
            setExpandedMenu('traffic');
        }

        // Check for active alerts
        const checkAlerts = async () => {
            try {
                const response = await getAllSystemAlerts({ status: "NEW" });
                if (response.success) {
                    setActiveAlertCount(response.alerts.length);
                }
            } catch (error) {
                console.error("Error fetching alerts:", error);
            }
        };

        // Initial check
        checkAlerts();

        // Set up polling interval (every 30 seconds)
        const intervalId = setInterval(checkAlerts, 30000);
        return () => clearInterval(intervalId);
    }, [location.pathname]);

    const handleToggleMenu = (menu) => {
        setExpandedMenu(expandedMenu === menu ? '' : menu);
    };

    const navigationItems = [
        { path: '/dashboard', label: 'Dashboard', icon: <MdDashboard size={20} /> },
        { path: '/device-console', label: 'Devices', icon: <MdDevices size={20} /> },
        { 
            id: 'traffic',
            label: 'Traffic', 
            icon: <MdTimeline size={20} />,
            submenu: [
                { path: '/logs', label: 'Traffic Logs' },
                { path: '/alert-rules', label: 'Alert Rules' },
                { 
                    path: '/offenses', 
                    label: 'Offenses', 
                    badge: activeAlertCount > 0 ? activeAlertCount : null 
                }
            ]
        },
        { path: '/firmware-management', label: 'Firmware', icon: <MdSystemUpdate size={20} /> }
    ];

    const handleLogout = () => {
        localStorage.removeItem("token");
        window.dispatchEvent(new Event("storage"));
        navigate("/login");
    };

    const isActive = (path) => {
        if (path === location.pathname) return true;
        // Check if any submenu item is active
        for (const item of navigationItems) {
            if (item.submenu && item.submenu.some(subItem => subItem.path === location.pathname)) {
                if (item.id === expandedMenu) return true;
            }
        }
        return false;
    };

    return (
        <div className="flex min-h-screen bg-background-surface">
            {/* Sidebar Navigation */}
            <div className="w-64 fixed left-0 top-0 h-screen p-4 flex flex-col border-r border-gray-800">
                <div className="mb-8 p-4">
                    <h1 className="text-xl font-bold text-primary-main">CYBIOT - SecureIOT</h1>
                </div>

                <nav className="flex-1">
                    {navigationItems.map((item) => (
                        <div key={item.path || item.id}>
                            {item.submenu ? (
                                <>
                                    <button
                                        onClick={() => handleToggleMenu(item.id)}
                                        className={`flex items-center justify-between gap-3 p-3 rounded-md mb-2 w-full transition-colors
                                            ${isActive(item.path)
                                                ? 'bg-primary-main text-white' 
                                                : 'text-text-secondary hover:bg-background-card'}`}
                                    >
                                        <div className="flex items-center gap-3">
                                            {item.icon}
                                            <span>{item.label}</span>
                                            {/* Show overall badge for active alerts */}
                                            {activeAlertCount > 0 && item.id === 'traffic' && (
                                                <span className="bg-red-500 text-white text-xs px-1.5 py-0.5 rounded-full">
                                                    {activeAlertCount}
                                                </span>
                                            )}
                                        </div>
                                        {expandedMenu === item.id ? <MdExpandLess /> : <MdExpandMore />}
                                    </button>
                                    {expandedMenu === item.id && (
                                        <div className="ml-8 mb-2 space-y-1">
                                            {item.submenu.map(subItem => (
                                                <Link
                                                    key={subItem.path}
                                                    to={subItem.path}
                                                    className={`flex items-center justify-between gap-3 p-2 rounded-md transition-colors
                                                        ${location.pathname === subItem.path 
                                                            ? 'bg-primary-main/20 text-primary-main' 
                                                            : 'text-text-secondary hover:bg-background-card'}`}
                                                >
                                                    <span>{subItem.label}</span>
                                                    {/* Show badge for each submenu item */}
                                                    {subItem.badge && (
                                                        <span className="bg-red-500 text-white text-xs px-1.5 py-0.5 rounded-full">
                                                            {subItem.badge}
                                                        </span>
                                                    )}
                                                </Link>
                                            ))}
                                        </div>
                                    )}
                                </>
                            ) : (
                                <Link
                                    to={item.path}
                                    className={`flex items-center gap-3 p-3 rounded-md mb-2 transition-colors
                                        ${location.pathname === item.path 
                                            ? 'bg-primary-main text-white' 
                                            : 'text-text-secondary hover:bg-background-card'}`}
                                >
                                    {item.icon}
                                    <span>{item.label}</span>
                                </Link>
                            )}
                        </div>
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
