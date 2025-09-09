// api/refine-analysis.ts

import { VercelRequest, VercelResponse } from '@vercel/node';
import { AnalysisResult } from '../src/types';
import Anthropic from '@anthropic-ai/sdk';
import OpenAI from 'openai';
import { GoogleGenerativeAI } from '@google/generative-ai';

// UPDATED: Flexible API key retrieval functions
function getOpenAIKey(): string | undefined {
  return process.env.OPENAI_API_KEY || 
         process.env.OPEN_AI_API_KEY || 
         process.env.OPENAI_TOKEN || 
         process.env.OPEN_AI_TOKEN ||
         process.env.OPENAI_SECRET;
}

function getAnthropicKey(): string | undefined {
  return process.env.ANTHROPIC_API_KEY || 
         process.env.ANTHROPIC_SECRET || 
         process.env.ANTHROPIC_TOKEN ||
         process.env.CLAUDE_API_KEY;
}

function getGoogleKey(): string | undefined {
  return process.env.GOOGLE_API_KEY || 
         process.env.GOOGLE_AI_TOKEN || 
         process.env.GOOGLE_AI_KEY ||
         process.env.GEMINI_API_KEY ||
         process.env.GEMINI_TOKEN;
}

// --- Initialize AI Clients with flexible keys ---
const anthropicKey = getAnthropicKey();
const openaiKey = getOpenAIKey();
const googleKey = getGoogleKey();

const anthropic = anthropicKey ? new Anthropic({ apiKey: anthropicKey }) : null;
const openai = openaiKey ? new OpenAI({ apiKey: openaiKey }) : null;
const genAI = googleKey ? new GoogleGenerativeAI(googleKey) : null;
const googleModel = genAI ? genAI.getGenerativeModel({ model: "gemini-1.5-pro-latest"}) : null;

// --- API Integration Functions ---
async function searchNumistaCoins(searchTerm: string) {
  const apiKey = process.env.NUMISTA_API_KEY || process.env.NUMISTA_TOKEN;
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

// --- PCGS Coin Grading & Population Data ---
async function searchPCGSCoins(searchTerm: string) {
  const apiKey = process.env.PCGS_API_KEY || process.env.PCGS_TOKEN || process.env.PCGS_SECRET;
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
  const apiKey = process.env.BRICKSET_API_KEY || process.env.BRICKSET_TOKEN;
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
  const apiKey = process.env.CHRONO24_API_KEY || process.env.CHRONO24_TOKEN;
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

// --- NEW: GoCollect Multi-Category Integration ---
async function searchGoCollect(searchTerm: string, collectibleType: string = 'all') {
  const apiKey = process.env.GOCOLLECT_API_KEY || process.env.GO_COLLECT_API_KEY || process.env.GOCOLLECT_TOKEN;
  if (!apiKey) return [];

  try {
    // GoCollect API endpoint - adjust based on their actual documentation
    const endpoint = collectibleType === 'all' 
      ? `https://api.gocollect.com/v1/collectibles/search?q=${encodeURIComponent(searchTerm)}`
      : `https://api.gocollect.com/v1/collectibles/${collectibleType}/search?q=${encodeURIComponent(searchTerm)}`;

    const response = await fetch(endpoint, {
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Accept': 'application/json'
      }
    });

    if (!response.ok) return [];
    const data = await response.json();
    
    return (data.results || data.items || []).map((item: any) => ({
      source: 'GoCollect',
      type: item.type || collectibleType,
      title: item.title || item.name,
      issue_number: item.issue,
      publisher: item.publisher,
      set_name: item.set_name,
      card_number: item.card_number,
      year: item.year,
      // Price data by condition/grade
      prices: {
        mint: item.prices?.mint || item.prices?.['9.8'],
        near_mint: item.prices?.near_mint || item.prices?.['9.6'],
        excellent: item.prices?.excellent || item.prices?.['9.4'],
        very_good: item.prices?.very_good || item.prices?.['9.0'],
        good: item.prices?.good || item.prices?.['8.0'],
        fair: item.prices?.fair || item.prices?.['6.0']
      },
      // Market trends
      trend_30_day: item.trends?.thirty_day,
      trend_90_day: item.trends?.ninety_day,
      trend_1_year: item.trends?.one_year,
      // Population/Census data for rarity
      census: {
        total_graded: item.census?.total,
        high_grade_count: item.census?.high_grade
      },
      // Additional metadata
      rarity: item.rarity,
      first_appearance: item.first_appearance,
      key_issue: item.key_issue,
      hot_item: item.hot_item
    }));
  } catch (error) {
    console.error('GoCollect error:', error);
    return [];
  }
}

// --- Perplexity API Integration ---
async function searchPerplexity(query: string, category: string) {
  const apiKey = process.env.PERPLEXITY_API_KEY || process.env.PERPLEXITY_TOKEN || process.env.PPLX_API_KEY;
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

    // Category-specific API calls with GoCollect integration
    if (category === 'Toys & Collectibles') {
      if (subcategory === 'LEGO Sets') {
        apiData = await searchBricksetLego(searchQuery);
        perplexityData = await searchPerplexity(searchQuery, 'LEGO collectibles');
      } else if (subcategory === 'Action Figures' || subcategory === 'Vintage Toys') {
        apiData = await searchGoCollect(searchQuery, 'toys');
        perplexityData = await searchPerplexity(searchQuery, 'vintage toys action figures');
      }
    } else if (category === 'Trading Cards') {
      // Handle specific trading card types
      if (subcategory === 'Pokemon Cards' || searchQuery.toLowerCase().includes('pokemon')) {
        apiData = await searchGoCollect(searchQuery, 'pokemon');
        perplexityData = await searchPerplexity(searchQuery, 'Pokemon TCG card values PSA BGS');
      } else if (subcategory === 'Magic: The Gathering' || searchQuery.toLowerCase().includes('mtg') || searchQuery.toLowerCase().includes('magic')) {
        apiData = await searchGoCollect(searchQuery, 'mtg');
        perplexityData = await searchPerplexity(searchQuery, 'Magic the Gathering card prices');
      } else if (subcategory === 'Sports Cards') {
        const goCollectData = await searchGoCollect(searchQuery, 'sports');
        apiData = [...goCollectData];
        perplexityData = await searchPerplexity(searchQuery, 'sports cards PSA BGS pricing');
      } else {
        // General trading cards
        apiData = await searchGoCollect(searchQuery, 'cards');
        perplexityData = await searchPerplexity(searchQuery, 'trading card values');
      }
    } else if (category === 'Comics & Graphic Novels' || category === 'Comic Books') {
      apiData = await searchGoCollect(searchQuery, 'comics');
      perplexityData = await searchPerplexity(searchQuery, 'comic book values CGC CBCS');
    } else if (category === 'Coins & Currency') {
      // Call both Numista and PCGS for coins
      const [numistaData, pcgsData] = await Promise.all([
        searchNumistaCoins(searchQuery),
        searchPCGSCoins(searchQuery)
      ]);
      apiData = [...numistaData, ...pcgsData];
      perplexityData = await searchPerplexity(searchQuery, 'numismatic coins grading PCGS NGC');
    } else if (category === 'Jewelry & Watches' && (subcategory === 'Luxury Watches' || subcategory === 'Watches')) {
      apiData = await searchChrono24Watches(searchQuery);
      perplexityData = await searchPerplexity(searchQuery, 'luxury watches market Chrono24');
    } else if (category === 'Video Games' || category === 'Gaming') {
      const goCollectData = await searchGoCollect(searchQuery, 'videogames');
      apiData = [...goCollectData];
      perplexityData = await searchPerplexity(searchQuery, 'video game values WATA VGA sealed');
    } else if (category === 'Magazines' || category === 'Publications') {
      apiData = await searchGoCollect(searchQuery, 'magazines');
      perplexityData = await searchPerplexity(searchQuery, 'vintage magazine values');
    } else if (category === 'Music & Memorabilia' && subcategory === 'Concert Posters') {
      apiData = await searchGoCollect(searchQuery, 'posters');
      perplexityData = await searchPerplexity(searchQuery, 'concert poster rock memorabilia values');
    } else {
      // For any other categories, try general GoCollect search plus Perplexity
      const goCollectData = await searchGoCollect(searchQuery, 'all');
      if (goCollectData.length > 0) {
        apiData = goCollectData;
      }
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
      2. If specific API data is provided, prioritize this authoritative data:
         - GoCollect: Provides graded prices, population census, and trend data
         - Numista: Global coin specifications and varieties
         - PCGS: US coin grading populations and price guides
         - Brickset: LEGO set details and current market values
         - Chrono24: Watch market prices and trends
      3. For graded items (cards, comics, coins): Grade dramatically affects value
         - Pokemon/MTG: PSA 10 vs PSA 9 can be 5-10x difference
         - Comics: CGC 9.8 vs 9.6 can be 3-5x difference
         - Coins: MS67 vs MS65 can be 10x+ difference
      4. Consider market trends: 30-day, 90-day, and 1-year trends from GoCollect
      5. Factor in rarity: population/census data indicates scarcity premiums
      6. Determine a new, adjusted estimated value as a single number.
      7. Create a new list of the top 5 key valuation factors incorporating market data.
      8. Generate a new summary that reflects both the refinement and the market data.

      Respond ONLY with a valid JSON object in the following format, with no other text or explanation.
      {
        "newValue": <number>,
        "newFactors": ["<factor 1>", "<factor 2>", "<factor 3>", "<factor 4>", "<factor 5>"],
        "newSummary": "<string>"
      }
    `;

    // --- Execute Parallel AI Calls ---
    const aiPromises = [];
    
    // Only add AI calls if the client is initialized
    if (anthropic) {
      aiPromises.push(
        anthropic.messages.create({
          model: "claude-3-5-sonnet-20240620",
          max_tokens: 1024,
          messages: [{ role: "user", content: prompt }],
        }).then(response => safeJsonParse(response.content[0].text))
      );
    }
    
    if (openai) {
      aiPromises.push(
        openai.chat.completions.create({
          model: "gpt-4o",
          messages: [{ role: "user", content: prompt }],
          response_format: { type: "json_object" },
        }).then(response => safeJsonParse(response.choices[0].message.content!))
      );
    }
    
    if (googleModel) {
      aiPromises.push(
        googleModel.generateContent(prompt)
          .then(response => safeJsonParse(response.response.text()))
      );
    }

    if (aiPromises.length === 0) {
      console.error("No AI services available - check API key configuration");
      throw new Error("No AI services are available. Please check API key configuration.");
    }

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