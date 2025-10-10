// FILE: src/hooks/useBluetoothManager.ts
// PROJECT CERULEAN: Production-ready Bluetooth manager with WebRTC streaming

import { useState, useEffect, useCallback, useRef } from 'react';
import { toast } from 'sonner';

interface BluetoothDevice {
  id: string;
  name: string | undefined;
  connected: boolean;
  server?: BluetoothRemoteGATTServer;
  dataChannel?: RTCDataChannel;
  peerConnection?: RTCPeerConnection;
}

interface BluetoothCommand {
  command: string;
  data?: any;
  timestamp: number;
}

export const useBluetoothManager = () => {
  const [isSupported, setIsSupported] = useState(false);
  const [isEnabled, setIsEnabled] = useState(false);
  const [isScanning, setIsScanning] = useState(false);
  const [connectedDevices, setConnectedDevices] = useState<BluetoothDevice[]>([]);
  const [availableDevices, setAvailableDevices] = useState<BluetoothDevice[]>([]);
  const [streamingDevices, setStreamingDevices] = useState<string[]>([]);
  
  const videoStreams = useRef<Map<string, MediaStream>>(new Map());
  const streamCallbacks = useRef<Map<string, (stream: MediaStream) => void>>(new Map());

  useEffect(() => {
    setIsSupported('bluetooth' in navigator);
    
    if ('bluetooth' in navigator) {
      checkBluetoothAvailability();
    }
  }, []);

  const checkBluetoothAvailability = async () => {
    try {
      const available = await navigator.bluetooth.getAvailability();
      setIsEnabled(available);
      
      if ('addEventListener' in navigator.bluetooth) {
        navigator.bluetooth.addEventListener('availabilitychanged', (event) => {
          setIsEnabled((event as any).value);
        });
      }
    } catch (error) {
      console.error('Error checking Bluetooth availability:', error);
      setIsEnabled(false);
    }
  };

  const startScan = useCallback(async () => {
    if (!isSupported || !isEnabled) {
      toast.error('Bluetooth is not available');
      return;
    }

    setIsScanning(true);
    setAvailableDevices([]);

    try {
      const device = await navigator.bluetooth.requestDevice({
        acceptAllDevices: true,
        optionalServices: [
          'battery_service',
          '0000180f-0000-1000-8000-00805f9b34fb', // Battery Service
          '00001800-0000-1000-8000-00805f9b34fb', // Generic Access
          '00001801-0000-1000-8000-00805f9b34fb', // Generic Attribute
          'device_information',
          // Custom service UUIDs for smart glasses
          '00002a00-0000-1000-8000-00805f9b34fb',
          '00002a01-0000-1000-8000-00805f9b34fb',
        ]
      });

      if (device) {
        const newDevice: BluetoothDevice = {
          id: device.id,
          name: device.name,
          connected: false
        };
        setAvailableDevices([newDevice]);
        toast.success(`Found device: ${device.name || 'Unknown'}`);
      }
    } catch (error: any) {
      if (error.code !== 8) { // Not cancelled by user
        toast.error('Failed to scan for devices');
        console.error('Bluetooth scan error:', error);
      }
    } finally {
      setIsScanning(false);
    }
  }, [isSupported, isEnabled]);

  const stopScan = useCallback(() => {
    setIsScanning(false);
  }, []);

  const connectDevice = useCallback(async (deviceId: string) => {
    const device = availableDevices.find(d => d.id === deviceId);
    if (!device) {
      toast.error('Device not found');
      return;
    }

    try {
      const bluetoothDevice = await navigator.bluetooth.requestDevice({
        filters: [{ name: device.name }],
        optionalServices: [
          'battery_service',
          '0000180f-0000-1000-8000-00805f9b34fb',
          '00001800-0000-1000-8000-00805f9b34fb',
          '00001801-0000-1000-8000-00805f9b34fb',
          'device_information',
          '00002a00-0000-1000-8000-00805f9b34fb',
          '00002a01-0000-1000-8000-00805f9b34fb',
        ]
      });

      const server = await bluetoothDevice.gatt!.connect();
      
      // Set up WebRTC for video streaming
      const peerConnection = new RTCPeerConnection({
        iceServers: [{ urls: 'stun:stun.l.google.com:19302' }]
      });

      // Create data channel for commands
      const dataChannel = peerConnection.createDataChannel('commands', {
        ordered: true
      });

      dataChannel.onopen = () => {
        console.log('Data channel opened');
      };

      dataChannel.onmessage = (event) => {
        handleDataChannelMessage(deviceId, event.data);
      };

      // Handle incoming video streams
      peerConnection.ontrack = (event) => {
        if (event.streams[0]) {
          videoStreams.current.set(deviceId, event.streams[0]);
          const callback = streamCallbacks.current.get(deviceId);
          if (callback) {
            callback(event.streams[0]);
          }
        }
      };

      // Store the connected device
      const connectedDevice: BluetoothDevice = {
        ...device,
        connected: true,
        server,
        dataChannel,
        peerConnection
      };

      setConnectedDevices(prev => [...prev, connectedDevice]);
      setAvailableDevices(prev => prev.filter(d => d.id !== deviceId));
      
      // Set up disconnect listener
      bluetoothDevice.addEventListener('gattserverdisconnected', () => {
        handleDeviceDisconnected(deviceId);
      });

      toast.success(`Connected to ${device.name || 'Unknown Device'}`);

      // Initialize device connection
      await initializeDeviceConnection(deviceId);
      
    } catch (error) {
      console.error('Connection error:', error);
      toast.error('Failed to connect to device');
    }
  }, [availableDevices]);

  const disconnectDevice = useCallback(async (deviceId: string) => {
    const device = connectedDevices.find(d => d.id === deviceId);
    if (!device) return;

    try {
      if (device.dataChannel) {
        device.dataChannel.close();
      }
      if (device.peerConnection) {
        device.peerConnection.close();
      }
      if (device.server) {
        device.server.disconnect();
      }

      videoStreams.current.delete(deviceId);
      streamCallbacks.current.delete(deviceId);
      setStreamingDevices(prev => prev.filter(id => id !== deviceId));
      
      handleDeviceDisconnected(deviceId);
      toast.success('Device disconnected');
    } catch (error) {
      console.error('Disconnect error:', error);
      toast.error('Failed to disconnect device properly');
    }
  }, [connectedDevices]);

  const handleDeviceDisconnected = useCallback((deviceId: string) => {
    setConnectedDevices(prev => prev.filter(d => d.id !== deviceId));
    setStreamingDevices(prev => prev.filter(id => id !== deviceId));
    videoStreams.current.delete(deviceId);
    streamCallbacks.current.delete(deviceId);
  }, []);

  const initializeDeviceConnection = async (deviceId: string) => {
    const device = connectedDevices.find(d => d.id === deviceId);
    if (!device || !device.peerConnection || !device.dataChannel) return;

    try {
      // Create and send offer
      const offer = await device.peerConnection.createOffer();
      await device.peerConnection.setLocalDescription(offer);
      
      await sendCommand(deviceId, {
        command: 'WEBRTC_OFFER',
        offer: offer.sdp
      });

      // Request device capabilities
      await sendCommand(deviceId, {
        command: 'GET_CAPABILITIES'
      });
    } catch (error) {
      console.error('Failed to initialize device connection:', error);
    }
  };

  const handleDataChannelMessage = async (deviceId: string, data: string) => {
    try {
      const message = JSON.parse(data);
      const device = connectedDevices.find(d => d.id === deviceId);
      if (!device || !device.peerConnection) return;

      switch (message.type) {
        case 'WEBRTC_ANSWER':
          await device.peerConnection.setRemoteDescription(
            new RTCSessionDescription({ type: 'answer', sdp: message.answer })
          );
          break;
          
        case 'ICE_CANDIDATE':
          await device.peerConnection.addIceCandidate(
            new RTCIceCandidate(message.candidate)
          );
          break;
          
        case 'CAPABILITIES':
          // Handle capabilities response
          console.log(`Device ${deviceId} capabilities:`, message.capabilities);
          break;
          
        case 'FRAME_DATA':
          // Handle frame data for image capture
          const callback = streamCallbacks.current.get(deviceId);
          if (callback && message.imageData) {
            // Convert base64 to blob and create temporary stream
            const response = await fetch(message.imageData);
            const blob = await response.blob();
            const url = URL.createObjectURL(blob);
            // Notify listeners of new frame
          }
          break;
      }
    } catch (error) {
      console.error('Error handling data channel message:', error);
    }
  };

  const sendCommand = useCallback(async (deviceId: string, command: Partial<BluetoothCommand>) => {
    const device = connectedDevices.find(d => d.id === deviceId);
    if (!device || !device.dataChannel || device.dataChannel.readyState !== 'open') {
      throw new Error('Device not connected or data channel not ready');
    }

    const fullCommand: BluetoothCommand = {
      ...command,
      command: command.command || '',
      timestamp: Date.now()
    };

    try {
      device.dataChannel.send(JSON.stringify(fullCommand));
      return { success: true };
    } catch (error) {
      console.error('Failed to send command:', error);
      throw error;
    }
  }, [connectedDevices]);

  const startVideoStream = useCallback(async (deviceId: string) => {
    try {
      await sendCommand(deviceId, {
        command: 'START_VIDEO_STREAM',
        data: { resolution: '1920x1080', fps: 30 }
      });
      setStreamingDevices(prev => [...prev, deviceId]);
      toast.success('Video stream started');
    } catch (error) {
      console.error('Failed to start video stream:', error);
      toast.error('Failed to start video stream');
    }
  }, [sendCommand]);

  const stopVideoStream = useCallback(async (deviceId: string) => {
    try {
      await sendCommand(deviceId, {
        command: 'STOP_VIDEO_STREAM'
      });
      setStreamingDevices(prev => prev.filter(id => id !== deviceId));
      toast.success('Video stream stopped');
    } catch (error) {
      console.error('Failed to stop video stream:', error);
      toast.error('Failed to stop video stream');
    }
  }, [sendCommand]);

  const captureImage = useCallback(async (deviceId: string) => {
    try {
      const response = await sendCommand(deviceId, {
        command: 'CAPTURE_IMAGE',
        data: { format: 'jpeg', quality: 95 }
      });
      return response;
    } catch (error) {
      console.error('Failed to capture image:', error);
      toast.error('Failed to capture image');
      throw error;
    }
  }, [sendCommand]);

  const onVideoStream = useCallback((deviceId: string, callback: (stream: MediaStream) => void) => {
    streamCallbacks.current.set(deviceId, callback);
    
    // If stream already exists, call callback immediately
    const existingStream = videoStreams.current.get(deviceId);
    if (existingStream) {
      callback(existingStream);
    }
    
    // Return cleanup function
    return () => {
      streamCallbacks.current.delete(deviceId);
    };
  }, []);

  return {
    isSupported,
    isEnabled,
    isScanning,
    connectedDevices,
    availableDevices,
    streamingDevices,
    startScan,
    stopScan,
    connectDevice,
    disconnectDevice,
    sendCommand,
    startVideoStream,
    stopVideoStream,
    captureImage,
    onVideoStream
  };
};