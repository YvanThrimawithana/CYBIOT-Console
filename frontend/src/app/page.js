"use client";
import React, { useEffect, useState } from "react";
import { BrowserRouter as Router, Routes, Route, Navigate } from "react-router-dom";
import Navbar from "../components/Navbar";
import DeviceConsole from "../pages/DeviceConsole";
import Login from "../pages/Login";
import Dashboard from "../pages/DashBoard";
import TrafficLogs from "../pages/TrafficLogs";
import FirmwareManagement from "../pages/FirmwareManagement";
import "./globals.css";

const App = () => {
    const [isAuthenticated, setIsAuthenticated] = useState(false);

    useEffect(() => {
        const checkAuth = () => {
            const token = localStorage.getItem("token");
            setIsAuthenticated(!!token);
        };
        
        checkAuth();
        window.addEventListener("storage", checkAuth);
        return () => window.removeEventListener("storage", checkAuth);
    }, []);

    return (
        <Router>
            <div className="flex">
                {isAuthenticated && <Navbar />}
                <div className="flex-1">
                    <Routes>
                        <Route 
                            path="/login" 
                            element={
                                !isAuthenticated ? 
                                <Login setIsAuthenticated={setIsAuthenticated} /> : 
                                <Navigate to="/dashboard" />
                            } 
                        />
                        <Route 
                            path="/dashboard" 
                            element={
                                isAuthenticated ? 
                                <Dashboard /> : 
                                <Navigate to="/login" />
                            } 
                        />
                        <Route 
                            path="/device-console" 
                            element={
                                isAuthenticated ? 
                                <DeviceConsole /> : 
                                <Navigate to="/login" />
                            } 
                        />
                        <Route 
                            path="/logs" 
                            element={
                                isAuthenticated ? 
                                <TrafficLogs /> : 
                                <Navigate to="/login" />
                            } 
                        />
                        <Route 
                            path="/traffic/:ip" 
                            element={
                                isAuthenticated ? 
                                <TrafficLogs /> : 
                                <Navigate to="/login" />
                            } 
                        />
                        <Route 
                            path="/firmware-management" 
                            element={
                                isAuthenticated ? 
                                <FirmwareManagement /> : 
                                <Navigate to="/login" />
                            } 
                        />
                        <Route 
                            path="/" 
                            element={
                                <Navigate to={isAuthenticated ? "/dashboard" : "/login"} />
                            } 
                        />
                        <Route 
                            path="*" 
                            element={
                                <Navigate to={isAuthenticated ? "/dashboard" : "/login"} />
                            } 
                        />
                    </Routes>
                </div>
            </div>
        </Router>
    );
};

export default App;