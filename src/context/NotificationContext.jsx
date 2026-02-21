import { createContext, useContext, useState, useEffect, useCallback, useRef } from 'react';
import { Bell, CheckCircle, AlertTriangle, X } from 'lucide-react';

// Import your alert sound
import alertSound from '../assets/alert.wav';

const NotificationContext = createContext();

export function NotificationProvider({ children }) {
  const [notifications, setNotifications] = useState([]);
  const [permission, setPermission] = useState('default');
  const [isSupported, setIsSupported] = useState(false);
  const [soundEnabled, setSoundEnabled] = useState(true);
  
  // Audio ref for playing sounds
  const audioRef = useRef(new Audio(alertSound));

  // Check browser support
  useEffect(() => {
    setIsSupported('Notification' in window && 'serviceWorker' in navigator);
    if ('Notification' in window) {
      setPermission(Notification.permission);
    }
    
    // Preload audio
    audioRef.current.load();
  }, []);

  // Request browser notification permission
  const requestPermission = useCallback(async () => {
    if (!isSupported) return false;
    
    try {
      const result = await Notification.requestPermission();
      setPermission(result);
      return result === 'granted';
    } catch (error) {
      console.error('Error requesting notification permission:', error);
      return false;
    }
  }, [isSupported]);

  // Play notification sound
  const playSound = useCallback((type = 'default') => {
    if (!soundEnabled) return;
    
    try {
      const audio = audioRef.current;
      audio.currentTime = 0; // Reset to start
      
      // Adjust volume based on notification type
      switch (type) {
        case 'urgent':
        case 'red':
          audio.volume = 1.0; // Full volume for urgent
          break;
        case 'warning':
        case 'yellow':
          audio.volume = 0.7; // Medium volume for warning
          break;
        case 'success':
        case 'green':
          audio.volume = 0.5; // Lower volume for success
          break;
        default:
          audio.volume = 0.6;
      }
      
      // Play sound (handle autoplay restrictions)
      const playPromise = audio.play();
      if (playPromise !== undefined) {
        playPromise.catch(err => {
          console.log('Audio play failed (likely autoplay restriction):', err);
        });
      }
    } catch (error) {
      console.error('Error playing sound:', error);
    }
  }, [soundEnabled]);

  // Show browser notification
  const showBrowserNotification = useCallback((title, options = {}) => {
    if (permission !== 'granted') return;

    if ('serviceWorker' in navigator && navigator.serviceWorker.ready) {
      navigator.serviceWorker.ready.then(registration => {
        registration.showNotification(title, {
          icon: '/logo192.png',
          badge: '/logo192.png',
          ...options,
        });
      });
    } else {
      new Notification(title, options);
    }
  }, [permission]);

  // Add in-app toast notification with sound
  const addToast = useCallback((message, type = 'info', duration = 5000) => {
    const id = Date.now() + Math.random();
    const newNotification = {
      id,
      message,
      type,
      timestamp: new Date(),
    };

    setNotifications(prev => [...prev, newNotification]);

    // Play sound based on notification type
    playSound(type);

    if (duration > 0) {
      setTimeout(() => {
        removeToast(id);
      }, duration);
    }

    return id;
  }, [playSound]);

  // Remove toast notification
  const removeToast = useCallback((id) => {
    setNotifications(prev => prev.filter(n => n.id !== id));
  }, []);

  // Send notification (both browser and in-app with sound)
  const notify = useCallback((title, options = {}) => {
    const { body, type = 'info', duration = 5000, data = {} } = options;
    
    // In-app toast with sound
    addToast(body || title, type, duration);
    
    // Browser notification
    showBrowserNotification(title, {
      body,
      data,
      tag: data.assignmentId || 'general',
      requireInteraction: type === 'urgent',
    });
  }, [addToast, showBrowserNotification]);

  // Specific notification types for your IoT app with sounds
  const notifyDeadline = useCallback((assignment, phase) => {
    const titles = {
      green: `🟢 Start Working: ${assignment.subject}`,
      yellow: `🟡 Deadline Approaching: ${assignment.subject}`,
      red: `🔴 URGENT: ${assignment.subject} Due Soon!`,
    };

    const messages = {
      green: `Start working on "${assignment.task}" - Green phase begins now!`,
      yellow: `"${assignment.task}" is entering yellow phase. Don't delay!`,
      red: `"${assignment.task}" is now in RED phase - complete immediately!`,
    };

    // Play sound and show notification
    playSound(phase);
    notify(titles[phase], {
      body: messages[phase],
      type: phase === 'red' ? 'urgent' : phase === 'yellow' ? 'warning' : 'success',
      duration: phase === 'red' ? 0 : 8000,
      data: { assignmentId: assignment._id, phase },
    });
  }, [notify, playSound]);

  // Toggle sound on/off
  const toggleSound = useCallback(() => {
    setSoundEnabled(prev => !prev);
  }, []);

  const value = {
    notifications,
    permission,
    isSupported,
    soundEnabled,
    requestPermission,
    notify,
    notifyDeadline,
    addToast,
    removeToast,
    showBrowserNotification,
    toggleSound,
    playSound,
  };

  return (
    <NotificationContext.Provider value={value}>
      {children}
      <ToastContainer notifications={notifications} removeToast={removeToast} />
    </NotificationContext.Provider>
  );
}

// Toast Container Component
function ToastContainer({ notifications, removeToast }) {
  const getIcon = (type) => {
    switch (type) {
      case 'success': return <CheckCircle className="w-5 h-5 text-emerald-500" />;
      case 'warning': return <AlertTriangle className="w-5 h-5 text-amber-500" />;
      case 'urgent': return <AlertTriangle className="w-5 h-5 text-red-500 animate-pulse" />;
      case 'error': return <X className="w-5 h-5 text-red-500" />;
      default: return <Bell className="w-5 h-5 text-blue-500" />;
    }
  };

  const getStyles = (type) => {
    switch (type) {
      case 'success': return 'bg-emerald-50 border-emerald-200 text-emerald-800';
      case 'warning': return 'bg-amber-50 border-amber-200 text-amber-800';
      case 'urgent': return 'bg-red-50 border-red-200 text-red-800 shadow-lg shadow-red-500/20';
      case 'error': return 'bg-red-50 border-red-200 text-red-800';
      default: return 'bg-blue-50 border-blue-200 text-blue-800';
    }
  };

  return (
    <div className="fixed top-4 right-4 z-50 space-y-3 w-full max-w-sm">
      {notifications.map((notification) => (
        <div
          key={notification.id}
          className={`flex items-start gap-3 p-4 rounded-xl border-2 shadow-lg transform transition-all duration-300 animate-in slide-in-from-right ${getStyles(notification.type)}`}
        >
          <div className="flex-shrink-0 mt-0.5">
            {getIcon(notification.type)}
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium leading-5">
              {notification.message}
            </p>
            <p className="text-xs opacity-75 mt-1">
              {notification.timestamp.toLocaleTimeString()}
            </p>
          </div>
          <button
            onClick={() => removeToast(notification.id)}
            className="flex-shrink-0 -mr-1 -mt-1 p-1 rounded-lg hover:bg-black/5 transition-colors"
          >
            <X className="w-4 h-4 opacity-50 hover:opacity-100" />
          </button>
        </div>
      ))}
    </div>
  );
}

export const useNotifications = () => {
  const context = useContext(NotificationContext);
  if (!context) {
    throw new Error('useNotifications must be used within NotificationProvider');
  }
  return context;
};