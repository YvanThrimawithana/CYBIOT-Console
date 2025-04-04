"use client";

import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import { theme } from "../styles/theme";

const Login = () => {
    const navigate = useNavigate();
    const [username, setUsername] = useState("");
    const [password, setPassword] = useState("");
    const [isRegistering, setIsRegistering] = useState(false);

    const handleSubmit = async (e) => {
        e.preventDefault();
        try {
            const endpoint = isRegistering
                ? "http://localhost:5000/api/users/register"
                : "http://localhost:5000/api/users/login";

            const response = await fetch(endpoint, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ username, password }),
            });

            const data = await response.json();
            if (!response.ok) throw new Error(data.error || "Request failed");

            if (isRegistering) {
                alert("Registration successful! Please log in.");
                setIsRegistering(false);
            } else {
                localStorage.setItem("token", data.token);
                navigate("/dashboard");
            }
        } catch (error) {
            alert(error.message);
        }
    };

    const handleLogout = () => {
        localStorage.removeItem("token");
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
                        className="w-full p-3 rounded-lg font-medium transition-all"
                        style={{ 
                            background: theme.colors.primary.main,
                            color: theme.colors.text.primary
                        }}
                    >
                        {isRegistering ? "Register" : "Login"}
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
