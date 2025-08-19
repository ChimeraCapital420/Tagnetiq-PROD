// FILE: src/pages/Onboarding.tsx (REVISED FOR STATE SYNC)

import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { supabase, Profile } from '@/lib/supabase';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { toast } from 'sonner';
import { CATEGORIES } from '@/lib/constants';
import { Toggle } from '@/components/ui/toggle';

const OnboardingPage: React.FC = () => {
  const { user, setProfile } = useAuth(); // GET THE setProfile FUNCTION
  const navigate = useNavigate();
  const [screenName, setScreenName] = useState('');
  const [location, setLocation] = useState('');
  const [selectedInterests, setSelectedInterests] = useState<string[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  const handleInterestToggle = (categoryId: string) => {
    setSelectedInterests(prev =>
      prev.includes(categoryId)
        ? prev.filter(id => id !== categoryId)
        : [...prev, categoryId]
    );
  };

  const handleCompleteOnboarding = async () => {
    if (!user) {
      toast.error('You must be logged in to complete onboarding.');
      return;
    }
    if (!screenName || !location || selectedInterests.length === 0) {
      toast.error('Please fill out all fields to continue.');
      return;
    }

    setIsLoading(true);

    try {
      const { data, error } = await supabase
        .from('profiles')
        .update({
          screen_name: screenName,
          location_text: location,
          interests: selectedInterests,
          onboarding_complete: true,
          updated_at: new Date().toISOString(),
        })
        .eq('id', user.id)
        .select() // Ask Supabase to return the updated row
        .single(); // Expect only one row

      if (error) throw error;

      // Manually update the profile in the app's global state
      if (data) {
        setProfile(data as Profile);
      }

      toast.success('Profile setup complete! Welcome to TagnetIQ.');
      navigate('/dashboard', { replace: true }); // This will now work

    } catch (error) {
      toast.error('Failed to save profile.', { description: (error as Error).message });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center p-4 bg-background">
      <Card className="w-full max-w-2xl">
        <CardHeader>
          <CardTitle className="text-2xl">Welcome to TagnetIQ!</CardTitle>
          <CardDescription>Let's set up your profile. This will help us personalize your experience.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="screen-name">Choose a Screen Name</Label>
              <Input
                id="screen-name"
                placeholder="e.g., ResaleWizard"
                value={screenName}
                onChange={(e) => setScreenName(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="location">Where are you located?</Label>
              <Input
                id="location"
                placeholder="e.g., Denver, CO"
                value={location}
                onChange={(e) => setLocation(e.target.value)}
              />
            </div>
          </div>
          <div className="space-y-2">
            <Label>What are your primary interests?</Label>
            <p className="text-sm text-muted-foreground">Select all that apply. This helps tailor the AI to your needs.</p>
            <div className="flex flex-wrap gap-2 pt-2">
              {CATEGORIES.map(category => (
                <Toggle
                  key={category.id}
                  pressed={selectedInterests.includes(category.id)}
                  onPressedChange={() => handleInterestToggle(category.id)}
                  variant="outline"
                >
                  {category.name}
                </Toggle>
              ))}
            </div>
          </div>
          <Button onClick={handleCompleteOnboarding} disabled={isLoading} className="w-full">
            {isLoading ? 'Saving...' : 'Complete Setup & Enter App'}
          </Button>
        </CardContent>
      </Card>
    </div>
  );
};

export default OnboardingPage;