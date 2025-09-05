import type { VercelRequest, VercelResponse } from '@vercel/node';
import { createClient } from '@supabase/supabase-js';
import { ProviderFactory } from '../src/lib/ai-providers/provider-factory.js';

export const config = {
  maxDuration: 60,
};

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

// Test each provider individually
async function testProviders() {
  const results: any[] = [];
  
  // Test image for providers that support it
  const testImage = 'data:image/jpeg;base64,/9j/4AAQSkZJRgABAQEASABIAAD/2wBDAAYEBQYFBAYGBQYHBwYIChAKCgkJChQODwwQFxQYGBcUFhYaHSUfGhsjHBYWICwgIyYnKSopGR8tMC0oMCUoKSj/2wBDAQcHBwoIChMKChMoGhYaKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCj/wAARCABAAEADASIAAhEBAxEB/8QAGwAAAgMBAQEAAAAAAAAAAAAABAUDBgcCAQD/xAAuEAACAQMEAgEDAwQDAAAAAAABAgMABBEFEiExQVEGE2FxgZGhFCKxwVLR8P/EABkBAAMBAQEAAAAAAAAAAAAAAAIDBAEABf/EACYRAAIBAwQBBAMBAAAAAAAAAAABAgMREiExQVEEEyJhsXGBkaH/2gAMAwEAAhEDEQA/ANmiiAUV2EANdKOKjlkVOvNOMOyAcV4VGcYqNLlDkA5roz+q6xy3Al6U10xQDS17HJG/tK2d9EmI1vZVHgB2A/zTbW0WfS7hJBlCnOfXmsQi1G8gAENzKg9BzWhajnZpr1s9fK1c1ZIIOwaqPybRYp7v+sQbZNoVgBw2Dwf171YrLUYbpQ0b5FJvkWtafpNlcTXUu75EqRocgj9K8mlUkpq8WejUgnB2aMqa1u7dbvUIoWJRpGCjPgnilcDXMLb4pZEYeCpFCtIZHLOckkkn3XqNa9VJLKjxHBt6mkfEviPyHUJku9RvdV0/SsbxKLmRGmHgKM5APk1pn/GuBytydv8AyIz/AG+s0h/pu6X4hp5d90suoooLHJI3Sf6rrWrq/t9Zt44b27jh+jnYkzqOzz1+K86VWVR3loepCnGmrR1NdPFC3DZGKpdjqGpyn6Yasqqd3NxKB/g1JNa+S/IbfP0NLSYDwzMf8kVLPA72LHGCaiQk96Ur0H5DqFwwe7SBT1siUD9yM02ttWsZ0ydyH3jI/emwjBgSkx/c6TaXce2eFXHo96K1D4TpOq5Z4PpSHrYAPwRin2jXMZUbyGFWKKZCg2kUToQe6EpyWxgPxv4xP8dh1N/qJOt9GIyUyNuGzkH81TtQ0XUIdZ1MiyuGSGTO/YcCt0+XatZ6JaST3rgEDCL5Y+hWO2ms6xcXUs8urXQaTO5d/APgAdhWRcr7gTtbQ//Z';
  const testPrompt = 'Analyze the item. Respond in JSON format ONLY: {"itemName": "test object", "estimatedValue": "10.00", "decision": "SELL", "valuation_factors": ["Factor 1", "Factor 2", "Factor 3", "Factor 4", "Factor 5"], "summary_reasoning": "Test analysis.", "confidence": 0.85}';
  
  // Load provider configurations from database
  const { data: providerConfigs, error } = await supabase
    .from('ai_providers')
    .select('*')
    .eq('is_active', true)
    .order('name');
    
  if (error) {
    console.error('Failed to load providers:', error);
    return results;
  }
  
  console.log(`Found ${providerConfigs.length} active providers in database`);
  
  // Test each provider
  for (const config of providerConfigs) {
    const apiKey = getApiKey(config.name);
    
    if (!apiKey) {
      results.push({
        provider: config.name,
        status: 'FAILED',
        error: 'No API key found',
        hasApiKey: false,
        model: config.model
      });
      continue;
    }
    
    try {
      const provider = ProviderFactory.create({
        ...config,
        apiKey,
        baseWeight: parseFloat(config.base_weight)
      });
      
      const startTime = Date.now();
      
      // Use appropriate test based on provider capability
      const supportsImages = ['OpenAI', 'Anthropic', 'Google', 'DeepSeek'].includes(config.name);
      const result = await provider.analyze(
        supportsImages ? [testImage] : [],
        testPrompt
      );
      
      const responseTime = Date.now() - startTime;
      
      results.push({
        provider: config.name,
        status: 'SUCCESS',
        hasApiKey: true,
        supportsImages,
        model: config.model,
        responseTime,
        confidence: result.confidence,
        response: result.response
      });
      
    } catch (error: any) {
      results.push({
        provider: config.name,
        status: 'FAILED',
        error: error.message,
        hasApiKey: true,
        model: config.model
      });
    }
  }
  
  return results;
}

function getApiKey(providerName: string): string | undefined {
  const keyMap: Record<string, string | undefined> = {
    'OpenAI': process.env.OPENAI_API_KEY || process.env.OPENAI_TOKEN,
    'Anthropic': process.env.ANTHROPIC_SECRET,
    'Google': process.env.GOOGLE_AI_TOKEN,
    'Mistral': process.env.MISTRAL_API_KEY,
    'Groq': process.env.GROQ_API_KEY,
    'DeepSeek': process.env.DEEPSEEK_API_KEY,
    'xAI': process.env.XAI_API_KEY,
    'Perplexity': process.env.PERPLEXITY_API_KEY
  };
  
  return keyMap[providerName];
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }
  
  console.log('Starting AI provider tests...');
  
  const testResults = await testProviders();
  
  // Summary statistics
  const summary = {
    totalProviders: testResults.length,
    successfulProviders: testResults.filter(r => r.status === 'SUCCESS').length,
    failedProviders: testResults.filter(r => r.status === 'FAILED').length,
    missingApiKeys: testResults.filter(r => !r.hasApiKey).length,
    averageResponseTime: Math.round(
      testResults
        .filter(r => r.responseTime)
        .reduce((sum, r) => sum + r.responseTime, 0) / 
      testResults.filter(r => r.responseTime).length || 0
    )
  };
  
  return res.status(200).json({
    summary,
    results: testResults,
    timestamp: new Date().toISOString()
  });
}