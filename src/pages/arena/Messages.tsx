// FILE: src/pages/arena/Messages.tsx

import React from 'react';
import { Card, CardContent } from '@/components/ui/card';

const MessagesPage: React.FC = () => {
    // This page will be developed to show a list of conversations
    // and the active message thread. For now, it's a placeholder.
    return (
        <div className="container mx-auto p-4 md:p-8">
             <h1 className="text-3xl font-bold mb-4">My Messages</h1>
            <Card>
                <CardContent className="p-6">
                    <p className="text-muted-foreground">Secure messaging system coming soon.</p>
                </CardContent>
            </Card>
        </div>
    );
};

export default MessagesPage;