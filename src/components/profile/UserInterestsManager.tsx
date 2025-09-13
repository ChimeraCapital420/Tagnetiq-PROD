// FILE: src/components/profile/UserInterestsManager.tsx
// User interface for managing Oracle proactive intelligence preferences

import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Label } from '@/components/ui/label';
import { Brain, Plus, X, Loader2, Search, Tag, Building2 } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from 'sonner';
import { useTranslation } from 'react-i18next';
import { cn } from '@/lib/utils';

interface UserInterest {
  id: string;
  user_id: string;
  interest_type: 'category' | 'keyword' | 'brand';
  interest_value: string;
  created_at: string;
}

const INTEREST_TYPES = [
  { value: 'category', label: 'Category', icon: Tag, description: 'General product categories' },
  { value: 'keyword', label: 'Keyword', icon: Search, description: 'Specific search terms' },
  { value: 'brand', label: 'Brand', icon: Building2, description: 'Manufacturer or brand names' }
];

const CATEGORY_SUGGESTIONS = [
  'Comic Books', 'Trading Cards', 'Vintage Electronics', 'Watches', 
  'Sneakers', 'Vinyl Records', 'Action Figures', 'Video Games',
  'Coins', 'Stamps', 'Antiques', 'Jewelry', 'Art', 'Books'
];

const UserInterestsManager: React.FC = () => {
  const { session } = useAuth();
  const { t } = useTranslation();
  const [interests, setInterests] = useState<UserInterest[]>([]);
  const [loading, setLoading] = useState(true);
  const [adding, setAdding] = useState(false);
  const [newInterestType, setNewInterestType] = useState<'category' | 'keyword' | 'brand'>('category');
  const [newInterestValue, setNewInterestValue] = useState('');
  const [showSuggestions, setShowSuggestions] = useState(false);

  // Fetch user interests
  useEffect(() => {
    fetchInterests();
  }, [session]);

  const fetchInterests = async () => {
    if (!session) return;

    try {
      const response = await fetch('/api/user/interests', {
        headers: {
          'Authorization': `Bearer ${session.access_token}`
        }
      });

      if (response.ok) {
        const data = await response.json();
        setInterests(data.interests);
      }
    } catch (error) {
      console.error('Failed to fetch interests:', error);
      toast.error(t('oracle.interests.fetchError', 'Failed to load interests'));
    } finally {
      setLoading(false);
    }
  };

  const addInterest = async () => {
    if (!session || !newInterestValue.trim()) return;

    setAdding(true);
    try {
      const response = await fetch('/api/user/interests', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session.access_token}`
        },
        body: JSON.stringify({
          interest_type: newInterestType,
          interest_value: newInterestValue.trim()
        })
      });

      if (response.ok) {
        const newInterest = await response.json();
        setInterests([newInterest, ...interests]);
        setNewInterestValue('');
        toast.success(t('oracle.interests.added', 'Interest added successfully'));
      } else if (response.status === 409) {
        toast.error(t('oracle.interests.duplicate', 'This interest already exists'));
      } else {
        throw new Error('Failed to add interest');
      }
    } catch (error) {
      console.error('Failed to add interest:', error);
      toast.error(t('oracle.interests.addError', 'Failed to add interest'));
    } finally {
      setAdding(false);
    }
  };

  const removeInterest = async (id: string) => {
    if (!session) return;

    try {
      const response = await fetch(`/api/user/interests?id=${id}`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${session.access_token}`
        }
      });

      if (response.ok) {
        setInterests(interests.filter(i => i.id !== id));
        toast.success(t('oracle.interests.removed', 'Interest removed'));
      } else {
        throw new Error('Failed to remove interest');
      }
    } catch (error) {
      console.error('Failed to remove interest:', error);
      toast.error(t('oracle.interests.removeError', 'Failed to remove interest'));
    }
  };

  const getInterestIcon = (type: string) => {
    const interestType = INTEREST_TYPES.find(t => t.value === type);
    return interestType?.icon || Tag;
  };

  const getInterestColor = (type: string) => {
    switch (type) {
      case 'category': return 'bg-blue-500/10 text-blue-500 border-blue-500/20';
      case 'keyword': return 'bg-purple-500/10 text-purple-500 border-purple-500/20';
      case 'brand': return 'bg-green-500/10 text-green-500 border-green-500/20';
      default: return 'bg-gray-500/10 text-gray-500 border-gray-500/20';
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Brain className="h-5 w-5" />
          {t('oracle.interests.title', 'Proactive Intelligence')}
        </CardTitle>
        <CardDescription>
          {t('oracle.interests.description', 'Tell the Oracle what you\'re looking for, and it will alert you when it spots these items in your environment')}
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Add new interest form */}
        <div className="space-y-4">
          <div className="flex gap-2">
            <Select
              value={newInterestType}
              onValueChange={(value: any) => setNewInterestType(value)}
            >
              <SelectTrigger className="w-[140px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {INTEREST_TYPES.map((type) => (
                  <SelectItem key={type.value} value={type.value}>
                    <div className="flex items-center gap-2">
                      <type.icon className="h-4 w-4" />
                      {type.label}
                    </div>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            
            <div className="relative flex-1">
              <Input
                placeholder={t('oracle.interests.placeholder', 'Enter your interest...')}
                value={newInterestValue}
                onChange={(e) => setNewInterestValue(e.target.value)}
                onKeyPress={(e) => e.key === 'Enter' && addInterest()}
                onFocus={() => newInterestType === 'category' && setShowSuggestions(true)}
                onBlur={() => setTimeout(() => setShowSuggestions(false), 200)}
              />
              
              {/* Category suggestions dropdown */}
              {showSuggestions && newInterestType === 'category' && (
                <div className="absolute top-full left-0 right-0 mt-1 bg-popover border rounded-md shadow-lg z-10 max-h-48 overflow-y-auto">
                  {CATEGORY_SUGGESTIONS.filter(cat => 
                    cat.toLowerCase().includes(newInterestValue.toLowerCase())
                  ).map((suggestion) => (
                    <button
                      key={suggestion}
                      className="w-full text-left px-3 py-2 hover:bg-accent text-sm"
                      onClick={() => {
                        setNewInterestValue(suggestion);
                        setShowSuggestions(false);
                      }}
                    >
                      {suggestion}
                    </button>
                  ))}
                </div>
              )}
            </div>
            
            <Button
              onClick={addInterest}
              disabled={!newInterestValue.trim() || adding}
              size="icon"
            >
              {adding ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Plus className="h-4 w-4" />
              )}
            </Button>
          </div>
          
          <p className="text-xs text-muted-foreground">
            {INTEREST_TYPES.find(t => t.value === newInterestType)?.description}
          </p>
        </div>

        {/* Current interests list */}
        <div className="space-y-2">
          <Label className="text-sm text-muted-foreground">
            {t('oracle.interests.current', 'Your current interests')} ({interests.length})
          </Label>
          
          {loading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          ) : interests.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <Brain className="h-8 w-8 mx-auto mb-2 opacity-50" />
              <p className="text-sm">
                {t('oracle.interests.empty', 'No interests added yet')}
              </p>
            </div>
          ) : (
            <div className="flex flex-wrap gap-2">
              {interests.map((interest) => {
                const Icon = getInterestIcon(interest.interest_type);
                return (
                  <Badge
                    key={interest.id}
                    variant="outline"
                    className={cn(
                      "pl-2 pr-1 py-1.5 flex items-center gap-1.5",
                      getInterestColor(interest.interest_type)
                    )}
                  >
                    <Icon className="h-3 w-3" />
                    <span>{interest.interest_value}</span>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-4 w-4 ml-1 hover:bg-transparent"
                      onClick={() => removeInterest(interest.id)}
                    >
                      <X className="h-3 w-3" />
                    </Button>
                  </Badge>
                );
              })}
            </div>
          )}
        </div>

        {/* Info box */}
        <div className="rounded-lg bg-muted/50 p-4 text-sm space-y-2">
          <p className="font-medium">
            {t('oracle.interests.howItWorks', 'How it works:')}
          </p>
          <ul className="space-y-1 text-muted-foreground">
            <li>• {t('oracle.interests.tip1', 'The Oracle continuously scans your environment')}</li>
            <li>• {t('oracle.interests.tip2', 'When it spots items matching your interests, you\'ll get an alert')}</li>
            <li>• {t('oracle.interests.tip3', 'High-value items and Arena bounties get priority notifications')}</li>
          </ul>
        </div>
      </CardContent>
    </Card>
  );
};

export default UserInterestsManager;