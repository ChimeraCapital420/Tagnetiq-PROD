// FILE: api/user/send-welcome-message.ts
// Sends welcome message from TagnetIQ Official to new users

import { supaAdmin } from '../_lib/supaAdmin.js';
import type { VercelRequest, VercelResponse } from '@vercel/node';
import { verifyUser } from '../_lib/security.js';

// TagnetIQ Official System Account ID - create this account in your DB
// Or use an admin user ID that represents the platform
const TAGNETIQ_OFFICIAL_ID = process.env.TAGNETIQ_SYSTEM_USER_ID || 'system';

const WELCOME_MESSAGE = `👋 Welcome to TagnetIQ!

We're thrilled to have you join our community of collectors, traders, and enthusiasts. You've just become part of the premier destination for asset evaluation, discovery, and exchange.

**What makes TagnetIQ special:**

🔍 **Discover** — Our AI-powered HYDRA engine helps you identify and evaluate items with precision and insight.

🤝 **Connect** — Meet fellow collectors who share your passion. This is a place where knowledge is exchanged freely and friendships are forged.

💎 **Trade** — Our marketplace brings together buyers and sellers in a trusted environment where fair dealing is the standard.

💡 **Share** — Your theories, expertise, and discoveries matter here. Every member adds to our collective knowledge.

**A note on community:**

TagnetIQ thrives because of mutual respect. We ask that all members:
• Treat others with courtesy and professionalism
• Share knowledge generously
• Deal honestly in all transactions
• Keep discussions constructive and inclusive

We're building something special together — a community where passion meets expertise, and where every item tells a story worth discovering.

If you ever need help, have questions, or just want to share an exciting find, we're here for you.

Happy hunting! 🎯

— The TagnetIQ Team`;

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', ['POST']);
    return res.status(405).json({ error: 'Method Not Allowed' });
  }

  try {
    const user = await verifyUser(req);

    // Check if user already received welcome message
    const { data: existingConvo } = await supaAdmin
      .from('secure_conversations')
      .select('id')
      .eq('seller_id', TAGNETIQ_OFFICIAL_ID)
      .eq('buyer_id', user.id)
      .is('listing_id', null)
      .limit(1)
      .single();

    if (existingConvo) {
      return res.status(200).json({ 
        message: 'Welcome message already sent',
        conversation_id: existingConvo.id,
        already_sent: true
      });
    }

    // Check if system account exists, if not skip gracefully
    const { data: systemAccount } = await supaAdmin
      .from('profiles')
      .select('id')
      .eq('id', TAGNETIQ_OFFICIAL_ID)
      .single();

    if (!systemAccount) {
      console.log('TagnetIQ system account not configured, skipping welcome message');
      return res.status(200).json({ 
        message: 'Welcome message system not configured',
        skipped: true
      });
    }

    // Create conversation
    const { data: conversation, error: convoError } = await supaAdmin
      .from('secure_conversations')
      .insert({
        buyer_id: user.id,
        seller_id: TAGNETIQ_OFFICIAL_ID,
        listing_id: null,
        conversation_type: 'direct',
      })
      .select()
      .single();

    if (convoError) throw convoError;

    // Send welcome message
    const { data: message, error: msgError } = await supaAdmin
      .from('secure_messages')
      .insert({
        conversation_id: conversation.id,
        sender_id: TAGNETIQ_OFFICIAL_ID,
        encrypted_content: WELCOME_MESSAGE,
        read: false,
      })
      .select()
      .single();

    if (msgError) throw msgError;

    return res.status(201).json({
      message: 'Welcome message sent!',
      conversation_id: conversation.id,
      already_sent: false
    });

  } catch (error: any) {
    const message = error.message || 'An unexpected error occurred';
    if (message.includes('Authentication')) {
      return res.status(401).json({ error: message });
    }
    console.error('Welcome message error:', message);
    return res.status(500).json({ error: message });
  }
}