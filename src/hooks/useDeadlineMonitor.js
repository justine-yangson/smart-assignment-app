import { useEffect, useCallback } from 'react';
import { useNotifications } from '../context/NotificationContext';

export function useDeadlineMonitor(assignments) {
  const { notifyDeadline, addToast } = useNotifications();

  const checkDeadlines = useCallback(() => {
    if (!assignments) return;

    const now = new Date();
    
    assignments.forEach(assignment => {
      if (assignment.status === 'completed') return;

      const { green, yellow, red } = assignment.deadlines;
      const greenDate = new Date(green);
      const yellowDate = new Date(yellow);
      const redDate = new Date(red);

      // Check if we just entered a new phase (within last minute)
      const checkPhase = (date, phase) => {
        const diff = now - date;
        return diff >= 0 && diff < 60000; // Within last minute
      };

      if (checkPhase(redDate, 'red')) {
        notifyDeadline(assignment, 'red');
      } else if (checkPhase(yellowDate, 'yellow')) {
        notifyDeadline(assignment, 'yellow');
      } else if (checkPhase(greenDate, 'green')) {
        notifyDeadline(assignment, 'green');
      }
    });
  }, [assignments, notifyDeadline]);

  // Check on mount and every minute
  useEffect(() => {
    checkDeadlines();
    const interval = setInterval(checkDeadlines, 60000);
    return () => clearInterval(interval);
  }, [checkDeadlines]);

  // Request notification permission on first load
  useEffect(() => {
    if ('Notification' in window && Notification.permission === 'default') {
      // Optionally auto-request after user interaction
      const handleClick = () => {
        Notification.requestPermission();
        document.removeEventListener('click', handleClick);
      };
      document.addEventListener('click', handleClick);
      return () => document.removeEventListener('click', handleClick);
    }
  }, []);
}