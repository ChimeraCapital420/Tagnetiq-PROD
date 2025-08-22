// FILE: src/components/investor/SentimentChart.tsx (CREATE OR REPLACE)

import React, { useState, useEffect } from 'react';
import { PieChart, Pie, Cell, ResponsiveContainer, Legend } from 'recharts';
import { toast } from 'sonner';

interface SentimentData {
  Positive: number;
  Neutral: number;
  Negative: number;
}

const COLORS = {
  Positive: '#22c55e', // Green
  Neutral: '#a1a1aa',  // Zinc
  Negative: '#ef4444', // Red
};

export const SentimentChart: React.FC = () => {
  const [data, setData] = useState<SentimentData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchSentiment = async () => {
      try {
        const response = await fetch('/api/investor/sentiment');
        if (!response.ok) {
          throw new Error('Failed to fetch sentiment data.');
        }
        const result = await response.json();
        setData(result);
      } catch (error) {
        toast.error("Could not load sentiment chart.", { description: (error as Error).message });
      } finally {
        setLoading(false);
      }
    };
    fetchSentiment();
  }, []);

  if (loading) {
    return <div className="h-48 w-full animate-pulse bg-muted rounded-lg"></div>;
  }

  if (!data || (data.Positive === 0 && data.Neutral === 0 && data.Negative === 0)) {
    return (
      <div className="h-48 flex items-center justify-center text-center text-sm text-muted-foreground">
        No feedback submitted yet to analyze sentiment.
      </div>
    );
  }

  const chartData = Object.entries(data).map(([name, value]) => ({ name, value }));
  const total = data.Positive + data.Neutral + data.Negative;

  return (
    <div className="w-full h-48">
      <ResponsiveContainer width="100%" height="100%">
        <PieChart>
          <Pie
            data={chartData}
            cx="50%"
            cy="50%"
            innerRadius={40}
            outerRadius={60}
            fill="#8884d8"
            paddingAngle={5}
            dataKey="value"
          >
            {chartData.map((entry) => (
              <Cell key={`cell-${entry.name}`} fill={COLORS[entry.name as keyof typeof COLORS]} />
            ))}
          </Pie>
          <Legend iconType="circle" layout="vertical" verticalAlign="middle" align="right" />
          <text x="50%" y="50%" textAnchor="middle" dominantBaseline="middle" fontSize="24" fontWeight="bold" fill="hsl(var(--foreground))">
            {total}
          </text>
           <text x="50%" y="65%" textAnchor="middle" dominantBaseline="middle" fontSize="12" fill="hsl(var(--muted-foreground))">
            Reports
          </text>
        </PieChart>
      </ResponsiveContainer>
    </div>
  );
};