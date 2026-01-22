// FILE: src/pages/Onboarding.tsx

import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Checkbox } from '@/components/ui/checkbox';
import { useNavigate } from 'react-router-dom';
import { toast } from 'sonner';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/contexts/AuthContext';
import { Sparkles, User, MapPin, Globe, Heart } from 'lucide-react';

const INTERESTS_OPTIONS = [
  { id: 'real-estate', label: 'Real Estate', icon: '🏠' },
  { id: 'vehicles', label: 'Vehicles', icon: '🚗' },
  { id: 'collectibles', label: 'Collectibles', icon: '🎨' },
  { id: 'luxury-goods', label: 'Luxury Goods', icon: '💎' },
  { id: 'lego', label: 'LEGO', icon: '🧱' },
  { id: 'star-wars', label: 'Star Wars', icon: '⭐' },
  { id: 'sports-memorabilia', label: 'Sports Memorabilia', icon: '🏆' },
  { id: 'books-media', label: 'Books & Media', icon: '📚' },
  { id: 'coins-currency', label: 'Coins & Currency', icon: '🪙' },
  { id: 'trading-cards', label: 'Trading Cards', icon: '🃏' },
  { id: 'art-antiques', label: 'Art & Antiques', icon: '🖼️' },
  { id: 'electronics', label: 'Electronics', icon: '📱' }
];

const LANGUAGES = [
  { code: 'en', name: 'English', flag: '🇺🇸' },
  { code: 'es', name: 'Spanish', flag: '🇪🇸' },
  { code: 'fr', name: 'French', flag: '🇫🇷' },
  { code: 'de', name: 'German', flag: '🇩🇪' },
  { code: 'it', name: 'Italian', flag: '🇮🇹' },
  { code: 'pt', name: 'Portuguese', flag: '🇵🇹' },
  { code: 'ja', name: 'Japanese', flag: '🇯🇵' },
  { code: 'zh', name: 'Chinese', flag: '🇨🇳' }
];

const Onboarding: React.FC = () => {
  const navigate = useNavigate();
  const { user, profile, setProfile } = useAuth();
  const [isLoading, setIsLoading] = useState(false);
  const [step, setStep] = useState(1);
  const totalSteps = 3;
  
  // Form data - pre-populate from existing profile if available
  const [screenName, setScreenName] = useState(profile?.screen_name || '');
  const [fullName, setFullName] = useState(profile?.full_name || '');
  const [languagePreference, setLanguagePreference] = useState(profile?.language_preference || 'en');
  const [interests, setInterests] = useState<string[]>(profile?.interests || []);
  const [locationText, setLocationText] = useState(profile?.location_text || '');

  const handleInterestToggle = (interestId: string) => {
    setInterests(prev => 
      prev.includes(interestId) 
        ? prev.filter(i => i !== interestId)
        : [...prev, interestId]
    );
  };

  const handleComplete = async () => {
    if (!user) return;
    
    setIsLoading(true);
    try {
      const updatedProfile = {
        screen_name: screenName.trim(),
        full_name: fullName.trim(),
        language_preference: languagePreference,
        interests,
        location_text: locationText.trim(),
        onboarding_complete: true,
        updated_at: new Date().toISOString()
      };

      const { error } = await supabase
        .from('profiles')
        .update(updatedProfile)
        .eq('id', user.id);

      if (error) throw error;

      // Update local profile state
      if (setProfile && profile) {
        setProfile({ ...profile, ...updatedProfile });
      }

      toast.success('Welcome to TagnetIQ! 🎉', {
        description: 'Your profile has been set up successfully. Let\'s get started!',
        duration: 5000
      });
      
      navigate('/dashboard');
    } catch (error: any) {
      console.error('Onboarding error:', error);
      toast.error('Failed to complete setup', {
        description: error.message || 'Please try again.'
      });
    } finally {
      setIsLoading(false);
    }
  };

  const canProceedStep1 = screenName.trim().length >= 3;
  const canProceedStep2 = interests.length >= 1;
  const canComplete = canProceedStep1 && canProceedStep2;

  const renderStepIndicator = () => (
    <div className="flex justify-center items-center space-x-2 mt-4">
      {[1, 2, 3].map((s) => (
        <div 
          key={s}
          className={`h-2 rounded-full transition-all duration-300 ${
            s === step ? 'w-8 bg-primary' : s < step ? 'w-4 bg-primary/60' : 'w-4 bg-muted'
          }`} 
        />
      ))}
    </div>
  );

  const renderStep = () => {
    switch(step) {
      case 1:
        return (
          <CardContent className="space-y-6">
            <div className="text-center pb-4">
              <User className="h-12 w-12 mx-auto text-primary mb-2" />
              <h3 className="text-lg font-semibold">Tell us about yourself</h3>
              <p className="text-sm text-muted-foreground">This helps personalize your experience</p>
            </div>
            
            <div className="space-y-2">
              <Label htmlFor="screenName">Username *</Label>
              <Input
                id="screenName"
                placeholder="Choose a unique username"
                value={screenName}
                onChange={(e) => setScreenName(e.target.value)}
                className="text-lg"
                autoFocus
              />
              <p className="text-xs text-muted-foreground">
                This is how other users will see you (min. 3 characters)
              </p>
            </div>
            
            <div className="space-y-2">
              <Label htmlFor="fullName">Full Name (Optional)</Label>
              <Input
                id="fullName"
                placeholder="Your full name"
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
              />
            </div>
            
            <div className="space-y-2">
              <Label htmlFor="language" className="flex items-center gap-2">
                <Globe className="h-4 w-4" />
                Preferred Language
              </Label>
              <Select value={languagePreference} onValueChange={setLanguagePreference}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {LANGUAGES.map(lang => (
                    <SelectItem key={lang.code} value={lang.code}>
                      <span className="flex items-center gap-2">
                        <span>{lang.flag}</span>
                        <span>{lang.name}</span>
                      </span>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </CardContent>
        );
        
      case 2:
        return (
          <CardContent className="space-y-6">
            <div className="text-center pb-4">
              <Heart className="h-12 w-12 mx-auto text-primary mb-2" />
              <h3 className="text-lg font-semibold">What are you interested in?</h3>
              <p className="text-sm text-muted-foreground">
                Select at least one to help us personalize your feed
              </p>
            </div>
            
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
              {INTERESTS_OPTIONS.map(interest => (
                <div 
                  key={interest.id} 
                  onClick={() => handleInterestToggle(interest.id)}
                  className={`
                    flex items-center gap-2 p-3 rounded-lg border cursor-pointer transition-all
                    ${interests.includes(interest.id) 
                      ? 'border-primary bg-primary/10 text-primary' 
                      : 'border-border hover:border-primary/50 hover:bg-muted/50'
                    }
                  `}
                >
                  <span className="text-lg">{interest.icon}</span>
                  <span className="text-sm font-medium">{interest.label}</span>
                </div>
              ))}
            </div>
            
            {interests.length > 0 && (
              <p className="text-center text-sm text-primary">
                {interests.length} interest{interests.length !== 1 ? 's' : ''} selected
              </p>
            )}
          </CardContent>
        );
        
      case 3:
        return (
          <CardContent className="space-y-6">
            <div className="text-center pb-4">
              <MapPin className="h-12 w-12 mx-auto text-primary mb-2" />
              <h3 className="text-lg font-semibold">Where are you located?</h3>
              <p className="text-sm text-muted-foreground">
                This helps us show relevant listings and currency
              </p>
            </div>
            
            <div className="space-y-2">
              <Label htmlFor="location">Location (Optional)</Label>
              <Input
                id="location"
                placeholder="City, State/Country"
                value={locationText}
                onChange={(e) => setLocationText(e.target.value)}
                className="text-lg"
                autoFocus
              />
              <p className="text-xs text-muted-foreground">
                e.g., "Los Angeles, CA" or "London, UK"
              </p>
            </div>

            {/* Summary Card */}
            <div className="mt-6 p-4 bg-muted/50 rounded-lg space-y-3">
              <h4 className="font-semibold text-sm">Your Profile Summary</h4>
              <div className="grid grid-cols-2 gap-2 text-sm">
                <div>
                  <span className="text-muted-foreground">Username:</span>
                  <span className="ml-2 font-medium">{screenName || '—'}</span>
                </div>
                <div>
                  <span className="text-muted-foreground">Language:</span>
                  <span className="ml-2 font-medium">
                    {LANGUAGES.find(l => l.code === languagePreference)?.flag} {LANGUAGES.find(l => l.code === languagePreference)?.name}
                  </span>
                </div>
                <div className="col-span-2">
                  <span className="text-muted-foreground">Interests:</span>
                  <span className="ml-2 font-medium">
                    {interests.length > 0 
                      ? interests.map(i => INTERESTS_OPTIONS.find(o => o.id === i)?.icon).join(' ')
                      : '—'
                    }
                  </span>
                </div>
              </div>
            </div>
          </CardContent>
        );
        
      default:
        return null;
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center p-4 bg-gradient-to-b from-background to-muted/20">
      <Card className="w-full max-w-lg shadow-xl">
        <CardHeader className="text-center">
          <div className="flex justify-center mb-2">
            <Sparkles className="h-8 w-8 text-primary" />
          </div>
          <CardTitle className="text-2xl">Welcome to TagnetIQ!</CardTitle>
          <CardDescription>
            Step {step} of {totalSteps} — Let's set up your profile
          </CardDescription>
          {renderStepIndicator()}
        </CardHeader>
        
        {renderStep()}
        
        <div className="flex justify-between p-6 pt-0">
          <Button
            variant="ghost"
            onClick={() => setStep(Math.max(1, step - 1))}
            disabled={step === 1}
          >
            Back
          </Button>
          
          {step < totalSteps ? (
            <Button
              onClick={() => setStep(step + 1)}
              disabled={step === 1 ? !canProceedStep1 : step === 2 ? !canProceedStep2 : false}
            >
              Continue
            </Button>
          ) : (
            <Button
              onClick={handleComplete}
              disabled={isLoading || !canComplete}
              className="min-w-[140px]"
            >
              {isLoading ? (
                <span className="flex items-center gap-2">
                  <span className="animate-spin">⏳</span>
                  Setting up...
                </span>
              ) : (
                <span className="flex items-center gap-2">
                  <Sparkles className="h-4 w-4" />
                  Complete Setup
                </span>
              )}
            </Button>
          )}
        </div>
      </Card>
    </div>
  );
};

export default Onboarding;