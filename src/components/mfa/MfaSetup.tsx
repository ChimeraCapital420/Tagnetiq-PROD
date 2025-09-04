// FILE: src/components/mfa/MfaSetup.tsx

import React, { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/lib/supabase';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { toast } from 'sonner';
import { Loader2 } from 'lucide-react';
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

  const handleConfirmReset = useCallback(async () => {
    setIsLoading(true);
    setStatusMessage('Resetting inconsistent MFA state via secure channel...');
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error("Authentication session not found for MFA reset.");

      const response = await fetch('/api/user/reset-mfa', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token: session.access_token }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(`Secure MFA reset failed: ${errorData.error}`);
      }
      
      toast.warning("Stale MFA setup detected and reset. Please re-enroll.");
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
      if (!skipCheck) {
        setStatusMessage('Verifying existing security factors...');
        const { data: factorsData, error: factorsError } = await supabase.auth.mfa.listFactors();
        if (factorsError) throw new Error(`Could not verify MFA status: ${factorsError.message}`);

        const existingFactor = factorsData.totp.find(f => f.status === 'verified');
        if (existingFactor) {
          // ACTIONABLE FIX: Prompt for confirmation instead of automatically resetting.
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
  }, []);

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

  if (isLoading && !qrCode) {
    return (
      <div className="flex flex-col items-center justify-center p-8">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
        <p className="mt-4 text-muted-foreground">{statusMessage}</p>
      </div>
    );
  }

  if (error) {
    return <div className="p-8 text-center text-destructive">{error}</div>;
  }

  return (
    <>
      <AlertDialog open={showResetConfirm} onOpenChange={setShowResetConfirm}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Existing MFA Detected</AlertDialogTitle>
            <AlertDialogDescription>
              An existing, verified authenticator setup was found for your account, but your Tagnetiq profile is out of sync. To proceed, we must reset your existing MFA configuration. You will need to re-scan a new QR code. Do you want to continue?
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => setShowResetConfirm(false)}>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleConfirmReset}>Yes, Reset MFA</AlertDialogAction>
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
              disabled={isLoading}
              />
          </div>
          <Button type="submit" className="w-full" disabled={isLoading}>
            {isLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Verify & Enable MFA'}
          </Button>
        </form>
      </div>
    </>
  );
};