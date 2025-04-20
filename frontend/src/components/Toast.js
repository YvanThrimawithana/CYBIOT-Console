import React, { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { RiCheckLine, RiErrorWarningLine, RiInformationLine, RiAlertLine, RiCloseLine } from 'react-icons/ri';
import { TOAST_TYPES } from '../contexts/ToastContext';

/**
 * Toast notification component
 * @param {Object} props Component props
 * @param {string} props.id - Unique ID for the toast
 * @param {string} props.message - The message to display
 * @param {string} props.type - The type of toast (success, error, info, warning)
 * @param {number} props.duration - How long to display the toast (ms)
 * @param {function} props.onClose - Function to call when toast is closed
 */
const Toast = ({ id, message, type = TOAST_TYPES.INFO, duration = 5000, onClose }) => {
  const [progress, setProgress] = useState(100);
  const [isVisible, setIsVisible] = useState(true);
  const [isPaused, setIsPaused] = useState(false);

  // Configure based on type
  const config = {
    [TOAST_TYPES.SUCCESS]: {
      icon: <RiCheckLine className="text-xl" />,
      bgColor: 'bg-green-700/90',
      progressColor: 'bg-green-500',
      borderColor: 'border-green-500'
    },
    [TOAST_TYPES.ERROR]: {
      icon: <RiErrorWarningLine className="text-xl" />,
      bgColor: 'bg-red-700/90',
      progressColor: 'bg-red-500',
      borderColor: 'border-red-500'
    },
    [TOAST_TYPES.WARNING]: {
      icon: <RiAlertLine className="text-xl" />,
      bgColor: 'bg-yellow-700/90', 
      progressColor: 'bg-yellow-500',
      borderColor: 'border-yellow-500'
    },
    [TOAST_TYPES.INFO]: {
      icon: <RiInformationLine className="text-xl" />,
      bgColor: 'bg-blue-700/90',
      progressColor: 'bg-blue-500',
      borderColor: 'border-blue-500'
    }
  };

  const { icon, bgColor, progressColor, borderColor } = config[type] || config[TOAST_TYPES.INFO];

  // Timer for progress bar
  useEffect(() => {
    if (duration === Infinity || isPaused) return;

    const interval = setInterval(() => {
      setProgress((prev) => {
        const newProgress = prev - (100 / (duration / 100));
        if (newProgress <= 0) {
          clearInterval(interval);
          setIsVisible(false);
          setTimeout(() => onClose?.(id), 300);
          return 0;
        }
        return newProgress;
      });
    }, 100);

    return () => clearInterval(interval);
  }, [duration, id, onClose, isPaused]);

  // Handle close
  const handleClose = () => {
    setIsVisible(false);
    setTimeout(() => onClose?.(id), 300);
  };

  return (
    <AnimatePresence>
      {isVisible && (
        <motion.div
          initial={{ opacity: 0, y: -20, scale: 0.9 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: -20, scale: 0.9 }}
          transition={{ duration: 0.2 }}
          className={`mb-2 pointer-events-auto max-w-md w-full ${bgColor} rounded-lg shadow-lg border-l-4 ${borderColor} overflow-hidden`}
          onMouseEnter={() => setIsPaused(true)}
          onMouseLeave={() => setIsPaused(false)}
        >
          <div className="p-4 flex">
            <div className="flex-shrink-0 text-white mr-3">{icon}</div>
            <div className="flex-grow text-white text-sm">{message}</div>
            <button
              onClick={handleClose}
              className="flex-shrink-0 text-white hover:text-gray-300 transition-colors"
              aria-label="Close"
            >
              <RiCloseLine className="text-xl" />
            </button>
          </div>
          {duration !== Infinity && (
            <div className="h-1 w-full bg-gray-800">
              <div
                className={`h-full ${progressColor} transition-all duration-75 ease-linear`}
                style={{ width: `${progress}%` }}
              />
            </div>
          )}
        </motion.div>
      )}
    </AnimatePresence>
  );
};

/**
 * Toast Container component to display all toast notifications
 * @param {Object} props Component props
 * @param {Array} props.toasts - Array of toast objects to display
 * @param {function} props.removeToast - Function to remove a toast
 */
export const ToastContainer = ({ toasts, removeToast }) => {
  if (!toasts.length) return null;

  return (
    <div className="fixed top-4 right-4 z-50 flex flex-col items-end pointer-events-none">
      <AnimatePresence>
        {toasts.map((toast) => (
          <Toast
            key={toast.id}
            id={toast.id}
            message={toast.message}
            type={toast.type}
            duration={toast.duration}
            onClose={removeToast}
          />
        ))}
      </AnimatePresence>
    </div>
  );
};

export default Toast;