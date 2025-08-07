// api/analyze-image.ts
export const config = {
  runtime: 'edge'
};

interface ImageAnalysisRequest {
  imageData: string;
  scanType: 'image';
  userId: string;
}

interface HydraResponse {
  itemName: string;
  estimatedValue: string;
  decision: 'BUY' | 'PASS';
  confidence: 'high' | 'medium' | 'low';
  category?: string;
  condition?: string;
  rarity?: string;
  keyFeatures?: string[];
  reasoning: string;
}

// Hydra Image Analysis Engine
class HydraImageEngine {
  private ANTHROPIC_SECRET = process.env.ANTHROPIC_SECRET;
  private OPENAI_TOKEN = process.env.OPENAI_TOKEN;
  private GOOGLE_AI_TOKEN = process.env.GOOGLE_AI_TOKEN;
  private DEEPSEEK_TOKEN = process.env.DEEPSEEK_TOKEN;
  private REMOVE_BG_SECRET = process.env.REMOVE_BG_SECRET;

  async analyzeImage(imageData: string): Promise<HydraResponse> {
    console.log('🖼️ Hydra analyzing image...');
    
    // Step 1: Optional image cleaning
    const cleanedImage = await this.cleanImage(imageData);
    const finalImage = cleanedImage || imageData;
    
    // Step 2: Multi-AI visual analysis
    const analyses = await Promise.allSettled([
      this.claudeVisionAnalysis(finalImage),
      this.gptVisionAnalysis(finalImage),
      this.geminiVisionAnalysis(finalImage),
      this.deepSeekImageAnalysis(finalImage)
    ]);

    console.log(`🤖 AI Vision analysis results: ${analyses.filter(a => a.status === 'fulfilled').length}/4 successful`);
    
    // Step 3: Build consensus from multiple AI responses
    return this.buildImageConsensus(analyses);
  }

  private async cleanImage(imageData: string): Promise<string | null> {
    if (!this.REMOVE_BG_SECRET) {
      console.log('⚠️ remove.bg API key missing - skipping image cleaning');
      return null;
    }

    try {
      console.log('🧹 Cleaning image with remove.bg...');
      
      // Convert base64 to blob for remove.bg API
      const base64Data = imageData.replace(/^data:image\/[a-z]+;base64,/, '');
      
      const response = await fetch('https://api.remove.bg/v1.0/removebg', {
        method: 'POST',
        headers: {
          'X-Api-Key': this.REMOVE_BG_SECRET,
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
        console.log('✅ Image cleaned successfully');
        return `data:image/png;base64,${cleanedBase64}`;
      }
    } catch (error) {
      console.error('Remove.bg error:', error);
    }
    
    return null;
  }

  private async claudeVisionAnalysis(imageData: string) {
    if (!this.ANTHROPIC_SECRET) {
      console.log('⚠️ Claude API key missing');
      return null;
    }

    try {
      console.log('🤖 Running Claude Vision analysis...');
      
      const response = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': this.ANTHROPIC_SECRET,
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

Respond in JSON format only:
{
  "itemName": "specific item name",
  "category": "sports/starwars/vintage/etc",
  "estimatedValue": 25.99,
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

      if (response.ok) {
        const data = await response.json();
        const analysisText = data.content[0].text;
        
        // Extract JSON from response
        const jsonMatch = content.match(/\{[\s\S]*\}/);
        if (jsonMatch) {
          return JSON.parse(jsonMatch[0]);
        }
      }
    } catch (error) {
      console.error('DeepSeek image analysis error:', error);
    }
    return null;
  }

  private extractFromText(text: string, field: string): string {
    // Simple text parsing for Gemini responses
    const patterns = {
      item: /(?:item|product|collectible):\s*([^\n,]+)/i,
      category: /(?:category|type):\s*([^\n,]+)/i
    };
    
    const pattern = patterns[field as keyof typeof patterns];
    const match = text.match(pattern);
    return match ? match[1].trim() : 'Unknown';
  }

  private extractValueFromText(text: string): number {
    const valueMatch = text.match(/\$?(\d+(?:\.\d{2})?)/);
    return valueMatch ? parseFloat(valueMatch[1]) : 0;
  }

  private buildImageConsensus(analyses: PromiseSettledResult<any>[]): HydraResponse {
    const validAnalyses = analyses
      .filter(result => result.status === 'fulfilled' && result.value)
      .map(result => (result as PromiseFulfilledResult<any>).value);

    console.log(`🎯 Building image consensus from ${validAnalyses.length} valid analyses`);

    if (validAnalyses.length === 0) {
      return {
        itemName: 'Unknown Item',
        estimatedValue: '0.00',
        decision: 'PASS',
        confidence: 'low',
        reasoning: 'Unable to analyze image - no AI models provided valid results'
      };
    }

    // Calculate consensus
    const buyVotes = validAnalyses.filter(a => a.decision === 'BUY').length;
    const totalVotes = validAnalyses.length;
    
    // Average estimated values
    const values = validAnalyses
      .map(a => parseFloat(a.estimatedValue) || 0)
      .filter(v => v > 0);
    
    const avgValue = values.length > 0 
      ? values.reduce((sum, val) => sum + val, 0) / values.length 
      : 0;

    // Get most common item name
    const itemNames = validAnalyses
      .map(a => a.itemName)
      .filter(name => name && name !== 'Unknown');
    
    const mostCommonName = itemNames.length > 0 
      ? itemNames[0] 
      : 'Collectible Item';

    // Determine confidence based on agreement
    let confidence: 'high' | 'medium' | 'low' = 'low';
    if (totalVotes >= 3) {
      const agreementRatio = buyVotes / totalVotes;
      if (agreementRatio >= 0.8 || agreementRatio <= 0.2) {
        confidence = 'high';
      } else if (agreementRatio >= 0.6 || agreementRatio <= 0.4) {
        confidence = 'medium';
      }
    }

    const decision = buyVotes > totalVotes / 2 ? 'BUY' : 'PASS';
    
    console.log(`📊 Image consensus: ${decision} (${buyVotes}/${totalVotes}) - ${avgValue.toFixed(2)} - ${confidence} confidence`);

    return {
      itemName: mostCommonName,
      estimatedValue: avgValue.toFixed(2),
      decision,
      confidence,
      category: validAnalyses[0]?.category || 'collectible',
      condition: validAnalyses[0]?.condition || 'unknown',
      keyFeatures: validAnalyses[0]?.keyFeatures || [],
      reasoning: `Analyzed by ${totalVotes} AI vision models. ${buyVotes} recommend BUY, ${totalVotes - buyVotes} recommend PASS. Average estimated value: ${avgValue.toFixed(2)}.`
    };
  }
}

export default async function handler(request: Request) {
  // Handle CORS
  if (request.method === 'OPTIONS') {
    return new Response(null, {
      status: 200,
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'POST, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type, Authorization',
      },
    });
  }

  if (request.method !== 'POST') {
    return new Response(JSON.stringify({ error: 'Method not allowed' }), {
      status: 405,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  try {
    const body: ImageAnalysisRequest = await request.json();
    const { imageData, userId } = body;

    if (!imageData || !userId) {
      return new Response(JSON.stringify({ error: 'Missing imageData or userId' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    console.log('🚀 Starting Hydra image analysis...');
    
    // Initialize Hydra Image Engine
    const hydra = new HydraImageEngine();
    
    // Perform image analysis
    const analysis = await hydra.analyzeImage(imageData);

    console.log('✅ Image analysis complete:', analysis);

    return new Response(JSON.stringify(analysis), {
      status: 200,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*',
      },
    });
  } catch (error) {
    console.error('❌ Image analysis error:', error);
    return new Response(JSON.stringify({ 
      error: 'Image analysis failed',
      itemName: 'Analysis Error',
      estimatedValue: '0.00',
      decision: 'PASS',
      confidence: 'low',
      reasoning: 'An error occurred during image analysis'
    }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
} analysisText.match(/\{[\s\S]*\}/);
        if (jsonMatch) {
          return JSON.parse(jsonMatch[0]);
        }
      }
    } catch (error) {
      console.error('Claude vision analysis error:', error);
    }
    return null;
  }

  private async gptVisionAnalysis(imageData: string) {
    if (!this.OPENAI_TOKEN) {
      console.log('⚠️ OpenAI API key missing');
      return null;
    }

    try {
      console.log('🤖 Running GPT-4 Vision analysis...');
      
      const response = await fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${this.OPENAI_TOKEN}`
        },
        body: JSON.stringify({
          model: 'gpt-4-vision-preview',
          messages: [{
            role: 'user',
            content: [
              {
                type: 'text',
                text: `Analyze this collectible item for resale value. Identify what it is, assess condition, and estimate market value. Focus on sports memorabilia, Star Wars items, trading cards, or vintage collectibles.

Return analysis as JSON only:
{
  "itemName": "item identification",
  "estimatedValue": 0.00,
  "category": "item category", 
  "condition": "condition assessment",
  "marketAnalysis": "market insights",
  "decision": "BUY/PASS",
  "reasoning": "explanation"
}`
              },
              {
                type: 'image_url',
                image_url: {
                  url: imageData
                }
              }
            ]
          }],
          max_tokens: 1000,
          temperature: 0.3
        })
      });

      if (response.ok) {
        const data = await response.json();
        const content = data.choices[0].message.content;
        const jsonMatch = content.match(/\{[\s\S]*\}/);
        if (jsonMatch) {
          return JSON.parse(jsonMatch[0]);
        }
      }
    } catch (error) {
      console.error('GPT vision analysis error:', error);
    }
    return null;
  }

  private async geminiVisionAnalysis(imageData: string) {
    if (!this.GOOGLE_AI_TOKEN) {
      console.log('⚠️ Gemini API key missing');
      return null;
    }

    try {
      console.log('🤖 Running Gemini Vision analysis...');
      
      // Convert base64 to proper format for Gemini
      const base64Data = imageData.replace(/^data:image\/[a-z]+;base64,/, '');
      
      const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-pro-vision:generateContent?key=${this.GOOGLE_AI_TOKEN}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          contents: [{
            parts: [
              {
                text: 'Analyze this collectible item image. Identify the item, assess its condition, estimate market value, and provide BUY/PASS recommendation. Focus on collectibles like sports cards, Star Wars items, or vintage memorabilia. Return as JSON.'
              },
              {
                inline_data: {
                  mime_type: 'image/jpeg',
                  data: base64Data
                }
              }
            ]
          }]
        })
      });

      if (response.ok) {
        const data = await response.json();
        const text = data.candidates?.[0]?.content?.parts?.[0]?.text || '';
        
        // Parse Gemini response and format to standard structure
        return {
          itemName: this.extractFromText(text, 'item'),
          estimatedValue: this.extractValueFromText(text),
          category: this.extractFromText(text, 'category'),
          decision: text.includes('BUY') ? 'BUY' : 'PASS',
          reasoning: text.substring(0, 150),
          confidence: 'medium'
        };
      }
    } catch (error) {
      console.error('Gemini vision analysis error:', error);
    }
    return null;
  }

  private async deepSeekImageAnalysis(imageData: string) {
    if (!this.DEEPSEEK_TOKEN) {
      console.log('⚠️ DeepSeek API key missing');
      return null;
    }

    try {
      console.log('🤖 Running DeepSeek Vision analysis...');
      
      const response = await fetch('https://api.deepseek.com/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${this.DEEPSEEK_TOKEN}`
        },
        body: JSON.stringify({
          model: 'deepseek-vl-chat',
          messages: [{
            role: 'user',
            content: [
              {
                type: 'text',
                text: 'Analyze this collectible image for mathematical valuation. Calculate potential ROI, market metrics, and provide numerical analysis for resale decision. Return JSON only.'
              },
              {
                type: 'image_url',
                image_url: {
                  url: imageData
                }
              }
            ]
          }]
        })
      });

      if (response.ok) {
        const data = await response.json();
        const content = data.choices[0].message.content;
        const jsonMatch =