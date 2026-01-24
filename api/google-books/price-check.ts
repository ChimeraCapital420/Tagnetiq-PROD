import type { VercelRequest, VercelResponse } from '@vercel/node';

// Google Books Price Check API
// Looks up books and estimates values by condition

const GOOGLE_BOOKS_API_URL = 'https://www.googleapis.com/books/v1';

interface GoogleBookVolume {
  id: string;
  volumeInfo: {
    title: string;
    subtitle?: string;
    authors?: string[];
    publisher?: string;
    publishedDate?: string;
    description?: string;
    industryIdentifiers?: Array<{
      type: string;
      identifier: string;
    }>;
    pageCount?: number;
    categories?: string[];
    averageRating?: number;
    ratingsCount?: number;
    imageLinks?: {
      thumbnail?: string;
      smallThumbnail?: string;
    };
    language?: string;
    previewLink?: string;
    infoLink?: string;
  };
  saleInfo?: {
    country?: string;
    saleability?: string;
    listPrice?: {
      amount: number;
      currencyCode: string;
    };
    retailPrice?: {
      amount: number;
      currencyCode: string;
    };
    buyLink?: string;
  };
}

interface ConditionPrice {
  condition: string;
  conditionCode: string;
  price: number;
  description: string;
}

interface PriceAnalysis {
  lowestPrice: number;
  highestPrice: number;
  averagePrice: number;
  medianPrice: number;
  priceCount: number;
}

// Condition multipliers for used book pricing
// Based on typical used book market (most books depreciate heavily)
const CONDITION_MULTIPLIERS: Record<string, { multiplier: number; description: string }> = {
  'poor': { multiplier: 0.02, description: 'Heavy wear, may have damage, writing, missing pages' },
  'acceptable': { multiplier: 0.05, description: 'Readable, significant wear, spine creases' },
  'good': { multiplier: 0.08, description: 'Minor wear, may have markings, intact binding' },
  'very_good': { multiplier: 0.12, description: 'Light wear, minimal markings, clean pages' },
  'like_new': { multiplier: 0.20, description: 'Near perfect, minimal signs of reading' },
  'new': { multiplier: 0.85, description: 'Unread, perfect condition, no defects' },
};

// Premium multipliers for special books
const PREMIUM_KEYWORDS = {
  'first edition': 3.0,
  '1st edition': 3.0,
  'signed': 5.0,
  'autographed': 5.0,
  'rare': 2.0,
  'limited edition': 2.5,
  'collectors': 2.0,
  'leather bound': 1.5,
  'illustrated': 1.3,
  'vintage': 1.5,
  'antique': 2.0,
};

// Calculate condition-based prices
function calculateConditionPrices(retailPrice: number, bookInfo: any): ConditionPrice[] {
  // Check for premium characteristics
  let premiumMultiplier = 1.0;
  const title = (bookInfo.title || '').toLowerCase();
  const description = (bookInfo.description || '').toLowerCase();
  const combined = `${title} ${description}`;
  
  for (const [keyword, mult] of Object.entries(PREMIUM_KEYWORDS)) {
    if (combined.includes(keyword)) {
      premiumMultiplier = Math.max(premiumMultiplier, mult);
    }
  }

  // Calculate age factor (older books from certain categories can be more valuable)
  const publishYear = parseInt(bookInfo.publishedDate?.substring(0, 4) || '2000');
  const currentYear = new Date().getFullYear();
  const age = currentYear - publishYear;
  
  // Most books depreciate, but very old books (50+ years) can appreciate
  let ageFactor = 1.0;
  if (age > 50) {
    ageFactor = 1.2 + (age - 50) * 0.01; // Slight premium for vintage
  }

  const prices: ConditionPrice[] = [];

  for (const [code, config] of Object.entries(CONDITION_MULTIPLIERS)) {
    let price = retailPrice * config.multiplier * premiumMultiplier * ageFactor;
    
    // Minimum price floor
    if (price < 0.50 && code !== 'poor') {
      price = code === 'new' ? retailPrice * 0.5 : Math.max(0.50, price);
    }
    
    // Round to cents
    price = Math.round(price * 100) / 100;
    
    // Format condition name
    const conditionName = code.replace('_', ' ').replace(/\b\w/g, c => c.toUpperCase());
    
    prices.push({
      condition: conditionName,
      conditionCode: code,
      price,
      description: config.description,
    });
  }

  return prices.sort((a, b) => a.price - b.price);
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  // Set CORS headers
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const apiKey = process.env.GOOGLE_BOOKS_API_KEY;

  if (!apiKey) {
    return res.status(500).json({ error: 'Google Books API key not configured' });
  }

  // Parse query parameters
  const { 
    q,              // General search query
    isbn,           // Direct ISBN lookup (preferred)
    title,          // Title search
    author,         // Author search
  } = req.query;

  if (!q && !isbn && !title) {
    return res.status(400).json({ 
      error: 'Missing search parameter. Provide q, isbn, or title',
      examples: [
        '/api/google-books/price-check?isbn=9780759512573',
        '/api/google-books/price-check?q=hour+game+baldacci',
        '/api/google-books/price-check?title=hour+game&author=baldacci'
      ]
    });
  }

  try {
    // Build search query
    let searchQuery = '';
    
    if (isbn) {
      searchQuery = `isbn:${isbn}`;
    } else if (title || author) {
      const parts: string[] = [];
      if (title) parts.push(`intitle:${title}`);
      if (author) parts.push(`inauthor:${author}`);
      searchQuery = parts.join('+');
    } else if (q) {
      searchQuery = q as string;
    }

    console.log(`📚 [Google Books] Searching: ${searchQuery}`);

    const searchUrl = `${GOOGLE_BOOKS_API_URL}/volumes?q=${encodeURIComponent(searchQuery)}&maxResults=5&key=${apiKey}`;
    
    const response = await fetch(searchUrl, {
      method: 'GET',
      headers: { 'Accept': 'application/json' },
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error(`Google Books API error: ${response.status}`, errorText);
      return res.status(response.status).json({
        error: 'Google Books API error',
        status: response.status,
        message: errorText.substring(0, 200),
      });
    }

    const data = await response.json();

    if (!data.items || data.items.length === 0) {
      return res.status(200).json({
        success: true,
        query: searchQuery,
        found: false,
        message: 'No books found matching query',
        priceAnalysis: null,
        conditionPrices: [],
        timestamp: new Date().toISOString(),
      });
    }

    // Get the best match (first result)
    const book: GoogleBookVolume = data.items[0];
    const vol = book.volumeInfo;
    const sale = book.saleInfo;

    // Extract ISBNs
    const isbn10 = vol.industryIdentifiers?.find(id => id.type === 'ISBN_10')?.identifier;
    const isbn13 = vol.industryIdentifiers?.find(id => id.type === 'ISBN_13')?.identifier;

    // Get retail price (use list price or retail price, or estimate)
    let retailPrice = sale?.listPrice?.amount || sale?.retailPrice?.amount;
    
    // If no price available, estimate based on page count and category
    if (!retailPrice) {
      const pages = vol.pageCount || 300;
      const isHardcover = (vol.title || '').toLowerCase().includes('hardcover');
      
      // Base estimate: ~$0.05 per page for paperback, $0.08 for hardcover
      retailPrice = isHardcover ? pages * 0.08 : pages * 0.05;
      retailPrice = Math.max(9.99, Math.min(retailPrice, 35.99)); // Clamp to reasonable range
    }

    // Calculate condition-based prices
    const conditionPrices = calculateConditionPrices(retailPrice, vol);

    // Build price analysis
    const prices = conditionPrices.map(cp => cp.price);
    const priceAnalysis: PriceAnalysis = {
      lowestPrice: Math.min(...prices),
      highestPrice: Math.max(...prices),
      averagePrice: Math.round(prices.reduce((a, b) => a + b, 0) / prices.length * 100) / 100,
      medianPrice: prices[Math.floor(prices.length / 2)],
      priceCount: prices.length,
    };

    // Build sample listings (simulated based on conditions)
    const sampleListings = conditionPrices.slice(2, 5).map(cp => ({
      source: 'Google Books Estimate',
      title: vol.title,
      price: cp.price,
      condition: cp.condition,
      url: vol.infoLink || `https://books.google.com/books?id=${book.id}`,
    }));

    // Suggested prices for quick reference
    const suggestedPrices = {
      flipPrice: conditionPrices.find(c => c.conditionCode === 'good')?.price || priceAnalysis.lowestPrice,
      quickSale: conditionPrices.find(c => c.conditionCode === 'acceptable')?.price || priceAnalysis.lowestPrice,
      fairValue: conditionPrices.find(c => c.conditionCode === 'very_good')?.price || priceAnalysis.medianPrice,
      premium: conditionPrices.find(c => c.conditionCode === 'like_new')?.price || priceAnalysis.highestPrice,
    };

    console.log(`✅ [Google Books] Found: ${vol.title} - Retail: $${retailPrice}`);

    return res.status(200).json({
      success: true,
      query: searchQuery,
      found: true,
      book: {
        id: book.id,
        title: vol.title,
        subtitle: vol.subtitle,
        authors: vol.authors || [],
        publisher: vol.publisher,
        publishedDate: vol.publishedDate,
        isbn10,
        isbn13,
        pageCount: vol.pageCount,
        categories: vol.categories || [],
        description: vol.description?.substring(0, 500),
        rating: vol.averageRating,
        ratingsCount: vol.ratingsCount,
        thumbnail: vol.imageLinks?.thumbnail?.replace('http:', 'https:'),
        googleBooksUrl: vol.infoLink || `https://books.google.com/books?id=${book.id}`,
      },
      pricing: {
        retailPrice,
        currency: sale?.listPrice?.currencyCode || 'USD',
        priceSource: sale?.listPrice ? 'google_books' : 'estimated',
      },
      conditionPrices,
      priceAnalysis,
      suggestedPrices,
      sampleListings,
      metadata: {
        dataSource: 'google_books',
        totalResults: data.totalItems || 0,
        note: 'Prices estimated based on retail value and typical used book market depreciation',
      },
      timestamp: new Date().toISOString(),
    });

  } catch (error: any) {
    console.error('Google Books price check error:', error);
    return res.status(500).json({
      error: 'Failed to check Google Books pricing',
      message: error.message,
    });
  }
}