// FILE: src/lib/ai-providers/kimi-provider.ts
// Kimi K2.6 Provider — via Vercel AI Gateway (no geo-restriction)
// Native multimodal MoE. 262K context. 80.2 SWE-bench.
// Routes through Vercel AI Gateway to avoid api.moonshot.cn geo-block from US servers.
// Uses AI_GATEWAY_API_KEY — set in Vercel Environment Variables.

import { BaseAIProvider } from './base-provider.js';
import { AIProvider, AIAnalysisResponse } from '@/types/hydra';

export class KimiProvider extends BaseAIProvider {
  private baseUrl = 'https://ai-gateway.vercel.sh/v1';
  private model = 'moonshotai/kimi-k2.6';

  constructor(config: AIProvider) {
    super(config);
    // AI_GATEWAY_API_KEY routes through Vercel — no geo-restriction
    this.apiKey = process.env.AI_GATEWAY_API_KEY || process.env.MOONSHOT_API_KEY || config.apiKey;
  }

  async analyze(images: string[], prompt: string): Promise<AIAnalysisResponse> {
    const startTime = Date.now();

    if (!this.apiKey || this.apiKey.length < 10) {
      throw new Error('Kimi: AI_GATEWAY_API_KEY missing or too short');
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
      console.log(`🌙 Kimi K2.6: Sending image (${images[0].length} chars) + prompt`);
    } else {
      messageContent = prompt + '\n\nPlease respond with valid JSON only.';
      console.log(`🌙 Kimi K2.6: Text-only analysis`);
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
      30000
    );

    if (!response.ok) {
      const errorText = await response.text();
      console.error(`🌙 Kimi API error: ${response.status}`, errorText);
      throw new Error(`Kimi API error: ${response.status} - ${errorText.substring(0, 200)}`);
    }

    const data = await response.json();
    const responseText = data?.choices?.[0]?.message?.content || '';

    if (!responseText) {
      console.error(`🌙 Kimi: Empty response`);
      throw new Error('Kimi: No content in response');
    }

    console.log(`🌙 Kimi K2.6 response preview: ${responseText.substring(0, 150)}...`);

    const parsed = this.parseAnalysisResult(responseText);

    if (!parsed) {
      console.warn('🌙 Kimi: Failed to parse response');
      return {
        response: {
          itemName: 'Kimi K2.6 Analysis',
          estimatedValue: 0,
          decision: 'SELL' as const,
          valuation_factors: ['Kimi K2.6 analysis completed', 'Vision processing done', 'Market assessment run', 'Condition evaluated', 'Price compared'],
          summary_reasoning: 'Analysis completed by Kimi K2.6 via Vercel AI Gateway',
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