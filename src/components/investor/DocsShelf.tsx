// FILE: src/components/investor/DocsShelf.tsx

import React from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { FileText, Download } from 'lucide-react';

const documents = [
    { name: "Pitch Deck Q3 2025.pdf", size: "4.2 MB", href: "/placeholder.pdf" },
    { name: "Financial Projections.xlsx", size: "1.8 MB", href: "/placeholder.xlsx" },
    { name: "Technical Whitepaper.pdf", size: "2.5 MB", href: "/placeholder.pdf" },
    { name: "Team Bios.pdf", size: "850 KB", href: "/placeholder.pdf" },
];

export const DocsShelf: React.FC = () => {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Investor Documents</CardTitle>
        <CardDescription>Key documents for due diligence and review.</CardDescription>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          {documents.map(doc => (
            <div key={doc.name} className="flex items-center justify-between p-3 rounded-md bg-muted/50">
              <div className="flex items-center gap-3">
                <FileText className="h-6 w-6 text-muted-foreground" />
                <div>
                  <p className="text-sm font-medium">{doc.name}</p>
                  <p className="text-xs text-muted-foreground">{doc.size}</p>
                </div>
              </div>
              <Button asChild variant="ghost" size="icon">
                <a href={doc.href} download>
                  <Download className="h-4 w-4" />
                </a>
              </Button>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
};
