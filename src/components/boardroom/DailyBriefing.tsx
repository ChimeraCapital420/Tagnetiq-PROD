// FILE: src/components/boardroom/DailyBriefing.tsx
// Daily briefing display component

import React, { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { 
  Loader2, 
  RefreshCw, 
  Sun, 
  Moon,
  ChevronDown,
  ChevronUp,
  Volume2,
  Calendar
} from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { VoicePlayer } from './VoicePlayer';

interface BriefingSection {
  member_slug: string;
  member_name: string;
  title: string;
  content: string;
  priority: number;
}

interface Briefing {
  id: string;
  briefing_date: string;
  briefing_type: string;
  sections: BriefingSection[];
  summary: string;
  action_items: any[];
  read_at: string | null;
  created_at: string;
}

export function DailyBriefing() {
  const [briefing, setBriefing] = useState<Briefing | null>(null);
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [expandedSections, setExpandedSections] = useState<Set<number>>(new Set([0, 1])); // First 2 expanded
  const [error, setError] = useState<string | null>(null);

  // Fetch today's briefing
  const fetchBriefing = async () => {
    setLoading(true);
    setError(null);

    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error('Not authenticated');

      const response = await fetch('/api/boardroom/briefing', {
        headers: {
          'Authorization': `Bearer ${session.access_token}`,
        },
      });

      const data = await response.json();

      if (data.exists === false) {
        setBriefing(null);
      } else if (data.id) {
        setBriefing(data);
      } else {
        setBriefing(null);
      }
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  // Generate new briefing
  const generateBriefing = async () => {
    setGenerating(true);
    setError(null);

    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error('Not authenticated');

      const response = await fetch('/api/boardroom/briefing', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({ type: 'morning' }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to generate briefing');
      }

      setBriefing(data);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setGenerating(false);
    }
  };

  // Toggle section expansion
  const toggleSection = (index: number) => {
    setExpandedSections(prev => {
      const next = new Set(prev);
      if (next.has(index)) {
        next.delete(index);
      } else {
        next.add(index);
      }
      return next;
    });
  };

  // Format date
  const formatDate = (dateStr: string) => {
    return new Date(dateStr).toLocaleDateString('en-US', {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    });
  };

  // Format time
  const formatTime = (dateStr: string) => {
    return new Date(dateStr).toLocaleTimeString('en-US', {
      hour: 'numeric',
      minute: '2-digit',
    });
  };

  useEffect(() => {
    fetchBriefing();
  }, []);

  // Loading state
  if (loading) {
    return (
      <Card>
        <CardContent className="py-12 flex items-center justify-center">
          <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
        </CardContent>
      </Card>
    );
  }

  // No briefing yet
  if (!briefing) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Sun className="w-5 h-5 text-yellow-500" />
            Morning Briefing
          </CardTitle>
          <CardDescription>
            Your board hasn't prepared today's briefing yet.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Button onClick={generateBriefing} disabled={generating}>
            {generating ? (
              <>
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                Board is preparing briefing...
              </>
            ) : (
              <>
                <RefreshCw className="w-4 h-4 mr-2" />
                Generate Today's Briefing
              </>
            )}
          </Button>
          {generating && (
            <p className="text-sm text-muted-foreground mt-3">
              Scuba Steve is scanning market news, Athena is analyzing strategy, 
              Vulcan is reviewing tech priorities, and Glitch is finding growth opportunities...
            </p>
          )}
          {error && (
            <p className="text-sm text-red-500 mt-3">{error}</p>
          )}
        </CardContent>
      </Card>
    );
  }

  // Display briefing
  return (
    <div className="space-y-4">
      {/* Header */}
      <Card>
        <CardHeader>
          <div className="flex items-start justify-between">
            <div>
              <CardTitle className="flex items-center gap-2">
                <Sun className="w-5 h-5 text-yellow-500" />
                {briefing.briefing_type === 'morning' ? 'Morning' : 'Evening'} Briefing
              </CardTitle>
              <CardDescription className="flex items-center gap-2 mt-1">
                <Calendar className="w-4 h-4" />
                {formatDate(briefing.briefing_date)} • Generated at {formatTime(briefing.created_at)}
              </CardDescription>
            </div>
            <Button variant="outline" size="sm" onClick={generateBriefing} disabled={generating}>
              {generating ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <RefreshCw className="w-4 h-4" />
              )}
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {/* Executive Summary */}
          <div className="bg-gradient-to-r from-amber-50 to-orange-50 dark:from-amber-950/20 dark:to-orange-950/20 p-4 rounded-lg border border-amber-200 dark:border-amber-800">
            <div className="flex items-start justify-between">
              <div className="flex-1">
                <h3 className="font-semibold text-amber-900 dark:text-amber-100 mb-2">
                  Executive Summary
                </h3>
                <p className="text-amber-800 dark:text-amber-200">
                  {briefing.summary}
                </p>
              </div>
              <VoicePlayer 
                text={briefing.summary} 
                memberSlug="griffin" 
                memberName="Griffin"
                compact 
              />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Sections */}
      {briefing.sections.map((section, index) => (
        <Card key={index}>
          <CardHeader 
            className="cursor-pointer hover:bg-muted/50 transition-colors"
            onClick={() => toggleSection(index)}
          >
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <CardTitle className="text-base">
                  {section.title}
                </CardTitle>
                <Badge variant="outline" className="text-xs">
                  {section.member_name}
                </Badge>
              </div>
              <div className="flex items-center gap-2">
                <VoicePlayer 
                  text={section.content} 
                  memberSlug={section.member_slug} 
                  memberName={section.member_name}
                  compact 
                />
                {expandedSections.has(index) ? (
                  <ChevronUp className="w-4 h-4 text-muted-foreground" />
                ) : (
                  <ChevronDown className="w-4 h-4 text-muted-foreground" />
                )}
              </div>
            </div>
          </CardHeader>
          {expandedSections.has(index) && (
            <CardContent>
              <div className="prose prose-sm dark:prose-invert max-w-none">
                <div className="whitespace-pre-wrap text-sm">
                  {section.content}
                </div>
              </div>
            </CardContent>
          )}
        </Card>
      ))}

      {error && (
        <div className="p-4 bg-red-50 text-red-700 rounded-lg">
          {error}
        </div>
      )}
    </div>
  );
}

export default DailyBriefing;