import { useState, useCallback, useRef, useEffect } from 'react';

export function useWiFiBox() {
  const [isConnected, setIsConnected] = useState(false);
  const [boxIP, setBoxIP] = useState(null);
  const [isScanning, setIsScanning] = useState(false);
  const [error, setError] = useState(null);
  const timeoutRef = useRef(null);

  // Scan for ESP32 on local network
  const scanForBox = useCallback(async () => {
    console.log('=== Starting WiFi Scan ===');
    setIsScanning(true);
    setError(null);
    
    // Try multiple common IP ranges
    const prefixes = ['192.168.1', '192.168.0', '10.0.0'];
    let foundIP = null;
    
    for (const prefix of prefixes) {
      if (foundIP) break;
      
      console.log('Scanning range:', prefix + '.1 to ' + prefix + '.50');
      
      for (let i = 1; i <= 50; i++) {
        const ip = `${prefix}.${i}`;
        
        try {
          const controller = new AbortController();
          const timeoutId = setTimeout(() => controller.abort(), 800);
          
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
          // Expected for most IPs
        }
      }
    }
    
    setIsScanning(false);
    
    if (foundIP) {
      console.log('✓ Connected to:', foundIP);
      setBoxIP(foundIP);
      setIsConnected(true);
      return foundIP;
    } else {
      console.log('✗ No ESP32 found');
      setError('ESP32 not found. Check WiFi and that ESP32 is on same network.');
      return null;
    }
  }, []);

  // Connect to specific IP
  const connect = useCallback(async (ip) => {
    try {
      setError(null);
      console.log('Connecting to specific IP:', ip);
      
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
    console.log('Disconnecting from ESP32');
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

  // Auto-reconnect on mount
  useEffect(() => {
    const savedIP = localStorage.getItem('esp32_ip');
    if (savedIP) {
      console.log('Auto-reconnecting to saved IP:', savedIP);
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