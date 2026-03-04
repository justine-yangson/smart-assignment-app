import { useState, useCallback, useRef, useEffect } from 'react';

export function useWiFiBox() {
  const [isConnected, setIsConnected] = useState(false);
  const [boxIP, setBoxIP] = useState(null);
  const [isScanning, setIsScanning] = useState(false);
  const [error, setError] = useState(null);
  const timeoutRef = useRef(null);

  // Scan for ESP32 on local network
  const scanForBox = useCallback(async () => {
    setIsScanning(true);
    setError(null);
    
    // Get local IP prefix
    const getLocalPrefix = () => {
      // Try to get from common router IPs
      return '192.168.1';
    };
    
    const prefix = getLocalPrefix();
    const foundIPs = [];
    
    // Scan IP range 1-50
    for (let i = 1; i <= 50; i++) {
      const ip = `${prefix}.${i}`;
      
      try {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 500);
        
        const response = await fetch(`http://${ip}/status`, {
          method: 'GET',
          signal: controller.signal
        }).catch(() => null);
        
        clearTimeout(timeoutId);
        
        if (response && response.ok) {
          foundIPs.push(ip);
          console.log('Found ESP32 at:', ip);
          break; // Stop at first found
        }
      } catch (e) {
        // Timeout or error, continue
      }
    }
    
    setIsScanning(false);
    
    if (foundIPs.length > 0) {
      setBoxIP(foundIPs[0]);
      setIsConnected(true);
      return foundIPs[0];
    } else {
      setError('ESP32 not found on network');
      return null;
    }
  }, []);

  // Connect to specific IP
  const connect = useCallback(async (ip) => {
    try {
      setError(null);
      const response = await fetch(`http://${ip}/status`, {
        method: 'GET',
        headers: { 'Content-Type': 'application/json' }
      });
      
      if (response.ok) {
        const data = await response.json();
        console.log('Connected to ESP32:', data);
        setBoxIP(ip);
        setIsConnected(true);
        return true;
      }
    } catch (error) {
      console.error('Connection failed:', error);
      setError('Failed to connect to ' + ip);
    }
    return false;
  }, []);

  // Disconnect
  const disconnect = useCallback(() => {
    setIsConnected(false);
    setBoxIP(null);
    setError(null);
  }, []);

  // Send notification to box
  const sendNotification = useCallback(async (data) => {
    if (!isConnected || !boxIP) {
      console.error('Not connected to WiFi box');
      return false;
    }

    try {
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

  // Auto-reconnect on mount
  useEffect(() => {
    const savedIP = localStorage.getItem('esp32_ip');
    if (savedIP) {
      connect(savedIP);
    }
    
    return () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
    };
  }, [connect]);

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
    scanForBox,
    connect,
    disconnect,
    sendNotification
  };
}