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
      onSuccess();
    } catch (err: any) {
      setError(err.message);
      toast.error("Skip Failed", { description: err.message });
    } finally {
      setIsLoading(false);
    }
  };

  const handleConfirmReset = useCallback(async () => {
    setIsLoading(true);
    setStatusMessage('Resetting MFA configuration...');
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error("Authentication session not found.");

      const response = await fetch('/api/user/reset-mfa', {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session.access_token}`
        },
        body: JSON.stringify({ token: session.access_token }),
      });

      const responseText = await response.text();
      
      if (!response.ok) {
        console.error('MFA Reset API Error:', {
          status: response.status,
          statusText: response.statusText,
          responseText: responseText.substring(0, 200)
        });
        
        let errorMessage = `Server error (${response.status})`;
        try {
          const errorData = JSON.parse(responseText);
          errorMessage = errorData.error || errorMessage;
        } catch (e) {
          if (response.status === 500) {
            errorMessage = "Server error occurred. Try the 'Skip MFA Setup' option instead.";
          }
        }
        throw new Error(errorMessage);
      }
      
      const data = JSON.parse(responseText);
      
      toast.success("MFA has been reset. Setting up new MFA...");
      setShowResetConfirm(false);
      enrollMfa(true);
    } catch (err: any) {
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

  const enrollMfa = useCallback(async (skipCheck = false) => {
    setIsLoading(true);
    setError(null);
    
    try {
      if (!skipCheck) {
        setStatusMessage('Checking existing MFA setup...');
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
    return (
      <div className="p-8 space-y-4">
        <Alert variant="destructive">
          <AlertTriangle className="h-4 w-4" />
          <AlertTitle>MFA Setup Error</AlertTitle>
          <AlertDescription>{error}</AlertDescription>
        </Alert>
        <div className="flex gap-2 justify-center">
          <Button onClick={() => window.location.reload()}>Retry</Button>
          <Button variant="outline" onClick={handleSkipMFA}>
            Skip MFA Setup
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
              An existing MFA setup was found for your account. You can either reset it or skip MFA setup for now.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => setShowResetConfirm(false)}>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleSkipMFA} variant="outline">
              Skip MFA Setup
            </AlertDialogAction>
            <AlertDialogAction onClick={handleConfirmReset}>
              Reset MFA
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <div className="flex flex-col items-center p-4 max-w-md mx-auto">
        <h3 className="text-lg font-semibold">Set Up Authenticator App</h3>
        <p className="text-sm text-muted-foreground mt-1 text-center">
          Scan this QR code with your authenticator app (e.g., Google Authenticator, Authy).
        </p>

        {qrCode && (
          <div className="p-4 my-4 bg-white rounded-lg">
            <img src={qrCode} alt="TOTP QR Code" className="w-48 h-48" />
          </div>
        )}

        {!qrCode && (
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
              pattern="\\d{6}"
              placeholder="123456"
              value={verificationCode}
              onChange={(e) => setVerificationCode(e.target.value)}
              required
              disabled={isLoading || !qrCode}
            />
          </div>
          
          <Button 
            type="submit" 
            className="w-full" 
            disabled={isLoading || !qrCode}
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