"use client";
import React, { useEffect, useState } from "react";
import { BrowserRouter as Router, Routes, Route, Navigate } from "react-router-dom";
import { QueryClientProvider } from '@tanstack/react-query';
import { queryClient } from '../lib/queryClient';
import Navbar from "../components/Navbar";
import DeviceConsole from "../pages/DeviceConsole";
import Login from "../pages/Login";
import Dashboard from "../pages/DashBoard";
import TrafficLogs from "../pages/TrafficLogs";
import FirmwareManagement from "../pages/FirmwareManagement";
import FirmwareProfile from "../pages/FirmwareProfile";
import "./globals.css";

const App = () => {
    const [isAuthenticated, setIsAuthenticated] = useState(false);
    const [isLoading, setIsLoading] = useState(true);

    useEffect(() => {
        const checkAuth = () => {
            const token = localStorage.getItem("token");
            setIsAuthenticated(!!token);
            setIsLoading(false);
        };
        
        checkAuth();
        window.addEventListener("storage", checkAuth);
        return () => window.removeEventListener("storage", checkAuth);
    }, []);

    if (isLoading) {
        return <div>Loading...</div>;
    }

    return (
        <QueryClientProvider client={queryClient}>
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
                                path="/firmware/:id" 
                                element={
                                    isAuthenticated ? 
                                    <FirmwareProfile /> : 
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
        </QueryClientProvider>
    );
};

export default App;