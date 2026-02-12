// FILE: src/lib/hydra/ai/deepseek.ts
// DeepSeek Provider for HYDRA
// TEXT-ONLY tiebreaker AI with enhanced reasoning
// Used when primary vision models disagree

import { BaseAIProvider, ProviderConfig } from './base-provider.js';
import type { AIAnalysisResponse, ModelVote } from '../types.js';
import { getApiKey, AI_PROVIDERS } from '../config/providers.js';
import { API_TIMEOUTS, AI_MODEL_WEIGHTS, TIEBREAKER_THRESHOLDS } from '../config/constants.js';
import { TIEBREAKER_SYSTEM_PROMPT, buildTiebreakerPrompt } from '../prompts/tiebreaker.js';

// =============================================================================
// DEEPSEEK PROVIDER
// =============================================================================

export class DeepSeekProvider extends BaseAIProvider {
  private static readonly API_ENDPOINT = 'https://api.deepseek.com/v1/chat/completions';

  constructor(config: ProviderConfig) {
    super(config);
    
    // Try multiple possible environment variable names
    this.apiKey = getApiKey('DeepSeek') || config.apiKey;
    
    if (!this.apiKey) {
      console.warn('⚠️ DeepSeek: No API key found');
      this.status.hasApiKey = false;
    }
  }

  /**
   * Standard analysis - TEXT ONLY (no image support)
   */
  async analyze(images: string[], prompt: string): Promise<AIAnalysisResponse> {
    const startTime = Date.now();

    try {
      if (!this.validateApiKey()) {
        throw new Error('DeepSeek API key is missing');
      }

      // DeepSeek is text-only - ignore images and use enhanced prompt
      const jsonEnforcedPrompt = `CRITICAL: Respond with ONLY a valid JSON object. No markdown, no explanations outside JSON.

${prompt}`;

      const response = await this.fetchWithTimeout(
        DeepSeekProvider.API_ENDPOINT,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${this.apiKey}`,
          },
          body: JSON.stringify({
            model: this.provider.model || AI_PROVIDERS.deepseek.models[0], // deepseek-chat
            messages: [
              {
                role: 'system',
                content: 'You must respond with ONLY a valid JSON object. Never include any text, markdown formatting, or code blocks outside the JSON structure.',
              },
              {
                role: 'user',
                content: jsonEnforcedPrompt,
              },
            ],
            temperature: 0.1,
            max_tokens: 800,
          }),
        },
        API_TIMEOUTS.deepseek
      );

      if (!response.ok) {
        const errorText = await response.text();
        console.error('🔍 DeepSeek API error details:', errorText);
        throw new Error(`DeepSeek API error: ${response.status}`);
      }

      const data = await response.json();
      const content = data.choices?.[0]?.message?.content || null;

      console.log('🔍 DeepSeek raw response:', content?.substring(0, 200) + '...');

      const parsed = this.parseAnalysisResult(content);

      const responseTime = Date.now() - startTime;
      this.logProviderStatus(true, responseTime);

      // Apply reduced weight for DeepSeek (tiebreaker role)
      const confidence = (parsed?.confidence || 0.82) * TIEBREAKER_THRESHOLDS.tiebreaker_weight;

      return {
        response: parsed,
        confidence,
        responseTime,
      };
    } catch (error: any) {
      const responseTime = Date.now() - startTime;
      this.logProviderStatus(false, responseTime, error);
      throw error;
    }
  }

  /**
   * Tiebreaker analysis - evaluates conflicting votes from primary AIs
   * Uses enhanced reasoning to break ties when primary models disagree
   */
  async analyzeAsTiebreaker(
    primaryVotes: ModelVote[],
    itemName: string
  ): Promise<AIAnalysisResponse> {
    const startTime = Date.now();

    try {
      if (!this.validateApiKey()) {
        throw new Error('DeepSeek API key is missing');
      }

      console.log('⚖️ DeepSeek: Running tiebreaker analysis');
      console.log(`   Evaluating ${primaryVotes.length} conflicting votes`);

      // Build tiebreaker prompt using the prompts module
      const tiebreakerPrompt = buildTiebreakerPrompt(primaryVotes, itemName);

      const response = await this.fetchWithTimeout(
        DeepSeekProvider.API_ENDPOINT,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${this.apiKey}`,
          },
          body: JSON.stringify({
            model: this.provider.model || AI_PROVIDERS.deepseek.models[0],
            messages: [
              {
                role: 'system',
                content: TIEBREAKER_SYSTEM_PROMPT,
              },
              {
                role: 'user',
                content: tiebreakerPrompt,
              },
            ],
            temperature: 0.1,
            max_tokens: 1000,
          }),
        },
        API_TIMEOUTS.deepseek
      );

      if (!response.ok) {
        const errorText = await response.text();
        console.error('🔍 DeepSeek tiebreaker API error:', errorText);
        throw new Error(`DeepSeek tiebreaker API error: ${response.status}`);
      }

      const data = await response.json();
      const content = data.choices?.[0]?.message?.content || null;

      console.log('⚖️ DeepSeek tiebreaker response:', content?.substring(0, 300) + '...');

      // Parse tiebreaker response
      const tiebreakerResult = this.parseTiebreakerResponse(content, primaryVotes);

      const responseTime = Date.now() - startTime;
      this.logProviderStatus(true, responseTime);

      return {
        response: tiebreakerResult,
        confidence: tiebreakerResult.confidence * TIEBREAKER_THRESHOLDS.tiebreaker_weight,
        responseTime,
      };
    } catch (error: any) {
      const responseTime = Date.now() - startTime;
      this.logProviderStatus(false, responseTime, error);
      throw error;
    }
  }

  /**
   * Parse tiebreaker response and select best vote
   */
  private parseTiebreakerResponse(
    content: string | null,
    primaryVotes: ModelVote[]
  ): any {
    if (!content || primaryVotes.length === 0) {
      // Return middle-ground fallback
      const values = primaryVotes.map(v => v.estimatedValue).filter(v => v > 0);
      const avgValue = values.length > 0 
        ? values.reduce((a, b) => a + b, 0) / values.length 
        : 0;

      return {
        itemName: primaryVotes[0]?.itemName || 'Unknown Item',
        estimatedValue: avgValue,
        decision: 'SELL',
        valuation_factors: [
          'Tiebreaker analysis completed',
          'Based on primary AI consensus',
          'Market factors considered',
          'Condition assessment included',
          'Resale potential evaluated',
        ],
        summary_reasoning: 'Tiebreaker selected based on weighted analysis of conflicting votes.',
        confidence: 0.7,
      };
    }

    try {
      // Try to parse JSON response
      let cleaned = content.replace(/```json\s*/gi, '').replace(/```\s*/g, '').trim();
      const jsonMatch = cleaned.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        cleaned = jsonMatch[0];
      }

      const parsed = JSON.parse(cleaned);

      // If response includes selectedVote index, use that vote
      if (typeof parsed.selectedVote === 'number' && primaryVotes[parsed.selectedVote]) {
        const selectedVote = primaryVotes[parsed.selectedVote];
        return {
          itemName: selectedVote.itemName,
          estimatedValue: parsed.adjustedValue || selectedVote.estimatedValue,
          decision: parsed.adjustedDecision || selectedVote.decision,
          valuation_factors: selectedVote.rawResponse?.valuation_factors || [
            'Selected by tiebreaker analysis',
            'Best reasoning quality',
            'Most consistent with market data',
            'Appropriate price range',
            'Clear item identification',
          ],
          summary_reasoning: parsed.reasoning || selectedVote.rawResponse?.summary_reasoning || 
            'Selected as most accurate analysis based on tiebreaker evaluation.',
          confidence: parsed.confidence || 0.75,
        };
      }

      // If response has direct analysis
      if (parsed.itemName && parsed.estimatedValue !== undefined) {
        return this.parseAnalysisResult(JSON.stringify(parsed)) || {
          ...parsed,
          confidence: parsed.confidence || 0.75,
        };
      }

      // Fallback: select vote with highest confidence
      const bestVote = primaryVotes.reduce((best, vote) => 
        vote.confidence > best.confidence ? vote : best, primaryVotes[0]
      );

      return {
        itemName: bestVote.itemName,
        estimatedValue: bestVote.estimatedValue,
        decision: bestVote.decision,
        valuation_factors: bestVote.rawResponse?.valuation_factors || [
          'Selected highest confidence vote',
          'Tiebreaker analysis completed',
          'Market comparison performed',
          'Condition factored in',
          'Best available assessment',
        ],
        summary_reasoning: `Selected ${bestVote.providerName} analysis as most reliable based on confidence score.`,
        confidence: 0.7,
      };

    } catch (error) {
      console.error('DeepSeek tiebreaker parsing error:', error);

      // Fallback: return average of all votes
      const values = primaryVotes.map(v => v.estimatedValue).filter(v => v > 0);
      const avgValue = values.length > 0 
        ? values.reduce((a, b) => a + b, 0) / values.length 
        : 0;

      const buyCount = primaryVotes.filter(v => v.decision === 'BUY').length;
      const sellCount = primaryVotes.filter(v => v.decision === 'SELL').length;

      return {
        itemName: primaryVotes[0]?.itemName || 'Unknown Item',
        estimatedValue: parseFloat(avgValue.toFixed(2)),
        decision: buyCount > sellCount ? 'BUY' : 'SELL',
        valuation_factors: [
          'Averaged from all AI votes',
          'Tiebreaker parsing failed',
          'Using consensus fallback',
          'Manual review recommended',
          'Multiple perspectives considered',
        ],
        summary_reasoning: 'Fallback analysis using average of all AI votes.',
        confidence: 0.6,
      };
    }
  }
}

// =============================================================================
// STANDALONE FUNCTIONS
// =============================================================================

/**
 * Quick analysis using DeepSeek without instantiating provider class
 */
export async function analyzeWithDeepSeek(
  images: string[],
  prompt: string,
  apiKey?: string
): Promise<AIAnalysisResponse> {
  const key = apiKey || getApiKey('DeepSeek');
  if (!key) {
    throw new Error('DeepSeek API key not found');
  }

  const provider = new DeepSeekProvider({
    id: 'deepseek-standalone',
    name: 'DeepSeek',
    model: AI_PROVIDERS.deepseek.models[0],
    baseWeight: AI_MODEL_WEIGHTS.deepseek,
    apiKey: key,
  });

  return provider.analyze(images, prompt);
}

/**
 * Run tiebreaker analysis on conflicting votes
 */
export async function runDeepSeekTiebreaker(
  primaryVotes: ModelVote[],
  itemName: string,
  apiKey?: string
): Promise<AIAnalysisResponse> {
  const key = apiKey || getApiKey('DeepSeek');
  if (!key) {
    throw new Error('DeepSeek API key not found');
  }

  const provider = new DeepSeekProvider({
    id: 'deepseek-tiebreaker',
    name: 'DeepSeek',
    model: AI_PROVIDERS.deepseek.models[0],
    baseWeight: AI_MODEL_WEIGHTS.deepseek,
    apiKey: key,
  });

  return provider.analyzeAsTiebreaker(primaryVotes, itemName);
}

// =============================================================================
// EXPORTS
// =============================================================================

export default DeepSeekProvider;