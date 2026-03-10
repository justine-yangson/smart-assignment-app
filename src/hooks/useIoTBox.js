import { useState, useCallback } from 'react';
import { useWiFiBox } from './useWiFiBox';

export function useIoTBox() {
  const [activeConnection, setActiveConnection] = useState(null);
  
  const wifi = useWiFiBox();

  // Connect - WiFi only
  const connect = useCallback(async (manualIP) => {
    alert('useIoTBox: connect() called!');
    console.log('=== useIoTBox: connect() STARTED ===');
    
    let result;
    if (manualIP) {
      result = await wifi.connectWithIP(manualIP);
    } else {
      // Try auto-connect to first available network
      const networks = await wifi.scanNetworks();
      if (networks.length > 0) {
        result = await wifi.connectToNetwork(networks[0].ssid);
      } else {
        alert('No IoT Box found. Please connect manually.');
        return false;
      }
    }
    
    alert('useIoTBox: result = ' + JSON.stringify(result));
    console.log('=== useIoTBox: result =', result);
    
    if (result && result.success) {
      setActiveConnection('wifi');
      alert('✓ Connected!');
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
    availableNetworks: wifi.availableNetworks,
    activeConnection,
    connect,
    disconnect,
    sendNotification,
    scanNetworks: wifi.scanNetworks,
    connectToNetwork: wifi.connectToNetwork
  };
}