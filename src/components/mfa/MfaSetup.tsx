// FILE: src/components/mfa/MfaSetup.tsx

import React, { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/lib/supabase';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { toast } from 'sonner';
import { Loader2, AlertTriangle, ShieldCheck, CheckCircle } from 'lucide-react';
import {
  Alert,
  AlertDescription,
  AlertTitle,
} from "@/components/ui/alert";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

interface MfaSetupProps {
  onSuccess: () => void;
}

export const MfaSetup: React.FC<MfaSetupProps> = ({ onSuccess }) => {
  const [qrCode, setQrCode] = useState<string | null>(null);
  const [factorId, setFactorId] = useState<string | null>(null);
  const [verificationCode, setVerificationCode] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [statusMessage, setStatusMessage] = useState('Initializing MFA Setup...');
  const [showResetConfirm, setShowResetConfirm] = useState(false);
  const [existingFactorId, setExistingFactorId] = useState<string | null>(null);
  const [setupComplete, setSetupComplete] = useState(false);

  // Skip MFA setup and mark as enrolled (user can enable later)
  const handleSkipMFA = async () => {
    setIsLoading(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Could not get user.");
      
      const { error: profileError } = await supabase
        .from('profiles')
        .update({ mfa_enrolled: true })
        .eq('id', user.id);

      if (profileError) throw profileError;

      toast.warning("MFA setup skipped. You can enable it later from your profile settings.");
      
      // Small delay then trigger success
      setTimeout(() => {
        onSuccess();
      }, 500);
    } catch (err: any) {
      setError(err.message);
      toast.error("Skip Failed", { description: err.message });
    } finally {
      setIsLoading(false);
    }
  };

  // Unenroll existing factor and re-enroll
  const handleResetAndReenroll = useCallback(async () => {
    setIsLoading(true);
    setShowResetConfirm(false);
    setStatusMessage('Removing existing MFA factor...');
    
    try {
      const { data: factorsData } = await supabase.auth.mfa.listFactors();
      
      if (factorsData && factorsData.totp && factorsData.totp.length > 0) {
        for (const factor of factorsData.totp) {
          try {
            const { error: unenrollError } = await supabase.auth.mfa.unenroll({
              factorId: factor.id,
            });
            
            if (unenrollError) {
              console.warn(`Could not unenroll factor ${factor.id}:`, unenrollError.message);
            } else {
              console.log(`Successfully unenrolled factor: ${factor.id}`);
            }
          } catch (e: any) {
            console.warn(`Error unenrolling factor ${factor.id}:`, e.message);
          }
        }
      }

      const { data: { session } } = await supabase.auth.getSession();
      if (session) {
        try {
          await fetch('/api/user/reset-mfa', {
            method: 'POST',
            headers: { 
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${session.access_token}`
            },
            body: JSON.stringify({ token: session.access_token }),
          });
        } catch (e) {
          console.log('Server-side MFA reset optional - continuing with client-side');
        }
      }

      toast.success("Existing MFA removed. Setting up new MFA...");
      
      await new Promise(resolve => setTimeout(resolve, 500));
      await enrollMfa(true);
      
    } catch (err: any) {
      console.error('Reset MFA error:', err);
      setError(err.message);
      toast.error("MFA Reset Failed", { 
        description: err.message,
        action: {
          label: "Skip Setup",
          onClick: handleSkipMFA
        }
      });
      setIsLoading(false);
    }
  }, []);

  // Main enrollment function
  const enrollMfa = useCallback(async (skipCheck = false) => {
    setIsLoading(true);
    setError(null);
    setQrCode(null);
    setFactorId(null);
    
    try {
      if (!skipCheck) {
        setStatusMessage('Checking existing MFA setup...');
        const { data: factorsData, error: factorsError } = await supabase.auth.mfa.listFactors();
        
        if (factorsError) {
          console.warn('Could not list MFA factors:', factorsError.message);
        } else if (factorsData && factorsData.totp && factorsData.totp.length > 0) {
          const verifiedFactor = factorsData.totp.find(f => f.status === 'verified');
          
          if (verifiedFactor) {
            setExistingFactorId(verifiedFactor.id);
            setShowResetConfirm(true);
            setIsLoading(false);
            return;
          }
          
          const unverifiedFactor = factorsData.totp.find(f => f.status === 'unverified');
          if (unverifiedFactor) {
            console.log('Found unverified factor, removing it first...');
            try {
              await supabase.auth.mfa.unenroll({ factorId: unverifiedFactor.id });
            } catch (e) {
              console.warn('Could not remove unverified factor:', e);
            }
          }
        }
      }

      setStatusMessage('Generating secure QR code...');
      
      const { data, error: enrollError } = await supabase.auth.mfa.enroll({
        factorType: 'totp',
        friendlyName: 'TagnetIQ Authenticator'
      });

      if (enrollError) {
        if (enrollError.message.includes('factor already exists') || 
            enrollError.message.includes('422') ||
            enrollError.status === 422) {
          setShowResetConfirm(true);
          setIsLoading(false);
          return;
        }
        throw enrollError;
      }

      if (!data || !data.totp) {
        throw new Error('Failed to generate MFA enrollment data');
      }

      setFactorId(data.id);
      setQrCode(data.totp.qr_code);
      setStatusMessage('');
      console.log('MFA enrollment initiated, factor ID:', data.id);

    } catch (err: any) {
      console.error('MFA enrollment error:', err);
      
      if (err.message?.includes('already') || err.status === 422) {
        setShowResetConfirm(true);
        setIsLoading(false);
        return;
      }
      
      setError(err.message);
      toast.error("MFA Setup Failed", { 
        description: err.message,
        action: {
          label: "Skip Setup",
          onClick: handleSkipMFA
        }
      });
    } finally {
      if (!showResetConfirm) {
        setIsLoading(false);
      }
    }
  }, []);

  useEffect(() => {
    enrollMfa();
  }, [enrollMfa]);

  // Verify the TOTP code
  const handleVerify = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!factorId) {
      toast.error("MFA setup not initialized. Please refresh and try again.");
      return;
    }
    
    if (!verificationCode || verificationCode.length !== 6) {
      toast.error("Please enter a valid 6-digit verification code.");
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      // Create a challenge
      const { data: challengeData, error: challengeError } = await supabase.auth.mfa.challenge({
        factorId: factorId,
      });
      
      if (challengeError) {
        throw new Error(`Challenge failed: ${challengeError.message}`);
      }

      // Verify the code
      const { error: verifyError } = await supabase.auth.mfa.verify({
        factorId: factorId,
        challengeId: challengeData.id,
        code: verificationCode,
      });
      
      if (verifyError) {
        throw new Error(`Verification failed: ${verifyError.message}`);
      }
      
      // Update profile to mark MFA as enrolled
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        const { error: profileError } = await supabase
          .from('profiles')
          .update({ mfa_enrolled: true })
          .eq('id', user.id);

        if (profileError) {
          console.warn('Could not update profile:', profileError.message);
        }
      }

      // Show success state
      setSetupComplete(true);
      setIsLoading(false);
      
      toast.success("MFA Enabled Successfully!", {
        description: "Your vault is now protected with two-factor authentication."
      });
      
      // Wait a moment to show success state, then proceed
      setTimeout(() => {
        console.log('[MfaSetup] Calling onSuccess callback...');
        onSuccess();
        
        // Force page reload as backup to ensure clean state
        setTimeout(() => {
          console.log('[MfaSetup] Forcing page reload for clean state...');
          window.location.reload();
        }, 500);
      }, 1500);

    } catch (err: any) {
      console.error('MFA verification error:', err);
      setError(err.message);
      toast.error("Verification Failed", { 
        description: err.message.includes('Invalid') 
          ? "The code you entered is incorrect. Please try again."
          : err.message
      });
      setIsLoading(false);
    }
  };

  // Success state - show confirmation before proceeding
  if (setupComplete) {
    return (
      <div className="flex flex-col items-center justify-center p-8 min-h-[300px]">
        <CheckCircle className="h-16 w-16 text-green-500 mb-4" />
        <h3 className="text-xl font-semibold text-green-600">MFA Setup Complete!</h3>
        <p className="text-muted-foreground mt-2">Your vault is now protected.</p>
        <div className="mt-4 flex items-center gap-2">
          <Loader2 className="h-4 w-4 animate-spin" />
          <span className="text-sm text-muted-foreground">Redirecting to vault...</span>
        </div>
      </div>
    );
  }

  // Loading state
  if (isLoading && !qrCode && !showResetConfirm) {
    return (
      <div className="flex flex-col items-center justify-center p-8">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
        <p className="mt-4 text-muted-foreground">{statusMessage}</p>
      </div>
    );
  }

  // Error state with recovery options
  if (error && !qrCode) {
    return (
      <div className="p-8 space-y-4">
        <Alert variant="destructive">
          <AlertTriangle className="h-4 w-4" />
          <AlertTitle>MFA Setup Error</AlertTitle>
          <AlertDescription>{error}</AlertDescription>
        </Alert>
        <div className="flex gap-2 justify-center">
          <Button onClick={() => {
            setError(null);
            enrollMfa();
          }}>
            Retry Setup
          </Button>
          <Button variant="outline" onClick={handleSkipMFA}>
            Skip MFA Setup
          </Button>
        </div>
      </div>
    );
  }

  return (
    <>
      {/* Reset Confirmation Dialog */}
      <AlertDialog open={showResetConfirm} onOpenChange={setShowResetConfirm}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2">
              <ShieldCheck className="h-5 w-5 text-primary" />
              Existing MFA Detected
            </AlertDialogTitle>
            <AlertDialogDescription className="space-y-2">
              <p>
                An existing MFA setup was found for your account. To set up a new authenticator, 
                we need to remove the existing one first.
              </p>
              <p className="text-sm text-amber-600 dark:text-amber-400">
                You will need to scan a new QR code with your authenticator app.
              </p>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className="flex-col sm:flex-row gap-2">
            <AlertDialogCancel onClick={() => setShowResetConfirm(false)}>
              Cancel
            </AlertDialogCancel>
            <AlertDialogAction 
              onClick={handleSkipMFA} 
              className="bg-secondary text-secondary-foreground hover:bg-secondary/80"
            >
              Skip MFA Setup
            </AlertDialogAction>
            <AlertDialogAction onClick={handleResetAndReenroll}>
              Reset & Setup New MFA
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Main Setup UI */}
      <div className="flex flex-col items-center p-4 max-w-md mx-auto">
        <h3 className="text-lg font-semibold">Set Up Authenticator App</h3>
        <p className="text-sm text-muted-foreground mt-1 text-center">
          Scan this QR code with your authenticator app (e.g., Google Authenticator, Authy).
        </p>

        {qrCode ? (
          <div className="p-4 my-4 bg-white rounded-lg shadow-sm">
            <img src={qrCode} alt="TOTP QR Code" className="w-48 h-48" />
          </div>
        ) : (
          <Alert className="my-4">
            <AlertTriangle className="h-4 w-4" />
            <AlertTitle>QR Code Not Available</AlertTitle>
            <AlertDescription>
              Unable to generate QR code. You can skip MFA setup for now and enable it later.
            </AlertDescription>
          </Alert>
        )}

        <form onSubmit={handleVerify} className="w-full space-y-4">
          <div className="space-y-2">
            <label htmlFor="verification-code" className="text-sm font-medium">
              Verification Code
            </label>
            <Input
              id="verification-code"
              type="text"
              inputMode="numeric"
              pattern="\d{6}"
              maxLength={6}
              placeholder="123456"
              value={verificationCode}
              onChange={(e) => setVerificationCode(e.target.value.replace(/\D/g, ''))}
              required
              disabled={isLoading || !qrCode}
              className="text-center text-lg tracking-widest"
            />
            <p className="text-xs text-muted-foreground text-center">
              Enter the 6-digit code from your authenticator app
            </p>
          </div>
          
          <Button 
            type="submit" 
            className="w-full" 
            disabled={isLoading || !qrCode || verificationCode.length !== 6}
          >
            {isLoading ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Verifying...
              </>
            ) : (
              'Verify & Enable MFA'
            )}
          </Button>
          
          <div className="relative">
            <div className="absolute inset-0 flex items-center">
              <span className="w-full border-t" />
            </div>
            <div className="relative flex justify-center text-xs uppercase">
              <span className="bg-background px-2 text-muted-foreground">Or</span>
            </div>
          </div>
          
          <Button 
            type="button" 
            variant="outline" 
            className="w-full" 
            onClick={handleSkipMFA}
            disabled={isLoading}
          >
            Skip MFA Setup
          </Button>
        </form>
        
        <p className="text-xs text-muted-foreground mt-4 text-center">
          MFA adds an extra layer of security to your account. You can enable it later from your profile settings.
        </p>
      </div>
    </>
  );
};