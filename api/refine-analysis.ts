// api/refine-analysis.ts
// FORCE REDEPLOY v2.0 - Added Pokemon TCG, RAWG, Discogs, Comic Vine, Retailed APIs

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

// Production URL for internal API calls
const BASE_URL = 'https://tagnetiq-prod.vercel.app';

// --- API Integration Functions ---

// Numista Coins
async function searchNumistaCoins(searchTerm: string) {
  try {
    const response = await fetch(
      `${BASE_URL}/api/numista/search?q=${encodeURIComponent(searchTerm)}&limit=5`,
      { headers: { 'Accept': 'application/json' } }
    );

    if (!response.ok) return [];
    const data = await response.json();
    
    return (data.results || []).map((coin: any) => ({
      source: 'Numista',
      title: coin.title,
      year: coin.minYear || coin.maxYear,
      country: coin.issuer?.name,
      composition: coin.composition?.text,
      numista_id: coin.id,
      url: coin.url
    }));
  } catch (error) {
    console.error('Numista error:', error);
    return [];
  }
}

// PCGS Coin Grading & Population Data
async function searchPCGSCoins(searchTerm: string) {
  const apiKey = process.env.PCGS_API_KEY || process.env.PCGS_TOKEN || process.env.PCGS_SECRET;
  if (!apiKey) return [];

  try {
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
      population_data: {
        total_graded: coin.population?.total,
        ms65_and_higher: coin.population?.ms65_plus,
        ms67_and_higher: coin.population?.ms67_plus,
        ms70_perfect: coin.population?.ms70
      },
      price_guide: {
        ms60: coin.prices?.ms60,
        ms63: coin.prices?.ms63,
        ms65: coin.prices?.ms65,
        ms67: coin.prices?.ms67,
        ms70: coin.prices?.ms70
      }
    }));
  } catch (error) {
    console.error('PCGS error:', error);
    return [];
  }
}

// Brickset LEGO
async function searchBricksetLego(searchTerm: string) {
  try {
    // Try set number extraction first
    const setNumberMatch = searchTerm.match(/\b(\d{4,6})\b/);
    
    let url: string;
    if (setNumberMatch) {
      url = `${BASE_URL}/api/brickset/sets?setNumber=${setNumberMatch[1]}`;
    } else {
      url = `${BASE_URL}/api/brickset/search?q=${encodeURIComponent(searchTerm)}&limit=5`;
    }
    
    const response = await fetch(url, {
      headers: { 'Accept': 'application/json' }
    });

    if (!response.ok) return [];
    const data = await response.json();
    
    const sets = data.results || data.sets || [];
    return sets.map((set: any) => ({
      source: 'Brickset',
      set_number: set.setNumber || set.number,
      name: set.name,
      year: set.year,
      theme: set.theme,
      subtheme: set.subtheme,
      pieces: set.pieces,
      minifigs: set.minifigs,
      retail_price_usd: set.retailPrice || set.USRetailPrice,
      current_value_new: set.valueNew,
      current_value_used: set.valueUsed,
      url: set.url
    }));
  } catch (error) {
    console.error('Brickset error:', error);
    return [];
  }
}

// Chrono24 Watch Search
async function searchChrono24Watches(searchTerm: string) {
  const apiKey = process.env.CHRONO24_API_KEY || process.env.CHRONO24_TOKEN;
  if (!apiKey) return [];

  try {
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
      average_price: watch.price_stats?.average,
      min_price: watch.price_stats?.min,
      max_price: watch.price_stats?.max,
      listing_url: watch.url
    }));
  } catch (error) {
    console.error('Chrono24 error:', error);
    return [];
  }
}

// GoCollect Multi-Category
async function searchGoCollect(searchTerm: string, collectibleType: string = 'all') {
  const apiKey = process.env.GOCOLLECT_API_KEY || process.env.GO_COLLECT_API_KEY || process.env.GOCOLLECT_TOKEN;
  if (!apiKey) return [];

  try {
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
      year: item.year,
      prices: item.prices,
      trend_30_day: item.trends?.thirty_day,
      trend_90_day: item.trends?.ninety_day,
      rarity: item.rarity,
      key_issue: item.key_issue
    }));
  } catch (error) {
    console.error('GoCollect error:', error);
    return [];
  }
}

// ==================== NEW API INTEGRATIONS ====================

// Pokemon TCG API
async function searchPokemonTCG(searchTerm: string) {
  try {
    const searchQuery = searchTerm
      .replace(/pokemon/gi, '')
      .replace(/card/gi, '')
      .trim();
    
    const response = await fetch(
      `${BASE_URL}/api/pokemon/search?q=${encodeURIComponent(searchQuery)}&limit=5`,
      { headers: { 'Accept': 'application/json' } }
    );

    if (!response.ok) return [];
    const data = await response.json();
    
    if (!data.success || !data.results) return [];
    
    return data.results.map((card: any) => ({
      source: 'Pokemon TCG',
      name: card.name,
      set: card.setName,
      number: card.number,
      rarity: card.rarity,
      tcgplayer_price: card.pricing?.tcgplayer?.market,
      cardmarket_price: card.pricing?.cardmarket?.averageSellPrice,
      image: card.imageSmall,
      tcgplayer_url: card.tcgplayerUrl
    }));
  } catch (error) {
    console.error('Pokemon TCG error:', error);
    return [];
  }
}

// RAWG Video Games API
async function searchRAWGGames(searchTerm: string) {
  try {
    const searchQuery = searchTerm
      .replace(/video game/gi, '')
      .replace(/game/gi, '')
      .trim();
    
    const response = await fetch(
      `${BASE_URL}/api/rawg/search?q=${encodeURIComponent(searchQuery)}&limit=5`,
      { headers: { 'Accept': 'application/json' } }
    );

    if (!response.ok) return [];
    const data = await response.json();
    
    if (!data.success || !data.results) return [];
    
    return data.results.map((game: any) => ({
      source: 'RAWG',
      name: game.name,
      released: game.released,
      metacritic: game.metacritic,
      platforms: game.platforms?.map((p: any) => p.platform?.name || p).join(', '),
      genres: game.genres?.map((g: any) => g.name || g).join(', '),
      esrb_rating: game.esrbRating,
      url: `https://rawg.io/games/${game.slug}`,
      // Note: RAWG doesn't provide pricing, useful for identification
      note: 'RAWG provides metadata for game identification. Use eBay for market prices.'
    }));
  } catch (error) {
    console.error('RAWG error:', error);
    return [];
  }
}

// Discogs Music/Vinyl API
async function searchDiscogs(searchTerm: string) {
  try {
    const searchQuery = searchTerm
      .replace(/vinyl/gi, '')
      .replace(/record/gi, '')
      .replace(/album/gi, '')
      .trim();
    
    const response = await fetch(
      `${BASE_URL}/api/discogs/search?q=${encodeURIComponent(searchQuery)}&type=release&limit=5`,
      { headers: { 'Accept': 'application/json' } }
    );

    if (!response.ok) return [];
    const data = await response.json();
    
    if (!data.success || !data.results) return [];
    
    return data.results.map((release: any) => ({
      source: 'Discogs',
      title: release.title,
      artist: release.artist,
      year: release.year,
      format: release.format,
      label: release.label,
      country: release.country,
      lowest_price: release.lowestPrice,
      for_sale: release.forSale,
      url: release.url || `https://www.discogs.com/release/${release.id}`
    }));
  } catch (error) {
    console.error('Discogs error:', error);
    return [];
  }
}

// Comic Vine Comics API
async function searchComicVine(searchTerm: string) {
  try {
    const searchQuery = searchTerm
      .replace(/comic/gi, '')
      .replace(/book/gi, '')
      .trim();
    
    const response = await fetch(
      `${BASE_URL}/api/comicvine/search?q=${encodeURIComponent(searchQuery)}&type=issue&limit=5`,
      { headers: { 'Accept': 'application/json' } }
    );

    if (!response.ok) return [];
    const data = await response.json();
    
    if (!data.success || !data.results) return [];
    
    return data.results.map((issue: any) => ({
      source: 'Comic Vine',
      name: issue.name,
      volume_name: issue.volumeName,
      issue_number: issue.issueNumber,
      cover_date: issue.coverDate,
      publisher: issue.publisher,
      first_appearance_characters: issue.firstAppearanceCharacters,
      url: issue.url,
      // Note: Comic Vine doesn't provide pricing
      note: 'Comic Vine provides comic metadata. Use eBay for market prices.'
    }));
  } catch (error) {
    console.error('Comic Vine error:', error);
    return [];
  }
}

// Retailed Sneaker/Streetwear API
async function searchRetailed(searchTerm: string) {
  try {
    // Check for SKU pattern
    const skuMatch = searchTerm.match(/\b([A-Z]{1,2}\d{4,6}-\d{3})\b/i);
    
    let url: string;
    if (skuMatch) {
      // Use price endpoint for SKU lookups
      url = `${BASE_URL}/api/retailed/prices?sku=${skuMatch[1]}`;
    } else {
      const searchQuery = searchTerm
        .replace(/sneaker/gi, '')
        .replace(/shoe/gi, '')
        .trim();
      url = `${BASE_URL}/api/retailed/search?q=${encodeURIComponent(searchQuery)}&limit=5`;
    }
    
    const response = await fetch(url, {
      headers: { 'Accept': 'application/json' }
    });

    if (!response.ok) return [];
    const data = await response.json();
    
    // Handle price endpoint response
    if (data.found && data.priceStats) {
      return [{
        source: 'Retailed',
        name: data.product?.title || searchTerm,
        sku: data.product?.sku,
        brand: data.product?.brand,
        colorway: data.product?.colorway,
        retail_price: data.product?.retailPrice,
        lowest_ask: data.priceStats.lowestAsk,
        highest_ask: data.priceStats.highestAsk,
        average_ask: data.priceStats.averageAsk,
        marketplace_count: data.priceStats.marketplaceCount,
        marketplaces: data.prices?.map((p: any) => ({
          name: p.marketplace,
          price: p.lowestAsk,
          url: p.url
        }))
      }];
    }
    
    // Handle search endpoint response
    if (data.success && data.results) {
      return data.results.map((item: any) => ({
        source: 'Retailed',
        name: item.name,
        sku: item.sku,
        brand: item.brand,
        colorway: item.colorway,
        release_date: item.releaseDate,
        retail_price: item.retailPrice
      }));
    }
    
    return [];
  } catch (error) {
    console.error('Retailed error:', error);
    return [];
  }
}

// Perplexity API Integration
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
 */
const safeJsonParse = (jsonString: string) => {
  try {
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
    let apiData: any[] = [];
    let perplexityData = null;

    // Determine search query from item name or refinement text
    const searchQuery = analysis.itemName || refinement_text;
    const searchLower = searchQuery.toLowerCase();

    console.log(`🔍 Refining analysis for: ${searchQuery}`);
    console.log(`📁 Category: ${category} / ${subcategory}`);

    // Category-specific API calls with all new integrations
    if (category === 'Toys & Collectibles') {
      if (subcategory === 'LEGO Sets' || searchLower.includes('lego')) {
        apiData = await searchBricksetLego(searchQuery);
        perplexityData = await searchPerplexity(searchQuery, 'LEGO collectibles');
      } else if (subcategory === 'Action Figures' || subcategory === 'Vintage Toys') {
        apiData = await searchGoCollect(searchQuery, 'toys');
        perplexityData = await searchPerplexity(searchQuery, 'vintage toys action figures');
      }
    } else if (category === 'Trading Cards') {
      // Pokemon cards - use Pokemon TCG API
      if (subcategory === 'Pokemon Cards' || searchLower.includes('pokemon') || searchLower.includes('charizard') || searchLower.includes('pikachu')) {
        const pokemonData = await searchPokemonTCG(searchQuery);
        const goCollectData = await searchGoCollect(searchQuery, 'pokemon');
        apiData = [...pokemonData, ...goCollectData];
        perplexityData = await searchPerplexity(searchQuery, 'Pokemon TCG card values PSA BGS');
      } 
      // Magic: The Gathering
      else if (subcategory === 'Magic: The Gathering' || searchLower.includes('mtg') || searchLower.includes('magic')) {
        apiData = await searchGoCollect(searchQuery, 'mtg');
        perplexityData = await searchPerplexity(searchQuery, 'Magic the Gathering card prices');
      } 
      // Sports Cards
      else if (subcategory === 'Sports Cards') {
        apiData = await searchGoCollect(searchQuery, 'sports');
        perplexityData = await searchPerplexity(searchQuery, 'sports cards PSA BGS pricing');
      } 
      // General trading cards
      else {
        const pokemonData = await searchPokemonTCG(searchQuery);
        const goCollectData = await searchGoCollect(searchQuery, 'cards');
        apiData = [...pokemonData, ...goCollectData];
        perplexityData = await searchPerplexity(searchQuery, 'trading card values');
      }
    } else if (category === 'Comics & Graphic Novels' || category === 'Comic Books' || searchLower.includes('comic') || searchLower.includes('marvel') || searchLower.includes('dc')) {
      // Use Comic Vine for identification + GoCollect for pricing
      const comicVineData = await searchComicVine(searchQuery);
      const goCollectData = await searchGoCollect(searchQuery, 'comics');
      apiData = [...comicVineData, ...goCollectData];
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
    } else if (category === 'Video Games' || category === 'Gaming' || searchLower.includes('game') || searchLower.includes('nintendo') || searchLower.includes('playstation') || searchLower.includes('xbox')) {
      // Use RAWG for identification + GoCollect for graded games
      const rawgData = await searchRAWGGames(searchQuery);
      const goCollectData = await searchGoCollect(searchQuery, 'videogames');
      apiData = [...rawgData, ...goCollectData];
      perplexityData = await searchPerplexity(searchQuery, 'video game values WATA VGA sealed');
    } else if (category === 'Music' || category === 'Vinyl' || searchLower.includes('vinyl') || searchLower.includes('record') || searchLower.includes('album')) {
      // Use Discogs for vinyl/music
      apiData = await searchDiscogs(searchQuery);
      perplexityData = await searchPerplexity(searchQuery, 'vinyl record values Discogs');
    } else if (category === 'Sneakers' || category === 'Footwear' || category === 'Streetwear' || searchLower.includes('jordan') || searchLower.includes('yeezy') || searchLower.includes('nike') || searchLower.includes('sneaker')) {
      // Use Retailed for sneakers/streetwear
      apiData = await searchRetailed(searchQuery);
      perplexityData = await searchPerplexity(searchQuery, 'sneaker resale StockX GOAT');
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

    console.log(`📊 Found ${apiData.length} API results from ${[...new Set(apiData.map(d => d.source))].join(', ') || 'none'}`);

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
         - Pokemon TCG: TCGPlayer/Cardmarket live pricing
         - GoCollect: Provides graded prices, population census, and trend data
         - Numista: Global coin specifications and varieties
         - PCGS: US coin grading populations and price guides
         - Brickset: LEGO set details and current market values
         - Chrono24: Watch market prices and trends
         - RAWG: Video game metadata for identification
         - Discogs: Vinyl/music marketplace pricing
         - Comic Vine: Comic metadata and first appearance info
         - Retailed: Sneaker/streetwear pricing from StockX/GOAT
      3. For graded items (cards, comics, coins): Grade dramatically affects value
         - Pokemon/MTG: PSA 10 vs PSA 9 can be 5-10x difference
         - Comics: CGC 9.8 vs 9.6 can be 3-5x difference
         - Coins: MS67 vs MS65 can be 10x+ difference
      4. Consider market trends: 30-day, 90-day, and 1-year trends
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
        }).then(response => {
          const text = response.content[0];
          return safeJsonParse('type' in text && text.type === 'text' ? text.text : '');
        })
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

    // Take the summary from the first successful response
    const newSummary = successfulResponses[0].newSummary || `Value adjusted based on user feedback. ${analysis.summary_reasoning}`;

    console.log(`✅ Refinement complete: $${analysis.estimatedValue.toFixed(2)} → $${averageValue.toFixed(2)}`);

    // --- Construct Final Updated Analysis ---
    const updatedAnalysis: AnalysisResult = {
      ...analysis,
      estimatedValue: averageValue,
      valuation_factors: uniqueFactors.slice(0, 5),
      summary_reasoning: newSummary,
    };

    return res.status(200).json(updatedAnalysis);

  } catch (error) {
    console.error('Error in /api/refine-analysis:', error);
    const errorMessage = error instanceof Error ? error.message : 'An unknown error occurred';
    return res.status(500).json({ error: 'Internal Server Error', details: errorMessage });
  }
}