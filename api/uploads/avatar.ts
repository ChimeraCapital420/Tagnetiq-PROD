// FILE: api/uploads/avatar.ts
// Avatar upload endpoint

import type { VercelRequest, VercelResponse } from '@vercel/node';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.VITE_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_SECRET!
);

async function verifyAuth(req: VercelRequest) {
  const token = req.headers.authorization?.replace('Bearer ', '');
  if (!token) return null;
  
  const { data: { user }, error } = await supabase.auth.getUser(token);
  return error || !user ? null : user;
}

export const config = {
  api: {
    bodyParser: {
      sizeLimit: '5mb',
    },
  },
};

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const user = await verifyAuth(req);
  if (!user) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  try {
    const { file, filename } = req.body;
    
    if (!file || !filename) {
      return res.status(400).json({ error: 'Missing file data' });
    }

    // Validate file type
    const validTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/gif'];
    const fileType = filename.split('.').pop()?.toLowerCase();
    
    if (!fileType || !['jpg', 'jpeg', 'png', 'gif'].includes(fileType)) {
      return res.status(400).json({ error: 'Invalid file type' });
    }

    // Generate unique filename
    const uniqueFilename = `${user.id}-${Date.now()}.${fileType}`;
    const filePath = `avatars/${uniqueFilename}`;

    // Convert base64 to buffer
    const fileBuffer = Buffer.from(file.replace(/^data:image\/\w+;base64,/, ''), 'base64');

    // Upload to Supabase Storage
    const { error: uploadError } = await supabase.storage
      .from('user-uploads')
      .upload(filePath, fileBuffer, {
        contentType: `image/${fileType}`,
        cacheControl: '3600',
        upsert: true
      });

    if (uploadError) {
      throw uploadError;
    }

    // Get public URL
    const { data: { publicUrl } } = supabase.storage
      .from('user-uploads')
      .getPublicUrl(filePath);

    // Update user profile
    const { error: updateError } = await supabase
      .from('profiles')
      .update({ avatar_url: publicUrl })
      .eq('id', user.id);

    if (updateError) {
      throw updateError;
    }

    res.status(200).json({ 
      success: true, 
      url: publicUrl 
    });

  } catch (error) {
    console.error('Avatar upload error:', error);
    res.status(500).json({ error: 'Failed to upload avatar' });
  }
}