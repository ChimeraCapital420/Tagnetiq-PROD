// FILE: src/components/boardroom/QuickTasks.tsx
// Quick task assignment UI for the boardroom

import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Loader2, CheckCircle, FileText, Send, Sparkles } from 'lucide-react';
import { supabase } from '@/lib/supabase';

interface QuickTask {
  id: string;
  label: string;
  description: string;
  assignedTo: string;
  memberName: string;
  taskType: string;
  icon: React.ReactNode;
}

const QUICK_TASKS: QuickTask[] = [
  {
    id: 'social-posts',
    label: 'Write Social Media Posts',
    description: 'Get Twitter, LinkedIn, and Instagram content',
    assignedTo: 'glitch',
    memberName: 'Glitch (CMO)',
    taskType: 'social_media_posts',
    icon: <Sparkles className="w-4 h-4" />,
  },
  {
    id: 'competitor-analysis',
    label: 'Competitive Analysis',
    description: 'Research PSA, WhatNot, Collectors.com',
    assignedTo: 'athena',
    memberName: 'Athena (CSO)',
    taskType: 'competitive_analysis',
    icon: <FileText className="w-4 h-4" />,
  },
  {
    id: 'market-research',
    label: 'Market Research',
    description: 'Latest collectibles market trends & data',
    assignedTo: 'scuba',
    memberName: 'Scuba Steve (Research)',
    taskType: 'market_research',
    icon: <FileText className="w-4 h-4" />,
  },
  {
    id: 'investor-narrative',
    label: 'Draft Investor Narrative',
    description: 'Craft the seed round story',
    assignedTo: 'athena',
    memberName: 'Athena (CSO)',
    taskType: 'investor_narrative',
    icon: <FileText className="w-4 h-4" />,
  },
  {
    id: 'terms-of-service',
    label: 'Draft Terms of Service',
    description: 'Legal ToS document',
    assignedTo: 'lexicoda',
    memberName: 'Lexicoda (Legal)',
    taskType: 'terms_of_service',
    icon: <FileText className="w-4 h-4" />,
  },
  {
    id: 'privacy-policy',
    label: 'Draft Privacy Policy',
    description: 'GDPR/CCPA compliant policy',
    assignedTo: 'lexicoda',
    memberName: 'Lexicoda (Legal)',
    taskType: 'privacy_policy',
    icon: <FileText className="w-4 h-4" />,
  },
  {
    id: 'api-design',
    label: 'Design Public API',
    description: 'API specification for B2B',
    assignedTo: 'vulcan',
    memberName: 'Vulcan (CTO)',
    taskType: 'api_design',
    icon: <FileText className="w-4 h-4" />,
  },
  {
    id: 'financial-projections',
    label: 'Financial Projections',
    description: '3-year revenue model',
    assignedTo: 'griffin',
    memberName: 'Griffin (CFO)',
    taskType: 'financial_projections',
    icon: <FileText className="w-4 h-4" />,
  },
  {
    id: 'email-sequences',
    label: 'Email Marketing Sequences',
    description: 'Welcome, activation, upgrade emails',
    assignedTo: 'glitch',
    memberName: 'Glitch (CMO)',
    taskType: 'email_sequences',
    icon: <Send className="w-4 h-4" />,
  },
  {
    id: 'pricing-analysis',
    label: 'Pricing Strategy',
    description: 'Analyze and recommend pricing',
    assignedTo: 'griffin',
    memberName: 'Griffin (CFO)',
    taskType: 'pricing_analysis',
    icon: <FileText className="w-4 h-4" />,
  },
];

interface TaskResult {
  taskId: string;
  deliverable: string;
  memberName: string;
  completedAt: string;
}

export function QuickTasks() {
  const [loading, setLoading] = useState<string | null>(null);
  const [results, setResults] = useState<TaskResult[]>([]);
  const [error, setError] = useState<string | null>(null);

  const executeTask = async (task: QuickTask) => {
    setLoading(task.id);
    setError(null);

    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error('Not authenticated');

      const response = await fetch('/api/boardroom/tasks', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({
          assigned_to: task.assignedTo,
          title: task.label,
          description: task.description,
          task_type: task.taskType,
          priority: 'high',
          execute_now: true,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Task execution failed');
      }

      setResults(prev => [{
        taskId: task.id,
        deliverable: data.deliverable,
        memberName: data.member?.name || task.memberName,
        completedAt: new Date().toLocaleTimeString(),
      }, ...prev]);

    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(null);
    }
  };

  const completedTaskIds = results.map(r => r.taskId);

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Sparkles className="w-5 h-5 text-yellow-500" />
            Quick Tasks - Assign Work to Your Board
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground mb-4">
            Click any task to have a board member produce it immediately. Results appear below.
          </p>
          
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-3">
            {QUICK_TASKS.map((task) => {
              const isLoading = loading === task.id;
              const isCompleted = completedTaskIds.includes(task.id);
              
              return (
                <Button
                  key={task.id}
                  variant={isCompleted ? "secondary" : "outline"}
                  className="h-auto py-3 px-4 flex flex-col items-start gap-1 text-left"
                  disabled={isLoading}
                  onClick={() => executeTask(task)}
                >
                  <div className="flex items-center gap-2 w-full">
                    {isLoading ? (
                      <Loader2 className="w-4 h-4 animate-spin" />
                    ) : isCompleted ? (
                      <CheckCircle className="w-4 h-4 text-green-500" />
                    ) : (
                      task.icon
                    )}
                    <span className="font-medium text-sm truncate">{task.label}</span>
                  </div>
                  <Badge variant="outline" className="text-xs">
                    {task.memberName}
                  </Badge>
                </Button>
              );
            })}
          </div>

          {error && (
            <div className="mt-4 p-3 bg-red-50 text-red-700 rounded-lg text-sm">
              {error}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Results */}
      {results.length > 0 && (
        <div className="space-y-4">
          <h3 className="text-lg font-semibold">Completed Deliverables</h3>
          {results.map((result, index) => (
            <Card key={`${result.taskId}-${index}`}>
              <CardHeader className="pb-2">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-base flex items-center gap-2">
                    <CheckCircle className="w-4 h-4 text-green-500" />
                    {QUICK_TASKS.find(t => t.id === result.taskId)?.label}
                  </CardTitle>
                  <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    <Badge variant="secondary">{result.memberName}</Badge>
                    <span>{result.completedAt}</span>
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                <div className="prose prose-sm max-w-none dark:prose-invert bg-muted/50 p-4 rounded-lg overflow-auto max-h-96">
                  <pre className="whitespace-pre-wrap text-sm font-sans">
                    {result.deliverable}
                  </pre>
                </div>
                <div className="mt-3 flex gap-2">
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => navigator.clipboard.writeText(result.deliverable)}
                  >
                    Copy to Clipboard
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}

export default QuickTasks;