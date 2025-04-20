"use client";

import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import { theme } from "../styles/theme";

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
            }

            if (isRegistering) {
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
                
                setIsAuthenticated(true);
                // Force a page reload to ensure all components pick up the new auth state
                window.location.href = '/dashboard';
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
            style={{ background: theme.colors.background.main }}>
            <div className="max-w-md w-full p-8 rounded-lg shadow-xl" 
                style={{ background: theme.colors.background.surface }}>
                <h2 className="text-2xl font-bold mb-6 text-center" 
                    style={{ color: theme.colors.primary.main }}>
                    {isRegistering ? "Create Account" : "Welcome Back"}
                </h2>
                
                {error && (
                    <div className="mb-4 p-2 bg-red-100 border border-red-400 text-red-700 rounded">
                        {error}
                    </div>
                )}
                
                <form onSubmit={handleSubmit} className="space-y-6">
                    <div>
                        <input
                            type="text"
                            placeholder="Username"
                            value={username}
                            onChange={(e) => setUsername(e.target.value)}
                            className="w-full p-3 rounded-lg focus:ring-2 transition-all"
                            style={{ 
                                background: theme.colors.background.card,
                                color: theme.colors.text.primary,
                                borderColor: theme.colors.background.card
                            }}
                        />
                    </div>
                    <div>
                        <input
                            type="password"
                            placeholder="Password"
                            value={password}
                            onChange={(e) => setPassword(e.target.value)}
                            className="w-full p-3 rounded-lg focus:ring-2 transition-all"
                            style={{ 
                                background: theme.colors.background.card,
                                color: theme.colors.text.primary,
                                borderColor: theme.colors.background.card
                            }}
                        />
                    </div>
                    <button
                        type="submit"
                        disabled={isLoading}
                        className="w-full p-3 rounded-lg font-medium transition-all"
                        style={{ 
                            background: theme.colors.primary.main,
                            color: theme.colors.text.primary,
                            opacity: isLoading ? 0.7 : 1
                        }}
                    >
                        {isLoading 
                            ? "Processing..." 
                            : isRegistering ? "Register" : "Login"
                        }
                    </button>
                </form>

                <button
                    onClick={() => setIsRegistering(!isRegistering)}
                    className="w-full mt-4 text-sm"
                    style={{ color: theme.colors.text.secondary }}
                >
                    {isRegistering ? "Already have an account? Login" : "Need an account? Register"}
                </button>
                <button
                    onClick={handleLogout}
                    className="w-full px-4 py-3 mt-6 bg-red-600 hover:bg-red-500 text-white font-semibold rounded-lg shadow-md transition-all duration-300 text-center"
                >
                    Logout
                </button>
            </div>
        </div>
    );
};

export default Login;
