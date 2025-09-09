// FILE: src/pages/SignUp.tsx

import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Link, useNavigate } from 'react-router-dom';
import { Eye, EyeOff } from 'lucide-react';
import { toast } from 'sonner';
import { supabase } from '@/lib/supabase';

const SignUp: React.FC = () => {
  const navigate = useNavigate();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);

  const handleSignUp = async () => {
    // Validation
    if (!email || !password) {
      toast.error('Please fill in all fields');
      return;
    }

    if (password !== confirmPassword) {
      toast.error('Passwords do not match.');
      return;
    }

    if (password.length < 6) {
      toast.error('Password must be at least 6 characters long');
      return;
    }

    setIsLoading(true);
    
    try {
      // Log the attempt
      console.log('Attempting signup for:', email);
      
      const { data, error } = await supabase.auth.signUp({
        email,
        password,
        options: {
          emailRedirectTo: `${window.location.origin}/auth/callback`,
          data: {
            // Add any metadata you want to store
            full_name: email.split('@')[0], // Default screen name from email
          }
        }
      });

      if (error) {
        // Log the full error for debugging
        console.error('Signup error:', error);
        
        // Handle specific error cases
        if (error.message.includes('duplicate')) {
          toast.error('Account already exists', { 
            description: 'Please sign in instead.' 
          });
          navigate('/login');
        } else if (error.message.includes('profiles')) {
          toast.error('Profile creation failed', { 
            description: 'There was an issue creating your profile. Please contact support.' 
          });
        } else {
          toast.error('Sign Up Failed', { 
            description: error.message 
          });
        }
      } else {
        console.log('Signup successful:', data);
        
        // Check if email confirmation is required
        if (data.user && !data.session) {
          toast.success('Success!', {
            description: 'Please check your email for a verification link.',
          });
          navigate('/login');
        } else if (data.session) {
          // User was automatically logged in (email confirmation disabled)
          toast.success('Account created successfully!');
          
          // Check if user has completed onboarding
          const { data: profile } = await supabase
            .from('profiles')
            .select('onboarding_completed')
            .eq('id', data.user.id)
            .single();
          
          if (profile?.onboarding_completed) {
            navigate('/onboarding');  // THIS IS THE ONLY CHANGE - was '/dashboard'
          } else {
            navigate('/onboarding');
          }
        }
      }
    } catch (err) {
      console.error('Unexpected error:', err);
      toast.error('An unexpected error occurred', {
        description: 'Please try again later.'
      });
    } finally {
      setIsLoading(false);
    }
  };
  
  const handleSubmit = (event: React.FormEvent) => {
    event.preventDefault();
    handleSignUp();
  };

  return (
    <div className="min-h-screen flex items-center justify-end p-4 md:p-8">
      <Card className="w-full max-w-sm bg-background/80 backdrop-blur-sm mr-0 md:mr-16">
        <form onSubmit={handleSubmit}>
          <CardHeader>
            <CardTitle>Create Account</CardTitle>
            <CardDescription>Enter your details to get started.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
              <Input 
                id="email" 
                type="email" 
                placeholder="m@example.com" 
                required 
                value={email} 
                onChange={(e) => setEmail(e.target.value)} 
                disabled={isLoading} 
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="password">Password</Label>
              <div className="relative">
                <Input 
                  id="password" 
                  type={showPassword ? 'text' : 'password'} 
                  required 
                  value={password} 
                  onChange={(e) => setPassword(e.target.value)} 
                  disabled={isLoading}
                  minLength={6}
                />
                <button
                  type="button"
                  className="absolute inset-y-0 right-0 z-10 flex items-center pr-3 text-muted-foreground"
                  onClick={() => setShowPassword(!showPassword)}
                >
                  {showPassword ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
                </button>
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="confirmPassword">Confirm Password</Label>
              <div className="relative">
                <Input 
                  id="confirmPassword" 
                  type={showConfirmPassword ? 'text' : 'password'} 
                  required 
                  value={confirmPassword} 
                  onChange={(e) => setConfirmPassword(e.target.value)} 
                  disabled={isLoading}
                  minLength={6}
                />
                <button
                  type="button"
                  className="absolute inset-y-0 right-0 z-10 flex items-center pr-3 text-muted-foreground"
                  onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                >
                  {showConfirmPassword ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
                </button>
              </div>
            </div>
          </CardContent>
          <CardFooter className="flex flex-col">
            <Button type="submit" className="w-full" disabled={isLoading}>
              {isLoading ? 'Creating Account...' : 'Create Account'}
            </Button>
            <p className="mt-4 text-xs text-center text-muted-foreground">
              Already have an account?{' '}
              <Link to="/login" className="underline">
                Sign in
              </Link>
            </p>
          </CardFooter>
        </form>
      </Card>
    </div>
  );
};

export default SignUp;