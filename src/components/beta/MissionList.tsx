import React, { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import type { Mission, MissionProgress } from '@/types/beta';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { CheckCircle, Circle } from 'lucide-react';
import { toast } from 'sonner';

export const MissionList: React.FC = () => {
  const [missions, setMissions] = useState<Mission[]>([]);
  const [progress, setProgress] = useState<Record<string, MissionProgress>>({});
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchMissionsAndProgress = async () => {
      setLoading(true);
      try {
        // Fetch all available missions
        const { data: missionsData, error: missionsError } = await supabase
          .from('missions')
          .select('*');
        if (missionsError) throw missionsError;
        setMissions(missionsData || []);

        // Fetch the current user's progress
        const { data: progressData, error: progressError } = await supabase
          .from('mission_progress')
          .select('*');
        if (progressError) throw progressError;
        
        const progressMap = (progressData || []).reduce((acc, p) => {
          acc[p.mission_key] = p;
          return acc;
        }, {} as Record<string, MissionProgress>);
        setProgress(progressMap);

      } catch (error) {
        toast.error('Failed to load missions.', { description: (error as Error).message });
      } finally {
        setLoading(false);
      }
    };

    fetchMissionsAndProgress();
  }, []);

  const handleCompleteMission = async (missionKey: string) => {
    // This is a placeholder for a real API call
    console.log(`Attempting to complete mission: ${missionKey}`);
    toast.success("Mission Complete!", { description: `You earned ${missions.find(m => m.key === missionKey)?.points || 0} points.`});
    // In a real app, you would optimistically update the UI and then re-fetch
  };

  if (loading) {
    return <p>Loading missions...</p>;
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Beta Missions</CardTitle>
        <CardDescription>Complete these tasks to help us test and earn rewards.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {missions.map((mission) => {
          const isCompleted = progress[mission.key]?.completed;
          return (
            <div key={mission.key} className={`p-4 rounded-lg flex items-center justify-between ${isCompleted ? 'bg-green-500/10' : 'bg-muted/50'}`}>
              <div className="flex items-start gap-4">
                {isCompleted ? <CheckCircle className="h-6 w-6 text-green-500 mt-1" /> : <Circle className="h-6 w-6 text-muted-foreground mt-1" />}
                <div>
                  <h4 className="font-semibold">{mission.title}</h4>
                  <p className="text-sm text-muted-foreground">{mission.description}</p>
                </div>
              </div>
              <div className="text-right">
                <p className="font-bold text-lg">{mission.points}</p>
                <p className="text-xs text-muted-foreground">Points</p>
                {!isCompleted && (
                    <Button size="sm" className="mt-2" onClick={() => handleCompleteMission(mission.key)}>Complete</Button>
                )}
              </div>
            </div>
          );
        })}
      </CardContent>
    </Card>
  );
};