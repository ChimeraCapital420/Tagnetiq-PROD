import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { Badge } from '@/components/ui/badge';
import { Brain, Zap, Sparkles, Bot, Cpu } from 'lucide-react';
import { HydraConsensus } from '@/types/hydra';

interface HydraConsensusDisplayProps {
  consensus: HydraConsensus;
}

export function HydraConsensusDisplay({ consensus }: HydraConsensusDisplayProps) {
  // Icon mapping for AI providers
  const providerIcons: Record<string, React.ReactNode> = {
    'OpenAI': <Brain className="h-4 w-4" />,
    'Anthropic': <Sparkles className="h-4 w-4" />,
    'Google': <Bot className="h-4 w-4" />,
    'Mistral': <Zap className="h-4 w-4" />,
    'Groq': <Cpu className="h-4 w-4" />
  };
  
  // Color mapping for providers
  const providerColors: Record<string, string> = {
    'OpenAI': 'bg-green-500',
    'Anthropic': 'bg-orange-500',
    'Google': 'bg-blue-500',
    'Mistral': 'bg-purple-500',
    'Groq': 'bg-pink-500'
  };
  
  // Calculate max weight for scaling
  const maxWeight = Math.max(...consensus.votes.map(v => v.weight));
  
  // Sort votes by weight
  const sortedVotes = [...consensus.votes].sort((a, b) => b.weight - a.weight);
  
  return (
    <Card className="w-full mt-4 border-border/50 bg-background/50 backdrop-blur-sm">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-lg font-medium flex items-center gap-2">
            <Brain className="h-5 w-5 text-primary" />
            Hydra AI Consensus Engine
          </CardTitle>
          <Badge 
            variant={consensus.consensus.confidence > 85 ? 'default' : 'secondary'}
            className="text-xs"
          >
            {consensus.consensus.confidence}% Confidence
          </Badge>
        </div>
      </CardHeader>
      <CardContent>
        <div className="space-y-3">
          <div className="text-sm text-muted-foreground mb-2">
            Synthesized from {consensus.consensus.totalVotes} AI models:
          </div>
          
          {sortedVotes.map((vote, index) => {
            const progressWidth = (vote.weight / maxWeight) * 100;
            const isLeadAI = index === 0;
            
            return (
              <div key={vote.providerId} className="space-y-1">
                <div className="flex items-center justify-between text-sm">
                  <div className="flex items-center gap-2">
                    <div className={`p-1 rounded ${providerColors[vote.providerName]} text-white`}>
                      {providerIcons[vote.providerName]}
                    </div>
                    <span className="font-medium">{vote.providerName}</span>
                    {isLeadAI && (
                      <Badge variant="outline" className="text-xs scale-90">
                        Lead AI
                      </Badge>
                    )}
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-muted-foreground">
                      {vote.responseTime}ms
                    </span>
                    <span className="font-mono text-sm font-semibold">
                      {vote.weight.toFixed(2)}
                    </span>
                  </div>
                </div>
                <Progress 
                  value={progressWidth} 
                  className="h-2"
                />
              </div>
            );
          })}
          
          <div className="pt-2 mt-3 border-t">
            <div className="flex justify-between items-center text-sm">
              <span className="text-muted-foreground">Analysis Quality:</span>
              <Badge 
                variant={
                  consensus.consensus.analysisQuality === 'OPTIMAL' ? 'default' :
                  consensus.consensus.analysisQuality === 'DEGRADED' ? 'secondary' : 'outline'
                }
                className="text-xs"
              >
                {consensus.consensus.analysisQuality}
              </Badge>
            </div>
            <div className="flex justify-between items-center text-sm mt-1">
              <span className="text-muted-foreground">Processing Time:</span>
              <span className="font-mono text-xs">{consensus.processingTime}ms</span>
            </div>
          </div>
          
          {/* Consensus explanation */}
          <div className="pt-2 text-xs text-muted-foreground">
            <details className="cursor-pointer">
              <summary className="hover:text-foreground transition-colors">
                How Hydra Consensus Works
              </summary>
              <p className="mt-2 leading-relaxed">
                Multiple AI models analyze your item simultaneously. Each model's vote is weighted 
                based on its expertise and confidence. The final valuation represents a weighted 
                consensus, providing superior accuracy compared to single-model analysis.
              </p>
            </details>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}