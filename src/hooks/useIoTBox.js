import { useState, useCallback } from 'react';
import { useWiFiBox } from './useWiFiBox';

export function useIoTBox() {
  const [activeConnection, setActiveConnection] = useState(null);
  
  const wifi = useWiFiBox();

  // Connect - WiFi only
  const connect = useCallback(async () => {
    // FORCE DEBUG
    alert('useIoTBox: connect() called!');
    console.log('=== useIoTBox: connect() STARTED ===');
    
    const wifiSuccess = await wifi.scanForBox();
    
    alert('useIoTBox: scan result = ' + wifiSuccess);
    console.log('=== useIoTBox: scan result =', wifiSuccess);
    
    if (wifiSuccess) {
      setActiveConnection('wifi');
      alert('✓ Connected via WiFi!');
      return true;
    }
    alert('✗ Connection failed');
    return false;
  }, [wifi]);

  // Disconnect
  const disconnect = useCallback(() => {
    alert('useIoTBox: disconnect() called!');
    console.log('=== useIoTBox: disconnect() ===');
    wifi.disconnect();
    setActiveConnection(null);
  }, [wifi]);

  // Send notification
  const sendNotification = useCallback(async (data) => {
    console.log('=== useIoTBox: sendNotification ===');
    if (!wifi.isConnected) {
      console.log('Not connected, trying to connect...');
      const connected = await connect();
      if (!connected) {
        console.error('Failed to connect');
        return false;
      }
    }
    return await wifi.sendNotification(data);
  }, [wifi, connect]);

  return {
    isConnected: wifi.isConnected,
    isScanning: wifi.isScanning,
    error: wifi.error,
    activeConnection,
    connect,
    disconnect,
    sendNotification
  };
}