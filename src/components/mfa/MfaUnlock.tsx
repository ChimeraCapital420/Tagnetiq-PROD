// FILE: src/components/mfa/MfaUnlock.tsx

import React, { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { toast } from 'sonner';
import { Loader2, ShieldCheck } from 'lucide-react';
import { AuthMfaChallengeResponse } from '@supabase/supabase-js';

interface MfaUnlockProps {
  onSuccess: () => void;
}

export const MfaUnlock: React.FC<MfaUnlockProps> = ({ onSuccess }) => {
  const [verificationCode, setVerificationCode] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [factorId, setFactorId] = useState<string | null>(null);

  useEffect(() => {
    // When the component loads, find the user's enrolled TOTP factor.
    const getMfaFactor = async () => {
      const { data, error } = await supabase.auth.mfa.listFactors();
      if (error) {
        toast.error("Error", { description: "Could not retrieve MFA status." });
        setError("Could not retrieve MFA status.");
        return;
      }
      const totpFactor = data.totp.find(factor => factor.status === 'verified');
      if (totpFactor) {
        setFactorId(totpFactor.id);
      } else {
        setError("No verified MFA method found for your account.");
      }
    };
    getMfaFactor();
  }, []);

  const handleVerify = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!factorId) {
      toast.error("MFA factor not identified.");
      return;
    }
    if (!verificationCode) {
      toast.error("Please enter your verification code.");
      return;
    }

    setIsLoading(true);
    setError(null);

    // Challenge and verify in one step for simplicity when unlocking.
    const { error } = await supabase.auth.mfa.challengeAndVerify({
      factorId,
      code: verificationCode,
    });

    if (error) {
      setError(error.message);
      toast.error("Unlock Failed", { description: "The code was incorrect. Please try again." });
      setIsLoading(false);
    } else {
      toast.success("Vault Unlocked");
      onSuccess();
      setIsLoading(false);
    }
  };

  return (
    <div className="flex flex-col items-center p-4 text-center">
        <ShieldCheck className="h-12 w-12 text-primary mb-4" />
        <h3 className="text-lg font-semibold">Vault is Locked</h3>
        <p className="text-sm text-muted-foreground mt-1">
            Enter the code from your authenticator app to continue.
        </p>

        <form onSubmit={handleVerify} className="w-full max-w-xs space-y-4 mt-6">
            <div className="space-y-2">
                <label htmlFor="unlock-code" className="sr-only">Verification Code</label>
                <Input
                id="unlock-code"
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
            {error && <p className="text-sm text-destructive">{error}</p>}
            <Button type="submit" className="w-full" disabled={isLoading || !factorId}>
            {isLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Unlock Vault'}
            </Button>
      </form>
    </div>
  );
};
