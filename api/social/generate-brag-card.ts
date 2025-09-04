// FILE: api/social/generate-brag-card.ts

import { VercelRequest, VercelResponse } from '@vercel/node';
import { createCanvas, loadImage, registerFont } from 'canvas';
import { supaAdmin } from '../_lib/supaAdmin';
import path from 'path';

export const config = {
  runtime: 'nodejs',
  maxDuration: 30,
};

interface BragCardRequest {
  itemName: string;
  estimatedValue: number;
  imageUrl: string;
  confidenceScore: number;
  category: string;
}

// Register custom fonts if needed
// registerFont(path.join(process.cwd(), 'fonts/Inter-Bold.ttf'), { family: 'Inter', weight: 'bold' });

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method Not Allowed' });
  }

  try {
    const { itemName, estimatedValue, imageUrl, confidenceScore, category } = req.body as BragCardRequest;

    // Validate input
    if (!itemName || !estimatedValue || !imageUrl) {
      return res.status(400).json({ error: 'Missing required fields' });
    }

    // Create a 1200x630 canvas (optimal for social media)
    const canvas = createCanvas(1200, 630);
    const ctx = canvas.getContext('2d');

    // Background gradient
    const gradient = ctx.createLinearGradient(0, 0, 1200, 630);
    gradient.addColorStop(0, '#1a1a2e');
    gradient.addColorStop(1, '#0f0f23');
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, 1200, 630);

    // Add grid pattern overlay
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.05)';
    ctx.lineWidth = 1;
    for (let i = 0; i < 1200; i += 30) {
      ctx.beginPath();
      ctx.moveTo(i, 0);
      ctx.lineTo(i, 630);
      ctx.stroke();
    }
    for (let i = 0; i < 630; i += 30) {
      ctx.beginPath();
      ctx.moveTo(0, i);
      ctx.lineTo(1200, i);
      ctx.stroke();
    }

    // Load and draw the item image
    try {
      const itemImage = await loadImage(imageUrl);
      
      // Draw image container with border
      ctx.fillStyle = 'rgba(255, 255, 255, 0.1)';
      ctx.fillRect(40, 40, 400, 400);
      
      // Draw the actual image
      ctx.save();
      ctx.beginPath();
      ctx.rect(50, 50, 380, 380);
      ctx.clip();
      
      // Calculate aspect ratio to fit image
      const imgAspect = itemImage.width / itemImage.height;
      let drawWidth = 380;
      let drawHeight = 380;
      let drawX = 50;
      let drawY = 50;
      
      if (imgAspect > 1) {
        drawHeight = 380 / imgAspect;
        drawY = 50 + (380 - drawHeight) / 2;
      } else {
        drawWidth = 380 * imgAspect;
        drawX = 50 + (380 - drawWidth) / 2;
      }
      
      ctx.drawImage(itemImage, drawX, drawY, drawWidth, drawHeight);
      ctx.restore();
    } catch (error) {
      console.error('Failed to load item image:', error);
      // Draw placeholder
      ctx.fillStyle = 'rgba(255, 255, 255, 0.1)';
      ctx.fillRect(50, 50, 380, 380);
    }

    // Right side content
    const rightX = 500;

    // Tagnetiq logo/brand
    ctx.font = 'bold 36px sans-serif';
    ctx.fillStyle = '#ffffff';
    ctx.fillText('TAGNETIQ', rightX, 80);
    
    // "AI VALUATION" badge
    ctx.fillStyle = '#4ade80';
    ctx.fillRect(rightX, 100, 180, 40);
    ctx.fillStyle = '#000000';
    ctx.font = 'bold 18px sans-serif';
    ctx.fillText('AI VALUATION', rightX + 20, 127);

    // Item name
    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 48px sans-serif';
    const maxWidth = 650;
    let fontSize = 48;
    
    // Adjust font size if text is too long
    while (ctx.measureText(itemName).width > maxWidth && fontSize > 24) {
      fontSize -= 2;
      ctx.font = `bold ${fontSize}px sans-serif`;
    }
    
    // Word wrap if needed
    const words = itemName.split(' ');
    let line = '';
    let y = 220;
    
    for (let n = 0; n < words.length; n++) {
      const testLine = line + words[n] + ' ';
      const metrics = ctx.measureText(testLine);
      const testWidth = metrics.width;
      
      if (testWidth > maxWidth && n > 0) {
        ctx.fillText(line, rightX, y);
        line = words[n] + ' ';
        y += fontSize + 10;
      } else {
        line = testLine;
      }
    }
    ctx.fillText(line, rightX, y);

    // Estimated value
    ctx.font = 'bold 72px sans-serif';
    ctx.fillStyle = '#4ade80';
    ctx.fillText(`$${estimatedValue.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`, rightX, y + 100);

    // Category
    ctx.font = '24px sans-serif';
    ctx.fillStyle = '#a0a0a0';
    ctx.fillText(category, rightX, y + 150);

    // Confidence score with visual indicator
    ctx.font = '20px sans-serif';
    ctx.fillStyle = '#ffffff';
    ctx.fillText('AI Confidence:', rightX, y + 200);
    
    // Confidence bar background
    ctx.fillStyle = 'rgba(255, 255, 255, 0.1)';
    ctx.fillRect(rightX + 150, y + 185, 200, 20);
    
    // Confidence bar fill
    const confidenceColor = confidenceScore > 85 ? '#4ade80' : confidenceScore > 65 ? '#fbbf24' : '#ef4444';
    ctx.fillStyle = confidenceColor;
    ctx.fillRect(rightX + 150, y + 185, (confidenceScore / 100) * 200, 20);
    
    // Confidence percentage
    ctx.fillStyle = '#ffffff';
    ctx.fillText(`${Math.round(confidenceScore)}%`, rightX + 360, y + 200);

    // Footer
    ctx.fillStyle = 'rgba(255, 255, 255, 0.1)';
    ctx.fillRect(0, 550, 1200, 80);
    
    ctx.font = '18px sans-serif';
    ctx.fillStyle = '#ffffff';
    ctx.fillText('Get your items valued with AI at tagnetiq.com', 400, 595);

    // Convert canvas to buffer
    const buffer = canvas.toBuffer('image/png');

    // Generate unique filename
    const filename = `brag-cards/${Date.now()}-${itemName.replace(/[^a-z0-9]/gi, '-').toLowerCase()}.png`;

    // Upload to Supabase Storage
    const { data, error } = await supaAdmin.storage
      .from('public-assets')
      .upload(filename, buffer, {
        contentType: 'image/png',
        cacheControl: '3600',
        upsert: false
      });

    if (error) {
      console.error('Failed to upload brag card:', error);
      throw new Error('Failed to upload brag card');
    }

    // Get public URL
    const { data: { publicUrl } } = supaAdmin.storage
      .from('public-assets')
      .getPublicUrl(filename);

    return res.status(200).json({ 
      success: true, 
      bragCardUrl: publicUrl 
    });

  } catch (error: any) {
    console.error('Error generating brag card:', error);
    return res.status(500).json({ 
      error: 'Failed to generate brag card',
      details: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
}