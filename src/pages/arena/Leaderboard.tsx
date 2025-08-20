// FILE: src/pages/arena/Leaderboard.tsx

import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Trophy, Loader2 } from 'lucide-react';
import { toast } from 'sonner';

interface LeaderboardEntry {
    user: string;
    roi: string;
    totalProfit: string;
}

const Leaderboard: React.FC = () => {
  const [leaderboardData, setLeaderboardData] = useState<LeaderboardEntry[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchLeaderboard = async () => {
        try {
            const response = await fetch('/api/arena/leaderboard');
            if (!response.ok) throw new Error("Failed to fetch leaderboard data.");
            const data = await response.json();
            setLeaderboardData(data);
        } catch (error) {
            toast.error("Error", { description: (error as Error).message });
        } finally {
            setLoading(false);
        }
    };
    fetchLeaderboard();
  }, []);

  return (
    <div className="container mx-auto p-4 md:p-8">
      <div className="space-y-8">
        <div>
          <h1 className="text-3xl font-bold">Leaderboard</h1>
          <p className="text-muted-foreground">Top performers in the Tagnetiq Arena.</p>
        </div>
        <Card>
          <CardHeader>
            <CardTitle>All-Time ROI Champions</CardTitle>
            <CardDescription>The highest return on investment since the Arena's inception.</CardDescription>
          </CardHeader>
          <CardContent>
            {loading ? (
                <div className="text-center py-16"><Loader2 className="h-8 w-8 animate-spin mx-auto" /></div>
            ) : (
                <Table>
                    <TableHeader>
                        <TableRow>
                        <TableHead className="w-[80px]">Rank</TableHead>
                        <TableHead>User</TableHead>
                        <TableHead className="text-right">Average ROI</TableHead>
                        <TableHead className="text-right">Total Profit</TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {leaderboardData.map((entry, index) => (
                        <TableRow key={index}>
                            <TableCell className="font-bold text-lg">{index === 0 ? <Trophy className="text-yellow-500" /> : index + 1}</TableCell>
                            <TableCell className="flex items-center gap-3">
                            <Avatar>
                                <AvatarImage src={`https://api.dicebear.com/8.x/initials/svg?seed=${entry.user}`} />
                                <AvatarFallback>{entry.user.substring(0, 2)}</AvatarFallback>
                            </Avatar>
                            {entry.user}
                            </TableCell>
                            <TableCell className="text-right font-semibold text-green-500">{entry.roi}%</TableCell>
                            <TableCell className="text-right font-semibold">${parseFloat(entry.totalProfit).toLocaleString()}</TableCell>
                        </TableRow>
                        ))}
                    </TableBody>
                </Table>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default Leaderboard;