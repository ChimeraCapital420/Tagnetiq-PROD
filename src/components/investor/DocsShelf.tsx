import React from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { FileText } from 'lucide-react';

// Displays downloadable documents for the investor.
export const DocsShelf: React.FC = () => {
    // In a real app, this data would come from /api/investor/docs
    const docs = [
        { slug: 'pitch-deck-q3', title: 'Pitch Deck (Q3 2025)' },
        { slug: 'financials-q2', title: 'Financial Projections (Q2 2025)' },
    ];

    const handleDocClick = (slug: string) => {
        // This would open a new tab to the tracked download link
        // For now, it just logs to the console
        console.log(`Requesting document: /api/investor/doc/${slug}`);
    };

    return (
        <Card className="bg-white/5 border-white/10 text-white backdrop-blur-sm">
            <CardHeader>
                <CardTitle>Data Room</CardTitle>
                <CardDescription className="text-white/70">Confidential corporate materials.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
                {docs.map(doc => (
                    <div key={doc.slug} className="flex items-center justify-between p-2 rounded-md hover:bg-white/10">
                        <div className="flex items-center gap-3">
                            <FileText className="h-5 w-5" />
                            <span>{doc.title}</span>
                        </div>
                        <Button variant="outline" className="text-white border-white/50 hover:bg-white/10" onClick={() => handleDocClick(doc.slug)}>
                            View
                        </Button>
                    </div>
                ))}
            </CardContent>
        </Card>
    );
};