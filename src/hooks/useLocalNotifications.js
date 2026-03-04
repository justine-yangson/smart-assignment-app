import { useEffect, useCallback, useState } from 'react';
import {
  requestNotificationPermission,
  registerNotificationActions,
  scheduleAssignmentNotification,
  cancelAllAssignmentNotifications,
  onNotificationAction,
  onNotificationReceived,
  checkNotificationPermission
} from '../services/notifications';

// Key to track if we've already asked for permission
const PERMISSION_ASKED_KEY = 'notification_permission_asked_v2';

// Main hook - Named export
export function useLocalNotifications(assignments, onAction) {
  const [permissionGranted, setPermissionGranted] = useState(false);
  const [isReady, setIsReady] = useState(false);
  const [showPrompt, setShowPrompt] = useState(false);

  // Initialize notifications
  useEffect(() => {
    let cleanupActionListener;
    let cleanupReceiveListener;

    const init = async () => {
      // Check if we already have permission
      const hasPermission = await checkNotificationPermission();
      setPermissionGranted(hasPermission);
      
      if (hasPermission) {
        console.log('Permission already granted');
        await registerNotificationActions();
        setIsReady(true);
        
        // Set up listeners only once
        cleanupActionListener = onNotificationAction((action) => {
          console.log('Notification action:', action);
          if (onAction) {
            onAction(action);
          }
        });
        
        cleanupReceiveListener = onNotificationReceived((notification) => {
          console.log('Notification received:', notification);
        });
      } else {
        // Check if we've asked before
        const hasAsked = localStorage.getItem(PERMISSION_ASKED_KEY) === 'true';
        console.log('Permission not granted, hasAsked before:', hasAsked);
        if (!hasAsked) {
          setShowPrompt(true);
        }
      }
    };

    init();

    return () => {
      cleanupActionListener?.();
      cleanupReceiveListener?.();
    };
  }, []); // Removed onAction dependency to prevent re-registering

  // Request permission
  const requestPermission = useCallback(async () => {
    const granted = await requestNotificationPermission();
    setPermissionGranted(granted);
    setShowPrompt(false);
    localStorage.setItem(PERMISSION_ASKED_KEY, 'true');
    
    if (granted) {
      await registerNotificationActions();
      setIsReady(true);
    }
    return granted;
  }, []);

  // Schedule notifications when assignments change
  useEffect(() => {
    if (!isReady || !assignments) {
      console.log('Not ready to schedule:', { isReady, assignmentsCount: assignments?.length });
      return;
    }

    const now = new Date();
    console.log('Checking assignments for scheduling at:', now.toISOString());
    
    // Cancel ALL existing notifications first to prevent duplicates
    assignments.forEach(assignment => {
      cancelAllAssignmentNotifications(assignment._id);
    });

    assignments.forEach(assignment => {
      if (assignment.status === 'completed') {
        return;
      }
      
      const { green, yellow, red } = assignment.deadlines;
      const greenDate = new Date(green);
      const yellowDate = new Date(yellow);
      const redDate = new Date(red);
      
      console.log('Assignment:', assignment.subject, {
        green: greenDate.toISOString(),
        yellow: yellowDate.toISOString(),
        red: redDate.toISOString(),
        now: now.toISOString()
      });
      
      // Schedule each phase individually if in future
      if (greenDate > now) {
        console.log('Scheduling GREEN for:', assignment.subject);
        scheduleAssignmentNotification(assignment, 'green');
      }
      if (yellowDate > now) {
        console.log('Scheduling YELLOW for:', assignment.subject);
        scheduleAssignmentNotification(assignment, 'yellow');
      }
      if (redDate > now) {
        console.log('Scheduling RED for:', assignment.subject);
        scheduleAssignmentNotification(assignment, 'red');
      }
    });

  }, [assignments, isReady]);

  return {
    permissionGranted,
    isReady,
    showPrompt,
    requestPermission
  };
}