import { createClient } from '@supabase/supabase-js';

// Debug logging
console.log('=== SUPABASE DEBUG ===');
console.log('Environment:', process.env.NODE_ENV);
console.log('NEXT_PUBLIC_SUPABASE_URL exists:', !!process.env.NEXT_PUBLIC_SUPABASE_URL);
console.log('NEXT_PUBLIC_SUPABASE_URL value:', process.env.NEXT_PUBLIC_SUPABASE_URL);
console.log('NEXT_PUBLIC_SUPABASE_ANON_token exists:', !!process.env.NEXT_PUBLIC_SUPABASE_ANON_token);
console.log('All env vars starting with NEXT_PUBLIC:', 
  Object.keys(process.env).filter(key => key.startsWith('NEXT_PUBLIC')));

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_token;

if (!supabaseUrl) {
  console.error('❌ NEXT_PUBLIC_SUPABASE_URL is missing or empty');
  throw new Error('supabaseUrl is required');
}

if (!supabaseAnonKey) {
  console.error('❌ NEXT_PUBLIC_SUPABASE_ANON_token is missing or empty');  
  throw new Error('supabaseAnonKey is required');
}

console.log('✅ Supabase config loaded successfully');

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: true
  }
});

// Database type definitions
export interface Profile {
  id: string;
  email: string;
  full_name?: string;
  avatar_url?: string;
  subscription_tier: 'free' | 'pro' | 'enterprise';
  total_scans: number;
  successful_finds: number;
  total_profit: number;
  settings: {
    theme: string;
    themeMode: string;
    voiceRecognition: boolean;
    listItAndWalkMode: boolean;
    notifications: boolean;
  };
  created_at: string;
  updated_at: string;
}

export interface ScanHistory {
  id: string;
  user_id: string;
  scan_type: 'barcode' | 'image';
  barcode_data?: string;
  image_data?: string;
  analysis_result: {
    itemName: string;
    estimatedValue: string;
    decision: string;
    confidence: string;
    reasoning: string;
  };
  profit_made: number;
  item_sold: boolean;
  sale_date?: string;
  listing_platform?: string;
  created_at: string;
}

export interface Inventory {
  id: string;
  user_id: string;
  scan_id?: string;
  item_name: string;
  purchase_price: number;
  estimated_value: number;
  actual_sale_price?: number;
  purchase_date: string;
  sale_date?: string;
  status: 'purchased' | 'listed' | 'sold' | 'returned';
  listing_url?: string;
  notes?: string;
  images?: string[];
  created_at: string;
  updated_at: string;
}

export interface Watchlist {
  id: string;
  user_id: string;
  item_name: string;
  target_price?: number;
  current_price?: number;
  alert_threshold?: number;
  marketplace?: string;
  item_url?: string;
  last_checked: string;
  created_at: string;
}

// Helper functions for common database operations
export const DatabaseHelper = {
  // Get user profile
  async getProfile(userId: string): Promise<Profile | null> {
    const { data, error } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', userId)
      .single();
    
    if (error) {
      console.error('Error fetching profile:', error);
      return null;
    }
    
    return data;
  },

  // Update user profile
  async updateProfile(userId: string, updates: Partial<Profile>): Promise<boolean> {
    const { error } = await supabase
      .from('profiles')
      .update(updates)
      .eq('id', userId);
    
    if (error) {
      console.error('Error updating profile:', error);
      return false;
    }
    
    return true;
  },

  // Get scan history
  async getScanHistory(userId: string, limit: number = 50): Promise<ScanHistory[]> {
    const { data, error } = await supabase
      .from('scan_history')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: false })
      .limit(limit);
    
    if (error) {
      console.error('Error fetching scan history:', error);
      return [];
    }
    
    return data || [];
  },

  // Add to inventory
  async addToInventory(inventoryItem: Omit<Inventory, 'id' | 'created_at' | 'updated_at'>): Promise<string | null> {
    const { data, error } = await supabase
      .from('inventory')
      .insert(inventoryItem)
      .select('id')
      .single();
    
    if (error) {
      console.error('Error adding to inventory:', error);
      return null;
    }
    
    return data.id;
  },

  // Get inventory
  async getInventory(userId: string): Promise<Inventory[]> {
    const { data, error } = await supabase
      .from('inventory')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: false });
    
    if (error) {
      console.error('Error fetching inventory:', error);
      return [];
    }
    
    return data || [];
  },

  // Update inventory item
  async updateInventoryItem(itemId: string, updates: Partial<Inventory>): Promise<boolean> {
    const { error } = await supabase
      .from('inventory')
      .update(updates)
      .eq('id', itemId);
    
    if (error) {
      console.error('Error updating inventory item:', error);
      return false;
    }
    
    return true;
  },

  // Get watchlist
  async getWatchlist(userId: string): Promise<Watchlist[]> {
    const { data, error } = await supabase
      .from('watchlist')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: false });
    
    if (error) {
      console.error('Error fetching watchlist:', error);
      return [];
    }
    
    return data || [];
  },

  // Add to watchlist
  async addToWatchlist(watchlistItem: Omit<Watchlist, 'id' | 'created_at'>): Promise<string | null> {
    const { data, error } = await supabase
      .from('watchlist')
      .insert(watchlistItem)
      .select('id')
      .single();
    
    if (error) {
      console.error('Error adding to watchlist:', error);
      return null;
    }
    
    return data.id;
  },

  // Remove from watchlist
  async removeFromWatchlist(itemId: string): Promise<boolean> {
    const { error } = await supabase
      .from('watchlist')
      .delete()
      .eq('id', itemId);
    
    if (error) {
      console.error('Error removing from watchlist:', error);
      return false;
    }
    
    return true;
  },

  // Get user statistics
  async getUserStats(userId: string): Promise<{
    totalScans: number;
    successfulFinds: number;
    totalProfit: number;
    recentScans: ScanHistory[];
  }> {
    const profile = await this.getProfile(userId);
    const recentScans = await this.getScanHistory(userId, 10);
    
    return {
      totalScans: profile?.total_scans || 0,
      successfulFinds: profile?.successful_finds || 0,
      totalProfit: profile?.total_profit || 0,
      recentScans
    };
  },

  // Update profit tracking
  async updateProfitTracking(userId: string, scanId: string, profitMade: number): Promise<boolean> {
    // Update scan history
    const { error: scanError } = await supabase
      .from('scan_history')
      .update({ 
        profit_made: profitMade,
        item_sold: true,
        sale_date: new Date().toISOString()
      })
      .eq('id', scanId);

    if (scanError) {
      console.error('Error updating scan profit:', scanError);
      return false;
    }

    // Update user profile totals
    const { error: profileError } = await supabase
      .rpc('increment_profit', {
        user_id: userId,
        profit_amount: profitMade
      });

    if (profileError) {
      console.error('Error updating profile totals:', profileError);
      return false;
    }

    return true;
  }
};