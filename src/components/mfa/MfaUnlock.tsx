// FILE: src/components/mfa/MfaUnlock.tsx

import React, { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { toast } from 'sonner';
import { Loader2, ShieldCheck, AlertTriangle, RefreshCw } from 'lucide-react';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
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

interface MfaUnlockProps {
  onSuccess: () => void;
}

export const MfaUnlock: React.FC<MfaUnlockProps> = ({ onSuccess }) => {
  const [verificationCode, setVerificationCode] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [isVerifying, setIsVerifying] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [factorId, setFactorId] = useState<string | null>(null);
  const [showResetDialog, setShowResetDialog] = useState(false);
  const [mfaStateMismatch, setMfaStateMismatch] = useState(false);

  useEffect(() => {
    checkMfaStatus();
  }, []);

  const checkMfaStatus = async () => {
    setIsLoading(true);
    setError(null);
    
    try {
      const { data, error: listError } = await supabase.auth.mfa.listFactors();
      
      console.log('[MfaUnlock] listFactors result:', { data, error: listError });
      
      if (listError) {
        console.error('[MfaUnlock] Error listing factors:', listError);
        setError(`Could not retrieve MFA status: ${listError.message}`);
        toast.error("Error", { description: "Could not retrieve MFA status." });
        return;
      }

      // Check for verified TOTP factors
      const verifiedFactor = data?.totp?.find(factor => factor.status === 'verified');
      
      if (verifiedFactor) {
        console.log('[MfaUnlock] Found verified factor:', verifiedFactor.id);
        setFactorId(verifiedFactor.id);
        setMfaStateMismatch(false);
      } else {
        // STATE MISMATCH DETECTED!
        // Profile says mfa_enrolled=true, but no factors exist in Supabase
        console.warn('[MfaUnlock] MFA state mismatch - profile enrolled but no factors found');
        setMfaStateMismatch(true);
        setFactorId(null);
        
        // Check for unverified factors (incomplete setup)
        const unverifiedFactor = data?.totp?.find(factor => factor.status === 'unverified');
        if (unverifiedFactor) {
          setError("Your MFA setup was not completed. Please reset and try again.");
        } else {
          setError("Your MFA enrollment has expired or was removed. Please set up MFA again.");
        }
      }
    } catch (err: any) {
      console.error('[MfaUnlock] Unexpected error:', err);
      setError(`Unexpected error: ${err.message}`);
    } finally {
      setIsLoading(false);
    }
  };

  // Auto-fix the mismatch by resetting mfa_enrolled to false
  const handleResetMfa = async () => {
    setIsLoading(true);
    setShowResetDialog(false);
    
    try {
      const { data: { user } } = await supabase.auth.getUser();
      
      if (!user) {
        throw new Error('Not authenticated');
      }

      // First, clean up any orphaned factors in Supabase
      const { data: factorsData } = await supabase.auth.mfa.listFactors();
      if (factorsData?.totp) {
        for (const factor of factorsData.totp) {
          try {
            await supabase.auth.mfa.unenroll({ factorId: factor.id });
            console.log('[MfaUnlock] Cleaned up factor:', factor.id);
          } catch (e) {
            console.warn('[MfaUnlock] Could not unenroll factor:', e);
          }
        }
      }

      // Reset the profile flag
      const { error: profileError } = await supabase
        .from('profiles')
        .update({ mfa_enrolled: false })
        .eq('id', user.id);

      if (profileError) {
        throw profileError;
      }

      toast.success("MFA Reset Complete", {
        description: "Redirecting to MFA setup..."
      });

      // Reload the page to trigger the MFA setup flow
      // Since mfa_enrolled is now false, Vault.tsx will show MfaSetup
      setTimeout(() => {
        window.location.reload();
      }, 1000);

    } catch (err: any) {
      console.error('[MfaUnlock] Reset error:', err);
      setError(`Reset failed: ${err.message}`);
      toast.error("Reset Failed", { description: err.message });
      setIsLoading(false);
    }
  };

  const handleVerify = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!factorId) {
      toast.error("MFA factor not found. Please reset your MFA.");
      return;
    }
    
    if (!verificationCode || verificationCode.length !== 6) {
      toast.error("Please enter a valid 6-digit verification code.");
      return;
    }

    setIsVerifying(true);
    setError(null);

    try {
      const { data, error: verifyError } = await supabase.auth.mfa.challengeAndVerify({
        factorId,
        code: verificationCode,
      });

      console.log('[MfaUnlock] challengeAndVerify result:', { data, error: verifyError });

      if (verifyError) {
        console.error('[MfaUnlock] Verification failed:', verifyError);
        
        // User-friendly error messages
        if (verifyError.message.includes('Invalid') || verifyError.message.includes('invalid')) {
          setError("Invalid code. Please check your authenticator app and try again.");
          toast.error("Invalid Code", { 
            description: "Make sure you're using the correct account in your authenticator app." 
          });
        } else if (verifyError.message.includes('expired')) {
          setError("Code expired. Enter the new code from your authenticator.");
          toast.error("Code Expired");
        } else {
          setError(verifyError.message);
          toast.error("Verification Failed", { description: verifyError.message });
        }
        
        // Clear the input for retry
        setVerificationCode('');
      } else {
        console.log('[MfaUnlock] Verification successful!');
        toast.success("Vault Unlocked", {
          description: "Welcome to your secure vault."
        });
        onSuccess();
      }
    } catch (err: any) {
      console.error('[MfaUnlock] Unexpected error:', err);
      setError(`Error: ${err.message}`);
      toast.error("Error", { description: err.message });
    } finally {
      setIsVerifying(false);
    }
  };

  // Loading state
  if (isLoading) {
    return (
      <div className="flex flex-col items-center justify-center p-8 min-h-[300px]">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
        <p className="mt-4 text-muted-foreground">Checking security status...</p>
      </div>
    );
  }

  // MFA State Mismatch - Show Reset Option
  if (mfaStateMismatch) {
    return (
      <>
        <div className="flex flex-col items-center p-6 text-center max-w-md mx-auto">
          <AlertTriangle className="h-12 w-12 text-amber-500 mb-4" />
          <h3 className="text-lg font-semibold">MFA Setup Required</h3>
          <p className="text-sm text-muted-foreground mt-2">
            Your authenticator app is no longer linked to your account. 
            This can happen if you changed phones or reinstalled your authenticator app.
          </p>
          
          <Alert className="mt-4 text-left">
            <AlertTriangle className="h-4 w-4" />
            <AlertTitle>What happened?</AlertTitle>
            <AlertDescription>
              Your account shows MFA is enabled, but no authenticator is connected. 
              You'll need to set up MFA again with a new QR code.
            </AlertDescription>
          </Alert>

          <Button 
            onClick={() => setShowResetDialog(true)} 
            className="mt-6 w-full"
            size="lg"
          >
            <RefreshCw className="mr-2 h-4 w-4" />
            Reset & Setup New MFA
          </Button>
          
          <p className="text-xs text-muted-foreground mt-4">
            You'll scan a new QR code with your authenticator app.
          </p>
        </div>

        {/* Reset Confirmation Dialog */}
        <AlertDialog open={showResetDialog} onOpenChange={setShowResetDialog}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Reset MFA?</AlertDialogTitle>
              <AlertDialogDescription>
                This will remove your current MFA enrollment and let you set up a new authenticator. 
                You'll need to scan a new QR code with your authenticator app.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancel</AlertDialogCancel>
              <AlertDialogAction onClick={handleResetMfa}>
                Yes, Reset MFA
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </>
    );
  }

  // Normal Unlock Flow
  return (
    <div className="flex flex-col items-center p-6 text-center max-w-md mx-auto">
      <ShieldCheck className="h-12 w-12 text-primary mb-4" />
      <h3 className="text-lg font-semibold">Vault is Locked</h3>
      <p className="text-sm text-muted-foreground mt-1">
        Enter the 6-digit code from your authenticator app.
      </p>

      <form onSubmit={handleVerify} className="w-full max-w-xs space-y-4 mt-6">
        <div className="space-y-2">
          <label htmlFor="unlock-code" className="sr-only">Verification Code</label>
          <Input
            id="unlock-code"
            type="text"
            inputMode="numeric"
            pattern="\d{6}"
            maxLength={6}
            placeholder="000000"
            value={verificationCode}
            onChange={(e) => setVerificationCode(e.target.value.replace(/\D/g, ''))}
            required
            disabled={isVerifying}
            className="text-center text-2xl tracking-[0.5em] font-mono"
            autoComplete="one-time-code"
            autoFocus
          />
        </div>
        
        {error && (
          <p className="text-sm text-destructive">{error}</p>
        )}
        
        <Button 
          type="submit" 
          className="w-full" 
          size="lg"
          disabled={isVerifying || verificationCode.length !== 6}
        >
          {isVerifying ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              Verifying...
            </>
          ) : (
            'Unlock Vault'
          )}
        </Button>
      </form>

      {/* Help text with reset option */}
      <div className="mt-6 pt-4 border-t w-full">
        <p className="text-xs text-muted-foreground mb-2">
          Lost access to your authenticator?
        </p>
        <Button 
          variant="ghost" 
          size="sm"
          onClick={() => setShowResetDialog(true)}
          className="text-xs"
        >
          Reset MFA
        </Button>
      </div>

      {/* Reset Confirmation Dialog */}
      <AlertDialog open={showResetDialog} onOpenChange={setShowResetDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Reset MFA?</AlertDialogTitle>
            <AlertDialogDescription>
              This will remove your current authenticator and require you to set up a new one. 
              Only do this if you've lost access to your authenticator app.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleResetMfa}>
              Yes, Reset MFA
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};