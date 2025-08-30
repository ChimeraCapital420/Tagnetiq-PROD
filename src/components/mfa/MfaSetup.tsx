// FILE: src/components/mfa/MfaSetup.tsx

import React, { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { toast } from 'sonner';
import { Loader2 } from 'lucide-react';

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

  useEffect(() => {
    const enrollMfa = async () => {
      setIsLoading(true);
      setError(null);
      
      try {
        setStatusMessage('Verifying existing security factors...');
        const { data: factorsData, error: factorsError } = await supabase.auth.mfa.listFactors();
        if (factorsError) throw new Error(`Could not verify MFA status: ${factorsError.message}`);

        const existingFactor = factorsData.totp.find(f => f.status === 'verified');
        if (existingFactor) {
          setStatusMessage('Resetting inconsistent MFA state via secure channel...');
          
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
    };

    enrollMfa();
  }, []);

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
        code: verificationCode,
      });
      if (challengeError) throw challengeError;

      const { error: verifyError } = await supabase.auth.mfa.verify({
        factorId: challengeId,
        challengeId: challengeData.id,
        code: verificationCode,
      });
      if (verifyError) throw verifyError;
      
      // CHARON: After successful verification, we must explicitly update the user's profile.
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
  );
};