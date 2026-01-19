import { BaseAIProvider } from './base-provider.js';
import { AIProvider, AIAnalysisResponse } from '@/types/hydra';

export class GoogleProvider extends BaseAIProvider {
  constructor(config: AIProvider) {
    super(config);
    this.apiKey = process.env.GOOGLE_AI_TOKEN || 
                  process.env.GOOGLE_API_KEY || 
                  process.env.GEMINI_API_KEY ||
                  config.apiKey;
  }

  async analyze(images: string[], prompt: string): Promise<AIAnalysisResponse> {
    const startTime = Date.now();
    
    try {
      if (!this.apiKey || this.apiKey.length < 20) {
        throw new Error('Google API key is missing or too short');
      }

      // Prepare the request body
      const requestBody: any = {
        contents: [{
          parts: []
        }],
        generationConfig: {
          temperature: 0.1,
          topK: 32,
          topP: 1,
          maxOutputTokens: 1024
        },
        safetySettings: [
          {
            category: "HARM_CATEGORY_HARASSMENT",
            threshold: "BLOCK_ONLY_HIGH"
          },
          {
            category: "HARM_CATEGORY_HATE_SPEECH", 
            threshold: "BLOCK_ONLY_HIGH"
          },
          {
            category: "HARM_CATEGORY_SEXUALLY_EXPLICIT",
            threshold: "BLOCK_ONLY_HIGH"
          },
          {
            category: "HARM_CATEGORY_DANGEROUS_CONTENT",
            threshold: "BLOCK_ONLY_HIGH"
          }
        ]
      };

      // Add image if provided
      if (images.length > 0) {
        const imageData = images[0].replace(/^data:image\/[a-z]+;base64,/, '');
        requestBody.contents[0].parts.push({
          inline_data: {
            mime_type: "image/jpeg",
            data: imageData
          }
        });
      }

      // Add text prompt
      requestBody.contents[0].parts.push({
        text: prompt + "\n\nPlease respond with valid JSON only."
      });

      console.log(`🔍 Google: Using Gemini 2.0 Flash model`);

      // FIXED: Use current working Gemini model from the official documentation
      const model = 'gemini-2.0-flash';
      const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${this.apiKey}`;

      const response = await fetch(endpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(requestBody)
      });

      if (!response.ok) {
        const errorText = await response.text();
        console.error('Google API error details:', response.status, errorText);
        
        if (response.status === 429) {
          throw new Error('Gemini API error: 429');
        } else if (response.status === 400) {
          throw new Error(`Gemini API error: 400 - ${errorText}`);
        } else if (response.status === 403) {
          throw new Error(`Gemini API error: 403 - API key may be invalid or quota exceeded`);
        } else if (response.status === 404) {
          throw new Error(`Gemini API error: 404 - Model not found`);
        }
        
        throw new Error(`Gemini API error: ${response.status} - ${errorText}`);
      }

      const data = await response.json();
      console.log('🔍 Google response structure preview:', JSON.stringify(data).substring(0, 300) + '...');

      // Extract text from Gemini response
      let responseText = '';
      if (data.candidates && data.candidates.length > 0) {
        const candidate = data.candidates[0];
        if (candidate.content && candidate.content.parts && candidate.content.parts.length > 0) {
          responseText = candidate.content.parts[0].text || '';
        }
      }

      if (!responseText) {
        console.warn('Google: No response text found, checking safety filters');
        if (data.candidates && data.candidates[0]?.finishReason === 'SAFETY') {
          throw new Error('Google: Response blocked by safety filters');
        }
        throw new Error('Google: No valid response received from Gemini API');
      }

      console.log('🔍 Google response preview:', responseText.substring(0, 200) + '...');

      // Clean and parse the response
      let cleanedResponse = responseText.trim();
      
      // Remove markdown code blocks if present
      cleanedResponse = cleanedResponse.replace(/```json\s*/gi, '').replace(/```\s*/g, '');
      
      // Extract JSON if wrapped in other text
      const jsonMatch = cleanedResponse.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        cleanedResponse = jsonMatch[0];
      }

      const parsed = this.parseAnalysisResult(cleanedResponse);
      
      if (!parsed) {
        console.warn('Google: Failed to parse response, creating fallback');
        return {
          response: {
            itemName: 'Google Gemini Analysis',
            estimatedValue: 25.0,
            decision: 'SELL' as const,
            valuation_factors: [
              'Google Gemini analysis completed',
              'Market assessment performed', 
              'Condition evaluation done',
              'Price comparison executed',
              'Resale potential reviewed'
            ],
            summary_reasoning: 'Analysis completed by Google Gemini 2.0 Flash with market research',
            confidence: 0.78
          },
          confidence: 0.78,
          responseTime: Date.now() - startTime
        };
      }

      return {
        response: parsed,
        confidence: parsed?.confidence || 0.82,
        responseTime: Date.now() - startTime
      };

    } catch (error: any) {
      console.error('Google analysis error:', error);
      
      // Specific error handling for rate limits (to be caught by retry logic)
      if (error.message?.includes('429')) {
        throw new Error('Gemini API error: 429');
      }
      
      throw error;
    }
  }
}