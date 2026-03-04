import { LocalNotifications } from '@capacitor/local-notifications';
import { Capacitor } from '@capacitor/core';

const isNative = Capacitor.isNativePlatform();

// Request permissions
export async function requestNotificationPermission() {
  if (!isNative) {
    console.log('Not native platform, skipping permission request');
    return false;
  }
  
  try {
    const { display } = await LocalNotifications.requestPermissions();
    console.log('Permission result:', display);
    return display === 'granted';
  } catch (error) {
    console.error('Error requesting permission:', error);
    return false;
  }
}

// Check permission status
export async function checkNotificationPermission() {
  if (!isNative) return false;
  
  try {
    const { display } = await LocalNotifications.checkPermissions();
    return display === 'granted';
  } catch (error) {
    console.error('Error checking permission:', error);
    return false;
  }
}

// Create notification channel for Android 8+
export async function createNotificationChannel() {
  if (!isNative) return;

  try {
    await LocalNotifications.createChannel({
      id: 'assignment-reminders',
      name: 'Assignment Reminders',
      description: 'Notifications for assignment deadlines',
      importance: 5, // High importance for popup
      visibility: 'public',
      sound: 'default',
      vibration: true,
      lights: true,
      lightColor: '#10B981'
    });
    console.log('Notification channel created');
  } catch (error) {
    console.error('Error creating channel:', error);
  }
}

// Register action types for assignment notifications
export async function registerNotificationActions() {
  if (!isNative) return;

  try {
    // Create notification channel first (required for Android 8+)
    await createNotificationChannel();

    await LocalNotifications.registerActionTypes({
      types: [
        {
          id: 'ASSIGNMENT_DUE',
          actions: [
            {
              id: 'start',
              title: 'Start',
              foreground: true
            },
            {
              id: 'snooze',
              title: 'Snooze 15m',
              foreground: false
            },
            {
              id: 'done',
              title: 'Mark Done',
              foreground: true
            }
          ]
        },
        {
          id: 'ASSIGNMENT_URGENT',
          actions: [
            {
              id: 'start',
              title: 'Start Now',
              foreground: true
            },
            {
              id: 'done',
              title: 'Mark Done',
              foreground: true
            }
          ]
        }
      ]
    });
    console.log('Notification actions registered');
  } catch (error) {
    console.error('Error registering actions:', error);
  }
}

// Schedule assignment reminder
export async function scheduleAssignmentNotification(assignment, phase) {
  if (!isNative) {
    console.log('Not native platform, skipping schedule');
    return;
  }

  const now = new Date();
  let triggerTime;
  let title, body, actionTypeId, iconColor;

  const { green, yellow, red } = assignment.deadlines;
  
  switch(phase) {
    case 'green':
      triggerTime = new Date(green);
      title = `Ready to "${assignment.subject}"?`;
      body = `Start working on: ${assignment.task}`;
      actionTypeId = 'ASSIGNMENT_DUE';
      iconColor = '#10B981'; // Green
      break;
    case 'yellow':
      triggerTime = new Date(yellow);
      title = `Deadline approaching!`;
      body = `${assignment.subject}: ${assignment.task}`;
      actionTypeId = 'ASSIGNMENT_DUE';
      iconColor = '#F59E0B'; // Yellow
      break;
    case 'red':
      triggerTime = new Date(red);
      title = `URGENT: ${assignment.subject}`;
      body = `Assignment overdue: ${assignment.task}`;
      actionTypeId = 'ASSIGNMENT_URGENT';
      iconColor = '#EF4444'; // Red
      break;
    default:
      return;
  }

  // Only schedule if time is in the future (at least 5 seconds from now)
  const minTime = new Date(now.getTime() + 5000); // 5 seconds buffer
  if (triggerTime <= minTime) {
    console.log(`Skipping ${phase} for ${assignment.subject} - time already passed or too soon`);
    return;
  }

  // Use assignment ID directly + phase offset for unique IDs
  const baseId = typeof assignment._id === 'string' 
    ? parseInt(assignment._id.replace(/\D/g, '').slice(0, 8), 10) 
    : assignment._id;
  
  // Add offset for each phase to ensure uniqueness
  const phaseOffsets = { green: 1, yellow: 2, red: 3 };
  const notificationId = baseId + (phaseOffsets[phase] * 100000);
  
  console.log(`Scheduling ${phase} notification for ${assignment.subject}:`, {
    id: notificationId,
    triggerTime: triggerTime.toISOString(),
    title,
    body
  });

  try {
    await LocalNotifications.schedule({
      notifications: [
        {
          id: notificationId,
          title,
          body,
          schedule: { at: triggerTime },
          actionTypeId,
          sound: undefined, // Use system default
          priority: 'high',
          visibility: 'public',
          extra: {
            assignmentId: assignment._id,
            phase,
            subject: assignment.subject
          },
          smallIcon: 'ic_notification',
          iconColor
        }
      ]
    });
    console.log(`Successfully scheduled ${phase} for ${assignment.subject}`);
  } catch (error) {
    console.error(`Error scheduling ${phase} for ${assignment.subject}:`, error);
  }
}

// Cancel specific notification
export async function cancelAssignmentNotification(assignmentId, phase) {
  if (!isNative) return;
  
  try {
    const baseId = typeof assignmentId === 'string' 
      ? parseInt(assignmentId.replace(/\D/g, '').slice(0, 8), 10) 
      : assignmentId;
    const phaseOffsets = { green: 1, yellow: 2, red: 3 };
    const notificationId = baseId + (phaseOffsets[phase] * 100000);
    
    await LocalNotifications.cancel({
      notifications: [{ id: notificationId }]
    });
  } catch (error) {
    console.error('Error canceling notification:', error);
  }
}

// Cancel all notifications for an assignment
export async function cancelAllAssignmentNotifications(assignmentId) {
  if (!isNative) return;
  
  try {
    const baseId = typeof assignmentId === 'string' 
      ? parseInt(assignmentId.replace(/\D/g, '').slice(0, 8), 10) 
      : assignmentId;
    
    const ids = [1, 2, 3].map(offset => baseId + (offset * 100000));
    
    await LocalNotifications.cancel({
      notifications: ids.map(id => ({ id }))
    });
    console.log('Canceled notifications for assignment:', assignmentId);
  } catch (error) {
    console.error('Error canceling notifications:', error);
  }
}

// Schedule all phases for an assignment
export async function scheduleAllAssignmentNotifications(assignment) {
  if (!isNative) return;
  
  console.log('Scheduling all notifications for:', assignment.subject);
  
  // Schedule sequentially instead of Promise.all to avoid conflicts
  await scheduleAssignmentNotification(assignment, 'green');
  await scheduleAssignmentNotification(assignment, 'yellow');
  await scheduleAssignmentNotification(assignment, 'red');
}

// Get pending notifications
export async function getPendingNotifications() {
  if (!isNative) return { notifications: [] };
  
  try {
    return await LocalNotifications.getPending();
  } catch (error) {
    console.error('Error getting pending notifications:', error);
    return { notifications: [] };
  }
}

// Cancel all pending notifications
export async function cancelAllNotifications() {
  if (!isNative) return;
  
  try {
    await LocalNotifications.cancelAll();
    console.log('All notifications canceled');
  } catch (error) {
    console.error('Error canceling all notifications:', error);
  }
}

// Listen for notification actions
export function onNotificationAction(callback) {
  if (!isNative) return () => {};

  const listener = LocalNotifications.addListener('localNotificationActionPerformed', (action) => {
    console.log('Notification action performed:', action);
    callback({
      actionId: action.actionId,
      assignmentId: action.notification?.extra?.assignmentId,
      phase: action.notification?.extra?.phase,
      subject: action.notification?.extra?.subject
    });
  });

  return () => listener.remove();
}

// Listen for received notifications (app in foreground)
export function onNotificationReceived(callback) {
  if (!isNative) return () => {};

  const listener = LocalNotifications.addListener('localNotificationReceived', (notification) => {
    console.log('Notification received in foreground:', notification);
    callback(notification);
  });

  return () => listener.remove();
}