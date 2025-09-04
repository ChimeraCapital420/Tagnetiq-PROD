// FILE: api/social/generate-brag-card.ts

import { VercelRequest, VercelResponse } from '@vercel/node';
import { supaAdmin } from '../_lib/supaAdmin';

export const config = {
  runtime: 'edge',
  maxDuration: 30,
};

interface BragCardRequest {
  itemName: string;
  estimatedValue: number;
  imageUrl: string;
  confidenceScore: number;
  category: string;
}

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

    // Generate HTML for the brag card
    const html = generateBragCardHTML({
      itemName,
      estimatedValue,
      imageUrl,
      confidenceScore,
      category
    });

    // Use Vercel's OG Image Generation API or external service
    // For now, we'll use a simple approach with HTML2Canvas on the client side
    // Return the data needed for client-side generation
    
    const bragCardData = {
      itemName,
      estimatedValue,
      imageUrl,
      confidenceScore,
      category,
      generatedAt: new Date().toISOString(),
      shareId: `${Date.now()}-${Math.random().toString(36).substring(2, 9)}`
    };

    // Store the brag card data for sharing
    const { data, error } = await supaAdmin
      .from('brag_cards')
      .insert({
        share_id: bragCardData.shareId,
        item_name: itemName,
        estimated_value: estimatedValue,
        image_url: imageUrl,
        confidence_score: confidenceScore,
        category: category,
        created_at: new Date().toISOString()
      })
      .select()
      .single();

    if (error) {
      console.error('Failed to store brag card:', error);
      // Continue anyway - we can still generate the card
    }

    // Return a URL that will render the brag card
    const bragCardUrl = `https://tagnetiq.com/brag/${bragCardData.shareId}`;

    return res.status(200).json({ 
      success: true, 
      bragCardUrl,
      bragCardData,
      html // Return HTML for client-side rendering
    });

  } catch (error: any) {
    console.error('Error generating brag card:', error);
    return res.status(500).json({ 
      error: 'Failed to generate brag card',
      details: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
}

function generateBragCardHTML(data: BragCardRequest): string {
  const { itemName, estimatedValue, imageUrl, confidenceScore, category } = data;
  const confidenceColor = confidenceScore > 85 ? '#4ade80' : confidenceScore > 65 ? '#fbbf24' : '#ef4444';

  return `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="UTF-8">
      <style>
        * { margin: 0; padding: 0; box-sizing: border-box; }
        body {
          width: 1200px;
          height: 630px;
          font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
          background: linear-gradient(135deg, #1a1a2e 0%, #0f0f23 100%);
          color: white;
          position: relative;
          overflow: hidden;
        }
        .grid-pattern {
          position: absolute;
          top: 0;
          left: 0;
          right: 0;
          bottom: 0;
          background-image: 
            linear-gradient(rgba(255,255,255,0.05) 1px, transparent 1px),
            linear-gradient(90deg, rgba(255,255,255,0.05) 1px, transparent 1px);
          background-size: 30px 30px;
        }
        .content {
          position: relative;
          display: flex;
          height: 100%;
          padding: 40px;
          gap: 60px;
        }
        .image-container {
          width: 400px;
          height: 400px;
          background: rgba(255, 255, 255, 0.1);
          border-radius: 8px;
          overflow: hidden;
          display: flex;
          align-items: center;
          justify-content: center;
        }
        .item-image {
          max-width: 100%;
          max-height: 100%;
          object-fit: contain;
        }
        .info-container {
          flex: 1;
          display: flex;
          flex-direction: column;
          justify-content: center;
        }
        .brand {
          font-size: 36px;
          font-weight: bold;
          margin-bottom: 20px;
        }
        .badge {
          background: #4ade80;
          color: black;
          padding: 10px 20px;
          display: inline-block;
          font-weight: bold;
          font-size: 18px;
          margin-bottom: 40px;
        }
        .item-name {
          font-size: 48px;
          font-weight: bold;
          margin-bottom: 30px;
          line-height: 1.2;
        }
        .value {
          font-size: 72px;
          font-weight: bold;
          color: #4ade80;
          margin-bottom: 20px;
        }
        .category {
          font-size: 24px;
          color: #a0a0a0;
          margin-bottom: 30px;
        }
        .confidence {
          display: flex;
          align-items: center;
          gap: 10px;
          font-size: 20px;
        }
        .confidence-bar {
          width: 200px;
          height: 20px;
          background: rgba(255, 255, 255, 0.1);
          position: relative;
          overflow: hidden;
        }
        .confidence-fill {
          position: absolute;
          left: 0;
          top: 0;
          height: 100%;
          background: ${confidenceColor};
          width: ${confidenceScore}%;
        }
        .footer {
          position: absolute;
          bottom: 0;
          left: 0;
          right: 0;
          background: rgba(255, 255, 255, 0.1);
          padding: 20px;
          text-align: center;
          font-size: 18px;
        }
      </style>
    </head>
    <body>
      <div class="grid-pattern"></div>
      <div class="content">
        <div class="image-container">
          <img src="${imageUrl}" alt="${itemName}" class="item-image">
        </div>
        <div class="info-container">
          <div class="brand">TAGNETIQ</div>
          <div class="badge">AI VALUATION</div>
          <div class="item-name">${itemName}</div>
          <div class="value">$${estimatedValue.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</div>
          <div class="category">${category}</div>
          <div class="confidence">
            <span>AI Confidence:</span>
            <div class="confidence-bar">
              <div class="confidence-fill"></div>
            </div>
            <span>${Math.round(confidenceScore)}%</span>
          </div>
        </div>
      </div>
      <div class="footer">
        Get your items valued with AI at tagnetiq.com
      </div>
    </body>
    </html>
  `;
}