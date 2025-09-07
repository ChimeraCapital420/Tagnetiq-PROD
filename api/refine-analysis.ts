// api/refine-analysis.ts

import { VercelRequest, VercelResponse } from '@vercel/node';
import { AnalysisResult } from '../src/types';
import Anthropic from '@anthropic-ai/sdk';
import OpenAI from 'openai';
import { GoogleGenerativeAI } from '@google/generative-ai';

// --- Initialize AI Clients ---
const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
});

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

const genAI = new GoogleGenerativeAI(process.env.GOOGLE_API_KEY!);
const googleModel = genAI.getGenerativeModel({ model: "gemini-1.5-pro-latest"});

// --- API Integration Functions ---
async function searchNumistaCoins(searchTerm: string) {
  const apiKey = process.env.NUMISTA_API_KEY;
  if (!apiKey) return [];

  try {
    const response = await fetch(
      `https://api.numista.com/v3/types?q=${encodeURIComponent(searchTerm)}&count=10`,
      {
        headers: {
          'Numista-API-Key': apiKey,
          'Accept': 'application/json'
        }
      }
    );

    if (!response.ok) return [];
    const data = await response.json();
    
    return (data.types || []).map((coin: any) => ({
      source: 'Numista',
      title: coin.title,
      year: coin.min_year || coin.max_year,
      country: coin.issuer?.name,
      composition: coin.composition?.text,
      weight: coin.weight,
      diameter: coin.diameter,
      mintage: coin.mintage,
      catalog_id: coin.id
    }));
  } catch (error) {
    console.error('Numista error:', error);
    return [];
  }
}

// --- NEW: PCGS Coin Grading & Population Data ---
async function searchPCGSCoins(searchTerm: string) {
  const apiKey = process.env.PCGS_API_KEY;
  if (!apiKey) return [];

  try {
    // Note: PCGS API structure varies - adjust endpoint based on their documentation
    // This is a common structure for coin grading APIs
    const response = await fetch(
      `https://api.pcgs.com/v1/coins/search?q=${encodeURIComponent(searchTerm)}&limit=10`,
      {
        headers: {
          'Authorization': `Bearer ${apiKey}`,
          'Accept': 'application/json'
        }
      }
    );

    if (!response.ok) return [];
    const data = await response.json();
    
    return (data.results || data.coins || []).map((coin: any) => ({
      source: 'PCGS',
      pcgs_number: coin.pcgs_number,
      title: coin.description || coin.coin_name,
      year: coin.year,
      mint_mark: coin.mint_mark,
      denomination: coin.denomination,
      // Population data shows rarity
      population_data: {
        total_graded: coin.population?.total,
        ms65_and_higher: coin.population?.ms65_plus,
        ms67_and_higher: coin.population?.ms67_plus,
        ms70_perfect: coin.population?.ms70
      },
      // Price guide data
      price_guide: {
        ms60: coin.prices?.ms60,
        ms63: coin.prices?.ms63,
        ms65: coin.prices?.ms65,
        ms67: coin.prices?.ms67,
        ms70: coin.prices?.ms70
      },
      variety: coin.variety,
      designation: coin.designation,
      coin_facts: coin.coin_facts
    }));
  } catch (error) {
    console.error('PCGS error:', error);
    return [];
  }
}

async function searchBricksetLego(searchTerm: string) {
  const apiKey = process.env.BRICKSET_API_KEY;
  if (!apiKey) return [];

  try {
    const response = await fetch('https://brickset.com/api/v3.asmx/getSets', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        apiKey: apiKey,
        params: JSON.stringify({ query: searchTerm, pageSize: 10 })
      }).toString()
    });

    if (!response.ok) return [];
    
    const text = await response.text();
    const jsonMatch = text.match(/>(\{.*\})</);
    if (!jsonMatch) return [];
    
    const data = JSON.parse(jsonMatch[1]);
    const sets = data.sets || [];

    return sets.map((set: any) => ({
      source: 'Brickset',
      set_number: set.number,
      name: set.name,
      year: set.year,
      theme: set.theme,
      subtheme: set.subtheme,
      pieces: set.pieces,
      minifigs: set.minifigs,
      retail_price_usd: set.USRetailPrice,
      current_value_new: set.currentValue?.new,
      current_value_used: set.currentValue?.used
    }));
  } catch (error) {
    console.error('Brickset error:', error);
    return [];
  }
}

// --- Chrono24 Watch Search Integration ---
async function searchChrono24Watches(searchTerm: string) {
  const apiKey = process.env.CHRONO24_API_KEY;
  if (!apiKey) return [];

  try {
    // Note: This is a hypothetical API structure based on typical watch marketplace APIs
    // You'll need to adjust based on actual Chrono24 API documentation
    const response = await fetch(
      `https://api.chrono24.com/v1/watches/search?q=${encodeURIComponent(searchTerm)}&limit=10`,
      {
        headers: {
          'Authorization': `Bearer ${apiKey}`,
          'Accept': 'application/json'
        }
      }
    );

    if (!response.ok) return [];
    const data = await response.json();
    
    return (data.watches || data.items || []).map((watch: any) => ({
      source: 'Chrono24',
      brand: watch.brand,
      model: watch.model,
      reference: watch.reference_number,
      year: watch.production_year,
      condition: watch.condition,
      box_papers: watch.box_and_papers,
      movement: watch.movement_type,
      case_material: watch.case_material,
      case_diameter: watch.case_diameter_mm,
      average_price: watch.price_stats?.average,
      min_price: watch.price_stats?.min,
      max_price: watch.price_stats?.max,
      market_trend: watch.price_trend,
      listing_url: watch.url
    }));
  } catch (error) {
    console.error('Chrono24 error:', error);
    return [];
  }
}

// --- Perplexity API Integration ---
async function searchPerplexity(query: string, category: string) {
  const apiKey = process.env.PERPLEXITY_API_KEY;
  if (!apiKey) return null;

  try {
    const response = await fetch('https://api.perplexity.ai/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'pplx-7b-online',
        messages: [
          {
            role: 'system',
            content: 'You are a collectibles valuation expert. Provide current market data and pricing information.'
          },
          {
            role: 'user',
            content: `Find current market prices and recent sales data for: ${query} in the ${category} category. Focus on: recent eBay sold listings, auction results, current retail prices, and condition-based pricing variations.`
          }
        ],
        temperature: 0.1,
        max_tokens: 1000
      }),
    });

    if (!response.ok) return null;
    const data = await response.json();
    return data.choices[0].message.content;
  } catch (error) {
    console.error('Perplexity error:', error);
    return null;
  }
}

/**
 * A helper function to safely parse a JSON string from an AI response.
 * @param jsonString The string to parse.
 * @returns The parsed object or null if parsing fails.
 */
const safeJsonParse = (jsonString: string) => {
  try {
    // Clean the string: remove ```json markdown and any leading/trailing whitespace
    const cleanedString = jsonString.replace(/```json/g, '').replace(/```/g, '').trim();
    return JSON.parse(cleanedString);
  } catch (error) {
    console.error("JSON parsing failed for string:", jsonString);
    return null;
  }
};


export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', ['POST']);
    return res.status(405).end('Method Not Allowed');
  }

  try {
    const { original_analysis, refinement_text, category, subcategory } = req.body;

    if (!original_analysis || !refinement_text) {
      return res.status(400).json({ error: 'Missing original_analysis or refinement_text in request body.' });
    }

    const analysis: AnalysisResult = original_analysis;

    // --- Fetch Category-Specific API Data ---
    let apiData = [];
    let perplexityData = null;

    // Determine search query from item name or refinement text
    const searchQuery = analysis.itemName || refinement_text;

    // Category-specific API calls
    if (category === 'Toys & Collectibles' && subcategory === 'LEGO Sets') {
      apiData = await searchBricksetLego(searchQuery);
      perplexityData = await searchPerplexity(searchQuery, 'LEGO collectibles');
    } else if (category === 'Coins & Currency') {
      // UPDATED: Call both Numista and PCGS for coins
      const [numistaData, pcgsData] = await Promise.all([
        searchNumistaCoins(searchQuery),
        searchPCGSCoins(searchQuery)
      ]);
      apiData = [...numistaData, ...pcgsData];
      perplexityData = await searchPerplexity(searchQuery, 'numismatic coins grading PCGS');
    } else if (category === 'Jewelry & Watches' && (subcategory === 'Luxury Watches' || subcategory === 'Watches')) {
      // Chrono24 integration for watches
      apiData = await searchChrono24Watches(searchQuery);
      perplexityData = await searchPerplexity(searchQuery, 'luxury watches market');
    } else {
      // For other categories, just use Perplexity
      perplexityData = await searchPerplexity(searchQuery, category || 'collectibles');
    }

    // --- Dynamic Multi-AI Consensus Prompt ---
    const prompt = `
      You are an expert appraiser. Given the following item analysis, new information from the user, and category-specific market data, provide an adjusted valuation.

      Original Item Analysis:
      - Item: ${analysis.itemName}
      - Category: ${category || 'Unknown'}
      - Subcategory: ${subcategory || 'Unknown'}
      - Original Estimated Value: $${analysis.estimatedValue.toFixed(2)}
      - Original Key Valuation Factors: ${analysis.valuation_factors.join('; ')}
      - Original Summary: ${analysis.summary_reasoning}

      New Information Provided by User: "${refinement_text}"

      ${apiData.length > 0 ? `Category-Specific Market Data:
      ${JSON.stringify(apiData, null, 2)}` : ''}

      ${perplexityData ? `Current Market Intelligence:
      ${perplexityData}` : ''}

      Your Task:
      1. Analyze how the new information and market data impact the item's value.
      2. If specific API data is provided (Numista for coins, Brickset for LEGO, Chrono24 for watches, PCGS for coin grading), prioritize this authoritative data.
      3. For coins specifically: 
         - PCGS population data indicates rarity (lower populations = higher value)
         - Grade differences dramatically affect value (MS65 vs MS67 can be 10x difference)
         - Consider both Numista's global data and PCGS's US-focused grading data
      4. For watches specifically, consider factors like: brand prestige, reference rarity, condition, box/papers completeness, and current market trends.
      5. Determine a new, adjusted estimated value as a single number.
      6. Create a new list of the top 5 key valuation factors incorporating market data.
      7. Generate a new summary that reflects both the refinement and the market data.

      Respond ONLY with a valid JSON object in the following format, with no other text or explanation.
      {
        "newValue": <number>,
        "newFactors": ["<factor 1>", "<factor 2>", "<factor 3>", "<factor 4>", "<factor 5>"],
        "newSummary": "<string>"
      }
    `;

    // --- Execute Parallel AI Calls ---
    const aiPromises = [
      // Anthropic Call
      anthropic.messages.create({
        model: "claude-3-5-sonnet-20240620",
        max_tokens: 1024,
        messages: [{ role: "user", content: prompt }],
      }).then(response => safeJsonParse(response.content[0].text)),

      // OpenAI Call
      openai.chat.completions.create({
        model: "gpt-4o",
        messages: [{ role: "user", content: prompt }],
        response_format: { type: "json_object" },
      }).then(response => safeJsonParse(response.choices[0].message.content!)),

      // Google Gemini Call
      googleModel.generateContent(prompt)
        .then(response => safeJsonParse(response.response.text())),
    ];

    const results = await Promise.allSettled(aiPromises);

    const successfulResponses = results
      .filter(result => result.status === 'fulfilled' && result.value)
      .map(result => (result as PromiseFulfilledResult<any>).value);
    
    if (successfulResponses.length === 0) {
        console.error("All AI API calls failed or returned invalid data.", results);
        throw new Error("Unable to get a valid response from any AI model.");
    }

    // --- Aggregate and Average the Results (Judicium Consensus) ---
    const totalValue = successfulResponses.reduce((acc, curr) => acc + (curr.newValue || 0), 0);
    const averageValue = totalValue / successfulResponses.length;

    const allFactors = successfulResponses.flatMap(res => res.newFactors || []);
    const uniqueFactors = [...new Set(allFactors)];

    // For simplicity, we'll take the summary from the first successful response.
    const newSummary = successfulResponses[0].newSummary || `Value adjusted based on user feedback. ${analysis.summary_reasoning}`;

    // --- Construct Final Updated Analysis ---
    const updatedAnalysis: AnalysisResult = {
      ...analysis,
      estimatedValue: averageValue,
      valuation_factors: uniqueFactors.slice(0, 5), // Take top 5 unique factors
      summary_reasoning: newSummary,
    };

    return res.status(200).json(updatedAnalysis);

  } catch (error) {
    console.error('Error in /api/refine-analysis:', error);
    const errorMessage = error instanceof Error ? error.message : 'An unknown error occurred';
    return res.status(500).json({ error: 'Internal Server Error', details: errorMessage });
  }
}