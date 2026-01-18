import { BookAuthority, OpenLibraryAuthority } from './book-authority.js.js';

export class AuthorityManager {
  private bookAuthority = new BookAuthority();
  private openLibrary = new OpenLibraryAuthority();
  
  async validateBook(itemName: string, imageText?: string) {
    console.log('🔍 Validating book:', itemName);
    
    // Try to extract ISBN from item name or image text
    const isbnMatch = (itemName + ' ' + (imageText || '')).match(/\b(?:ISBN[-\s]?(?:10|13)?[:.\s]?)?([\d-]{10,17})\b/i);
    
    if (isbnMatch) {
      const isbn = isbnMatch[1];
      console.log('📚 Found ISBN:', isbn);
      
      // Try Google Books first
      const googleData = await this.bookAuthority.getByISBN(isbn);
      if (googleData) {
        console.log('✅ Google Books data found');
        return googleData;
      }
      
      // Fallback to Open Library
      const openLibData = await this.openLibrary.searchByISBN(isbn);
      if (openLibData) {
        console.log('✅ Open Library data found');
        return openLibData;
      }
    }
    
    // No ISBN? Try title search
    const bookData = await this.bookAuthority.searchByTitle(itemName);
    if (bookData) {
      console.log('✅ Found book by title search');
      return bookData;
    }
    
    return null;
  }
}