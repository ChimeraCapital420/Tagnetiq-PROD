// FILE: src/components/investor/KeyDifferentiators.tsx

import React from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { BrainCircuit, Globe, Server, BarChart } from 'lucide-react';

const differentiators = [
    {
        icon: <BrainCircuit className="h-6 w-6 text-primary" />,
        title: "Multi-Category AI Evaluation",
        description: "A proprietary AI model capable of analyzing a wide range of asset categories."
    },
    {
        icon: <Globe className="h-6 w-6 text-primary" />,
        title: "Real-Time Global Market Data",
        description: "Integration with live data sources provides up-to-the-minute market insights."
    },
    {
        icon: <Server className="h-6 w-6 text-primary" />,
        title: "Enterprise-Ready Backend",
        description: "A scalable and secure infrastructure built on Supabase, ready for growth."
    },
    {
        icon: <BarChart className="h-6 w-6 text-primary" />,
        title: "Proven Beta Traction",
        description: "Demonstrated user engagement and product validation from an active beta program."
    }
];

export const KeyDifferentiators: React.FC = () => {
    return (
        <Card>
            <CardHeader>
                <CardTitle>Key Differentiators</CardTitle>
                <CardDescription>Our competitive edge in the physical asset intelligence market.</CardDescription>
            </CardHeader>
            <CardContent className="grid gap-6 sm:grid-cols-2">
                {differentiators.map(item => (
                    <div key={item.title} className="flex items-start gap-4">
                        <div>{item.icon}</div>
                        <div>
                            <h3 className="font-semibold">{item.title}</h3>
                            <p className="text-sm text-muted-foreground">{item.description}</p>
                        </div>
                    </div>
                ))}
            </CardContent>
        </Card>
    );
};