import { useState, useCallback, useEffect, useRef } from 'react';

// Check if Web Bluetooth is supported
const isBluetoothSupported = () => {
  return 'bluetooth' in navigator;
};

export function useBluetoothBox() {
  const [isConnected, setIsConnected] = useState(false);
  const [isScanning, setIsScanning] = useState(false);
  const [error, setError] = useState(null);
  const [device, setDevice] = useState(null);
  const serverRef = useRef(null);
  const characteristicRef = useRef(null);

  // Standard UART service UUIDs for ESP32
  const SERVICE_UUID = '0000ffe0-0000-1000-8000-00805f9b34fb';
  const CHARACTERISTIC_UUID = '0000ffe1-0000-1000-8000-00805f9b34fb';

  // Scan and connect to ESP32
  const connect = useCallback(async () => {
    if (!isBluetoothSupported()) {
      setError('Bluetooth not supported on this device');
      return false;
    }

    setIsScanning(true);
    setError(null);

    try {
      // Request device with name filter
      const device = await navigator.bluetooth.requestDevice({
        filters: [
          { name: 'SmartAssignment-Box' },
          { namePrefix: 'ESP32' },
          { namePrefix: 'Smart' }
        ],
        optionalServices: [SERVICE_UUID, 'battery_service']
      });

      console.log('Found device:', device.name);
      setDevice(device);

      // Connect to GATT server
      const server = await device.gatt.connect();
      serverRef.current = server;

      // Get service
      const service = await server.getPrimaryService(SERVICE_UUID);
      
      // Get characteristic
      const characteristic = await service.getCharacteristic(CHARACTERISTIC_UUID);
      characteristicRef.current = characteristic;

      // Setup disconnect listener
      device.addEventListener('gattserverdisconnected', () => {
        console.log('Bluetooth disconnected');
        setIsConnected(false);
        setDevice(null);
        serverRef.current = null;
        characteristicRef.current = null;
      });

      setIsConnected(true);
      console.log('Bluetooth connected!');
      return true;

    } catch (error) {
      console.error('Bluetooth connection error:', error);
      if (error.name === 'NotFoundError') {
        setError('No device selected');
      } else if (error.name === 'SecurityError') {
        setError('Bluetooth permission denied');
      } else {
        setError('Connection failed: ' + error.message);
      }
      return false;
    } finally {
      setIsScanning(false);
    }
  }, []);

  // Disconnect
  const disconnect = useCallback(async () => {
    if (device && device.gatt.connected) {
      await device.gatt.disconnect();
    }
    serverRef.current = null;
    characteristicRef.current = null;
    setDevice(null);
    setIsConnected(false);
    setError(null);
  }, [device]);

  // Send notification via Bluetooth
  const sendNotification = useCallback(async (data) => {
    if (!isConnected || !characteristicRef.current) {
      console.error('Bluetooth not connected');
      return false;
    }

    try {
      const jsonStr = JSON.stringify(data) + '\n';
      const encoder = new TextEncoder();
      const bytes = encoder.encode(jsonStr);

      // Send in chunks (BLE has ~20 byte limit)
      const maxChunkSize = 20;
      for (let i = 0; i < bytes.length; i += maxChunkSize) {
        const chunk = bytes.slice(i, i + maxChunkSize);
        await characteristicRef.current.writeValue(chunk);
        await new Promise(r => setTimeout(r, 50));
      }

      console.log('Bluetooth notification sent:', data);
      return true;

    } catch (error) {
      console.error('Failed to send Bluetooth notification:', error);
      setIsConnected(false);
      setError('Connection lost');
      return false;
    }
  }, [isConnected]);

  return {
    isSupported: isBluetoothSupported(),
    isConnected,
    isScanning,
    error,
    deviceName: device?.name || null,
    connect,
    disconnect,
    sendNotification
  };
}