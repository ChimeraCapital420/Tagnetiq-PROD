// src/lib/ai-providers/mistral-provider.ts
protected parseResponse(response: string): any {
  try {
    const cleaned = response.replace(/```json\n?/g, '')
                          .replace(/```\n?/g, '')
                          .trim();
    
    const parsed = JSON.parse(cleaned);
    
    // Validate required fields
    const required = ['itemName', 'estimatedValue', 'decision', 'valuation_factors', 'summary_reasoning'];
    const missing = required.filter(field => !parsed[field]);
    
    if (missing.length > 0) {
      console.warn('Mistral: Parsed JSON missing required fields:', missing);
      
      // Attempt to fix common issues
      if (!parsed.itemName && parsed.item_name) parsed.itemName = parsed.item_name;
      if (!parsed.estimatedValue && parsed.estimated_value) parsed.estimatedValue = parsed.estimated_value;
      if (!parsed.valuation_factors && parsed.factors) parsed.valuation_factors = parsed.factors;
      if (!parsed.summary_reasoning && parsed.summary) parsed.summary_reasoning = parsed.summary;
      
      // Set defaults for still-missing fields
      parsed.itemName = parsed.itemName || 'Unknown Item';
      parsed.estimatedValue = parsed.estimatedValue || 0;
      parsed.decision = parsed.decision || 'SELL';
      parsed.valuation_factors = parsed.valuation_factors || ['Unable to analyze'];
      parsed.summary_reasoning = parsed.summary_reasoning || 'Analysis incomplete';
      parsed.confidence = parsed.confidence || 0.1;
    }
    
    return parsed;
  } catch (error) {
    console.error('Mistral JSON parse error:', error);
    console.error('Raw response:', response);
    
    // Return minimal valid structure
    return {
      itemName: 'Parse Error',
      estimatedValue: 0,
      decision: 'SELL',
      valuation_factors: ['Parsing failed'],
      summary_reasoning: 'Failed to parse Mistral response',
      confidence: 0.1,
      error: true
    };
  }
}