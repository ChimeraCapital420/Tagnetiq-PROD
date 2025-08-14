import { toast } from 'sonner';
import { APP_VERSION } from './constants';

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
      headers: { 'Content-Type': 'application/json' },
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