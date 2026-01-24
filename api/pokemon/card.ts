// FILE: api/pokemon/card.ts
// Pokemon TCG Card Detail with Full Pricing

import type { VercelRequest, VercelResponse } from '@vercel/node';

export const config = {
  runtime: 'nodejs',
  maxDuration: 15,
};

const POKEMON_TCG_BASE_URL = 'https://api.pokemontcg.io/v2';

function formatPriceBreakdown(tcgplayer: any, cardmarket: any) {
  const breakdown: any = {};
  
  // TCGPlayer prices (USD) - multiple variants
  if (tcgplayer?.prices) {
    breakdown.tcgplayer = {
      url: tcgplayer.url,
      updatedAt: tcgplayer.updatedAt,
      currency: 'USD',
      variants: {}
    };
    
    for (const [variant, prices] of Object.entries(tcgplayer.prices)) {
      const p = prices as any;
      breakdown.tcgplayer.variants[variant] = {
        low: p.low,
        mid: p.mid,
        high: p.high,
        market: p.market,
        directLow: p.directLow
      };
    }
  }
  
  // Cardmarket prices (EUR) - European market
  if (cardmarket?.prices) {
    breakdown.cardmarket = {
      url: cardmarket.url,
      updatedAt: cardmarket.updatedAt,
      currency: 'EUR',
      prices: {
        lowPrice: cardmarket.prices.lowPrice,
        averageSellPrice: cardmarket.prices.averageSellPrice,
        trendPrice: cardmarket.prices.trendPrice,
        avg1Day: cardmarket.prices.avg1,
        avg7Day: cardmarket.prices.avg7,
        avg30Day: cardmarket.prices.avg30,
        reverseHoloLow: cardmarket.prices.reverseHoloLow,
        reverseHoloTrend: cardmarket.prices.reverseHoloTrend
      }
    };
  }
  
  return breakdown;
}

function determinePriceRange(tcgplayer: any, cardmarket: any) {
  let minPrice = Infinity;
  let maxPrice = 0;
  let marketPrice: number | null = null;
  let currency = 'USD';
  
  // Check TCGPlayer
  if (tcgplayer?.prices) {
    for (const prices of Object.values(tcgplayer.prices)) {
      const p = prices as any;
      if (p.low && p.low < minPrice) minPrice = p.low;
      if (p.high && p.high > maxPrice) maxPrice = p.high;
      if (p.market && !marketPrice) marketPrice = p.market;
    }
  }
  
  // Check Cardmarket (convert to USD roughly for comparison, or keep EUR)
  if (cardmarket?.prices) {
    if (minPrice === Infinity) {
      // Only Cardmarket data available
      currency = 'EUR';
      minPrice = cardmarket.prices.lowPrice || Infinity;
      maxPrice = cardmarket.prices.trendPrice || 0;
      marketPrice = cardmarket.prices.averageSellPrice;
    }
  }
  
  return {
    currency,
    low: minPrice === Infinity ? null : minPrice,
    high: maxPrice === 0 ? null : maxPrice,
    market: marketPrice,
    hasPriceData: minPrice !== Infinity || maxPrice !== 0
  };
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method Not Allowed' });
  }

  const apiKey = process.env.POKEMON_TCG_API_KEY;
  const { id } = req.query;

  if (!id || typeof id !== 'string') {
    return res.status(400).json({
      error: 'Missing card ID',
      message: 'Provide a Pokemon TCG card ID',
      example: '/api/pokemon/card?id=base1-4',
      format: 'Card IDs follow pattern: {set_id}-{card_number}'
    });
  }

  try {
    const headers: Record<string, string> = {
      'Content-Type': 'application/json'
    };
    
    if (apiKey) {
      headers['X-Api-Key'] = apiKey;
    }

    const response = await fetch(
      `${POKEMON_TCG_BASE_URL}/cards/${encodeURIComponent(id)}`,
      {
        method: 'GET',
        headers
      }
    );

    if (response.status === 404) {
      return res.status(404).json({
        error: 'Card not found',
        message: `No card found with ID: ${id}`,
        suggestion: 'Use /api/pokemon/search to find valid card IDs'
      });
    }

    if (!response.ok) {
      const errorText = await response.text();
      return res.status(response.status).json({
        error: 'Pokemon TCG API error',
        status: response.status,
        message: errorText
      });
    }

    const data = await response.json();
    const card = data.data;

    if (!card) {
      return res.status(404).json({
        error: 'Card not found',
        message: `No card found with ID: ${id}`
      });
    }

    // Build comprehensive response
    const priceBreakdown = formatPriceBreakdown(card.tcgplayer, card.cardmarket);
    const priceRange = determinePriceRange(card.tcgplayer, card.cardmarket);

    const result = {
      success: true,
      card: {
        // Identity
        id: card.id,
        name: card.name,
        supertype: card.supertype,
        subtypes: card.subtypes || [],
        
        // Pokemon stats
        hp: card.hp,
        types: card.types || [],
        evolvesFrom: card.evolvesFrom,
        evolvesTo: card.evolvesTo,
        
        // Set info
        set: {
          id: card.set.id,
          name: card.set.name,
          series: card.set.series,
          printedTotal: card.set.printedTotal,
          total: card.set.total,
          releaseDate: card.set.releaseDate,
          images: card.set.images
        },
        
        // Card identification
        number: card.number,
        cardNumber: `${card.number}/${card.set.printedTotal}`,
        rarity: card.rarity,
        artist: card.artist,
        
        // Game data
        attacks: card.attacks,
        weaknesses: card.weaknesses,
        resistances: card.resistances,
        retreatCost: card.retreatCost,
        
        // Flavor
        flavorText: card.flavorText,
        nationalPokedexNumbers: card.nationalPokedexNumbers,
        
        // Legality
        legalities: card.legalities,
        
        // Images
        images: card.images,
        
        // Prices
        priceRange,
        priceBreakdown,
        
        // Raw links
        links: {
          tcgplayer: card.tcgplayer?.url,
          cardmarket: card.cardmarket?.url
        }
      },
      
      // For Hydra integration
      valuationContext: {
        category: 'trading-cards',
        subcategory: 'pokemon-tcg',
        identifiers: {
          pokemonTcgId: card.id,
          setCode: card.set.id,
          setName: card.set.name,
          cardNumber: card.number,
          rarity: card.rarity,
          pokedexNumbers: card.nationalPokedexNumbers
        },
        description: `${card.name} - ${card.set.name} ${card.number}/${card.set.printedTotal}${card.rarity ? ` (${card.rarity})` : ''}`,
        marketData: {
          hasData: priceRange.hasPriceData,
          currency: priceRange.currency,
          marketPrice: priceRange.market,
          lowPrice: priceRange.low,
          highPrice: priceRange.high,
          sources: Object.keys(priceBreakdown)
        }
      }
    };

    return res.status(200).json(result);

  } catch (error: any) {
    console.error('Pokemon TCG card fetch failed:', error);
    return res.status(500).json({
      error: 'Failed to fetch card',
      message: error.message
    });
  }
}