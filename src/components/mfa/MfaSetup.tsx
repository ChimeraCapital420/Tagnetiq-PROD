// FILE: src/components/mfa/MfaSetup.tsx

import React, { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/lib/supabase';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { toast } from 'sonner';
import { Loader2, AlertTriangle } from 'lucide-react';
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
  const [challengeId, setChallengeId] = useState<string | null>(null);
  const [verificationCode, setVerificationCode] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [statusMessage, setStatusMessage] = useState('Initializing MFA Setup...');
  const [showResetConfirm, setShowResetConfirm] = useState(false);
  const [skipVerification, setSkipVerification] = useState(false);

  const handleConfirmReset = useCallback(async () => {
    setIsLoading(true);
    setStatusMessage('Resetting inconsistent MFA state via secure channel...');
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error("Authentication session not found for MFA reset.");

      const response = await fetch('/api/user/reset-mfa', {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session.access_token}`
        },
        body: JSON.stringify({ token: session.access_token }),
      });

      // Get response text first to check what's being returned
      const responseText = await response.text();
      
      if (!response.ok) {
        console.error('MFA Reset API Error:', {
          status: response.status,
          statusText: response.statusText,
          responseText: responseText.substring(0, 200) // First 200 chars
        });
        
        // Try to parse as JSON, but handle if it's HTML
        let errorMessage = `Server error (${response.status})`;
        try {
          const errorData = JSON.parse(responseText);
          errorMessage = errorData.error || errorMessage;
        } catch (e) {
          // Response wasn't JSON, probably HTML error page
          if (response.status === 404) {
            errorMessage = "MFA reset endpoint not found. Please contact support.";
          } else if (response.status === 500) {
            errorMessage = "Server error occurred. Try 'Skip Verification' instead.";
          } else {
            errorMessage = "Server error occurred. Please try again later.";
          }
        }
        throw new Error(errorMessage);
      }
      
      // Parse successful response
      const data = JSON.parse(responseText);
      
      toast.warning("Stale MFA setup detected and reset. Please re-enroll.");
      setShowResetConfirm(false);
      // After resetting, re-run the enrollment process
      enrollMfa(true); // Pass true to skip the check
    } catch (err: any) {
      setError(err.message);
      toast.error("MFA Reset Failed", { description: err.message });
      setIsLoading(false);
    }
  }, []);

  const enrollMfa = useCallback(async (skipCheck = false) => {
    setIsLoading(true);
    setError(null);
    
    try {
      if (!skipCheck && !skipVerification) {
        setStatusMessage('Verifying existing security factors...');
        const { data: factorsData, error: factorsError } = await supabase.auth.mfa.listFactors();
        if (factorsError) throw new Error(`Could not verify MFA status: ${factorsError.message}`);

        const existingFactor = factorsData.totp.find(f => f.status === 'verified');
        if (existingFactor) {
          setShowResetConfirm(true);
          setIsLoading(false);
          return;
        }
      }

      setStatusMessage('Generating secure QR code...');
      const { data, error: enrollError } = await supabase.auth.mfa.enroll({
        factorType: 'totp',
      });

      if (enrollError) throw enrollError;

      setChallengeId(data.id);
      setQrCode(data.totp.qr_code);
      setStatusMessage('');

    } catch (err: any) {
      setError(err.message);
      toast.error("MFA Setup Failed", { description: err.message });
    } finally {
      setIsLoading(false);
    }
  }, [skipVerification]);

  useEffect(() => {
    enrollMfa();
  }, [enrollMfa]);

  const handleVerify = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!challengeId || !verificationCode) {
      toast.error("Please enter the verification code.");
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      const { data: challengeData, error: challengeError } = await supabase.auth.mfa.challenge({
        factorId: challengeId,
      });
      if (challengeError) throw challengeError;

      const { error: verifyError } = await supabase.auth.mfa.verify({
        factorId: challengeId,
        challengeId: challengeData.id,
        code: verificationCode,
      });
      if (verifyError) throw verifyError;
      
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Could not get user to update profile.");
      
      const { error: profileError } = await supabase
        .from('profiles')
        .update({ mfa_enrolled: true })
        .eq('id', user.id);

      if (profileError) throw profileError;

      toast.success("MFA Enabled Successfully!");
      onSuccess();

    } catch (err: any) {
      setError(err.message);
      toast.error("Verification Failed", { description: err.message });
    } finally {
      setIsLoading(false);
    }
  };

  // Skip verification and mark as enrolled (temporary bypass)
  const handleSkipVerification = async () => {
    setIsLoading(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Could not get user.");
      
      // Just mark the profile as MFA enrolled without actually setting up MFA
      const { error: profileError } = await supabase
        .from('profiles')
        .update({ mfa_enrolled: true })
        .eq('id', user.id);

      if (profileError) throw profileError;

      toast.warning("MFA verification skipped. Please set up MFA from your profile settings.");
      onSuccess();
    } catch (err: any) {
      setError(err.message);
      toast.error("Skip Failed", { description: err.message });
    } finally {
      setIsLoading(false);
    }
  };

  if (isLoading && !qrCode) {
    return (
      <div className="flex flex-col items-center justify-center p-8">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
        <p className="mt-4 text-muted-foreground">{statusMessage}</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-8 space-y-4">
        <Alert variant="destructive">
          <AlertTriangle className="h-4 w-4" />
          <AlertTitle>MFA Setup Error</AlertTitle>
          <AlertDescription>{error}</AlertDescription>
        </Alert>
        <div className="flex gap-2 justify-center">
          <Button onClick={() => window.location.reload()}>Retry</Button>
          <Button variant="outline" onClick={handleSkipVerification}>
            Skip MFA Verification
          </Button>
        </div>
      </div>
    );
  }

  return (
    <>
      <AlertDialog open={showResetConfirm} onOpenChange={setShowResetConfirm}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Existing MFA Detected</AlertDialogTitle>
            <AlertDialogDescription>
              An existing, verified authenticator setup was found for your account, but your Tagnetiq profile is out of sync. You can either reset MFA or skip verification for now.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => setShowResetConfirm(false)}>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleSkipVerification} variant="outline">
              Skip Verification
            </AlertDialogAction>
            <AlertDialogAction onClick={handleConfirmReset}>
              Reset MFA
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <div className="flex flex-col items-center p-4">
        <h3 className="text-lg font-semibold">Set Up Authenticator App</h3>
        <p className="text-sm text-muted-foreground mt-1 text-center">
          Scan this QR code with your authenticator app (e.g., Google Authenticator, Authy).
        </p>

        {qrCode && (
          <div className="p-4 my-4 bg-white rounded-lg">
            <img src={qrCode} alt="TOTP QR Code" />
          </div>
        )}

        {!qrCode && (
          <Alert className="my-4">
            <AlertTriangle className="h-4 w-4" />
            <AlertTitle>QR Code Not Available</AlertTitle>
            <AlertDescription>
              Unable to generate QR code. You can skip verification for now and set up MFA later.
            </AlertDescription>
          </Alert>
        )}

        <form onSubmit={handleVerify} className="w-full max-w-xs space-y-4">
          <div className="space-y-2">
              <label htmlFor="verification-code" className="text-sm font-medium">Verification Code</label>
              <Input
              id="verification-code"
              type="text"
              inputMode="numeric"
              pattern="\\d{6}"
              placeholder="123456"
              value={verificationCode}
              onChange={(e) => setVerificationCode(e.target.value)}
              required
              disabled={isLoading || !qrCode}
              />
          </div>
          <Button type="submit" className="w-full" disabled={isLoading || !qrCode}>
            {isLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Verify & Enable MFA'}
          </Button>
          <Button 
            type="button" 
            variant="ghost" 
            className="w-full" 
            onClick={handleSkipVerification}
          >
            Skip MFA Setup (Not Recommended)
          </Button>
        </form>
      </div>
    </>
  );
};