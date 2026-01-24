import type { VercelRequest, VercelResponse } from '@vercel/node';

// Google Books Search API
// Searches for books by title, author, ISBN, or general query

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

interface SearchResult {
  id: string;
  title: string;
  subtitle?: string;
  authors: string[];
  publisher?: string;
  publishedDate?: string;
  isbn10?: string;
  isbn13?: string;
  pageCount?: number;
  categories: string[];
  rating?: number;
  ratingsCount?: number;
  thumbnail?: string;
  listPrice?: number;
  retailPrice?: number;
  currency: string;
  googleBooksUrl: string;
  buyLink?: string;
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
    isbn,           // Direct ISBN lookup
    title,          // Title search
    author,         // Author search
    limit = '10'    // Results limit (max 40)
  } = req.query;

  if (!q && !isbn && !title && !author) {
    return res.status(400).json({ 
      error: 'Missing search parameter. Provide q, isbn, title, or author',
      examples: [
        '/api/google-books/search?q=harry+potter',
        '/api/google-books/search?isbn=9780439708180',
        '/api/google-books/search?title=hour+game&author=baldacci'
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

    const maxResults = Math.min(parseInt(limit as string) || 10, 40);
    const searchUrl = `${GOOGLE_BOOKS_API_URL}/volumes?q=${encodeURIComponent(searchQuery)}&maxResults=${maxResults}&key=${apiKey}`;
    
    const response = await fetch(searchUrl, {
      method: 'GET',
      headers: { 'Accept': 'application/json' },
    });

    if (!response.ok) {
      const errorData = await response.json();
      console.error(`Google Books API error: ${response.status}`, errorData);
      return res.status(response.status).json({
        error: 'Google Books API error',
        status: response.status,
        message: errorData.error?.message || 'Unknown error',
      });
    }

    const data = await response.json();

    // Transform results
    const results: SearchResult[] = (data.items || []).map((item: GoogleBookVolume) => {
      const vol = item.volumeInfo;
      const sale = item.saleInfo;
      
      // Extract ISBNs
      const isbn10 = vol.industryIdentifiers?.find(id => id.type === 'ISBN_10')?.identifier;
      const isbn13 = vol.industryIdentifiers?.find(id => id.type === 'ISBN_13')?.identifier;
      
      return {
        id: item.id,
        title: vol.title,
        subtitle: vol.subtitle,
        authors: vol.authors || [],
        publisher: vol.publisher,
        publishedDate: vol.publishedDate,
        isbn10,
        isbn13,
        pageCount: vol.pageCount,
        categories: vol.categories || [],
        rating: vol.averageRating,
        ratingsCount: vol.ratingsCount,
        thumbnail: vol.imageLinks?.thumbnail?.replace('http:', 'https:'),
        listPrice: sale?.listPrice?.amount,
        retailPrice: sale?.retailPrice?.amount,
        currency: sale?.listPrice?.currencyCode || sale?.retailPrice?.currencyCode || 'USD',
        googleBooksUrl: vol.infoLink || `https://books.google.com/books?id=${item.id}`,
        buyLink: sale?.buyLink,
      };
    });

    return res.status(200).json({
      success: true,
      query: searchQuery,
      totalResults: data.totalItems || 0,
      resultsReturned: results.length,
      results,
      timestamp: new Date().toISOString(),
    });

  } catch (error: any) {
    console.error('Google Books search error:', error);
    return res.status(500).json({
      error: 'Failed to search Google Books',
      message: error.message,
    });
  }
}