import React, { useState, useEffect } from "react";
import { RiAlertFill, RiCloseLine } from "react-icons/ri";

/**
 * Reusable error message component with auto-dismiss option
 * @param {Object} props Component props
 * @param {string} props.message - Error message to display
 * @param {function} props.onDismiss - Callback function when error is dismissed
 * @param {boolean} props.autoDismiss - If true, automatically dismisses after timeout
 * @param {number} props.timeout - Time in milliseconds before auto-dismissal (default: 5000)
 * @param {string} props.type - Type of message: "error", "warning", "info", or "success" (default: "error")
 */
const ErrorMessage = ({
  message,
  onDismiss,
  autoDismiss = false,
  timeout = 5000,
  type = "error"
}) => {
  // Auto-dismiss timer
  const [visible, setVisible] = useState(true);
  
  useEffect(() => {
    if (autoDismiss && message) {
      const timer = setTimeout(() => {
        setVisible(false);
        if (onDismiss) onDismiss();
      }, timeout);
      
      return () => clearTimeout(timer);
    }
  }, [message, autoDismiss, timeout, onDismiss]);
  
  // If no message or not visible, don't render
  if (!message || !visible) {
    return null;
  }
  
  // Styling based on message type
  const typeStyles = {
    error: {
      bg: "bg-red-900/50",
      border: "border-red-700",
      icon: <RiAlertFill className="text-red-400 text-xl mr-2" />,
      iconColor: "text-red-400",
      hoverColor: "hover:text-red-300"
    },
    warning: {
      bg: "bg-yellow-900/50",
      border: "border-yellow-700",
      icon: <RiAlertFill className="text-yellow-400 text-xl mr-2" />,
      iconColor: "text-yellow-400",
      hoverColor: "hover:text-yellow-300"
    },
    info: {
      bg: "bg-blue-900/50",
      border: "border-blue-700",
      icon: <RiAlertFill className="text-blue-400 text-xl mr-2" />,
      iconColor: "text-blue-400",
      hoverColor: "hover:text-blue-300"
    },
    success: {
      bg: "bg-green-900/50",
      border: "border-green-700",
      icon: <RiAlertFill className="text-green-400 text-xl mr-2" />,
      iconColor: "text-green-400",
      hoverColor: "hover:text-green-300"
    }
  };
  
  const style = typeStyles[type] || typeStyles.error;
  
  const handleDismiss = () => {
    setVisible(false);
    if (onDismiss) onDismiss();
  };
  
  return (
    <div className={`${style.bg} border ${style.border} text-white p-4 rounded-lg mb-4 relative`}>
      <div className="flex items-center">
        {style.icon}
        <div className="flex-1">{message}</div>
        <button
          onClick={handleDismiss}
          className={`${style.iconColor} ${style.hoverColor} ml-2`}
          aria-label="Dismiss"
        >
          <RiCloseLine size={20} />
        </button>
      </div>
      {autoDismiss && (
        <div className="mt-2 h-1 w-full bg-gray-700 rounded-full overflow-hidden">
          <div
            className={`${style.iconColor} h-1`}
            style={{
              width: "100%",
              animation: `shrink ${timeout / 1000}s linear forwards`
            }}
          />
        </div>
      )}
      <style jsx>{`
        @keyframes shrink {
          0% { width: 100%; }
          100% { width: 0%; }
        }
      `}</style>
    </div>
  );
};

export default ErrorMessage;