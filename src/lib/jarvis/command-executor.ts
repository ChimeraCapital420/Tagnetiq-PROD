// src/lib/jarvis/command-executor.ts
import { EventEmitter } from 'events';
import { db } from '../../server/db';
import { items, challenges, messages, watchlists } from '../../server/db/schema';

export interface JarvisCommand {
  action: 'vault' | 'challenge' | 'message' | 'watchlist' | 'bounty' | 'analyze' | 'sell';
  target?: string;
  params?: any;
  context?: any;
}

export class JarvisCommandExecutor extends EventEmitter {
  private userId: string;
  private activeContext: any = {};

  constructor(userId: string) {
    super();
    this.userId = userId;
  }

  async executeVoiceCommand(transcription: string): Promise<any> {
    const command = this.parseCommand(transcription);
    
    switch (command.action) {
      case 'vault':
        return this.executeVault(command);
      
      case 'challenge':
        return this.executeChallenge(command);
      
      case 'message':
        return this.executeMessage(command);
      
      case 'watchlist':
        return this.executeWatchlist(command);
      
      case 'bounty':
        return this.executeBounty(command);
      
      case 'analyze':
        return this.executeDeepAnalysis(command);
      
      case 'sell':
        return this.executeSell(command);
      
      default:
        throw new Error(`Unknown command: ${command.action}`);
    }
  }

  private parseCommand(transcription: string): JarvisCommand {
    const lowerText = transcription.toLowerCase();
    
    // Pattern matching for different commands
    if (lowerText.includes('vault') || lowerText.includes('save')) {
      return {
        action: 'vault',
        params: this.extractVaultParams(transcription)
      };
    }
    
    if (lowerText.includes('challenge') || lowerText.includes('arena')) {
      return {
        action: 'challenge',
        params: this.extractChallengeParams(transcription)
      };
    }
    
    if (lowerText.includes('message') || lowerText.includes('tell')) {
      return {
        action: 'message',
        target: this.extractMessageTarget(transcription),
        params: { message: this.extractMessageContent(transcription) }
      };
    }
    
    if (lowerText.includes('watch') || lowerText.includes('alert')) {
      return {
        action: 'watchlist',
        params: this.extractWatchlistParams(transcription)
      };
    }
    
    if (lowerText.includes('bounty') || lowerText.includes('reward')) {
      return {
        action: 'bounty',
        params: this.extractBountyParams(transcription)
      };
    }
    
    if (lowerText.includes('analyze') || lowerText.includes('deep dive')) {
      return {
        action: 'analyze',
        params: { fullAnalysis: true }
      };
    }
    
    if (lowerText.includes('sell') || lowerText.includes('list')) {
      return {
        action: 'sell',
        params: this.extractSellParams(transcription)
      };
    }
    
    throw new Error('Could not parse command');
  }

  private async executeVault(command: JarvisCommand) {
    // Use the current context (last analyzed item)
    const itemData = this.activeContext.lastAnalyzedItem;
    
    if (!itemData) {
      throw new Error('No item to vault. Analyze an item first.');
    }

    const response = await fetch('/api/vault/items', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        ...itemData,
        tags: command.params?.tags || [],
        notes: command.params?.notes || 'Added via Jarvis voice command'
      })
    });

    if (!response.ok) throw new Error('Failed to vault item');

    const result = await response.json();
    
    this.emit('command:executed', {
      action: 'vault',
      result,
      voiceResponse: `Item successfully vaulted. ${itemData.name} has been secured in your collection.`
    });

    return result;
  }

  private async executeChallenge(command: JarvisCommand) {
    const itemId = this.activeContext.lastVaultedItem?.id || command.params?.itemId;
    
    if (!itemId) {
      throw new Error('No item selected for challenge');
    }

    const challengeData = {
      itemId,
      type: command.params?.type || 'authenticity',
      wagerAmount: command.params?.wager || 0,
      timeLimit: command.params?.timeLimit || 24 * 60 * 60, // 24 hours default
      rules: command.params?.rules || 'Standard authenticity challenge rules apply'
    };

    const response = await fetch('/api/arena/challenge', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(challengeData)
    });

    if (!response.ok) throw new Error('Failed to create challenge');

    const result = await response.json();
    
    this.emit('command:executed', {
      action: 'challenge',
      result,
      voiceResponse: `Arena challenge created. ${result.participantCount} experts have been notified. Challenge expires in ${result.timeLimit / 3600} hours.`
    });

    return result;
  }

  private async executeMessage(command: JarvisCommand) {
    const { target, params } = command;
    
    // Find user by name or handle
    const targetUser = await this.findUserByName(target!);
    
    if (!targetUser) {
      throw new Error(`Could not find user: ${target}`);
    }

    const messageData = {
      recipientId: targetUser.id,
      content: params.message,
      metadata: {
        sentViaJarvis: true,
        context: this.activeContext.lastAnalyzedItem ? {
          itemId: this.activeContext.lastAnalyzedItem.id,
          itemName: this.activeContext.lastAnalyzedItem.name
        } : null
      }
    };

    const response = await fetch('/api/messages', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(messageData)
    });

    if (!response.ok) throw new Error('Failed to send message');

    const result = await response.json();
    
    this.emit('command:executed', {
      action: 'message',
      result,
      voiceResponse: `Message sent to ${targetUser.name}. They'll be notified immediately.`
    });

    return result;
  }

  private async executeSell(command: JarvisCommand) {
    const itemId = this.activeContext.lastVaultedItem?.id || command.params?.itemId;
    const platforms = command.params?.platforms || ['ebay', 'mercari', 'facebook'];
    
    // Generate optimized listings for each platform
    const listings = await Promise.all(
      platforms.map(async (platform: string) => {
        const response = await fetch('/api/marketplace/generate-listing', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            itemId,
            platform,
            pricing: command.params?.pricing || 'market-optimal',
            autoList: command.params?.autoList ?? true
          })
        });

        return response.json();
      })
    );

    this.emit('command:executed', {
      action: 'sell',
      result: { listings },
      voiceResponse: `Listings created on ${platforms.join(', ')}. 
                      Optimal price set at $${listings[0].price}. 
                      Expected to sell within ${listings[0].estimatedDays} days.`
    });

    return listings;
  }

  private extractVaultParams(transcription: string) {
    // Extract tags, categories, notes from natural language
    const tags = [];
    if (transcription.includes('vintage')) tags.push('vintage');
    if (transcription.includes('rare')) tags.push('rare');
    if (transcription.includes('mint')) tags.push('mint-condition');
    
    return { tags };
  }

  private async findUserByName(name: string) {
    // Search for user in database
    const result = await db.execute(sql`
      SELECT id, name, username 
      FROM users 
      WHERE LOWER(name) LIKE ${`%${name.toLowerCase()}%`}
      OR LOWER(username) LIKE ${`%${name.toLowerCase()}%`}
      LIMIT 1
    `);

    return result.rows[0];
  }

  updateContext(key: string, value: any) {
    this.activeContext[key] = value;
    this.emit('context:updated', { key, value });
  }

  getContext() {
    return this.activeContext;
  }
}