// FILE: src/pages/Onboarding.tsx

import React, { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Checkbox } from '@/components/ui/checkbox';
import { useNavigate } from 'react-router-dom';
import { toast } from 'sonner';
import { supabase } from '@/lib/supabase';
import { User } from '@supabase/supabase-js';

const INTERESTS_OPTIONS = [
  'Real Estate',
  'Vehicles', 
  'Collectibles',
  'Luxury Goods',
  'LEGO',
  'Star Wars',
  'Sports Memorabilia',
  'Books & Media',
  'Coins & Currency',
  'Trading Cards',
  'Art & Antiques',
  'Electronics'
];

const LANGUAGES = [
  { code: 'en', name: 'English' },
  { code: 'es', name: 'Spanish' },
  { code: 'fr', name: 'French' },
  { code: 'de', name: 'German' },
  { code: 'it', name: 'Italian' },
  { code: 'pt', name: 'Portuguese' },
  { code: 'ja', name: 'Japanese' },
  { code: 'zh', name: 'Chinese' }
];

const Onboarding: React.FC = () => {
  const navigate = useNavigate();
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [step, setStep] = useState(1);
  
  // Form data
  const [screenName, setScreenName] = useState('');
  const [fullName, setFullName] = useState('');
  const [languagePreference, setLanguagePreference] = useState('en');
  const [interests, setInterests] = useState<string[]>([]);
  const [locationText, setLocationText] = useState('');

  useEffect(() => {
    checkUser();
  }, []);

  const checkUser = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      navigate('/login');
      return;
    }
    setUser(user);
    
    // Check if already onboarded
    const { data: profile } = await supabase
      .from('profiles')
      .select('onboarding_complete')
      .eq('id', user.id)
      .single();
      
    if (profile?.onboarding_complete) {
      navigate('/dashboard');
    }
  };

  const handleInterestToggle = (interest: string) => {
    setInterests(prev => 
      prev.includes(interest) 
        ? prev.filter(i => i !== interest)
        : [...prev, interest]
    );
  };

  const handleComplete = async () => {
    if (!user) return;
    
    setIsLoading(true);
    try {
      // Update profile with onboarding data
      const { error } = await supabase
        .from('profiles')
        .update({
          screen_name: screenName,
          full_name: fullName,
          language_preference: languagePreference,
          interests,
          location_text: locationText,
          onboarding_complete: true,
          updated_at: new Date().toISOString()
        })
        .eq('id', user.id);

      if (error) throw error;

      toast.success('Welcome to TagnetIQ!', {
        description: 'Your profile has been set up successfully.'
      });
      
      navigate('/dashboard');
    } catch (error: any) {
      console.error('Onboarding error:', error);
      toast.error('Failed to complete onboarding', {
        description: error.message
      });
    } finally {
      setIsLoading(false);
    }
  };

  const renderStep = () => {
    switch(step) {
      case 1:
        return (
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="screenName">Screen Name</Label>
              <Input
                id="screenName"
                placeholder="Choose a unique username"
                value={screenName}
                onChange={(e) => setScreenName(e.target.value)}
                required
              />
              <p className="text-xs text-muted-foreground">
                This is how other users will see you
              </p>
            </div>
            <div className="space-y-2">
              <Label htmlFor="fullName">Full Name</Label>
              <Input
                id="fullName"
                placeholder="Your full name"
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="language">Preferred Language</Label>
              <Select value={languagePreference} onValueChange={setLanguagePreference}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {LANGUAGES.map(lang => (
                    <SelectItem key={lang.code} value={lang.code}>
                      {lang.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </CardContent>
        );
        
      case 2:
        return (
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label>What are you interested in?</Label>
              <p className="text-sm text-muted-foreground">
                Select all that apply - this helps us personalize your experience
              </p>
              <div className="grid grid-cols-2 gap-3 mt-4">
                {INTERESTS_OPTIONS.map(interest => (
                  <div key={interest} className="flex items-center space-x-2">
                    <Checkbox
                      id={interest}
                      checked={interests.includes(interest)}
                      onCheckedChange={() => handleInterestToggle(interest)}
                    />
                    <Label
                      htmlFor={interest}
                      className="text-sm font-normal cursor-pointer"
                    >
                      {interest}
                    </Label>
                  </div>
                ))}
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="location">Location (Optional)</Label>
              <Input
                id="location"
                placeholder="City, Country"
                value={locationText}
                onChange={(e) => setLocationText(e.target.value)}
              />
            </div>
          </CardContent>
        );
        
      default:
        return null;
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center p-4">
      <Card className="w-full max-w-2xl">
        <CardHeader>
          <CardTitle>Welcome to TagnetIQ!</CardTitle>
          <CardDescription>
            Let's set up your profile to get you started
          </CardDescription>
          <div className="flex justify-center space-x-2 mt-4">
            <div className={`h-2 w-16 rounded ${step >= 1 ? 'bg-primary' : 'bg-muted'}`} />
            <div className={`h-2 w-16 rounded ${step >= 2 ? 'bg-primary' : 'bg-muted'}`} />
          </div>
        </CardHeader>
        
        {renderStep()}
        
        <div className="flex justify-between p-6">
          <Button
            variant="ghost"
            onClick={() => setStep(Math.max(1, step - 1))}
            disabled={step === 1}
          >
            Back
          </Button>
          {step < 2 ? (
            <Button
              onClick={() => setStep(step + 1)}
              disabled={step === 1 && (!screenName || !fullName)}
            >
              Next
            </Button>
          ) : (
            <Button
              onClick={handleComplete}
              disabled={isLoading || interests.length === 0}
            >
              {isLoading ? 'Setting up...' : 'Complete Setup'}
            </Button>
          )}
        </div>
      </Card>
    </div>
  );
};

export default Onboarding;