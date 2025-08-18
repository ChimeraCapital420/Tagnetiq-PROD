// FILE: src/components/investor/DocsShelf.tsx

import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Download, FileText, Presentation, FileImage, FileQuestion } from 'lucide-react';
import { toast } from 'sonner';

// Define the shape of a document object we expect from the API
interface InvestorDocument {
  name: string;
  url: string;
}

// Helper function to get an appropriate icon based on the file extension
const getFileIcon = (fileName: string) => {
  if (fileName.endsWith('.pdf')) return <FileText className="h-5 w-5 text-red-500" />;
  if (fileName.endsWith('.pptx') || fileName.endsWith('.key')) return <Presentation className="h-5 w-5 text-orange-500" />;
  if (fileName.endsWith('.png') || fileName.endsWith('.jpg')) return <FileImage className="h-5 w-5 text-blue-500" />;
  return <FileQuestion className="h-5 w-5 text-gray-500" />;
};

export const DocsShelf: React.FC = () => {
  const [documents, setDocuments] = useState<InvestorDocument[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchDocuments = async () => {
      try {
        const response = await fetch('/api/investor/documents');
        if (!response.ok) {
          throw new Error('Failed to fetch investor documents.');
        }
        const data = await response.json();
        setDocuments(data);
      } catch (error) {
        toast.error('Could not load documents.', { description: (error as Error).message });
      } finally {
        setLoading(false);
      }
    };
    fetchDocuments();
  }, []);

  return (
    <Card>
      <CardHeader>
        <CardTitle>Investor Data Room</CardTitle>
        <CardDescription>Secure access to key investment documents.</CardDescription>
      </CardHeader>
      <CardContent>
        {loading ? (
          <div className="space-y-2">
            {[...Array(3)].map((_, i) => (
              <div key={i} className="h-10 bg-muted rounded w-full animate-pulse"></div>
            ))}
          </div>
        ) : documents.length > 0 ? (
          <ul className="space-y-2">
            {documents.map((doc) => (
              <li key={doc.name}>
                <a
                  href={doc.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center justify-between p-2 rounded-md hover:bg-muted transition-colors"
                >
                  <div className="flex items-center gap-3">
                    {getFileIcon(doc.name)}
                    <span className="font-medium text-sm">{doc.name}</span>
                  </div>
                  <Download className="h-4 w-4 text-muted-foreground" />
                </a>
              </li>
            ))}
          </ul>
        ) : (
          <div className="text-center text-sm text-muted-foreground py-4">
            No documents have been uploaded to the data room.
          </div>
        )}
      </CardContent>
    </Card>
  );
};