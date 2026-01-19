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

      console.log(`🔍 Google: Using Gemini 2.5 Flash-Lite model`);

      // FIXED: Use current working Gemini model
      const model = 'gemini-2.5-flash-lite';
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
          throw new Error('Gemini API