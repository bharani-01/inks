/**
 * Microsoft Clarity Analytics Integration
 * Session recording, heatmaps, scroll tracking, and user behavior analytics
 */

const DEFAULT_PROJECT_ID = import.meta.env.VITE_CLARITY_PROJECT_ID || '';

/**
 * Initialize Microsoft Clarity Tracking Script
 */
export function initClarity(projectId = DEFAULT_PROJECT_ID) {
  if (typeof window === 'undefined') return;

  const id = projectId || DEFAULT_PROJECT_ID;
  if (!id) {
    // If no project ID is configured yet, register a no-op queue so calls don't crash
    if (!window.clarity) {
      window.clarity = function () {
        (window.clarity.q = window.clarity.q || []).push(arguments);
      };
    }
    return;
  }

  // Prevent duplicate script injection
  if (document.getElementById('microsoft-clarity-script')) return;

  (function (c, l, a, r, i, t, y) {
    c[a] =
      c[a] ||
      function () {
        (c[a].q = c[a].q || []).push(arguments);
      };
    t = l.createElement(r);
    t.id = 'microsoft-clarity-script';
    t.async = 1;
    t.src = 'https://www.clarity.ms/tag/' + i;
    y = l.getElementsByTagName(r)[0];
    y.parentNode.insertBefore(t, y);
  })(window, document, 'clarity', 'script', id);
}

/**
 * Identify authenticated user in Clarity session recordings
 * Allows searching recordings by User ID, Name, Role in the Clarity dashboard
 */
export function identifyUser(user) {
  if (typeof window === 'undefined' || !window.clarity || !user) return;

  try {
    const customId = String(user.id);
    const friendlyName = user.name || user.email || `User #${user.id}`;
    
    // Clarity Identify API: clarity("identify", customId, customSessionId, customPageId, friendlyName)
    window.clarity('identify', customId, undefined, undefined, friendlyName);
    
    // Set custom session attributes
    if (user.role) window.clarity('set', 'role', user.role);
    if (user.email) window.clarity('set', 'email', user.email);
  } catch (err) {
    console.warn('[Clarity] identify error:', err);
  }
}

/**
 * Track custom business event in Clarity (e.g. order_created, wallet_paid)
 */
export function trackClarityEvent(eventName) {
  if (typeof window === 'undefined' || !window.clarity || !eventName) return;

  try {
    window.clarity('event', eventName);
  } catch (err) {
    console.warn('[Clarity] event track error:', err);
  }
}

/**
 * Set custom metadata tag in Clarity
 */
export function setClarityTag(key, value) {
  if (typeof window === 'undefined' || !window.clarity || !key) return;

  try {
    window.clarity('set', key, String(value));
  } catch (err) {
    console.warn('[Clarity] set tag error:', err);
  }
}
