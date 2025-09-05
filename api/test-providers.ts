import type { VercelRequest, VercelResponse } from '@vercel/node';
import { createClient } from '@supabase/supabase-js';

export const config = {
  maxDuration: 60,
};

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

// Test provider class
class TestProvider {
  constructor(
    private config: any,
    private apiKey: string
  ) {}

  async analyze(images: string[], prompt: string): Promise<any> {
    const { name, endpoint, model } = this.config;
    
    switch (name) {
      case 'OpenAI':
        return this.testOpenAI(images, prompt);
      case 'Anthropic':
        return this.testAnthropic(images, prompt);
      case 'Google':
        return this.testGoogle(images, prompt);
      case 'Mistral':
        return this.testMistral(prompt);
      case 'Groq':
        return this.testGroq(prompt);
      case 'DeepSeek':
        return this.testDeepSeek(images, prompt);
      case 'xAI':
        return this.testXAI(prompt);
      case 'Perplexity':
        return this.testPerplexity(prompt);
      default:
        throw new Error(`Unknown provider: ${name}`);
    }
  }

  private async testOpenAI(images: string[], prompt: string) {
    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${this.apiKey}`
      },
      body: JSON.stringify({
        model: this.config.model || 'gpt-4-turbo',
        messages: [{
          role: 'user',
          content: images.length > 0 ? [
            { type: 'text', text: prompt },
            { type: 'image_url', image_url: { url: images[0] } }
          ] : prompt
        }],
        max_tokens: 1000
      })
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`OpenAI error: ${response.status} - ${error}`);
    }

    const data = await response.json();
    return {
      response: JSON.parse(data.choices[0].message.content),
      confidence: 0.85
    };
  }

  private async testAnthropic(images: string[], prompt: string) {
    const messages = images.length > 0 ? [{
      role: 'user',
      content: [
        { type: 'image', source: { type: 'base64', media_type: 'image/jpeg', data: images[0].split(',')[1] } },
        { type: 'text', text: prompt }
      ]
    }] : [{
      role: 'user',
      content: prompt
    }];

    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': this.apiKey,
        'anthropic-version': '2023-06-01'
      },
      body: JSON.stringify({
        model: this.config.model || 'claude-3-opus-20240229',
        messages,
        max_tokens: 1000
      })
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`Anthropic error: ${response.status} - ${error}`);
    }

    const data = await response.json();
    return {
      response: JSON.parse(data.content[0].text),
      confidence: 0.9
    };
  }

  private async testGoogle(images: string[], prompt: string) {
    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${this.config.model || 'gemini-pro'}:generateContent?key=${this.apiKey}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{
            parts: images.length > 0 ? [
              { text: prompt },
              { inline_data: { mime_type: 'image/jpeg', data: images[0].split(',')[1] } }
            ] : [{ text: prompt }]
          }]
        })
      }
    );

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`Google error: ${response.status} - ${error}`);
    }

    const data = await response.json();
    return {
      response: JSON.parse(data.candidates[0].content.parts[0].text),
      confidence: 0.85
    };
  }

  private async testMistral(prompt: string) {
    const response = await fetch('https://api.mistral.ai/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${this.apiKey}`
      },
      body: JSON.stringify({
        model: this.config.model || 'mistral-large-latest',
        messages: [{ role: 'user', content: prompt }]
      })
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`Mistral error: ${response.status} - ${error}`);
    }

    const data = await response.json();
    return {
      response: JSON.parse(data.choices[0].message.content),
      confidence: 0.8
    };
  }

  private async testGroq(prompt: string) {
    const response = await fetch('https://api.groq.com/openai/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${this.apiKey}`
      },
      body: JSON.stringify({
        model: this.config.model || 'llama3-70b-8192',
        messages: [{ role: 'user', content: prompt }]
      })
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`Groq error: ${response.status} - ${error}`);
    }

    const data = await response.json();
    return {
      response: JSON.parse(data.choices[0].message.content),
      confidence: 0.75
    };
  }

  private async testDeepSeek(images: string[], prompt: string) {
    const response = await fetch('https://api.deepseek.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${this.apiKey}`
      },
      body: JSON.stringify({
        model: this.config.model || 'deepseek-chat',
        messages: [{
          role: 'user',
          content: images.length > 0 ? [
            { type: 'text', text: prompt },
            { type: 'image_url', image_url: { url: images[0] } }
          ] : prompt
        }]
      })
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`DeepSeek error: ${response.status} - ${error}`);
    }

    const data = await response.json();
    return {
      response: JSON.parse(data.choices[0].message.content),
      confidence: 0.8
    };
  }

  private async testXAI(prompt: string) {
    const response = await fetch('https://api.x.ai/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${this.apiKey}`
      },
      body: JSON.stringify({
        model: this.config.model || 'grok-beta',
        messages: [{ role: 'user', content: prompt }]
      })
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`xAI error: ${response.status} - ${error}`);
    }

    const data = await response.json();
    return {
      response: JSON.parse(data.choices[0].message.content),
      confidence: 0.85
    };
  }

  private async testPerplexity(prompt: string) {
    const response = await fetch('https://api.perplexity.ai/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${this.apiKey}`
      },
      body: JSON.stringify({
        model: this.config.model || 'llama-3.1-sonar-large-128k-online',
        messages: [{ role: 'user', content: prompt }]
      })
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`Perplexity error: ${response.status} - ${error}`);
    }

    const data = await response.json();
    return {
      response: JSON.parse(data.choices[0].message.content),
      confidence: 0.8
    };
  }
}

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
      const provider = new TestProvider(config, apiKey);
      
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