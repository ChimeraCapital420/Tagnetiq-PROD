// FILE: api/investor/documents.ts

import { supaAdmin } from '../_lib/supaAdmin.js';
import type { VercelRequest, VercelResponse } from '@vercel/node';
import { verifyUserIsAdmin } from '../_lib/security.js';

const BUCKET_NAME = 'investor-documents';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method Not Allowed' });
  }
  
  try {
    await verifyUserIsAdmin(req); // SECURITY: Verify user is an admin

    // 1. List all files in the specified bucket
    const { data: fileList, error: listError } = await supaAdmin.storage
      .from(BUCKET_NAME)
      .list();

    if (listError) throw listError;
    if (!fileList) {
        return res.status(200).json([]);
    }
    
    // 2. Create an array of file paths to generate signed URLs for
    const filePaths = fileList.map(file => file.name);

    // 3. Generate signed URLs for all the files. These URLs are temporary and secure.
    // The link will be valid for 1 hour (3600 seconds).
    const { data: signedUrlsData, error: signedUrlError } = await supaAdmin.storage
      .from(BUCKET_NAME)
      .createSignedUrls(filePaths, 3600);

    if (signedUrlError) throw signedUrlError;

    // 4. Combine the file names with their new signed URLs
    const documents = signedUrlsData.map(urlData => {
        const fileName = urlData.path.split('/').pop();
        return {
            name: fileName,
            url: urlData.signedUrl
        };
    });

    return res.status(200).json(documents);

  } catch (error: any) {
    const message = error.message || 'An unexpected error occurred.';
     if (message.includes('Authorization')) {
        return res.status(403).json({ error: message });
    }
    if (message.includes('Authentication')) {
        return res.status(401).json({ error: message });
    }
    console.error('Error fetching investor documents:', message);
    return res.status(500).json({ error: message });
  }
}