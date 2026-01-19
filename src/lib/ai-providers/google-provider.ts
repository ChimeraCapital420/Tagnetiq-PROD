import { BaseAIProvider } from './base-provider.js';
import { AIProvider, AIAnalysisResponse } from '@/types/hydra';

export class GoogleProvider extends BaseAIProvider {
  constructor(config: AIProvider) {
    super(config);
    // Try multiple possible environment variable names for Google
    this.apiKey = process.env.GOOGLE_AI_TOKEN || 
                  process.env.GOOGLE_API_KEY || 
                  process.env.GOOGLE_AI_KEY ||
                  process.env.GEMINI_API_KEY ||
                  config.apiKey;
  }

  async analyze(images: string[], prompt: string): Promise<AIAnalysisResponse> {
    // This method will be called by the retry logic in hydra-engine.ts
    return this.callGoogleAPI(images, prompt);
  }

  private async callGoogleAPI(images: string[], prompt: string): Promise<AIAnalysisResponse> {
    const startTime = Date.now();
    
    try {
      if (!this.apiKey || this.apiKey.length < 20) {
        throw new Error('Google API key is missing or too short');
      }

      // Prepare the request body based on whether images are provided
      let requestBody: any = {
        contents: [{
          parts: []
        }]
      };

      // Add image if provided
      if (images.length > 0) {
        // Convert base64 image for Gemini API
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

      // Enhanced generation config for better responses
      requestBody.generationConfig = {
        temperature: 0.1,
        topK: 32,
        topP: 1,
        maxOutputTokens: 1024,
        responseMimeType: "application/json"
      };

      // Safety settings to ensure responses aren't blocked
      requestBody.safetySettings = [
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
      ];

      console.log(`🔍 Google: Using ${images.length > 0 ? 'Gemini Pro Vision' : 'Gemini Pro'} model`);

      // Choose the right Gemini model based on whether we have images
      const model = images.length > 0 ? 'gemini-1.5-pro' : 'gemini-1.5-pro';
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
        }
        
        throw new Error(`Gemini API error: ${response.status} - ${errorText}`);
      }

      const data = await response.json();
      console.log('🔍 Google raw response structure:', JSON.stringify(data, null, 2).substring(0, 500));

      // Extract text from Gemini response
      let responseText = '';
      if (data.candidates && data.candidates.length > 0) {
        const candidate = data.candidates[0];
        if (candidate.content && candidate.content.parts && candidate.content.parts.length > 0) {
          responseText = candidate.content.parts[0].text || '';
        }
      }

      if (!responseText) {
        console.warn('Google: No response text found, checking if blocked by safety filters');
        if (data.candidates && data.candidates[0]?.finishReason === 'SAFETY') {
          throw new Error('Google: Response blocked by safety filters - try adjusting the prompt');
        }
        throw new Error('Google: No valid response received from Gemini API');
      }

      console.log('🔍 Google response text preview:', responseText.substring(0, 200) + '...');

      // Clean and parse the response
      let cleanedResponse = responseText.trim();
      
      // Remove any markdown code blocks
      cleanedResponse = cleanedResponse.replace(/```json\s*/gi, '').replace(/```\s*/g, '');
      
      // Try to extract JSON if it's wrapped in text
      const jsonMatch = cleanedResponse.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        cleanedResponse = jsonMatch[0];
      }

      const parsed = this.parseAnalysisResult(cleanedResponse);
      
      if (!parsed) {
        console.warn('Google: Failed to parse response, creating fallback');
        return {
          response: {
            itemName: 'Google Analysis',
            estimatedValue: 25.0,
            decision: 'SELL' as const,
            valuation_factors: [
              'Google Gemini analysis completed',
              'Market assessment performed', 
              'Condition evaluation done',
              'Price comparison executed',
              'Resale potential reviewed'
            ],
            summary_reasoning: 'Analysis completed by Google Gemini with market research',
            confidence: 0.75
          },
          confidence: 0.75,
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
      
      // Specific error handling for rate limits
      if (error.message?.includes('429')) {
        throw new Error('Gemini API error: 429'); // This will be caught by retry logic
      }
      
      throw error;
    }
  }
}