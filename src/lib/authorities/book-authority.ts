export interface BookData {
  isbn?: string;
  isbn10?: string;
  isbn13?: string;
  title: string;
  authors: string[];
  publisher: string;
  publishedDate: string;
  pageCount: number;
  categories: string[];
  description: string;
  retailPrice?: number;
  thumbnail?: string;
  verified: boolean;
  source: string;
  marketValue?: {
    good: number;
    veryGood: number;
    likeNew: number;
    new: number;
  };
}

export class BookAuthority {
  private googleApiKey = process.env.GOOGLE_BOOKS_API_KEY!;
  
  async searchByTitle(title: string): Promise<BookData | null> {
    try {
      const query = encodeURIComponent(title);
      const url = `https://www.googleapis.com/books/v1/volumes?q=${query}&key=${this.googleApiKey}&maxResults=1`;
      
      const response = await fetch(url);
      const data = await response.json();
      
      if (data.items && data.items.length > 0) {
        return this.parseGoogleBookData(data.items[0]);
      }
      
      return null;
    } catch (error) {
      console.error('Google Books search error:', error);
      return null;
    }
  }
  
  async getByISBN(isbn: string): Promise<BookData | null> {
    try {
      // Clean ISBN (remove dashes/spaces)
      const cleanISBN = isbn.replace(/[-\s]/g, '');
      const url = `https://www.googleapis.com/books/v1/volumes?q=isbn:${cleanISBN}&key=${this.googleApiKey}`;
      
      const response = await fetch(url);
      const data = await response.json();
      
      if (data.items && data.items.length > 0) {
        return this.parseGoogleBookData(data.items[0]);
      }
      
      return null;
    } catch (error) {
      console.error('Google Books ISBN lookup error:', error);
      return null;
    }
  }
  
  private parseGoogleBookData(item: any): BookData {
    const volumeInfo = item.volumeInfo || {};
    const saleInfo = item.saleInfo || {};
    const identifiers = volumeInfo.industryIdentifiers || [];
    
    // Extract ISBNs
    const isbn10 = identifiers.find((id: any) => id.type === 'ISBN_10')?.identifier;
    const isbn13 = identifiers.find((id: any) => id.type === 'ISBN_13')?.identifier;
    
    // Get retail price if available
    let retailPrice = undefined;
    if (saleInfo.listPrice) {
      retailPrice = saleInfo.listPrice.amount;
    } else if (saleInfo.retailPrice) {
      retailPrice = saleInfo.retailPrice.amount;
    }
    
    // Calculate estimated market values based on condition
    const marketValue = this.calculateMarketValue(
      retailPrice || 25, // Default to $25 if no price
      volumeInfo.publishedDate,
      volumeInfo.categories || []
    );
    
    return {
      isbn: isbn13 || isbn10,
      isbn10,
      isbn13,
      title: volumeInfo.title || 'Unknown Title',
      authors: volumeInfo.authors || ['Unknown Author'],
      publisher: volumeInfo.publisher || 'Unknown Publisher',
      publishedDate: volumeInfo.publishedDate || '',
      pageCount: volumeInfo.pageCount || 0,
      categories: volumeInfo.categories || [],
      description: volumeInfo.description || '',
      retailPrice,
      thumbnail: volumeInfo.imageLinks?.thumbnail,
      verified: true,
      source: 'Google Books',
      marketValue
    };
  }
  
  private calculateMarketValue(retailPrice: number, publishedDate: string, categories: string[]) {
    // Calculate book age
    const yearPublished = new Date(publishedDate).getFullYear();
    const currentYear = new Date().getFullYear();
    const age = currentYear - yearPublished;
    
    // Base depreciation
    let depreciation = 1.0;
    if (age < 1) depreciation = 0.7;      // New books lose 30%
    else if (age < 2) depreciation = 0.5;  // 1-2 years old
    else if (age < 5) depreciation = 0.3;  // 2-5 years old
    else depreciation = 0.2;                // Older books
    
    // Category adjustments
    const isTextbook = categories.some(cat => 
      cat.toLowerCase().includes('textbook') || 
      cat.toLowerCase().includes('education')
    );
    const isCollectible = categories.some(cat => 
      cat.toLowerCase().includes('comics') || 
      cat.toLowerCase().includes('first edition')
    );
    
    if (isTextbook) depreciation *= 0.5;     // Textbooks depreciate faster
    if (isCollectible) depreciation *= 2.0;  // Collectibles appreciate
    
    return {
      good: Math.round(retailPrice * depreciation * 0.4),
      veryGood: Math.round(retailPrice * depreciation * 0.6),
      likeNew: Math.round(retailPrice * depreciation * 0.8),
      new: Math.round(retailPrice * 0.9)
    };
  }
}

// Open Library Authority (Free backup)
export class OpenLibraryAuthority {
  async searchByISBN(isbn: string): Promise<any> {
    try {
      const cleanISBN = isbn.replace(/[-\s]/g, '');
      const url = `https://openlibrary.org/api/books?bibkeys=ISBN:${cleanISBN}&format=json&jscmd=data`;
      
      const response = await fetch(url);
      const data = await response.json();
      
      const bookKey = `ISBN:${cleanISBN}`;
      if (data[bookKey]) {
        return this.parseOpenLibraryData(data[bookKey]);
      }
      
      return null;
    } catch (error) {
      console.error('Open Library error:', error);
      return null;
    }
  }
  
  private parseOpenLibraryData(book: any): BookData {
    return {
      title: book.title,
      authors: book.authors?.map((a: any) => a.name) || [],
      publisher: book.publishers?.[0]?.name || 'Unknown',
      publishedDate: book.publish_date || '',
      pageCount: book.number_of_pages || 0,
      categories: book.subjects?.map((s: any) => s.name) || [],
      description: book.notes || '',
      thumbnail: book.cover?.medium,
      verified: true,
      source: 'Open Library',
      marketValue: {
        good: 5,
        veryGood: 10,
        likeNew: 15,
        new: 20
      }
    };
  }
}