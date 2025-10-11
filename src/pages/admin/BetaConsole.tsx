import React, { useState, useEffect } from 'react';
import { TriageTable } from '@/components/beta/TriageTable';
import { AdminAnalytics } from '@/components/beta/AdminAnalytics';
import { AdminInviteForm } from '@/components/beta/AdminInviteForm';
import { CerberusProvisioner } from '@/components/admin/CerberusProvisioner';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { supabase } from '@/lib/supabaseClient';
import { Bot, CheckCircle, AlertCircle, RefreshCw } from 'lucide-react';
import { Button } from '@/components/ui/button';

const BetaConsole: React.FC = () => {
  const [aiTestResults, setAiTestResults] = useState<any[]>([]);
  const [loadingAI, setLoadingAI] = useState(true);

  useEffect(() => {
    fetchAITestResults();
  }, []);

  async function fetchAITestResults() {
    try {
      // Query feedback table without assuming column names
      const { data, error } = await supabase
        .from('feedback')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(50); // Get more to filter through

      if (error) {
        console.error('Feedback query error:', error);
        // Don't throw, just handle gracefully
        setAiTestResults([]);
        return;
      }
      
      // Log first item structure for debugging
      if (data && data.length > 0) {
        console.log('Feedback table structure:', Object.keys(data[0]));
        console.log('Sample feedback item:', data[0]);
      }
      
      // Filter for AI tests based on multiple possible indicators
      const aiTests = (data || []).filter(item => {
        // Check metadata for AI markers
        if (item.metadata && typeof item.metadata === 'object') {
          if (item.metadata.test_scenario || 
              item.metadata.ai_evaluator ||
              item.metadata.purpose === 'automated_testing' ||
              item.metadata.is_ai_test) {
            return true;
          }
        }
        
        // Check if there's a comment field that contains AI markers
        if (item.comment && typeof item.comment === 'string') {
          const aiMarkers = ['ai_synthetic_test', 'AI Test', 'Cerberus', 'automated test'];
          return aiMarkers.some(marker => item.comment.toLowerCase().includes(marker.toLowerCase()));
        }
        
        // Check if there's a message field (alternative to comment)
        if (item.message && typeof item.message === 'string') {
          const aiMarkers = ['ai_synthetic_test', 'AI Test', 'Cerberus', 'automated test'];
          return aiMarkers.some(marker => item.message.toLowerCase().includes(marker.toLowerCase()));
        }
        
        // Check if user email indicates AI agent
        if (item.user_email && item.user_email.includes('@cerberus.tagnetiq.com')) {
          return true;
        }
        
        return false;
      });
      
      console.log(`Found ${aiTests.length} AI test results out of ${data?.length || 0} total feedback items`);
      setAiTestResults(aiTests);
      
    } catch (error) {
      console.error('Error fetching AI test results:', error);
      setAiTestResults([]);
    } finally {
      setLoadingAI(false);
    }
  }

  const refreshResults = () => {
    setLoadingAI(true);
    fetchAITestResults();
  };

  return (
    <div className="container mx-auto p-4 md:p-8">
      <div className="space-y-8">
        <div>
          <h1 className="text-3xl font-bold">Beta Program Admin Console</h1>
          <p className="text-muted-foreground">Manage testers, review feedback, and monitor program health.</p>
        </div>
        
        <AdminAnalytics />
        
        {/* Cerberus AI Test Results Section */}
        <Card className="border-purple-500/20">
          <CardHeader>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Bot className="h-5 w-5 text-purple-500" />
                <CardTitle>Cerberus AI Test Results</CardTitle>
              </div>
              <Button
                onClick={refreshResults}
                disabled={loadingAI}
                size="sm"
                variant="outline"
              >
                <RefreshCw className={`h-4 w-4 mr-2 ${loadingAI ? 'animate-spin' : ''}`} />
                Refresh
              </Button>
            </div>
            <CardDescription>
              Latest synthetic test results from AI agents testing the platform
            </CardDescription>
          </CardHeader>
          <CardContent>
            {loadingAI ? (
              <div className="flex items-center justify-center p-8">
                <RefreshCw className="h-6 w-6 animate-spin text-muted-foreground" />
                <span className="ml-2 text-sm text-muted-foreground">Loading AI test results...</span>
              </div>
            ) : aiTestResults.length === 0 ? (
              <div className="text-center p-8">
                <p className="text-sm text-muted-foreground mb-4">
                  No AI test results found yet.
                </p>
                <p className="text-xs text-muted-foreground">
                  Use the provisioner below to create an AI agent, then run tests to see results here.
                </p>
              </div>
            ) : (
              <div className="space-y-4">
                {aiTestResults.map((test) => {
                  // Extract the display text from comment or message field
                  const displayText = test.comment || test.message || test.feedback || 'No feedback text available';
                  const rating = test.rating || test.score || 0;
                  
                  return (
                    <div key={test.id} className="border rounded-lg p-4">
                      <div className="flex items-start justify-between">
                        <div className="flex-1">
                          <div className="flex items-center gap-2 mb-2">
                            <Badge variant="outline" className="text-purple-500">
                              {test.metadata?.ai_evaluator || 'AI Agent'}
                            </Badge>
                            <span className="text-sm text-muted-foreground">
                              {test.metadata?.test_scenario || test.category || 'Automated Test'}
                            </span>
                            {test.user_email && test.user_email.includes('@cerberus') && (
                              <Badge variant="secondary" className="text-xs">
                                Cerberus Agent
                              </Badge>
                            )}
                          </div>
                          
                          <div className="flex items-center gap-4 text-sm mb-2">
                            <span className="flex items-center gap-1">
                              {rating >= 7 ? (
                                <CheckCircle className="h-4 w-4 text-green-500" />
                              ) : rating >= 5 ? (
                                <AlertCircle className="h-4 w-4 text-yellow-500" />
                              ) : (
                                <AlertCircle className="h-4 w-4 text-red-500" />
                              )}
                              Score: {rating}/10
                            </span>
                            <span className="text-muted-foreground">
                              {new Date(test.created_at).toLocaleString()}
                            </span>
                          </div>
                          
                          <p className="text-sm whitespace-pre-wrap">{displayText}</p>
                          
                          {test.metadata && (
                            <>
                              {test.metadata.issues && Array.isArray(test.metadata.issues) && test.metadata.issues.length > 0 && (
                                <div className="mt-3 p-3 bg-red-50 dark:bg-red-950/20 rounded">
                                  <p className="text-sm font-medium mb-1 text-red-700 dark:text-red-400">Issues Found:</p>
                                  <ul className="text-xs list-disc list-inside space-y-1 text-red-600 dark:text-red-300">
                                    {test.metadata.issues.map((issue: string, i: number) => (
                                      <li key={i}>{issue}</li>
                                    ))}
                                  </ul>
                                </div>
                              )}
                              
                              {test.metadata.suggestions && Array.isArray(test.metadata.suggestions) && test.metadata.suggestions.length > 0 && (
                                <div className="mt-3 p-3 bg-blue-50 dark:bg-blue-950/20 rounded">
                                  <p className="text-sm font-medium mb-1 text-blue-700 dark:text-blue-400">Suggestions:</p>
                                  <ul className="text-xs list-disc list-inside space-y-1 text-blue-600 dark:text-blue-300">
                                    {test.metadata.suggestions.map((suggestion: string, i: number) => (
                                      <li key={i}>{suggestion}</li>
                                    ))}
                                  </ul>
                                </div>
                              )}
                              
                              {test.metadata.timestamp && (
                                <p className="text-xs text-muted-foreground mt-2">
                                  Test run: {new Date(test.metadata.timestamp).toLocaleString()}
                                </p>
                              )}
                            </>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })}
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