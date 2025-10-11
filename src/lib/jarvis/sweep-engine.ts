// src/lib/jarvis/sweep-engine.ts
import { EventEmitter } from 'events';
import { db } from '../../server/db';
import { watchlists, bounties, users } from '../../server/db/schema';
import { inArray, and, gte, sql } from 'drizzle-orm';

export interface SweepContext {
  userId: string;
  location?: { lat: number; lng: number };
  currentEnvironment?: 'garage-sale' | 'thrift-store' | 'estate-sale' | 'antique-mall' | 'unknown';
  recentScans: string[];
  activeHunts: string[];
}

export interface OpportunityAlert {
  type: 'personal-interest' | 'network-bounty' | 'trending-demand' | 'arbitrage' | 'authentication-needed';
  priority: 'low' | 'medium' | 'high' | 'critical';
  item: {
    description: string;
    estimatedValue?: { min: number; max: number };
    matchedCriteria?: string[];
  };
  networkContext?: {
    interestedUsers: number;
    activeWatchlists: number;
    bountyValue?: number;
    demandTrend: 'rising' | 'stable' | 'falling';
  };
  actionSuggestion: string;
  voiceAlert: string;
}

export class JarvisSweepEngine extends EventEmitter {
  private isActive = false;
  private sweepInterval: NodeJS.Timeout | null = null;
  private context: SweepContext;
  private opportunityQueue: OpportunityAlert[] = [];
  private processedItems = new Set<string>();

  constructor(context: SweepContext) {
    super();
    this.context = context;
  }

  async startProactiveSweep() {
    this.isActive = true;
    
    // Load network intelligence
    await this.loadNetworkIntelligence();
    
    // Start continuous sweep
    this.sweepInterval = setInterval(() => {
      if (this.isActive) {
        this.performSweep();
      }
    }, 2000); // Sweep every 2 seconds

    this.emit('sweep:started');
  }

  private async loadNetworkIntelligence() {
    // Load all active watchlists and bounties from the network
    const [networkWatchlists, activeBounties, trendingCategories] = await Promise.all([
      this.getNetworkWatchlists(),
      this.getActiveBounties(),
      this.getTrendingCategories()
    ]);

    this.context.activeHunts = [
      ...networkWatchlists.map(w => w.criteria),
      ...activeBounties.map(b => b.targetItem),
      ...trendingCategories
    ];
  }

  private async performSweep() {
    try {
      // Capture ambient visual data
      const visualData = await this.captureAmbientVisual();
      
      // Quick object detection using lightweight model
      const detectedObjects = await this.quickObjectDetection(visualData);
      
      // Cross-reference with network intelligence
      const opportunities = await this.analyzeOpportunities(detectedObjects);
      
      // Filter and prioritize
      const prioritizedOpps = this.prioritizeOpportunities(opportunities);
      
      // Emit alerts for high-value opportunities
      for (const opp of prioritizedOpps) {
        if (!this.processedItems.has(opp.item.description)) {
          this.processedItems.add(opp.item.description);
          this.emit('opportunity:detected', opp);
        }
      }
    } catch (error) {
      console.error('Sweep error:', error);
    }
  }

  private async quickObjectDetection(visualData: any): Promise<DetectedObject[]> {
    // Use Gemini Flash for ultra-fast object recognition
    const response = await fetch('/api/jarvis/quick-detect', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ 
        image: visualData,
        mode: 'speed-optimized',
        context: this.context.currentEnvironment
      })
    });

    return response.json();
  }

  private async analyzeOpportunities(objects: DetectedObject[]): Promise<OpportunityAlert[]> {
    const opportunities: OpportunityAlert[] = [];

    for (const obj of objects) {
      // Check personal interests
      const personalMatch = await this.checkPersonalInterests(obj);
      if (personalMatch) opportunities.push(personalMatch);

      // Check network bounties
      const bountyMatch = await this.checkNetworkBounties(obj);
      if (bountyMatch) opportunities.push(bountyMatch);

      // Check arbitrage opportunities
      const arbitrage = await this.checkArbitrageOpportunity(obj);
      if (arbitrage) opportunities.push(arbitrage);

      // Check authentication needs
      if (this.needsAuthentication(obj)) {
        opportunities.push(this.createAuthenticationAlert(obj));
      }
    }

    return opportunities;
  }

  private prioritizeOpportunities(opportunities: OpportunityAlert[]): OpportunityAlert[] {
    return opportunities
      .sort((a, b) => {
        const priorityWeight = { critical: 4, high: 3, medium: 2, low: 1 };
        return priorityWeight[b.priority] - priorityWeight[a.priority];
      })
      .slice(0, 3); // Top 3 opportunities
  }

  private async checkNetworkBounties(obj: DetectedObject): Promise<OpportunityAlert | null> {
    const bountyMatches = await db.select({
      bounty: bounties,
      interestedCount: sql<number>`COUNT(DISTINCT user_id)`
    })
    .from(bounties)
    .where(
      and(
        sql`SIMILARITY(${bounties.targetItem}, ${obj.description}) > 0.7`,
        gte(bounties.expiresAt, new Date())
      )
    )
    .groupBy(bounties.id)
    .limit(1);

    if (bountyMatches.length > 0) {
      const match = bountyMatches[0];
      return {
        type: 'network-bounty',
        priority: match.bounty.rewardAmount > 100 ? 'critical' : 'high',
        item: {
          description: obj.description,
          matchedCriteria: [`Bounty: ${match.bounty.targetItem}`]
        },
        networkContext: {
          interestedUsers: match.interestedCount,
          activeWatchlists: 0,
          bountyValue: match.bounty.rewardAmount,
          demandTrend: 'rising'
        },
        actionSuggestion: `Secure immediately - ${match.interestedCount} users seeking this item`,
        voiceAlert: `Critical opportunity: Network bounty match detected. ${match.bounty.targetItem}. Reward: $${match.bounty.rewardAmount}. Act fast.`
      };
    }

    return null;
  }

  private async getNetworkWatchlists() {
    return db.select()
      .from(watchlists)
      .where(sql`created_at > NOW() - INTERVAL '30 days'`)
      .limit(100);
  }

  private async getActiveBounties() {
    return db.select()
      .from(bounties)
      .where(gte(bounties.expiresAt, new Date()))
      .limit(50);
  }

  private async getTrendingCategories() {
    // Analyze recent successful sales and searches
    const trending = await db.execute(sql`
      SELECT category, COUNT(*) as demand_score
      FROM items
      WHERE created_at > NOW() - INTERVAL '7 days'
      GROUP BY category
      ORDER BY demand_score DESC
      LIMIT 10
    `);

    return trending.rows.map(r => r.category);
  }

  async stopSweep() {
    this.isActive = false;
    if (this.sweepInterval) {
      clearInterval(this.sweepInterval);
      this.sweepInterval = null;
    }
    this.emit('sweep:stopped');
  }
}

interface DetectedObject {
  description: string;
  confidence: number;
  boundingBox?: { x: number; y: number; width: number; height: number };
  estimatedCategory?: string;
}