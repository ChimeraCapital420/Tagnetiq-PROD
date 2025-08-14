// FILE: src/lib/analytics.ts
// A helper for firing off tracking events from the client-side.

import { getInvestorToken } from './investorAuth';

type EventType = 'portal_view'; // Add more as needed: 'doc_click', etc.

interface EventPayload {
  [key: string]: any;
}

/**
 * Fires a tracking event.
 * In a real implementation, this would hit an endpoint that records the event.
 * @param eventType - The type of event to track.
 * @param payload - Additional data associated with the event.
 */
export function trackEvent(eventType: EventType, payload: EventPayload = {}): void {
  const token = getInvestorToken();
  if (!token) {
    return;
  }

  const eventData = {
    token,
    eventType,
    ...payload,
    timestamp: new Date().toISOString(),
    url: window.location.href,
  };

  // navigator.sendBeacon('/api/investor/events', JSON.stringify(eventData));
  console.log('EVENT TRACKED:', eventData);
}