"use client";

import React from "react";
const Notification = ({ message, isError }) => {
    return (
        <div style={{ padding: "10px", color: isError ? "red" : "green" }}>
            {message}
        </div>
    );
};
export default Notification;