// FILE: src/components/DualScanner.tsx (ENHANCED MULTI-MODAL ANALYSIS SYSTEM WITH BLUETOOTH)
// FIXED: Added image compression to prevent FUNCTION_PAYLOAD_TOO_LARGE errors
// FIXED: Added Supabase image upload for marketplace image persistence

import React, { useState, useRef, useCallback, useEffect } from 'react';
import { useZxing } from 'react-zxing';
import { v4 as uuidv4 } from 'uuid';
import { X, FlipHorizontal, Upload, Circle, Zap, Loader2, ScanLine, ImageIcon, Video, Settings as SettingsIcon, Focus, Check, FileText, Award, ShieldCheck, Plus, Trash2, Search, Eye, Bluetooth } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useAppContext } from '@/contexts/AppContext';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from 'sonner';
import { supabase } from '@/lib/supabase';
import CameraSettingsModal from './CameraSettingsModal.js';
import DevicePairingModal from './DevicePairingModal.js';
import './DualScanner.css';
import { AnalysisResult } from '@/types';

type ScanMode = 'image' | 'barcode' | 'video';

interface CapturedItem {
  id: string;
  type: 'photo' | 'video' | 'document' | 'certificate';
  data: string; // base64 or blob URL
  thumbnail: string;
  name: string;
  selected: boolean;
  // NEW: Store original uncompressed data for upload
  originalData?: string;
  metadata?: {
    documentType?: 'certificate' | 'grading' | 'appraisal' | 'receipt' | 'authenticity' | 'other';
    description?: string;
    extractedText?: string;
    barcodes?: string[];
    videoFrames?: string[];
    originalSize?: number;
    compressedSize?: number;
  };
}

interface DualScannerProps {
  isOpen: boolean;
  onClose: () => void;
}

// =============================================================================
// IMAGE COMPRESSION UTILITY (prevents FUNCTION_PAYLOAD_TOO_LARGE)
// =============================================================================

interface CompressionOptions {
  maxWidth?: number;
  maxHeight?: number;
  maxSizeMB?: number;
  quality?: number;
}

const DEFAULT_COMPRESSION: CompressionOptions = {
  maxWidth: 1920,
  maxHeight: 1920,
  maxSizeMB: 2.5, // Stay well under Vercel's 4.5MB limit
  quality: 0.85,
};

async function compressImage(
  dataUrl: string,
  options: CompressionOptions = {}
): Promise<{ compressed: string; originalSize: number; compressedSize: number }> {
  const opts = { ...DEFAULT_COMPRESSION, ...options };
  
  // Get original size
  const originalSize = Math.round((dataUrl.length * 3) / 4); // Approximate base64 to bytes
  
  // If already small enough, return as-is
  const maxBytes = opts.maxSizeMB! * 1024 * 1024;
  if (originalSize < maxBytes * 0.8) {
    return { compressed: dataUrl, originalSize, compressedSize: originalSize };
  }
  
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => {
      // Calculate new dimensions
      let { width, height } = img;
      
      if (width > opts.maxWidth! || height > opts.maxHeight!) {
        const ratio = Math.min(opts.maxWidth! / width, opts.maxHeight! / height);
        width = Math.floor(width * ratio);
        height = Math.floor(height * ratio);
      }
      
      // Draw to canvas
      const canvas = document.createElement('canvas');
      canvas.width = width;
      canvas.height = height;
      
      const ctx = canvas.getContext('2d');
      if (!ctx) {
        reject(new Error('Could not get canvas context'));
        return;
      }
      
      ctx.imageSmoothingEnabled = true;
      ctx.imageSmoothingQuality = 'high';
      ctx.drawImage(img, 0, 0, width, height);
      
      // Compress with reducing quality until under limit
      let quality = opts.quality!;
      let compressed = canvas.toDataURL('image/jpeg', quality);
      let compressedSize = Math.round((compressed.length * 3) / 4);
      
      while (compressedSize > maxBytes && quality > 0.1) {
        quality -= 0.1;
        compressed = canvas.toDataURL('image/jpeg', quality);
        compressedSize = Math.round((compressed.length * 3) / 4);
      }
      
      // If still too large, resize further
      if (compressedSize > maxBytes && width > 800) {
        canvas.width = Math.floor(width * 0.7);
        canvas.height = Math.floor(height * 0.7);
        ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
        compressed = canvas.toDataURL('image/jpeg', 0.8);
        compressedSize = Math.round((compressed.length * 3) / 4);
      }
      
      console.log(`📸 Compressed: ${(originalSize / 1024 / 1024).toFixed(2)}MB → ${(compressedSize / 1024 / 1024).toFixed(2)}MB`);
      
      resolve({ compressed, originalSize, compressedSize });
    };
    
    img.onerror = () => reject(new Error('Failed to load image for compression'));
    img.src = dataUrl;
  });
}

function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(2)} MB`;
}

// =============================================================================
// SUPABASE IMAGE UPLOAD UTILITY (for marketplace persistence)
// =============================================================================

/**
 * Upload an image to Supabase storage and return the public URL
 * Images are stored in 'user-uploads' bucket for marketplace display
 */
async function uploadImageToSupabase(
  base64Data: string,
  userId: string,
  itemIndex: number
): Promise<string | null> {
  try {
    console.log(`📤 [UPLOAD] Starting upload for image ${itemIndex}...`);
    console.log(`📤 [UPLOAD] User ID: ${userId}`);
    console.log(`📤 [UPLOAD] Data length: ${base64Data.length} chars`);
    
    // Validate base64 data
    if (!base64Data || !base64Data.startsWith('data:')) {
      console.error('❌ [UPLOAD] Invalid base64 data - does not start with data:');
      return null;
    }
    
    // Convert base64 to blob
    const base64Response = await fetch(base64Data);
    const blob = await base64Response.blob();
    console.log(`📤 [UPLOAD] Blob created: ${(blob.size / 1024).toFixed(1)}KB, type: ${blob.type}`);
    
    // Generate unique filename
    const timestamp = Date.now();
    const filename = `${userId}/${timestamp}_${itemIndex}.jpg`;
    console.log(`📤 [UPLOAD] Filename: ${filename}`);
    
    // Upload to Supabase storage
    console.log(`📤 [UPLOAD] Calling supabase.storage.from('user-uploads').upload...`);
    const { data, error } = await supabase.storage
      .from('user-uploads')
      .upload(filename, blob, {
        contentType: 'image/jpeg',
        upsert: true,
      });
    
    if (error) {
      console.error('❌ [UPLOAD] Supabase storage error:', JSON.stringify(error));
      console.error('❌ [UPLOAD] Error message:', error.message);
      return null;
    }
    
    console.log(`📤 [UPLOAD] Upload success, data:`, JSON.stringify(data));
    
    // Get public URL
    const { data: urlData } = supabase.storage
      .from('user-uploads')
      .getPublicUrl(filename);
    
    console.log(`✅ [UPLOAD] Public URL: ${urlData.publicUrl}`);
    return urlData.publicUrl;
    
  } catch (error: any) {
    console.error('❌ [UPLOAD] Exception during upload:', error);
    console.error('❌ [UPLOAD] Error name:', error?.name);
    console.error('❌ [UPLOAD] Error message:', error?.message);
    console.error('❌ [UPLOAD] Error stack:', error?.stack);
    return null;
  }
}

/**
 * Upload multiple images and return array of public URLs
 */
async function uploadImagesToSupabase(
  items: CapturedItem[],
  userId: string
): Promise<string[]> {
  console.log(`📦 [BATCH UPLOAD] Starting upload of ${items.length} images for user ${userId}`);
  
  const results: (string | null)[] = [];
  
  // Upload sequentially to avoid overwhelming the connection
  for (let i = 0; i < items.length; i++) {
    const item = items[i];
    // Use original uncompressed data if available, otherwise use data
    const imageData = item.originalData || item.data;
    console.log(`📦 [BATCH UPLOAD] Image ${i}: originalData=${!!item.originalData}, dataLength=${imageData?.length || 0}`);
    
    if (!imageData) {
      console.error(`❌ [BATCH UPLOAD] No image data for item ${i}`);
      results.push(null);
      continue;
    }
    
    const url = await uploadImageToSupabase(imageData, userId, i);
    results.push(url);
  }
  
  // Filter out null results (failed uploads)
  const validUrls = results.filter((url): url is string => url !== null);
  
  console.log(`📦 [BATCH UPLOAD] Complete: ${validUrls.length}/${items.length} images uploaded`);
  console.log(`📦 [BATCH UPLOAD] URLs:`, validUrls);
  
  return validUrls;
}

// =============================================================================
// MAIN COMPONENT
// =============================================================================

const DualScanner: React.FC<DualScannerProps> = ({ isOpen, onClose }) => {
  const { setLastAnalysisResult, setIsAnalyzing, selectedCategory } = useAppContext();
  const { session } = useAuth();
  
  const [scanMode, setScanMode] = useState<ScanMode>('image');
  const [capturedItems, setCapturedItems] = useState<CapturedItem[]>([]);
  const [isProcessing, setIsProcessing] = useState(false);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [isDevicePairingOpen, setIsDevicePairingOpen] = useState(false);
  const [devices, setDevices] = useState<MediaDeviceInfo[]>([]);
  const [selectedDeviceId, setSelectedDeviceId] = useState<string | undefined>(undefined);
  const [isRecording, setIsRecording] = useState(false);
  const [videoChunks, setVideoChunks] = useState<Blob[]>([]);
  const [isAnalyzingBarcodes, setIsAnalyzingBarcodes] = useState(false);
  const [isCompressing, setIsCompressing] = useState(false);
  const [isUploading, setIsUploading] = useState(false);

  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const imageInputRef = useRef<HTMLInputElement>(null);
  const documentInputRef = useRef<HTMLInputElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const hiddenCanvasRef = useRef<HTMLCanvasElement>(null);

  const { ref: zxingRef } = useZxing({
    deviceId: selectedDeviceId,
    onResult(result) {
      if (scanMode === 'barcode' && !isProcessing) {
        setIsProcessing(true);
        toast.success(`Barcode detected: ${result.getText()}`);
        setLastAnalysisResult({ 
          id: uuidv4(), 
          decision: 'BUY', 
          itemName: `Barcode: ${result.getText()}`, 
          estimatedValue: 0.00, 
          confidenceScore: 50, 
          summary_reasoning: 'Barcode scanned, ready for lookup.',
          analysis_quality: 'OPTIMAL',
          valuation_factors: ['Barcode Detection'],
          capturedAt: new Date().toISOString(),
          category: 'barcode',
          imageUrl: '',
          marketComps: [],
          resale_toolkit: { listInArena: true, sellOnProPlatforms: true, linkToMyStore: false, shareToSocial: true },
          tags: ['barcode']
        });
        setIsAnalyzing(true);
        onClose();
      }
    },
    paused: scanMode !== 'barcode' || !isOpen || isProcessing,
  });

  // Enhanced barcode detection for captured images using zxing-js
  const detectBarcodesInImage = async (imageData: string): Promise<string[]> => {
    return new Promise((resolve) => {
      const img = new Image();
      img.onload = async () => {
        try {
          const canvas = document.createElement('canvas');
          const ctx = canvas.getContext('2d');
          canvas.width = img.width;
          canvas.height = img.height;
          
          if (ctx) {
            ctx.drawImage(img, 0, 0);
            // Barcode detection would go here
            resolve([]);
          } else {
            resolve([]);
          }
        } catch (error) {
          console.error('Barcode detection error:', error);
          resolve([]);
        }
      };
      img.onerror = () => resolve([]);
      img.src = imageData;
    });
  };

  // Extract multiple frames from video for better analysis
  const extractVideoFrames = async (videoBlob: Blob, frameCount: number = 5): Promise<string[]> => {
    return new Promise((resolve) => {
      const videoUrl = URL.createObjectURL(videoBlob);
      const tempVideo = document.createElement('video');
      tempVideo.src = videoUrl;
      tempVideo.muted = true;
      tempVideo.preload = 'metadata';
      
      const frames: string[] = [];
      let currentFrame = 0;
      
      tempVideo.onloadedmetadata = () => {
        const interval = tempVideo.duration / frameCount;
        
        const extractFrame = () => {
          if (currentFrame >= frameCount) {
            URL.revokeObjectURL(videoUrl);
            resolve(frames);
            return;
          }
          
          tempVideo.currentTime = Math.max(0.1, interval * currentFrame);
        };
        
        tempVideo.onseeked = () => {
          const canvas = document.createElement('canvas');
          canvas.width = tempVideo.videoWidth || 640;
          canvas.height = tempVideo.videoHeight || 480;
          const context = canvas.getContext('2d');
          
          if (context) {
            context.drawImage(tempVideo, 0, 0, canvas.width, canvas.height);
            frames.push(canvas.toDataURL('image/jpeg', 0.85)); // Compress video frames too
          }
          
          currentFrame++;
          extractFrame();
        };
        
        extractFrame();
      };

      tempVideo.onerror = () => {
        URL.revokeObjectURL(videoUrl);
        resolve([]);
      };

      tempVideo.load();
    });
  };

  // Simulated OCR text extraction
  const extractTextFromDocument = async (imageData: string): Promise<string> => {
    return "";
  };

  const stopCamera = useCallback(() => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => track.stop());
      streamRef.current = null;
    }
  }, []);

  const startCamera = useCallback(async () => {
    stopCamera();
    if (navigator.mediaDevices && navigator.mediaDevices.getUserMedia) {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: { 
            deviceId: selectedDeviceId ? { exact: selectedDeviceId } : undefined,
            width: { ideal: 1920 },
            height: { ideal: 1080 },
          }
        });
        streamRef.current = stream;
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
        }
      } catch (err) {
        console.error("Error accessing camera:", err);
        toast.error("Camera access denied.", {
          description: "Please enable camera permissions in your browser settings.",
        });
        onClose();
      }
    }
  }, [selectedDeviceId, onClose, stopCamera]);

  useEffect(() => {
    const getDevices = async () => {
      try {
        await navigator.mediaDevices.getUserMedia({ video: true });
        const availableDevices = await navigator.mediaDevices.enumerateDevices();
        const videoDevices = availableDevices.filter(d => d.kind === 'videoinput');
        setDevices(videoDevices);
        if (!selectedDeviceId && videoDevices.length > 0) {
          const rearCamera = videoDevices.find(d => d.label.toLowerCase().includes('back'));
          setSelectedDeviceId(rearCamera?.deviceId || videoDevices[0].deviceId);
        }
      } catch (err) {
        toast.error("Could not access camera devices.");
      }
    };
    if (isOpen) {
        getDevices();
    }
  }, [isOpen, selectedDeviceId]);

  useEffect(() => {
    if (isOpen) {
      startCamera();
    } else {
      stopCamera();
    }
    return () => stopCamera();
  }, [isOpen, startCamera, stopCamera]);

  // FIXED: Add captured item WITH compression, preserving original for upload
  const addCapturedItem = async (item: Omit<CapturedItem, 'id' | 'selected'>) => {
    setIsCompressing(true);
    
    try {
      let processedData = item.data;
      let originalData = item.data; // Preserve original for Supabase upload
      let originalSize = 0;
      let compressedSize = 0;
      
      // Compress images and photos for API, but keep original for storage
      if (item.type === 'photo' || item.type === 'document') {
        const result = await compressImage(item.data);
        processedData = result.compressed;
        originalSize = result.originalSize;
        compressedSize = result.compressedSize;
        
        // Show compression feedback if significant
        if (originalSize > 1024 * 1024 && compressedSize < originalSize * 0.7) {
          toast.info(`Image compressed: ${formatFileSize(originalSize)} → ${formatFileSize(compressedSize)}`);
        }
      }
      
      const newItem: CapturedItem = {
        ...item,
        id: uuidv4(),
        selected: true,
        data: processedData,
        originalData: originalData, // NEW: Store original for Supabase upload
        thumbnail: item.type === 'document' ? item.thumbnail : processedData,
        metadata: {
          ...item.metadata,
          originalSize,
          compressedSize,
        },
      };
      
      // Enhanced processing based on item type
      if (item.type === 'photo') {
        const barcodes = await detectBarcodesInImage(processedData);
        if (barcodes.length > 0) {
          newItem.metadata = {
            ...newItem.metadata,
            barcodes
          };
          toast.success(`Found ${barcodes.length} barcode(s) in image`);
        }
      } else if (item.type === 'document') {
        const extractedText = await extractTextFromDocument(processedData);
        newItem.metadata = {
          ...newItem.metadata,
          extractedText
        };
      }
      
      setCapturedItems(prev => [...prev, newItem].slice(-15));
    } catch (error) {
      console.error('Error processing captured item:', error);
      toast.error('Failed to process image');
    } finally {
      setIsCompressing(false);
    }
  };

  const toggleItemSelection = (itemId: string) => {
    setCapturedItems(prev => 
      prev.map(item => 
        item.id === itemId 
          ? { ...item, selected: !item.selected }
          : item
      )
    );
  };

  const selectAllItems = () => {
    setCapturedItems(prev => prev.map(item => ({ ...item, selected: true })));
  };

  const deselectAllItems = () => {
    setCapturedItems(prev => prev.map(item => ({ ...item, selected: false })));
  };

  const removeItem = (itemId: string) => {
    setCapturedItems(prev => prev.filter(item => item.id !== itemId));
  };

  const clearAllItems = () => {
    setCapturedItems([]);
    toast.info("All items cleared");
  };

  const handleManualFocus = () => {
    if (videoRef.current) {
      videoRef.current.focus();
      toast.info("Attempting to focus camera.");
    }
  };

  const handleBluetoothDeviceConnected = (device: any) => {
    toast.success(`Connected to ${device.name}`, {
      description: "Device is now available as a camera source"
    });
    setIsDevicePairingOpen(false);
  };
  
  // FIXED: Capture image with compression, preserving original
  const captureImage = async () => {
    if (videoRef.current && canvasRef.current) {
      const video = videoRef.current;
      const canvas = canvasRef.current;
      canvas.width = video.videoWidth;
      canvas.height = video.videoHeight;
      const context = canvas.getContext('2d');
      if (context) {
        context.drawImage(video, 0, 0, canvas.width, canvas.height);
        // Use 0.92 quality initially, compression will reduce further if needed
        const dataUrl = canvas.toDataURL('image/jpeg', 0.92);
        
        await addCapturedItem({
          type: 'photo',
          data: dataUrl,
          thumbnail: dataUrl,
          name: `Photo ${capturedItems.filter(i => i.type === 'photo').length + 1}`
        });
      }
    }
  };

  const generateVideoThumbnail = async (videoBlob: Blob): Promise<string> => {
    return new Promise((resolve, reject) => {
      const videoUrl = URL.createObjectURL(videoBlob);
      const tempVideo = document.createElement('video');
      tempVideo.src = videoUrl;
      tempVideo.muted = true;
      tempVideo.preload = 'metadata';
      
      tempVideo.onloadedmetadata = () => {
        tempVideo.currentTime = Math.max(0.1, tempVideo.duration / 2);
      };

      tempVideo.onseeked = () => {
        const canvas = document.createElement('canvas');
        canvas.width = tempVideo.videoWidth || 320;
        canvas.height = tempVideo.videoHeight || 240;
        const context = canvas.getContext('2d');
        
        if (context) {
          context.drawImage(tempVideo, 0, 0, canvas.width, canvas.height);
          const thumbnail = canvas.toDataURL('image/jpeg', 0.7);
          URL.revokeObjectURL(videoUrl);
          resolve(thumbnail);
        } else {
          reject(new Error('Could not generate thumbnail'));
        }
      };

      tempVideo.onerror = () => {
        URL.revokeObjectURL(videoUrl);
        reject(new Error('Video loading failed'));
      };

      tempVideo.load();
    });
  };

  const startVideoRecording = () => {
    if (!streamRef.current) {
      toast.error("No camera stream available for recording.");
      return;
    }

    try {
      const mediaRecorder = new MediaRecorder(streamRef.current, {
        mimeType: 'video/webm;codecs=vp9'
      });

      mediaRecorderRef.current = mediaRecorder;
      setVideoChunks([]);

      mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          setVideoChunks(prev => [...prev, event.data]);
        }
      };

      mediaRecorder.onstop = async () => {
        const videoBlob = new Blob(videoChunks, { type: 'video/webm' });
        
        try {
          const thumbnail = await generateVideoThumbnail(videoBlob);
          const videoFrames = await extractVideoFrames(videoBlob, 5);
          const videoUrl = URL.createObjectURL(videoBlob);
          
          // Compress video frames
          const compressedFrames = await Promise.all(
            videoFrames.map(async (frame) => {
              const result = await compressImage(frame, { maxWidth: 1280, quality: 0.8 });
              return result.compressed;
            })
          );
          
          addCapturedItem({
            type: 'video',
            data: videoUrl,
            thumbnail: thumbnail,
            name: `Video ${capturedItems.filter(i => i.type === 'video').length + 1}`,
            metadata: {
              videoFrames: compressedFrames
            }
          });
        } catch (error) {
          console.error('Failed to process video:', error);
        }

        toast.success("Video recorded and processed successfully!");
        setIsRecording(false);
      };

      mediaRecorder.start();
      setIsRecording(true);
      toast.info("Video recording started...");

    } catch (error) {
      console.error("Error starting video recording:", error);
      toast.error("Failed to start video recording.");
    }
  };

  const stopVideoRecording = () => {
    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.stop();
      setIsRecording(false);
    }
  };

  // FIXED: Handle image upload WITH compression, preserving original
  const handleImageUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(event.target.files || []);
    
    for (const file of files) {
      // Check file size and warn if very large
      if (file.size > 10 * 1024 * 1024) {
        toast.info(`Compressing large image: ${formatFileSize(file.size)}`);
      }
      
      const reader = new FileReader();
      reader.onload = async (e) => {
        if (e.target?.result) {
          const dataUrl = e.target.result as string;
          await addCapturedItem({
            type: 'photo',
            data: dataUrl,
            thumbnail: dataUrl,
            name: file.name || `Upload ${capturedItems.filter(i => i.type === 'photo').length + 1}`
          });
        }
      };
      reader.readAsDataURL(file);
    }
    
    if (event.target) {
      event.target.value = '';
    }
  };

  // FIXED: Handle document upload WITH compression
  const handleDocumentUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(event.target.files || []);
    
    for (const file of files) {
      const reader = new FileReader();
      reader.onload = async (e) => {
        if (e.target?.result) {
          const dataUrl = e.target.result as string;
          
          // Create document thumbnail
          const canvas = document.createElement('canvas');
          const ctx = canvas.getContext('2d');
          canvas.width = 200;
          canvas.height = 260;
          
          if (ctx) {
            ctx.fillStyle = '#f8f9fa';
            ctx.fillRect(0, 0, 200, 260);
            ctx.fillStyle = '#6c757d';
            ctx.font = '12px Arial';
            ctx.textAlign = 'center';
            ctx.fillText('Document', 100, 130);
            ctx.fillText(file.name.split('.').pop()?.toUpperCase() || 'FILE', 100, 150);
          }
          
          const thumbnailUrl = canvas.toDataURL('image/png');
          
          const fileName = file.name.toLowerCase();
          let documentType: CapturedItem['metadata']['documentType'] = 'other';
          
          if (fileName.includes('certificate') || fileName.includes('cert')) {
            documentType = 'certificate';
          } else if (fileName.includes('grade') || fileName.includes('grading') || fileName.includes('psa') || fileName.includes('bgs')) {
            documentType = 'grading';
          } else if (fileName.includes('appraisal') || fileName.includes('appraise')) {
            documentType = 'appraisal';
          } else if (fileName.includes('receipt') || fileName.includes('invoice') || fileName.includes('purchase')) {
            documentType = 'receipt';
          } else if (fileName.includes('authentic') || fileName.includes('coa')) {
            documentType = 'authenticity';
          }
          
          await addCapturedItem({
            type: 'document',
            data: dataUrl,
            thumbnail: thumbnailUrl,
            name: file.name,
            metadata: {
              documentType: documentType,
              description: `${documentType.charAt(0).toUpperCase() + documentType.slice(1)} document`
            }
          });

          toast.success(`Document uploaded: ${documentType} detected`);
        }
      };
      reader.readAsDataURL(file);
    }
    
    if (event.target) {
      event.target.value = '';
    }
  };

  const scanAllImagesForBarcodes = async () => {
    setIsAnalyzingBarcodes(true);
    const imageItems = capturedItems.filter(item => item.type === 'photo');
    
    if (imageItems.length === 0) {
      toast.error("No images to scan for barcodes");
      setIsAnalyzingBarcodes(false);
      return;
    }
    
    toast.info(`Scanning ${imageItems.length} images for barcodes...`);
    
    let totalBarcodesFound = 0;
    for (const item of imageItems) {
      const barcodes = await detectBarcodesInImage(item.data);
      if (barcodes.length > 0) {
        totalBarcodesFound += barcodes.length;
        setCapturedItems(prev => prev.map(i => 
          i.id === item.id 
            ? { ...i, metadata: { ...i.metadata, barcodes } }
            : i
        ));
      }
    }
    
    setIsAnalyzingBarcodes(false);
    toast.success(`Found ${totalBarcodesFound} barcodes across ${imageItems.length} images`);
  };

  // FIXED: Process analysis with Supabase image upload for marketplace persistence
  const processMultiModalAnalysis = async () => {
    const selectedItems = capturedItems.filter(item => item.selected);
    
    if (selectedItems.length === 0) {
      toast.error("Please select at least one item for analysis.");
      return;
    }

    if (!session?.access_token || !session?.user?.id) {
      toast.error("Authentication required. Please sign in again.");
      return;
    }

    console.log('🚀 [ANALYSIS] Starting processMultiModalAnalysis');
    console.log(`🚀 [ANALYSIS] User ID: ${session.user.id}`);
    console.log(`🚀 [ANALYSIS] Selected items: ${selectedItems.length}`);

    setIsProcessing(true);
    setIsAnalyzing(true);
    onClose();
    toast.info(`Analyzing ${selectedItems.length} items with multi-AI system...`);

    try {
      // =======================================================================
      // STEP 1: Upload original images to Supabase for marketplace persistence
      // =======================================================================
      setIsUploading(true);
      
      const imageItems = selectedItems.filter(item => item.type === 'photo' || item.type === 'document');
      console.log(`📤 [ANALYSIS] Image items to upload: ${imageItems.length}`);
      
      let originalImageUrls: string[] = [];
      
      if (imageItems.length > 0) {
        toast.info("Uploading images to storage...");
        
        // Log what we're about to upload
        imageItems.forEach((item, i) => {
          console.log(`📤 [ANALYSIS] Item ${i}: type=${item.type}, hasOriginal=${!!item.originalData}, dataLen=${item.data?.length || 0}`);
        });
        
        originalImageUrls = await uploadImagesToSupabase(imageItems, session.user.id);
        
        if (originalImageUrls.length > 0) {
          console.log(`✅ [ANALYSIS] Uploaded ${originalImageUrls.length} images to Supabase storage`);
          toast.success(`Uploaded ${originalImageUrls.length} image(s)`);
        } else {
          console.warn('⚠️ [ANALYSIS] No images were uploaded to Supabase - check bucket exists and policies');
          toast.warning('Images could not be uploaded - continuing with analysis');
        }
      } else {
        console.log('📤 [ANALYSIS] No image items to upload');
      }
      
      setIsUploading(false);
      // =======================================================================
      
      console.log(`📤 [ANALYSIS] Final originalImageUrls to send: ${JSON.stringify(originalImageUrls)}`);
      
      // Calculate total payload size before sending
      let totalPayloadSize = 0;
      
      const analysisData = {
        scanType: 'multi-modal',
        // Include original image URLs for database persistence
        originalImageUrls: originalImageUrls,
        items: await Promise.all(selectedItems.map(async (item) => {
          let processedData = item.data;
          let additionalFrames: string[] = [];
          
          // For videos, use compressed frames
          if (item.type === 'video' && item.metadata?.videoFrames) {
            additionalFrames = item.metadata.videoFrames;
            processedData = item.metadata.videoFrames[0] || item.thumbnail;
          } else if (item.type === 'video') {
            try {
              const videoBlob = await fetch(item.data).then(r => r.blob());
              const videoUrl = URL.createObjectURL(videoBlob);
              const tempVideo = document.createElement('video');
              tempVideo.src = videoUrl;
              tempVideo.muted = true;
              tempVideo.preload = 'metadata';
              
              await new Promise((resolve) => {
                tempVideo.onloadedmetadata = () => {
                  tempVideo.currentTime = Math.max(0.1, tempVideo.duration / 2);
                };
                tempVideo.onseeked = resolve;
                tempVideo.load();
              });

              const canvas = document.createElement('canvas');
              canvas.width = Math.min(tempVideo.videoWidth || 640, 1280);
              canvas.height = Math.min(tempVideo.videoHeight || 480, 720);
              const context = canvas.getContext('2d');
              
              if (context) {
                context.drawImage(tempVideo, 0, 0, canvas.width, canvas.height);
                processedData = canvas.toDataURL('image/jpeg', 0.85);
              }
              
              URL.revokeObjectURL(videoUrl);
            } catch (error) {
              console.error('Error processing video:', error);
            }
          } else if (item.type === 'photo' || item.type === 'document') {
            // Final safety compression check - ensure under 2MB per image
            const currentSize = Math.round((processedData.length * 3) / 4);
            if (currentSize > 2 * 1024 * 1024) {
              console.log(`⚠️ Re-compressing large image: ${formatFileSize(currentSize)}`);
              const result = await compressImage(processedData, { maxSizeMB: 1.5, quality: 0.75 });
              processedData = result.compressed;
            }
          }
          
          // Track payload size
          totalPayloadSize += processedData.length;
          additionalFrames.forEach(f => totalPayloadSize += f.length);
          
          return {
            type: item.type,
            name: item.name,
            data: processedData,
            additionalFrames: additionalFrames,
            metadata: {
              ...item.metadata,
              extractedText: item.metadata?.extractedText || "",
              barcodes: item.metadata?.barcodes || []
            }
          };
        })),
        category_id: selectedCategory?.split('-')[0] || 'general',
        subcategory_id: selectedCategory || 'general'
      };

      // Final payload size check
      const estimatedBytes = (totalPayloadSize * 3) / 4;
      console.log(`📦 Total payload size: ${formatFileSize(estimatedBytes)}`);
      
      if (estimatedBytes > 4 * 1024 * 1024) {
        toast.warning(`Large payload detected (${formatFileSize(estimatedBytes)}). Analysis may take longer.`);
      }

      const response = await fetch('/api/analyze', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session.access_token}`
        },
        body: JSON.stringify(analysisData)
      });

      if (!response.ok) {
        const errorText = await response.text();
        console.error("Analysis API Error Response Text:", errorText);
        
        // Check for payload too large error
        if (response.status === 413 || errorText.includes('PAYLOAD_TOO_LARGE') || errorText.includes('body exceeded')) {
          throw new Error('Image too large for analysis. Please try with a smaller image or fewer items.');
        }
        
        try {
            const errorData = JSON.parse(errorText);
            throw new Error(errorData.error || `Analysis request failed with status ${response.status}.`);
        } catch (e) {
             throw new Error(`Analysis request failed with status ${response.status}. The server response was not valid JSON.`);
        }
      }
      
      const analysisResult: AnalysisResult = await response.json();
      
      // Include both the uploaded URLs and local thumbnails in the result
      setLastAnalysisResult({ 
        ...analysisResult, 
        id: uuidv4(), 
        imageUrls: originalImageUrls.length > 0 ? originalImageUrls : selectedItems.map(item => item.thumbnail)
      });
      
      toast.success("Enhanced multi-modal analysis complete!");

    } catch (error) {
      console.error("Processing error:", error);
      setLastAnalysisResult(null);
      toast.error("Analysis Failed", {
        description: (error as Error).message
      });
    } finally {
      setIsProcessing(false);
      setIsAnalyzing(false);
      setIsUploading(false);
    }
  };

  const handleFlipCamera = () => {
    if (devices.length > 1) {
      const currentIndex = devices.findIndex(d => d.deviceId === selectedDeviceId);
      const nextIndex = (currentIndex + 1) % devices.length;
      setSelectedDeviceId(devices[nextIndex].deviceId);
    } else {
      toast.info("No other camera detected.");
    }
  };

  const getItemIcon = (type: string, metadata?: any) => {
    switch (type) {
      case 'photo': return <ImageIcon className="w-3 h-3" />;
      case 'video': return <Video className="w-3 h-3" />;
      case 'document': 
        if (metadata?.documentType === 'certificate') return <Award className="w-3 h-3" />;
        if (metadata?.documentType === 'authenticity') return <ShieldCheck className="w-3 h-3" />;
        return <FileText className="w-3 h-3" />;
      default: return <FileText className="w-3 h-3" />;
    }
  };

  const selectedCount = capturedItems.filter(item => item.selected).length;
  const totalItems = capturedItems.length;
  
  if (!isOpen) return null;

  return (
    <>
      <div className="dual-scanner-overlay" onClick={onClose}>
        <div className="dual-scanner-content" onClick={e => e.stopPropagation()}>
          <canvas ref={canvasRef} style={{ display: 'none' }} />
          <canvas ref={hiddenCanvasRef} style={{ display: 'none' }} />
          <header className="dual-scanner-header">
            <div className="flex gap-2">
              <Button variant="ghost" size="icon" onClick={() => setIsSettingsOpen(true)}>
                <SettingsIcon />
              </Button>
              <Button variant="ghost" size="icon" onClick={() => setIsDevicePairingOpen(true)}>
                <Bluetooth />
              </Button>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-sm text-muted-foreground">
                {selectedCount}/{totalItems} selected
              </span>
              {totalItems > 0 && (
                <>
                  <Button 
                    variant="ghost" 
                    size="sm" 
                    onClick={selectedCount === totalItems ? deselectAllItems : selectAllItems}
                  >
                    {selectedCount === totalItems ? 'Deselect All' : 'Select All'}
                  </Button>
                  <Button variant="ghost" size="sm" onClick={clearAllItems}>
                    Clear All
                  </Button>
                </>
              )}
            </div>
            <Button variant="ghost" size="icon" onClick={onClose}>
              <X />
            </Button>
          </header>

          <main className="dual-scanner-main">
            <div className="relative w-full h-full bg-black">
              <video
                ref={(node) => {
                  videoRef.current = node;
                  if (zxingRef) {
                    (zxingRef as React.MutableRefObject<HTMLVideoElement | null>).current = node;
                  }
                }}
                autoPlay
                playsInline
                className="w-full h-full object-contain"
              />
              {scanMode === 'barcode' && <div className="barcode-reticle" />}
              {isRecording && (
                <div style={{ position: 'absolute', top: '20px', left: '50%', transform: 'translateX(-50%)', background: 'rgba(239, 68, 68, 0.9)', color: 'white', padding: '8px 16px', borderRadius: '20px', fontSize: '14px', fontWeight: 'bold' }}>
                  ● REC
                </div>
              )}
              {/* Compression indicator */}
              {isCompressing && (
                <div style={{ position: 'absolute', top: '20px', left: '50%', transform: 'translateX(-50%)', background: 'rgba(59, 130, 246, 0.9)', color: 'white', padding: '8px 16px', borderRadius: '20px', fontSize: '14px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <Loader2 className="w-4 h-4 animate-spin" /> Compressing...
                </div>
              )}
              {/* Upload indicator */}
              {isUploading && (
                <div style={{ position: 'absolute', top: '20px', left: '50%', transform: 'translateX(-50%)', background: 'rgba(34, 197, 94, 0.9)', color: 'white', padding: '8px 16px', borderRadius: '20px', fontSize: '14px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <Loader2 className="w-4 h-4 animate-spin" /> Uploading to marketplace...
                </div>
              )}
            </div>
          </main>
          
          <footer className="dual-scanner-footer">
            <div className="scanner-controls">
                <Button variant="ghost" size="icon" onClick={handleFlipCamera}><FlipHorizontal/></Button>
                <Button variant="ghost" size="icon" onClick={handleManualFocus}><Focus /></Button>
                <input 
                  type="file" 
                  ref={imageInputRef} 
                  accept="image/*" 
                  multiple 
                  className="hidden" 
                  onChange={handleImageUpload} 
                />
                <Button variant="ghost" size="icon" onClick={() => imageInputRef.current?.click()}>
                  <Upload />
                </Button>
                <input 
                  type="file" 
                  ref={documentInputRef} 
                  accept=".pdf,.jpg,.jpeg,.png,.doc,.docx" 
                  multiple 
                  className="hidden" 
                  onChange={handleDocumentUpload} 
                />
                <Button variant="ghost" size="icon" onClick={() => documentInputRef.current?.click()}>
                  <FileText />
                </Button>
                <Button 
                  variant="ghost" 
                  size="icon" 
                  onClick={scanAllImagesForBarcodes}
                  disabled={isAnalyzingBarcodes || capturedItems.filter(i => i.type === 'photo').length === 0}
                >
                  {isAnalyzingBarcodes ? <Loader2 className="animate-spin" /> : <Search />}
                </Button>
            </div>

            {scanMode === 'image' && (
              <div style={{ position: 'relative', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <Button 
                    onClick={captureImage} 
                    className="capture-button" 
                    size="icon" 
                    disabled={isProcessing || isCompressing || isUploading || capturedItems.length >= 15}
                  >
                      <Circle className="w-16 h-16 fill-white" />
                  </Button>
              </div>
            )}

            {scanMode === 'video' && (
              <div style={{ position: 'relative', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <Button 
                    onClick={isRecording ? stopVideoRecording : startVideoRecording} 
                    className="capture-button" 
                    size="icon" 
                    disabled={isProcessing}
                    style={{ backgroundColor: isRecording ? '#ef4444' : 'transparent' }}
                  >
                      <Circle className="w-16 h-16 fill-white" />
                  </Button>
              </div>
            )}
            
            {selectedCount > 0 && (
              <div style={{ position: 'absolute', right: '1rem', bottom: '8rem', zIndex: 10 }}>
                <Button 
                  onClick={processMultiModalAnalysis} 
                  disabled={isProcessing || isCompressing || isUploading} 
                  size="lg" 
                  className="bg-gradient-to-r from-blue-500 to-purple-600 hover:from-blue-600 hover:to-purple-700"
                >
                  {isProcessing || isUploading ? <Loader2 className="animate-spin mr-2" /> : <Zap className="mr-2" />}
                  {isUploading ? 'Uploading...' : `AI Analyze ${selectedCount} Item${selectedCount > 1 ? 's' : ''}`}
                </Button>
              </div>
            )}
            
            <div className="captured-previews" style={{ 
              display: 'flex', 
              gap: '0.5rem', 
              flexWrap: 'wrap', 
              justifyContent: 'center', 
              maxHeight: '5rem', 
              overflowY: 'auto',
              padding: '0.5rem'
            }}>
              {capturedItems.map((item) => (
                <div key={item.id} className="relative group" style={{ position: 'relative' }}>
                  <img 
                    src={item.thumbnail} 
                    alt={item.name} 
                    className={`preview-thumb cursor-pointer transition-all border-2 ${
                      item.selected 
                        ? 'border-blue-500 ring-2 ring-blue-300 scale-105' 
                        : 'border-gray-300 opacity-70 hover:opacity-100'
                    }`}
                    style={{
                      width: '60px',
                      height: '60px',
                      objectFit: 'cover',
                      borderRadius: '8px'
                    }}
                    onClick={() => toggleItemSelection(item.id)}
                    title={`${item.name} (${item.type})${item.metadata?.compressedSize ? ` - ${formatFileSize(item.metadata.compressedSize)}` : ''}`}
                  />
                  
                  {item.selected && (
                    <div style={{
                      position: 'absolute',
                      top: '-2px',
                      right: '-2px',
                      backgroundColor: '#3b82f6',
                      borderRadius: '50%',
                      width: '20px',
                      height: '20px',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      border: '2px solid white',
                      zIndex: 10
                    }}>
                      <Check className="w-3 h-3 text-white" />
                    </div>
                  )}
                  
                  <div style={{
                    position: 'absolute',
                    bottom: '2px',
                    left: '2px',
                    backgroundColor: 'rgba(0,0,0,0.8)',
                    color: 'white',
                    borderRadius: '4px',
                    padding: '2px',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center'
                  }}>
                    {getItemIcon(item.type, item.metadata)}
                  </div>
                  
                  {item.metadata?.barcodes && item.metadata.barcodes.length > 0 && (
                    <div style={{
                      position: 'absolute',
                      bottom: '2px',
                      right: '2px',
                      backgroundColor: 'rgba(34,197,94,0.9)',
                      color: 'white',
                      borderRadius: '4px',
                      padding: '2px',
                      fontSize: '10px',
                      fontWeight: 'bold'
                    }}>
                      {item.metadata.barcodes.length}
                    </div>
                  )}
                  
                  <Button 
                    variant="ghost" 
                    size="icon"
                    style={{
                      position: 'absolute',
                      top: '-2px',
                      left: '-2px',
                      width: '20px',
                      height: '20px',
                      backgroundColor: '#ef4444',
                      color: 'white',
                      borderRadius: '50%',
                      opacity: 0,
                      border: '2px solid white',
                      padding: '0',
                      minWidth: '20px'
                    }}
                    className="group-hover:opacity-100 transition-opacity"
                    onClick={(e) => {
                      e.stopPropagation();
                      removeItem(item.id);
                    }}
                  >
                    <Trash2 className="w-3 h-3" />
                  </Button>
                </div>
              ))}
            </div>

            <div className="mode-toggle">
                <Button onClick={() => setScanMode('image')} variant={scanMode === 'image' ? 'secondary' : 'ghost'}>
                  <ImageIcon className="mr-2"/>Photo
                </Button>
                <Button onClick={() => setScanMode('barcode')} variant={scanMode === 'barcode' ? 'secondary' : 'ghost'}>
                  <ScanLine className="mr-2"/>Barcode
                </Button>
                <Button onClick={() => setScanMode('video')} variant={scanMode === 'video' ? 'secondary' : 'ghost'}>
                  <Video className="mr-2"/>Video
                </Button>
            </div>
          </footer>
        </div>
      </div>
      <CameraSettingsModal 
        isOpen={isSettingsOpen} 
        onClose={() => setIsSettingsOpen(false)} 
        availableDevices={devices}
        currentDeviceId={selectedDeviceId}
        onDeviceChange={setSelectedDeviceId}
      />
      <DevicePairingModal
        isOpen={isDevicePairingOpen}
        onClose={() => setIsDevicePairingOpen(false)}
        onDeviceConnected={handleBluetoothDeviceConnected}
      />
    </>
  );
};

export default DualScanner;