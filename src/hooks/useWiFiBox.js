import { useState, useCallback, useEffect, useRef } from 'react';
import { CapacitorWifi } from '@capgo/capacitor-wifi';

export function useWiFiBox() {
  const [isConnected, setIsConnected] = useState(false);
  const [boxIP, setBoxIP] = useState(null);
  const [isScanning, setIsScanning] = useState(false);
  const [error, setError] = useState(null);
  const [availableNetworks, setAvailableNetworks] = useState([]);
  const listenerRef = useRef(null);

  // Request permissions
  const requestPermissions = useCallback(async () => {
    try {
      const status = await CapacitorWifi.requestPermissions();
      return status.location === 'granted';
    } catch (err) {
      console.error('Permission error:', err);
      return false;
    }
  }, []);

  // Scan for available WiFi networks
  const scanNetworks = useCallback(async () => {
    console.log('=== Starting WiFi Scan ===');
    setIsScanning(true);
    setError(null);
    
    try {
      // Check permissions first
      const hasPermission = await requestPermissions();
      if (!hasPermission) {
        setError('Location permission required for WiFi scanning');
        setIsScanning(false);
        return [];
      }

      // Scan for networks (using scan() method, not startScan)
      const result = await CapacitorWifi.scan();
      console.log('Available networks:', result.networks);
      
      // Filter for IoT Box networks
      const iotNetworks = result.networks.filter(network => {
        const ssid = network.ssid.toLowerCase();
        return ssid.includes('reminder') || 
               ssid.includes('iot') || 
               ssid.includes('box') || 
               ssid.includes('esp') ||
               ssid.includes('smart');
      });
      
      console.log('IoT networks found:', iotNetworks);
      setAvailableNetworks(iotNetworks);
      setIsScanning(false);
      return iotNetworks;
    } catch (err) {
      console.error('Scan failed:', err);
      setError('Failed to scan WiFi: ' + err.message);
      setIsScanning(false);
      return [];
    }
  }, [requestPermissions]);

  // Connect to a specific network
  const connectToNetwork = useCallback(async (ssid, password = '') => {
    console.log('=== Connecting to:', ssid, '===');
    setIsScanning(true);
    setError(null);
    
    try {
      // Connect to network
      await CapacitorWifi.connect({
        ssid: ssid,
        password: password
      });
      
      console.log('WiFi connected, checking for ESP32...');
      
      // Wait for connection to stabilize
      await new Promise(resolve => setTimeout(resolve, 3000));
      
      // Try to find ESP32 IP
      const commonIPs = ['192.168.4.1', '192.168.1.1', '10.0.0.1'];
      let foundIP = null;
      
      for (const ip of commonIPs) {
        try {
          const controller = new AbortController();
          const timeoutId = setTimeout(() => controller.abort(), 2000);
          
          const response = await fetch(`http://${ip}/status`, {
            method: 'GET',
            signal: controller.signal
          }).catch(() => null);
          
          clearTimeout(timeoutId);
          
          if (response && response.ok) {
            console.log('✓ Found ESP32 at:', ip);
            foundIP = ip;
            break;
          }
        } catch (e) {
          // Try next IP
        }
      }
      
      setIsScanning(false);
      
      if (foundIP) {
        setBoxIP(foundIP);
        setIsConnected(true);
        return { success: true, ip: foundIP };
      } else {
        // Connected to WiFi but ESP32 not responding - use default
        setBoxIP('192.168.4.1');
        setIsConnected(true);
        return { success: true, ip: '192.168.4.1' };
      }
    } catch (err) {
      console.error('Connection error:', err);
      setError('Failed to connect: ' + err.message);
      setIsScanning(false);
      return { success: false, error: err.message };
    }
  }, []);

  // Manual IP connect (fallback)
  const connectWithIP = useCallback(async (ip) => {
    console.log('=== Manual connect to IP:', ip, '===');
    setIsScanning(true);
    setError(null);
    
    try {
      const response = await fetch(`http://${ip}/status`, {
        method: 'GET',
        headers: { 'Content-Type': 'application/json' }
      });
      
      if (response.ok) {
        const data = await response.json();
        console.log('Connected to ESP32:', data);
        setBoxIP(ip);
        setIsConnected(true);
        setIsScanning(false);
        return true;
      }
    } catch (error) {
      console.error('Connection failed:', error);
      setError('Failed to connect to ' + ip);
    }
    
    setIsScanning(false);
    return false;
  }, []);

  // Disconnect
  const disconnect = useCallback(async () => {
    console.log('Disconnecting from ESP32');
    try {
      await CapacitorWifi.disconnect();
    } catch (e) {
      console.log('Disconnect error (may be normal):', e);
    }
    setIsConnected(false);
    setBoxIP(null);
    setError(null);
    setAvailableNetworks([]);
  }, []);

  // Send notification to box
  const sendNotification = useCallback(async (data) => {
    if (!isConnected || !boxIP) {
      console.error('Not connected to WiFi box');
      return false;
    }

    try {
      console.log('Sending notification to:', boxIP, data);
      
      const response = await fetch(`http://${boxIP}/notify`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data)
      });

      if (response.ok) {
        const result = await response.json();
        console.log('WiFi notification sent:', result);
        return true;
      } else {
        throw new Error('Bad response: ' + response.status);
      }
    } catch (error) {
      console.error('Failed to send WiFi notification:', error);
      setIsConnected(false);
      setError('Connection lost');
      return false;
    }
  }, [isConnected, boxIP]);

  // Get current WiFi info
  const getWifiInfo = useCallback(async () => {
    try {
      const info = await CapacitorWifi.getWifiInfo();
      return info;
    } catch (err) {
      console.error('Failed to get WiFi info:', err);
      return null;
    }
  }, []);

  // Auto-reconnect on mount
  useEffect(() => {
    const savedIP = localStorage.getItem('esp32_ip');
    if (savedIP) {
      console.log('Auto-reconnecting to saved IP:', savedIP);
      connectWithIP(savedIP);
    }
  }, [connectWithIP]);

  // Save IP when connected
  useEffect(() => {
    if (boxIP) {
      localStorage.setItem('esp32_ip', boxIP);
    }
  }, [boxIP]);

  return {
    isConnected,
    boxIP,
    isScanning,
    error,
    availableNetworks,
    scanNetworks,
    connectToNetwork,
    connectWithIP,
    disconnect,
    sendNotification,
    getWifiInfo
  };
}