// FILE: src/lib/hydra/fetchers/google-books.ts
// HYDRA v7.0 - Google Books API Fetcher
// FIXED v7.0: Convert HTTP image URLs to HTTPS to avoid mixed content warnings

import type { MarketDataSource, AuthorityData } from '../types.js';

const GOOGLE_BOOKS_API = 'https://www.googleapis.com/books/v1';

export async function fetchGoogleBooksData(itemName: string): Promise<MarketDataSource> {
  const startTime = Date.now();
  const apiKey = process.env.GOOGLE_BOOKS_API_KEY;
  
  try {
    // Build search query
    const searchQuery = buildBookQuery(itemName);
    console.log(`🔍 Google Books search: "${searchQuery}"`);
    
    // Build URL with optional API key
    let searchUrl = `${GOOGLE_BOOKS_API}/volumes?q=${encodeURIComponent(searchQuery)}&maxResults=10&printType=books&orderBy=relevance`;
    if (apiKey) {
      searchUrl += `&key=${apiKey}`;
    }
    
    const response = await fetch(searchUrl, {
      method: 'GET',
      headers: {
        'Accept': 'application/json',
      },
    });
    
    if (!response.ok) {
      console.error(`❌ Google Books API error: ${response.status}`);
      return createFallbackResult(itemName, searchQuery);
    }
    
    const data = await response.json();
    const books = data.items || [];
    
    if (books.length === 0) {
      console.log('⚠️ Google Books: No matching books found');
      return {
        source: 'google_books',
        available: false,
        query: searchQuery,
        totalListings: 0,
        error: 'No matching books found',
      };
    }
    
    // Get the best match
    const bestMatch = books[0];
    const volumeInfo = bestMatch.volumeInfo || {};
    const saleInfo = bestMatch.saleInfo || {};
    
    console.log(`✅ Google Books: Found "${volumeInfo.title}" by ${volumeInfo.authors?.join(', ') || 'Unknown'}`);
    
    // Extract price data
    const priceData = extractPriceData(saleInfo, volumeInfo);
    
    // Extract ISBN
    const isbn13 = volumeInfo.industryIdentifiers?.find((id: any) => id.type === 'ISBN_13')?.identifier;
    const isbn10 = volumeInfo.industryIdentifiers?.find((id: any) => id.type === 'ISBN_10')?.identifier;
    
    // FIXED v7.0: Convert HTTP image URLs to HTTPS
    const imageLinks = fixImageUrls(volumeInfo.imageLinks);
    
    // Build authority data
    const authorityData: AuthorityData = {
      source: 'google_books',
      verified: true,
      confidence: calculateMatchConfidence(itemName, volumeInfo.title, volumeInfo.authors),
      itemDetails: {
        googleBooksId: bestMatch.id,
        title: volumeInfo.title,
        subtitle: volumeInfo.subtitle,
        authors: volumeInfo.authors,
        publisher: volumeInfo.publisher,
        publishedDate: volumeInfo.publishedDate,
        description: volumeInfo.description?.substring(0, 500),
        isbn13,
        isbn10,
        pageCount: volumeInfo.pageCount,
        categories: volumeInfo.categories,
        language: volumeInfo.language,
        averageRating: volumeInfo.averageRating,
        ratingsCount: volumeInfo.ratingsCount,
        maturityRating: volumeInfo.maturityRating,
        imageLinks, // FIXED: Now uses HTTPS URLs
        previewLink: volumeInfo.previewLink,
        infoLink: volumeInfo.infoLink,
        canonicalVolumeLink: volumeInfo.canonicalVolumeLink,
      },
      priceData: priceData || undefined,
      externalUrl: volumeInfo.infoLink || volumeInfo.canonicalVolumeLink,
      lastUpdated: new Date().toISOString(),
    };
    
    // Build sample listings
    const sampleListings = books.slice(0, 5).map((book: any) => {
      const info = book.volumeInfo || {};
      const sale = book.saleInfo || {};
      return {
        title: `${info.title}${info.authors ? ' by ' + info.authors[0] : ''}`,
        price: sale.listPrice?.amount || sale.retailPrice?.amount || 0,
        condition: info.publishedDate || 'Unknown Date',
        url: info.infoLink || info.canonicalVolumeLink || `https://books.google.com/books?id=${book.id}`,
      };
    });
    
    console.log(`✅ Google Books: Authority data retrieved in ${Date.now() - startTime}ms`);
    
    return {
      source: 'google_books',
      available: true,
      query: searchQuery,
      totalListings: data.totalItems || books.length,
      priceAnalysis: priceData ? {
        lowest: priceData.retail * 0.3,
        highest: priceData.retail * 2,
        average: priceData.retail,
        median: priceData.retail,
      } : undefined,
      suggestedPrices: priceData ? {
        goodDeal: parseFloat((priceData.retail * 0.4).toFixed(2)),
        fairMarket: parseFloat((priceData.retail * 0.6).toFixed(2)),
        sellPrice: parseFloat((priceData.retail * 0.75).toFixed(2)),
      } : undefined,
      sampleListings,
      authorityData,
      metadata: {
        responseTime: Date.now() - startTime,
        totalBooks: data.totalItems,
        bestMatchId: bestMatch.id,
        isbn: isbn13 || isbn10,
      },
    };
    
  } catch (error) {
    console.error('❌ Google Books fetch error:', error);
    return {
      source: 'google_books',
      available: false,
      query: itemName,
      totalListings: 0,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}

// ==================== HELPER FUNCTIONS ====================

/**
 * FIXED v7.0: Convert all HTTP image URLs to HTTPS
 * Google Books API returns HTTP URLs which cause mixed content warnings
 */
function fixImageUrls(imageLinks: any): any {
  if (!imageLinks) return undefined;
  
  const fixed: any = {};
  
  for (const [key, value] of Object.entries(imageLinks)) {
    if (typeof value === 'string') {
      // Replace http:// with https://
      fixed[key] = value.replace(/^http:\/\//i, 'https://');
    } else {
      fixed[key] = value;
    }
  }
  
  return fixed;
}

function buildBookQuery(itemName: string): string {
  // Check for ISBN
  const isbnMatch = itemName.match(/\b(97[89]\d{10}|\d{10})\b/);
  if (isbnMatch) {
    return `isbn:${isbnMatch[1]}`;
  }
  
  // Clean up the name
  let query = itemName
    .replace(/\b(book|hardcover|paperback|first edition|signed|rare)\b/gi, '')
    .replace(/\s+/g, ' ')
    .trim();
  
  // Try to identify author format "Title by Author"
  const byMatch = query.match(/(.+?)\s+by\s+(.+)/i);
  if (byMatch) {
    return `intitle:${byMatch[1].trim()}+inauthor:${byMatch[2].trim()}`;
  }
  
  return query;
}

function extractPriceData(saleInfo: any, volumeInfo: any): { retail: number; ebook?: number } | null {
  const listPrice = saleInfo.listPrice?.amount;
  const retailPrice = saleInfo.retailPrice?.amount;
  
  if (listPrice || retailPrice) {
    return {
      retail: listPrice || retailPrice,
      ebook: saleInfo.saleability === 'FOR_SALE' ? retailPrice : undefined,
    };
  }
  
  // Estimate based on page count
  if (volumeInfo.pageCount) {
    const estimatedPrice = Math.max(5, Math.min(volumeInfo.pageCount * 0.05, 50));
    return {
      retail: parseFloat(estimatedPrice.toFixed(2)),
    };
  }
  
  return null;
}

function calculateMatchConfidence(searchTerm: string, title: string, authors?: string[]): number {
  const searchLower = searchTerm.toLowerCase();
  const titleLower = title?.toLowerCase() || '';
  
  // Check for ISBN match (highest confidence)
  if (searchLower.match(/\b(97[89]\d{10}|\d{10})\b/)) {
    return 0.99;
  }
  
  // Check for exact title match
  if (titleLower === searchLower || searchLower.includes(titleLower)) {
    return 0.95;
  }
  
  // Check for title containment
  if (titleLower.includes(searchLower.split(' ')[0]) || searchLower.includes(titleLower.split(' ')[0])) {
    return 0.85;
  }
  
  // Check author match
  if (authors && authors.some(a => searchLower.includes(a.toLowerCase()))) {
    return 0.80;
  }
  
  return 0.60;
}

function createFallbackResult(itemName: string, query: string): MarketDataSource {
  const searchUrl = `https://www.google.com/search?tbm=bks&q=${encodeURIComponent(itemName)}`;
  
  return {
    source: 'google_books',
    available: true,
    query,
    totalListings: 0,
    sampleListings: [{
      title: `Search Google Books for "${itemName}"`,
      price: 0,
      condition: 'N/A',
      url: searchUrl,
    }],
    metadata: {
      fallback: true,
      searchUrl,
    },
  };
}