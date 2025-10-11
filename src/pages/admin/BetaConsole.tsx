import React, { useState, useEffect } from 'react';
import { TriageTable } from '@/components/beta/TriageTable';
import { AdminAnalytics } from '@/components/beta/AdminAnalytics';
import { AdminInviteForm } from '@/components/beta/AdminInviteForm';
import { CerberusProvisioner } from '@/components/admin/CerberusProvisioner';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { supabase } from '@/lib/supabaseClient';
import { Bot, CheckCircle, AlertCircle } from 'lucide-react';

const BetaConsole: React.FC = () => {
  const [aiTestResults, setAiTestResults] = useState<any[]>([]);
  const [loadingAI, setLoadingAI] = useState(true);

  useEffect(() => {
    fetchAITestResults();
  }, []);

  async function fetchAITestResults() {
    try {
      const { data, error } = await supabase
        .from('feedback')
        .select('*')
        .or('comment.ilike.%AI Test%,comment.ilike.%ai_synthetic_test%')
        .order('created_at', { ascending: false })
        .limit(10);

      if (error) throw error;
      
      // Filter for AI tests based on metadata or comment markers
      const aiTests = (data || []).filter(item => 
        item.metadata?.test_scenario || 
        item.metadata?.ai_evaluator ||
        item.comment?.includes('AI Test') ||
        item.comment?.includes('ai_synthetic_test')
      );
      
      setAiTestResults(aiTests);
    } catch (error) {
      console.error('Error fetching AI test results:', error);
    } finally {
      setLoadingAI(false);
    }
  }

  return (
    <div className="container mx-auto p-4 md:p-8">
      <div className="space-y-8">
        <div>
          <h1 className="text-3xl font-bold">Beta Program Admin Console</h1>
          <p className="text-muted-foreground">Manage testers, review feedback, and monitor program health.</p>
        </div>
        
        <AdminAnalytics />
        
        {/* New Cerberus AI Test Results Section */}
        <Card className="border-purple-500/20">
          <CardHeader>
            <div className="flex items-center gap-2">
              <Bot className="h-5 w-5 text-purple-500" />
              <CardTitle>Cerberus AI Test Results</CardTitle>
            </div>
            <CardDescription>
              Latest synthetic test results from AI agents testing the platform
            </CardDescription>
          </CardHeader>
          <CardContent>
            {loadingAI ? (
              <p className="text-sm text-muted-foreground">Loading AI test results...</p>
            ) : aiTestResults.length === 0 ? (
              <p className="text-sm text-muted-foreground">No AI test results yet. Use the provisioner below to create an AI agent, then run tests.</p>
            ) : (
              <div className="space-y-4">
                {aiTestResults.map((test) => (
                  <div key={test.id} className="border rounded-lg p-4">
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-2">
                          <Badge variant="outline" className="text-purple-500">
                            {test.metadata?.ai_evaluator || 'AI Agent'}
                          </Badge>
                          <span className="text-sm text-muted-foreground">
                            {test.metadata?.test_scenario || 'Unknown Test'}
                          </span>
                        </div>
                        
                        <div className="flex items-center gap-4 text-sm">
                          <span className="flex items-center gap-1">
                            {test.rating >= 7 ? (
                              <CheckCircle className="h-4 w-4 text-green-500" />
                            ) : (
                              <AlertCircle className="h-4 w-4 text-yellow-500" />
                            )}
                            Score: {test.rating}/10
                          </span>
                          <span className="text-muted-foreground">
                            {new Date(test.created_at).toLocaleString()}
                          </span>
                        </div>
                        
                        <p className="mt-2 text-sm">{test.comment}</p>
                        
                        {test.metadata?.issues && test.metadata.issues.length > 0 && (
                          <div className="mt-3 p-2 bg-muted rounded">
                            <p className="text-sm font-medium mb-1">Issues Found:</p>
                            <ul className="text-xs list-disc list-inside space-y-1">
                              {test.metadata.issues.map((issue: string, i: number) => (
                                <li key={i}>{issue}</li>
                              ))}
                            </ul>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
        
        <div className="grid gap-8 md:grid-cols-2">
          <AdminInviteForm />
          <CerberusProvisioner />
        </div>
        
        <TriageTable />
      </div>
    </div>
  );
};

export default BetaConsole;