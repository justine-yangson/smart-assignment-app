import { useState, useEffect, useRef } from 'react';
import { Bell, BellRing, BellOff, Check, Trash2, Clock } from 'lucide-react';
import { useNotifications } from '../context/NotificationContext';

export default function NotificationBell({ assignments }) {
  const [isOpen, setIsOpen] = useState(false);
  const [unreadCount, setUnreadCount] = useState(0);
  const [notifications, setNotifications] = useState([]);
  const [notifiedPhases, setNotifiedPhases] = useState(new Set());
  const [tick, setTick] = useState(0);
  
  // Call useNotifications at TOP LEVEL of component - not inside callbacks! [^28^][^31^]
  const { permission, isSupported, requestPermission, notifyDeadline, notify } = useNotifications();

  // Force re-render every 5 seconds to update phases in real-time
  useEffect(() => {
    const interval = setInterval(() => {
      setTick(t => t + 1);
    }, 5000);
    return () => clearInterval(interval);
  }, []);

  // Generate notifications from assignments - runs every tick
  useEffect(() => {
    if (!assignments) return;
    
    const now = new Date();
    const newNotifications = [];

    assignments.forEach(assignment => {
      if (assignment.status === 'completed') return;

      const { green, yellow, red } = assignment.deadlines;
      const greenDate = new Date(green);
      const yellowDate = new Date(yellow);
      const redDate = new Date(red);

      // Show ALL active phases
      if (now >= redDate) {
        newNotifications.push({
          id: `${assignment._id}-red`,
          assignment,
          phase: 'red',
          message: `URGENT: ${assignment.subject} is overdue!`,
          time: redDate,
          read: false,
        });
      }
      
      if (now >= yellowDate) {
        newNotifications.push({
          id: `${assignment._id}-yellow`,
          assignment,
          phase: 'yellow',
          message: `${assignment.subject} deadline approaching`,
          time: yellowDate,
          read: false,
        });
      }
      
      if (now >= greenDate && now < yellowDate) {
        newNotifications.push({
          id: `${assignment._id}-green`,
          assignment,
          phase: 'green',
          message: `Start working on ${assignment.subject}`,
          time: greenDate,
          read: false,
        });
      }
    });

    const phaseOrder = { red: 0, yellow: 1, green: 2 };
    newNotifications.sort((a, b) => phaseOrder[a.phase] - phaseOrder[b.phase]);

    setNotifications(prev => {
      const merged = newNotifications.map(newNotif => {
        const existing = prev.find(p => p.id === newNotif.id);
        return existing ? { ...newNotif, read: existing.read } : newNotif;
      });
      return merged;
    });
    
    setUnreadCount(newNotifications.filter(n => !n.read).length);
  }, [assignments, tick]);

  // Check for phase changes and trigger notifications
  useEffect(() => {
    const checkDeadlines = () => {
      const now = new Date();
      
      assignments.forEach(assignment => {
        if (assignment.status === 'completed') return;

        const { green, yellow, red } = assignment.deadlines;
        const greenDate = new Date(green);
        const yellowDate = new Date(yellow);
        const redDate = new Date(red);

        const checkPhase = (phaseDate, phaseName, preNotify = false) => {
          const timeSincePhaseStarted = now - phaseDate;
          const timeUntilPhaseStarts = phaseDate - now;
          const notificationId = `${assignment._id}-${phaseName}`;
          
          if (notifiedPhases.has(notificationId)) return;

          // Notify when phase starts (within last 2 minutes)
          if (timeSincePhaseStarted >= 0 && timeSincePhaseStarted < 120000) {
            notifyDeadline(assignment, phaseName);
            setNotifiedPhases(prev => new Set([...prev, notificationId]));
          }
          
          // Pre-notification: 1 minute before phase starts
          if (preNotify && timeUntilPhaseStarts > 0 && timeUntilPhaseStarts <= 60000) {
            const preNotificationId = `${assignment._id}-${phaseName}-pre`;
            if (!notifiedPhases.has(preNotificationId)) {
              const titles = {
                yellow: `🟡 ${assignment.subject} entering yellow phase soon`,
                red: `🔴 ${assignment.subject} entering red phase soon`
              };
              const messages = {
                yellow: `"${assignment.task}" will enter yellow phase in 1 minute!`,
                red: `"${assignment.task}" will enter red phase in 1 minute - deadline approaching!`
              };
              
              // Use notify from the hook called at top level - NOT inside callback [^28^][^31^]
              notify(titles[phaseName], {
                body: messages[phaseName],
                type: phaseName === 'red' ? 'urgent' : 'warning',
                data: { assignmentId: assignment._id, phase: phaseName, pre: true }
              });
              
              setNotifiedPhases(prev => new Set([...prev, preNotificationId]));
            }
          }
        };

        checkPhase(greenDate, 'green', false);
        checkPhase(yellowDate, 'yellow', true);
        checkPhase(redDate, 'red', true);
      });
    };

    checkDeadlines();
    const interval = setInterval(checkDeadlines, 10000);
    
    return () => clearInterval(interval);
  }, [assignments, notifyDeadline, notifiedPhases, tick, notify]); // Added notify to dependencies

  const markAsRead = (id) => {
    setNotifications(prev => 
      prev.map(n => n.id === id ? { ...n, read: true } : n)
    );
    setUnreadCount(prev => Math.max(0, prev - 1));
  };

  const markAllAsRead = () => {
    setNotifications(prev => prev.map(n => ({ ...n, read: true })));
    setUnreadCount(0);
  };

  const clearAll = () => {
    setNotifications([]);
    setUnreadCount(0);
    setNotifiedPhases(new Set());
  };

  const getPhaseColor = (phase) => {
    switch (phase) {
      case 'red': return 'text-red-500 bg-red-50';
      case 'yellow': return 'text-amber-500 bg-amber-50';
      case 'green': return 'text-emerald-500 bg-emerald-50';
      default: return 'text-gray-500 bg-gray-50';
    }
  };

  const getPhaseDot = (phase) => {
    switch (phase) {
      case 'red': return 'bg-red-500 animate-pulse';
      case 'yellow': return 'bg-amber-500';
      case 'green': return 'bg-emerald-500';
      default: return 'bg-gray-500';
    }
  };

  return (
    <div className="relative">
      {/* Bell Button */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="relative p-2 rounded-xl hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
      >
        {permission === 'granted' ? (
          <BellRing className="w-6 h-6 text-gray-700 dark:text-gray-300" />
        ) : (
          <Bell className="w-6 h-6 text-gray-700 dark:text-gray-300" />
        )}
        
        {unreadCount > 0 && (
          <span className="absolute -top-1 -right-1 w-5 h-5 bg-red-500 text-white text-xs font-bold rounded-full flex items-center justify-center animate-bounce">
            {unreadCount > 9 ? '9+' : unreadCount}
          </span>
        )}
      </button>

      {/* Dropdown */}
      {isOpen && (
        <div className="absolute right-0 mt-2 w-80 bg-white dark:bg-gray-800 rounded-2xl shadow-xl border border-gray-200 dark:border-gray-700 z-50 overflow-hidden">
          {/* Header */}
          <div className="flex items-center justify-between p-4 border-b border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-900">
            <h3 className="font-semibold text-gray-900 dark:text-white flex items-center gap-2">
              <Bell className="w-4 h-4" />
              Notifications
            </h3>
            <div className="flex items-center gap-1">
              {isSupported && permission !== 'granted' && (
                <button
                  onClick={requestPermission}
                  className="p-1.5 text-xs bg-blue-100 dark:bg-blue-900 text-blue-700 dark:text-blue-300 rounded-lg hover:bg-blue-200 transition-colors"
                  title="Enable browser notifications"
                >
                  <BellOff className="w-3 h-3" />
                </button>
              )}
              {unreadCount > 0 && (
                <button
                  onClick={markAllAsRead}
                  className="p-1.5 text-xs bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-300 transition-colors"
                  title="Mark all as read"
                >
                  <Check className="w-3 h-3" />
                </button>
              )}
              <button
                onClick={clearAll}
                className="p-1.5 text-xs bg-red-100 dark:bg-red-900 text-red-700 dark:text-red-300 rounded-lg hover:bg-red-200 transition-colors"
                title="Clear all"
              >
                <Trash2 className="w-3 h-3" />
              </button>
            </div>
          </div>

          {/* Notification List */}
          <div className="max-h-96 overflow-y-auto">
            {notifications.length === 0 ? (
              <div className="p-8 text-center text-gray-500 dark:text-gray-400">
                <Bell className="w-12 h-12 mx-auto mb-3 opacity-20" />
                <p className="text-sm">No notifications yet</p>
                <p className="text-xs mt-1 opacity-75">
                  Deadline alerts will appear here
                </p>
              </div>
            ) : (
              <div className="divide-y divide-gray-100 dark:divide-gray-700">
                {notifications.map((notification) => (
                  <div
                    key={notification.id}
                    onClick={() => markAsRead(notification.id)}
                    className={`p-4 hover:bg-gray-50 dark:hover:bg-gray-700/50 cursor-pointer transition-colors ${
                      !notification.read ? 'bg-blue-50/50 dark:bg-blue-900/10' : ''
                    }`}
                  >
                    <div className="flex items-start gap-3">
                      <div className={`w-2 h-2 rounded-full mt-2 ${getPhaseDot(notification.phase)}`} />
                      <div className="flex-1 min-w-0">
                        <p className={`text-sm font-medium ${
                          !notification.read 
                            ? 'text-gray-900 dark:text-white' 
                            : 'text-gray-600 dark:text-gray-400'
                        }`}>
                          {notification.message}
                        </p>
                        <div className="flex items-center gap-2 mt-1 text-xs text-gray-500 dark:text-gray-400">
                          <Clock className="w-3 h-3" />
                          <span className={getPhaseColor(notification.phase)}>
                            {notification.phase.toUpperCase()} Phase
                          </span>
                          <span>•</span>
                          <span>
                            {new Date(notification.time).toLocaleDateString()}
                          </span>
                        </div>
                      </div>
                      {!notification.read && (
                        <span className="w-2 h-2 bg-blue-500 rounded-full flex-shrink-0" />
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Footer */}
          <div className="p-3 border-t border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-900 text-center">
            <button
              onClick={() => setIsOpen(false)}
              className="text-xs text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300 transition-colors"
            >
              Close
            </button>
          </div>
        </div>
      )}

      {/* Click outside to close */}
      {isOpen && (
        <div
          className="fixed inset-0 z-40"
          onClick={() => setIsOpen(false)}
        />
      )}
    </div>
  );
}