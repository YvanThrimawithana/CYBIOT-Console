"use client";

import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import { theme } from "../styles/theme";
import { MdLock, MdPerson } from "react-icons/md";

const Login = ({ setIsAuthenticated }) => {
    const navigate = useNavigate();
    const [username, setUsername] = useState("");
    const [password, setPassword] = useState("");
    const [isRegistering, setIsRegistering] = useState(false);
    const [error, setError] = useState("");
    const [isLoading, setIsLoading] = useState(false);

    const handleSubmit = async (e) => {
        e.preventDefault();
        setError("");
        setIsLoading(true);
        
        try {
            const endpoint = isRegistering
                ? "http://localhost:5000/api/users/register"
                : "http://localhost:5000/api/users/login";

            console.log(`Sending request to ${endpoint} for user: ${username}`);
            
            const response = await fetch(endpoint, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ username, password }),
            });

            const data = await response.json();
            
            if (!response.ok) {
                throw new Error(data.error || `Request failed with status ${response.status}`);
            }            if (isRegistering) {
                console.log("Registration successful");
                alert("Registration successful! Please log in.");
                setIsRegistering(false);
            } else {
                console.log("Login successful");
                  // Store all tokens and user info
                localStorage.setItem("token", data.token);
                localStorage.setItem("refreshToken", data.refreshToken);
                localStorage.setItem("userId", data.userId);
                localStorage.setItem("username", data.username);
                localStorage.setItem("role", data.role);
                  // First store all authentication data
                localStorage.setItem("token", data.token);
                localStorage.setItem("refreshToken", data.refreshToken);
                localStorage.setItem("userId", data.userId);
                localStorage.setItem("username", data.username);
                localStorage.setItem("role", data.role);
                
                // Then set authenticated state
                setIsAuthenticated(true);
                
                // Navigate without timeout to prevent race conditions
                navigate('/dashboard');
            }
        } catch (error) {
            console.error("Auth error:", error);
            setError(error.message);
        } finally {
            setIsLoading(false);
        }
    };

    const handleLogout = () => {
        localStorage.removeItem("token");
        localStorage.removeItem("refreshToken");
        localStorage.removeItem("userId");
        localStorage.removeItem("username");
        localStorage.removeItem("role");
        setIsAuthenticated(false);
        alert("Logged out successfully");
        window.location.href = "/login";
    };

    return (
        <div className="min-h-screen flex items-center justify-center px-4" 
            style={{ 
                background: `linear-gradient(135deg, ${theme.colors.background.main}, ${theme.colors.background.surface})`,
                backgroundSize: 'cover'
            }}>
            <div className="max-w-md w-full p-8 rounded-lg shadow-xl border border-gray-700" 
                style={{ background: `rgba(${parseInt(theme.colors.background.surface.slice(1, 3), 16)}, 
                                            ${parseInt(theme.colors.background.surface.slice(3, 5), 16)}, 
                                            ${parseInt(theme.colors.background.surface.slice(5, 7), 16)}, 0.85)`,
                         backdropFilter: 'blur(10px)' }}>
                
                {/* Logo Section */}
                <div className="flex justify-center mb-8">
                    <img 
                        src="/cybiot-logo.png" 
                        alt="CYBIOT Logo" 
                        className="max-h-24 w-auto"
                    />
                </div>
                
                <h2 className="text-2xl font-bold mb-6 text-center" 
                    style={{ color: theme.colors.primary.main }}>
                    {isRegistering ? "Create Secure Account" : "Secure Login"}
                </h2>
                
                <p className="text-center mb-6" style={{ color: theme.colors.text.secondary }}>
                    {isRegistering 
                        ? "Register to access IoT security dashboard" 
                        : "Enter your credentials to access your IoT security dashboard"}
                </p>
                
                {error && (
                    <div className="mb-4 p-3 bg-red-100 border border-red-400 text-red-700 rounded flex items-center">
                        <svg className="w-5 h-5 mr-2" fill="currentColor" viewBox="0 0 20 20">
                            <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
                        </svg>
                        {error}
                    </div>
                )}
                
                <form onSubmit={handleSubmit} className="space-y-6">
                    <div className="relative">
                        <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                            <MdPerson size={20} color={theme.colors.text.secondary} />
                        </div>
                        <input
                            type="text"
                            placeholder="Username"
                            value={username}
                            onChange={(e) => setUsername(e.target.value)}
                            className="w-full pl-10 p-3 rounded-lg focus:ring-2 transition-all"
                            style={{ 
                                background: theme.colors.background.card,
                                color: theme.colors.text.primary,
                                borderColor: theme.colors.background.card
                            }}
                            required
                        />
                    </div>
                    
                    <div className="relative">
                        <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                            <MdLock size={20} color={theme.colors.text.secondary} />
                        </div>
                        <input
                            type="password"
                            placeholder="Password"
                            value={password}
                            onChange={(e) => setPassword(e.target.value)}
                            className="w-full pl-10 p-3 rounded-lg focus:ring-2 transition-all"
                            style={{ 
                                background: theme.colors.background.card,
                                color: theme.colors.text.primary,
                                borderColor: theme.colors.background.card
                            }}
                            required
                        />
                    </div>
                    
                    {!isRegistering && (
                        <div className="flex justify-end">
                            <a href="#" className="text-sm" style={{ color: theme.colors.primary.main }}>
                                Forgot password?
                            </a>
                        </div>
                    )}
                    
                    <button
                        type="submit"
                        disabled={isLoading}
                        className="w-full p-3 rounded-lg font-medium transition-all shadow-md hover:shadow-lg"
                        style={{ 
                            background: theme.colors.primary.main,
                            color: "#FFFFFF",
                            opacity: isLoading ? 0.7 : 1
                        }}
                    >
                        {isLoading 
                            ? "Processing..." 
                            : isRegistering ? "Create Account" : "Sign In"
                        }
                    </button>
                </form>

                <div className="mt-6 text-center">
                    <button
                        onClick={() => setIsRegistering(!isRegistering)}
                        className="text-sm hover:underline"
                        style={{ color: theme.colors.primary.main }}
                    >
                        {isRegistering ? "Already have an account? Sign In" : "Need an account? Register Now"}
                    </button>
                </div>
                
                {/* Remove the logout button from login page as it's not needed here */}
                
                <div className="mt-8 pt-4 border-t text-center text-xs" style={{ color: theme.colors.text.secondary, borderColor: theme.colors.background.card }}>
                    CYBIOT Secure IoT Platform © {new Date().getFullYear()} | All Rights Reserved
                </div>
            </div>
        </div>
    );
};

export default Login;
