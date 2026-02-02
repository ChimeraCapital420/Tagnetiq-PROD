// FILE: api/seo/social-share.ts
// Generates shareable links and can trigger auto-posts
// Called when a new listing is created or updated

import type { VercelRequest, VercelResponse } from '@vercel/node';
import { createClient } from '@supabase/supabase-js';
import { SEO_CONFIG } from './config';

const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

const { domain } = SEO_CONFIG;

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { listing_id } = req.body;

  if (!listing_id) {
    return res.status(400).json({ error: 'Missing listing_id' });
  }

  try {
    const { data: listing, error } = await supabase
      .from('arena_listings')
      .select(`
        *,
        profiles!arena_listings_seller_id_fkey (
          screen_name,
          location_text
        )
      `)
      .eq('id', listing_id)
      .single();

    if (error || !listing) {
      return res.status(404).json({ error: 'Listing not found' });
    }

    const shareLinks = generateShareLinks(listing);
    const embedCode = generateEmbedCode(listing);

    return res.status(200).json({
      success: true,
      listing_id,
      share_links: shareLinks,
      embed_code: embedCode,
      og_image: `${domain}/api/seo/og-image/${listing_id}`,
      direct_link: `${domain}/marketplace/${listing_id}`,
    });
  } catch (error: any) {
    console.error('Social share error:', error);
    return res.status(500).json({ error: 'Failed to generate share links' });
  }
}

function generateShareLinks(listing: any): Record<string, string> {
  const title = encodeURIComponent(listing.item_name || 'Check out this item');
  const price = listing.asking_price?.toFixed(2) || '0.00';
  const url = encodeURIComponent(`${domain}/marketplace/${listing.id}`);
  const description = encodeURIComponent(
    `${listing.item_name} - $${price} on TagnetIQ Marketplace`
  );
  const hashtags = encodeURIComponent(
    `TagnetIQ,${listing.category || 'collectibles'},forsale`.replace(/-/g, '')
  );
  const image = encodeURIComponent(
    listing.primary_photo_url || `${domain}/api/seo/og-image/${listing.id}`
  );

  return {
    // Facebook
    facebook: `https://www.facebook.com/sharer/sharer.php?u=${url}&quote=${description}`,
    
    // Twitter/X
    twitter: `https://twitter.com/intent/tweet?text=${description}&url=${url}&hashtags=${hashtags}`,
    
    // Pinterest (great for visual items!)
    pinterest: `https://pinterest.com/pin/create/button/?url=${url}&media=${image}&description=${description}`,
    
    // LinkedIn (for luxury/business items)
    linkedin: `https://www.linkedin.com/sharing/share-offsite/?url=${url}`,
    
    // Reddit (collector communities)
    reddit: `https://reddit.com/submit?url=${url}&title=${title}`,
    
    // WhatsApp
    whatsapp: `https://wa.me/?text=${description}%20${url}`,
    
    // Telegram
    telegram: `https://t.me/share/url?url=${url}&text=${description}`,
    
    // Email
    email: `mailto:?subject=${title}&body=${description}%0A%0A${url}`,
    
    // SMS (mobile)
    sms: `sms:?body=${description}%20${decodeURIComponent(url)}`,
    
    // Copy link (returns the URL to copy)
    copy: `${domain}/marketplace/${listing.id}`,
  };
}

function generateEmbedCode(listing: any): string {
  const price = listing.asking_price?.toFixed(2) || '0.00';
  
  // Embeddable widget for forums, blogs, etc.
  return `<div style="border:1px solid #333;border-radius:12px;padding:16px;max-width:400px;background:#1a1a1a;font-family:sans-serif;">
  <a href="${domain}/marketplace/${listing.id}" target="_blank" style="text-decoration:none;color:inherit;">
    <img src="${listing.primary_photo_url || `${domain}/placeholder.svg`}" style="width:100%;border-radius:8px;margin-bottom:12px;" alt="${listing.item_name}">
    <div style="color:#fff;font-size:16px;font-weight:600;margin-bottom:8px;">${listing.item_name}</div>
    <div style="color:#22c55e;font-size:24px;font-weight:700;">$${price}</div>
    <div style="color:#3b82f6;font-size:12px;margin-top:8px;">View on TagnetIQ →</div>
  </a>
</div>`;
}