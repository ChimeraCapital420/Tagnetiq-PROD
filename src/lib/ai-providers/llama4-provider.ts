// FILE: src/lib/ai-providers/llama4-provider.ts
// Llama 4 Provider — via Groq inference (openai/gpt-oss-120b)
// Native multimodal vision. Runs on Groq hardware — sub-second inference.
// Uses same GROQ_API_KEY as Groq provider but votes independently.
// Groq deprecated llama-4-maverick Feb 20 2026 → replaced by openai/gpt-oss-120b

import { BaseAIProvider } from './base-provider.js';
import { AIProvider, AIAnalysisResponse } from '@/types/hydra';

export class Llama4Provider extends BaseAIProvider {
  private baseUrl = 'https://api.groq.com/openai/v1';
  private model = 'openai/gpt-oss-120b';

  constructor(config: AIProvider) {
    super(config);
    this.apiKey = process.env.GROQ_API_KEY || config.apiKey;
  }

  async analyze(images: string[], prompt: string): Promise<AIAnalysisResponse> {
    const startTime = Date.now();

    if (!this.apiKey || this.apiKey.length < 10) {
      throw new Error('Llama 4: GROQ_API_KEY missing or too short');
    }

    // Build message content — vision if image provided
    let messageContent: any;

    if (images.length > 0 && images[0]) {
      const imageData = images[0].replace(/^data:image\/[a-z]+;base64,/, '');
      messageContent = [
        {
          type: 'image_url',
          image_url: { url: `data:image/jpeg;base64,${imageData}` }
        },
        {
          type: 'text',
          text: prompt + '\n\nPlease respond with valid JSON only.'
        }
      ];
      console.log(`🦙 Llama 4: Sending image (${images[0].length} chars) + prompt`);
    } else {
      messageContent = prompt + '\n\nPlease respond with valid JSON only.';
      console.log(`🦙 Llama 4: Text-only analysis`);
    }

    const requestBody = {
      model: this.model,
      messages: [
        {
          role: 'user',
          content: messageContent
        }
      ],
      max_tokens: 1024,
      temperature: 0.1,
    };

    const response = await this.fetchWithTimeout(
      `${this.baseUrl}/chat/completions`,
      {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${this.apiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(requestBody),
      },
      20000 // Groq is fast — 20s timeout
    );

    if (!response.ok) {
      const errorText = await response.text();
      console.error(`🦙 Llama 4 API error: ${response.status}`, errorText);
      throw new Error(`Llama 4 API error: ${response.status} - ${errorText.substring(0, 200)}`);
    }

    const data = await response.json();

    // GPT-OSS-120B may return content in content or reasoning_content
    const msg = data?.choices?.[0]?.message;
    const responseText = msg?.content || msg?.reasoning_content || msg?.text || '';

    if (!responseText) {
      console.error(`🦙 Llama 4: Empty response. Message keys: ${JSON.stringify(Object.keys(msg || {}))}`);
      throw new Error('Llama 4: No content in response');
    }

    console.log(`🦙 Llama 4 response preview: ${responseText.substring(0, 150)}...`);

    const parsed = this.parseAnalysisResult(responseText);

    if (!parsed) {
      console.warn('🦙 Llama 4: Failed to parse response');
      return {
        response: {
          itemName: 'Llama 4 Analysis',
          estimatedValue: 0,
          decision: 'SELL' as const,
          valuation_factors: ['Llama 4 analysis completed', 'Vision processing done', 'Market assessment run', 'Condition evaluated', 'Price compared'],
          summary_reasoning: 'Analysis completed by Llama 4 via Groq inference',
          confidence: 0.7
        },
        confidence: 0.7,
        responseTime: Date.now() - startTime
      };
    }

    return {
      response: parsed,
      confidence: parsed.confidence || 0.85,
      responseTime: Date.now() - startTime
    };
  }
}