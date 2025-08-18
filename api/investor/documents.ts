// FILE: api/investor/documents.ts (CREATE THIS NEW FILE)

import { supaAdmin } from '../_lib/supaAdmin';
import type { VercelRequest, VercelResponse } from '@vercel/node';

const BUCKET_NAME = 'investor-documents';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method Not Allowed' });
  }

  // In a real production app, you would add admin role-based access control here
  // to ensure only authenticated admins can access this endpoint.

  try {
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

  } catch (error) {
    const message = error instanceof Error ? error.message : 'An unexpected error occurred.';
    console.error('Error fetching investor documents:', message);
    return res.status(500).json({ error: message });
  }
}