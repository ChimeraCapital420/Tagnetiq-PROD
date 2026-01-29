// FILE: src/hooks/useWelcomeMessage.ts
// Hook to send welcome message after onboarding

import { useEffect, useRef } from 'react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/contexts/AuthContext';

export const useWelcomeMessage = () => {
  const { user, profile } = useAuth();
  const sentRef = useRef(false);

  useEffect(() => {
    // Only run once per session, after onboarding is complete
    if (!user || !profile || !profile.onboarding_complete || sentRef.current) {
      return;
    }

    const sendWelcome = async () => {
      try {
        sentRef.current = true;
        
        const { data: { session } } = await supabase.auth.getSession();
        if (!session) return;

        const response = await fetch('/api/user/send-welcome-message', {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${session.access_token}`,
          },
        });

        if (response.ok) {
          const data = await response.json();
          if (!data.already_sent && !data.skipped) {
            console.log('Welcome message sent to new user');
          }
        }
      } catch (error) {
        // Silent fail - welcome message is not critical
        console.log('Welcome message could not be sent:', error);
      }
    };

    // Small delay to not interfere with onboarding completion
    const timer = setTimeout(sendWelcome, 2000);
    return () => clearTimeout(timer);
  }, [user, profile]);
};

export default useWelcomeMessage;