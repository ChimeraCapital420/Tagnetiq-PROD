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

  useEffect(() => {
    const enrollMfa = async () => {
      setIsLoading(true);
      setError(null);
      
      const { data, error } = await supabase.auth.mfa.enroll({
        factorType: 'totp',
      });

      if (error) {
        setError(error.message);
        toast.error("MFA Setup Failed", { description: error.message });
        setIsLoading(false);
        return;
      }

      setChallengeId(data.id);
      // The QR code is provided as a data URI
      setQrCode(data.totp.qr_code);
      setIsLoading(false);
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

    // First, challenge with the code
    const { data: challengeData, error: challengeError } = await supabase.auth.mfa.challenge({
      factorId: challengeId,
      code: verificationCode,
    });

    if (challengeError) {
      setError(challengeError.message);
      toast.error("Verification Failed", { description: challengeError.message });
      setIsLoading(false);
      return;
    }

    // If challenge is successful, verify it to complete enrollment
    const { error: verifyError } = await supabase.auth.mfa.verify({
      factorId: challengeId,
      challengeId: challengeData.id,
      code: verificationCode,
    });

    if (verifyError) {
        setError(verifyError.message);
        toast.error("Verification Failed", { description: verifyError.message });
        setIsLoading(false);
        return;
    }
    
    toast.success("MFA Enabled Successfully!");
    onSuccess();
    setIsLoading(false);
  };

  if (isLoading && !qrCode) {
    return (
      <div className="flex flex-col items-center justify-center p-8">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
        <p className="mt-4 text-muted-foreground">Generating secure QR code...</p>
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
            pattern="\d{6}"
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
