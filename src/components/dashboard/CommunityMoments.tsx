// FILE: src/components/dashboard/CommunityMoments.tsx
// Community Moments — "Someone just found a $2,400 error coin"
//
// Sprint E: Anonymized feed of best Oracle catches.
// Creates FOMO, proves the product works, keeps dashboard fresh.
//
// Rules:
//   - Never shows who found it (anonymous by design)
//   - Admin-curated only (never auto-published)
//   - Reactions are simple tap-to-react (no comments)
//   - Falls back gracefully when no moments exist yet

import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Sparkles, TrendingUp, Star, Package, Brain, ChevronRight } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/contexts/AuthContext';
import { cn } from '@/lib/utils';
import { formatDistanceToNow } from 'date-fns';

interface CommunityMoment {
  id: string;
  moment_type: string;
  headline: string;
  description?: string;
  category?: string;
  value_found?: number;
  value_paid?: number;
  reaction_count: number;
  view_count: number;
  created_at: string;
}

const MOMENT_ICONS: Record<string, React.ElementType> = {
  rare_find: Star,
  big_flip: TrendingUp,
  surprise_value: Sparkles,
  milestone: Package,
  oracle_insight: Brain,
};

const MOMENT_COLORS: Record<string, string> = {
  rare_find: 'text-amber-400',
  big_flip: 'text-emerald-400',
  surprise_value: 'text-cyan-400',
  milestone: 'text-violet-400',
  oracle_insight: 'text-blue-400',
};

const CommunityMoments: React.FC = () => {
  const { user } = useAuth();
  const [moments, setMoments] = useState<CommunityMoment[]>([]);
  const [loading, setLoading] = useState(true);
  const [reactedIds, setReactedIds] = useState<Set<string>>(new Set());

  useEffect(() => {
    fetchMoments();
  }, []);

  const fetchMoments = async () => {
    try {
      const { data } = await supabase
        .from('community_moments')
        .select('id, moment_type, headline, description, category, value_found, value_paid, reaction_count, view_count, created_at')
        .eq('is_published', true)
        .order('created_at', { ascending: false })
        .limit(5);

      setMoments(data || []);
    } catch {
      // Graceful fail — table might not exist yet
    } finally {
      setLoading(false);
    }
  };

  const handleReact = async (momentId: string) => {
    if (reactedIds.has(momentId)) return;

    setReactedIds(prev => new Set([...prev, momentId]));
    setMoments(prev =>
      prev.map(m =>
        m.id === momentId ? { ...m, reaction_count: m.reaction_count + 1 } : m
      )
    );

    // Fire and forget
    supabase
      .from('community_moments')
      .update({ reaction_count: moments.find(m => m.id === momentId)!.reaction_count + 1 })
      .eq('id', momentId)
      .then(() => {});
  };

  // Don't render if no moments (no empty state — just invisible)
  if (loading || moments.length === 0) return null;

  return (
    <Card className="overflow-hidden border-border/50 bg-background/50 backdrop-blur-sm">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-sm font-medium flex items-center gap-2">
            <Sparkles className="h-4 w-4 text-cyan-400" />
            Community Finds
          </CardTitle>
          <Badge variant="outline" className="text-xs">
            Live
          </Badge>
        </div>
      </CardHeader>
      <CardContent className="space-y-3 pt-0">
        {moments.map((moment) => {
          const Icon = MOMENT_ICONS[moment.moment_type] || Sparkles;
          const colorClass = MOMENT_COLORS[moment.moment_type] || 'text-cyan-400';
          const hasProfit = moment.value_found && moment.value_paid && moment.value_found > moment.value_paid;

          return (
            <button
              key={moment.id}
              onClick={() => handleReact(moment.id)}
              className={cn(
                "w-full text-left p-3 rounded-lg border border-border/30 hover:border-border/60 transition-all group",
                reactedIds.has(moment.id) && "border-cyan-500/30 bg-cyan-500/5"
              )}
            >
              <div className="flex items-start gap-3">
                <div className={cn("mt-0.5 flex-shrink-0", colorClass)}>
                  <Icon className="h-4 w-4" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium leading-snug">
                    {moment.headline}
                  </p>
                  {moment.description && (
                    <p className="text-xs text-muted-foreground mt-1 line-clamp-1">
                      {moment.description}
                    </p>
                  )}
                  <div className="flex items-center gap-3 mt-2">
                    {moment.category && (
                      <Badge variant="secondary" className="text-[10px] px-1.5 py-0">
                        {moment.category}
                      </Badge>
                    )}
                    {hasProfit && (
                      <span className="text-[10px] text-emerald-400">
                        {Math.round(((moment.value_found! - moment.value_paid!) / moment.value_paid!) * 100)}% margin
                      </span>
                    )}
                    <span className="text-[10px] text-muted-foreground">
                      {formatDistanceToNow(new Date(moment.created_at), { addSuffix: true })}
                    </span>
                    {moment.reaction_count > 0 && (
                      <span className="text-[10px] text-muted-foreground">
                        🔥 {moment.reaction_count}
                      </span>
                    )}
                  </div>
                </div>
                <ChevronRight className="h-3 w-3 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity mt-1" />
              </div>
            </button>
          );
        })}
      </CardContent>
    </Card>
  );
};

export default CommunityMoments;