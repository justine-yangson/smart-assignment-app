import { useState, useCallback } from 'react';
import { useWiFiBox } from './useWiFiBox';

export function useIoTBox() {
  const [activeConnection, setActiveConnection] = useState(null);
  
  const wifi = useWiFiBox();

  // Connect - WiFi only
  const connect = useCallback(async () => {
    console.log('Scanning for ESP32 on WiFi...');
    const wifiSuccess = await wifi.scanForBox();
    if (wifiSuccess) {
      setActiveConnection('wifi');
      console.log('Connected via WiFi!');
      return true;
    }
    console.log('WiFi connection failed');
    return false;
  }, [wifi]);

  // Disconnect
  const disconnect = useCallback(() => {
    wifi.disconnect();
    setActiveConnection(null);
  }, [wifi]);

  // Send notification
  const sendNotification = useCallback(async (data) => {
    if (!wifi.isConnected) {
      console.log('No WiFi connection, trying to connect...');
      const connected = await connect();
      if (!connected) {
        console.error('Failed to connect to ESP32');
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