// FILE: api/_lib/email.ts (CREATED NEW FILE)

import type { VercelResponse } from '@vercel/node';

const RESEND_API_KEY = process.env.RESEND_API_KEY;
const FROM_EMAIL = 'beta@tagnetiq.com'; // Or your verified Resend domain email

interface EmailPayload {
  to: string;
  subject: string;
  html: string;
}

/**
 * Sends an email using the Resend API.
 * @param {EmailPayload} payload - The email details.
 * @returns {Promise<boolean>} - True if the email was sent successfully.
 */
export async function sendEmail(payload: EmailPayload): Promise<boolean> {
  if (!RESEND_API_KEY) {
    console.warn('RESEND_API_KEY is not set. Email dispatch is disabled.');
    // In a development environment, we can consider this a "successful" send
    // to not block the invite flow. In production, this should throw an error.
    return process.env.NODE_ENV === 'development';
  }

  try {
    const response = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${RESEND_API_KEY}`,
      },
      body: JSON.stringify({
        from: `TagnetIQ Beta <${FROM_EMAIL}>`,
        to: payload.to,
        subject: payload.subject,
        html: payload.html,
      }),
    });

    if (!response.ok) {
      const errorBody = await response.json();
      console.error('Failed to send email via Resend:', errorBody);
      return false;
    }
    
    console.log(`Email successfully sent to ${payload.to}`);
    return true;

  } catch (error) {
    console.error('Error dispatching email:', error);
    return false;
  }
}