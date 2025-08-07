import { NextApiRequest, NextApiResponse } from 'next';
import { createClient } from '@supabase/supabase-js';

// Initialize Supabase client
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

// API Keys
const OPENAI_API_KEY = process.env.OPENAI_API_KEY;
const ANTHROPIC_API_KEY = process.env.ANTHROPIC_API_KEY;
const GOOGLE_AI_API_KEY = process.env.GOOGLE_AI_API_KEY;
const XAI_API_KEY = process.env.XAI_API_KEY;
const DEEPSEEK_API_KEY = process.env.DEEPSEEK_API_KEY;
const REMOVE_BG_API_KEY = process.env.REMOVE_BG_API_KEY;

interface ImageAnalysisRequest {
  imageData: string; // Base64 encoded image
  scanType: 'image';
  userId: string;
}

// Hydra Image Analysis Engine
class HydraImageEngine {
  async analyzeImage(imageData: string): Promise<any> {
    // Step 1: Clean image with remove.bg (optional)
    const cleanedImage = await this.cleanImage(imageData);
    
    // Step 2: Multi-AI visual analysis
    const analyses = await Promise.allSettled([
      this.claudeVisionAnalysis(imageData),
      this.gptVisionAnalysis(imageData),
      this.geminiVisionAnalysis(imageData),
      this.deepSeekImageAnalysis(imageData)
    ]);

    // Step 3: Build consensus from multiple AI responses
    return this.buildImageConsensus(analyses, imageData);
  }

  private async cleanImage(imageData: string): Promise<string> {
    try {
      // Convert base64 to blob for remove.bg API
      const base64Data = imageData.replace(/^data:image\/[a-z]+;base64,/, '');
      
      const response = await fetch('https://api.remove.bg/v1.0/removebg', {
        method: 'POST',
        headers: {
          'X-Api-Key': REMOVE_BG_API_KEY!,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          image_file_b64: base64Data,
          size: 'auto',
          format: 'png'
        })
      });

      if (response.ok) {
        const result = await response.arrayBuffer();
        const cleanedBase64 = Buffer.from(result).toString('base64');
        return `data:image/png;base64,${cleanedBase64}`;
      }
    } catch (error) {
      console.error('Remove.bg error:', error);
    }
    
    // Return original if cleaning fails
    return imageData;
  }

  private async claudeVisionAnalysis(imageData: string): Promise<any> {
    try {
      const response = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': ANTHROPIC_API_KEY!,
          'anthropic-version': '2023-06-01'
        },
        body: JSON.stringify({
          model: 'claude-3-5-sonnet-20241022',
          max_tokens: 1500,
          messages: [{
            role: 'user',
            content: [
              {
                type: 'text',
                text: `Analyze this collectible item image. Identify the item, estimate its value, and provide resale analysis.

Focus on:
- Sports cards/memorabilia
- Star Wars collectibles  
- Vintage items
- Trading cards
- Autographed items
- Condition assessment

Respond in JSON format:
{
  "itemName": "specific item name",
  "category": "sports/starwars/vintage/etc",
  "estimatedValue": number,
  "condition": "mint/near mint/good/poor",
  "rarity": "common/uncommon/rare/ultra rare",
  "marketDemand": "high/medium/low",
  "decision": "BUY/PASS",
  "confidence": "high/medium/low",
  "keyFeatures": ["feature1", "feature2"],
  "reasoning": "detailed explanation"
}`
              },
              {
                type: 'image',
                source: {
                  type: 'base64',
                  media_type: 'image/jpeg',
                  data: imageData.replace(/^data:image\/[a-z]+;base64,/, '')
                }
              }
            ]
          }]
        })
      });

      const data = await response.json();
      return JSON.parse(data.content[0].text);
    } catch (error) {
      console.error('Claude vision analysis error:', error);
      return null;
    }
  }

  private async gptVisionAnalysis(imageData: string): Promise<any> {
    try {
      const response = await fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${