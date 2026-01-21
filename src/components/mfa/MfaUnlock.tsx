// FILE: src/components/mfa/MfaUnlock.tsx

import React, { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { toast } from 'sonner';
import { Loader2, ShieldCheck, AlertTriangle } from 'lucide-react';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';

interface MfaUnlockProps {
  onSuccess: () => void;
}

export const MfaUnlock: React.FC<MfaUnlockProps> = ({ onSuccess }) => {
  const [verificationCode, setVerificationCode] = useState('');
  const [isLoading, setIsLoading] = useState(true); // Start true while checking
  const [error, setError] = useState<string | null>(null);
  const [factorId, setFactorId] = useState<string | null>(null);
  const [debugInfo, setDebugInfo] = useState<string>('');

  useEffect(() => {
    const getMfaFactor = async () => {
      setIsLoading(true);
      setDebugInfo('Checking MFA factors...');
      
      try {
        const { data, error: listError } = await supabase.auth.mfa.listFactors();
        
        console.log('[MfaUnlock] listFactors result:', { data, error: listError });
        
        if (listError) {
          console.error('[MfaUnlock] Error listing factors:', listError);
          setError(`Could not retrieve MFA status: ${listError.message}`);
          setDebugInfo(`Error: ${listError.message}`);
          toast.error("Error", { description: "Could not retrieve MFA status." });
          return;
        }

        if (!data || !data.totp || data.totp.length === 0) {
          console.warn('[MfaUnlock] No TOTP factors found');
          setError("No MFA factors enrolled. Please set up MFA first.");
          setDebugInfo('No TOTP factors found in account');
          return;
        }

        // Log all factors for debugging
        console.log('[MfaUnlock] All TOTP factors:', data.totp.map(f => ({
          id: f.id,
          status: f.status,
          friendly_name: f.friendly_name
        })));

        // First try to find a verified factor
        let totpFactor = data.totp.find(factor => factor.status === 'verified');
        
        // If no verified factor, check for unverified (incomplete setup)
        if (!totpFactor) {
          const unverifiedFactor = data.totp.find(factor => factor.status === 'unverified');
          if (unverifiedFactor) {
            console.warn('[MfaUnlock] Found unverified factor - MFA setup incomplete');
            setError("MFA setup was not completed. Please reset and set up MFA again.");
            setDebugInfo(`Factor ${unverifiedFactor.id} is unverified - setup incomplete`);
            return;
          }
        }

        if (totpFactor) {
          console.log('[MfaUnlock] Using verified factor:', totpFactor.id);
          setFactorId(totpFactor.id);
          setDebugInfo(`Ready - Factor: ${totpFactor.id.substring(0, 8)}...`);
          setError(null);
        } else {
          console.error('[MfaUnlock] No verified MFA method found');
          setError("No verified MFA method found. Your authenticator may not be properly linked.");
          setDebugInfo('Factor exists but status is not "verified"');
        }
      } catch (err: any) {
        console.error('[MfaUnlock] Unexpected error:', err);
        setError(`Unexpected error: ${err.message}`);
        setDebugInfo(`Exception: ${err.message}`);
      } finally {
        setIsLoading(false);
      }
    };
    
    getMfaFactor();
  }, []);

  const handleVerify = async (e: React.FormEvent) => {
    e.preventDefault();
    
    console.log('[MfaUnlock] handleVerify called', { factorId, verificationCode });
    
    if (!factorId) {
      toast.error("MFA factor not identified. Please refresh the page.");
      return;
    }
    
    if (!verificationCode || verificationCode.length !== 6) {
      toast.error("Please enter a valid 6-digit verification code.");
      return;
    }

    setIsLoading(true);
    setError(null);
    setDebugInfo('Verifying code...');

    try {
      console.log('[MfaUnlock] Calling challengeAndVerify...');
      
      const { data, error: verifyError } = await supabase.auth.mfa.challengeAndVerify({
        factorId,
        code: verificationCode,
      });

      console.log('[MfaUnlock] challengeAndVerify result:', { data, error: verifyError });

      if (verifyError) {
        console.error('[MfaUnlock] Verification failed:', verifyError);
        setError(verifyError.message);
        setDebugInfo(`Verify error: ${verifyError.message}`);
        
        // Provide user-friendly error message
        if (verifyError.message.includes('Invalid') || verifyError.message.includes('invalid')) {
          toast.error("Invalid Code", { 
            description: "The code you entered is incorrect. Make sure you're using the right account in your authenticator app." 
          });
        } else if (verifyError.message.includes('expired')) {
          toast.error("Code Expired", { 
            description: "The code has expired. Please enter the new code from your authenticator." 
          });
        } else {
          toast.error("Unlock Failed", { description: verifyError.message });
        }
      } else {
        console.log('[MfaUnlock] Verification successful!');
        setDebugInfo('Success!');
        toast.success("Vault Unlocked", {
          description: "Your secure vault is now accessible."
        });
        onSuccess();
      }
    } catch (err: any) {
      console.error('[MfaUnlock] Unexpected error during verify:', err);
      setError(`Unexpected error: ${err.message}`);
      setDebugInfo(`Exception: ${err.message}`);
      toast.error("Error", { description: err.message });
    } finally {
      setIsLoading(false);
    }
  };

  // Show loading state while checking MFA status
  if (isLoading && !factorId) {
    return (
      <div className="flex flex-col items-center justify-center p-8">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
        <p className="mt-4 text-muted-foreground">Checking MFA status...</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col items-center p-4 text-center max-w-md mx-auto">
      <ShieldCheck className="h-12 w-12 text-primary mb-4" />
      <h3 className="text-lg font-semibold">Vault is Locked</h3>
      <p className="text-sm text-muted-foreground mt-1">
        Enter the code from your authenticator app to continue.
      </p>

      {/* Error Alert */}
      {error && !factorId && (
        <Alert variant="destructive" className="mt-4 text-left">
          <AlertTriangle className="h-4 w-4" />
          <AlertTitle>MFA Problem</AlertTitle>
          <AlertDescription>
            {error}
            <div className="mt-2">
              <Button 
                variant="outline" 
                size="sm"
                onClick={() => window.location.reload()}
              >
                Retry
              </Button>
            </div>
          </AlertDescription>
        </Alert>
      )}

      {/* Unlock Form - only show if we have a factorId */}
      {factorId && (
        <form onSubmit={handleVerify} className="w-full max-w-xs space-y-4 mt-6">
          <div className="space-y-2">
            <label htmlFor="unlock-code" className="sr-only">Verification Code</label>
            <Input
              id="unlock-code"
              type="text"
              inputMode="numeric"
              pattern="\d{6}"
              maxLength={6}
              placeholder="123456"
              value={verificationCode}
              onChange={(e) => setVerificationCode(e.target.value.replace(/\D/g, ''))}
              required
              disabled={isLoading}
              className="text-center text-lg tracking-widest"
              autoComplete="one-time-code"
            />
            <p className="text-xs text-muted-foreground">
              Enter the 6-digit code from your authenticator app
            </p>
          </div>
          
          {error && factorId && (
            <p className="text-sm text-destructive">{error}</p>
          )}
          
          <Button 
            type="submit" 
            className="w-full" 
            disabled={isLoading || verificationCode.length !== 6}
          >
            {isLoading ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Verifying...
              </>
            ) : (
              'Unlock Vault'
            )}
          </Button>
        </form>
      )}

      {/* Debug info - remove in production */}
      {process.env.NODE_ENV === 'development' && debugInfo && (
        <p className="text-xs text-gray-500 mt-4 font-mono">
          Debug: {debugInfo}
        </p>
      )}
    </div>
  );
};