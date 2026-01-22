import { toast } from 'sonner';
import { APP_VERSION } from './constants.js';
import { supabase } from './supabase';

interface FeedbackPayload {
  tester_id: string;
  category: string;
  severity: string;
  message: string;
  route: string;
  device: Record<string, any>; 
  flags: Record<string, any>;
  app_version: string;
}

/**
 * Submits feedback to the backend API.
 */
export async function submitFeedback(payload: Omit<FeedbackPayload, 'app_version' | 'device' | 'flags'>) {
  try {
    // Get the current session for authentication
    const { data: { session } } = await supabase.auth.getSession();
    
    if (!session?.access_token) {
      toast.error('Authentication Required', {
        description: 'Please log in to submit feedback.',
      });
      return false;
    }

    const fullPayload: FeedbackPayload = {
      ...payload,
      app_version: APP_VERSION,
      device: {
        userAgent: navigator.userAgent,
        screen: `${window.screen.width}x${window.screen.height}`
      },
      flags: JSON.parse(localStorage.getItem('tagnetiq-beta-flags') || '{}'),
    };

    const response = await fetch('/api/feedback', {
      method: 'POST',
      headers: { 
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${session.access_token}`
      },
      body: JSON.stringify(fullPayload),
    });

    if (!response.ok) {
      const { error } = await response.json();
      throw new Error(error || 'Failed to submit feedback.');
    }

    toast.success('Feedback submitted!', {
      description: 'Thank you for helping us improve TagnetIQ.',
    });
    return true;

  } catch (error) {
    toast.error('Submission Failed', {
      description: (error as Error).message,
    });
    return false;
  }
}