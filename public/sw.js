// ─────────────────────────────────────────────────────────────
// PReminder Service Worker
// ─────────────────────────────────────────────────────────────
// Handles desktop notifications for stale PRs.
// Registered from the client-side notification permission flow.

const APP_URL = self.location.origin;
const _CHECK_INTERVAL_MS = 30 * 60 * 1000; // 30 minutes

// ─── Install & Activate ──────────────────────────────────────

self.addEventListener('install', () => {
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(self.clients.claim());
});

// ─── Push Notifications ──────────────────────────────────────

self.addEventListener('push', (event) => {
  if (!event.data) return;

  let payload;
  try {
    payload = event.data.json();
  } catch {
    payload = {
      title: 'PReminder',
      body: event.data.text(),
    };
  }

  const { title = 'PReminder', body, icon, data } = payload;

  event.waitUntil(
    self.registration.showNotification(title, {
      body,
      icon: icon || '/icon-192x192.png',
      badge: '/badge-72x72.png',
      tag: data?.prUrl || 'preminder',
      data: {
        url: data?.actionUrl || APP_URL + '/dashboard',
        prUrl: data?.prUrl,
      },
      actions: [
        { action: 'open-spa', title: 'Go to PReminder' },
        { action: 'view-pr', title: 'View PR' },
      ],
    }),
  );
});

// ─── Notification Click ──────────────────────────────────────

self.addEventListener('notificationclick', (event) => {
  event.notification.close();

  let targetUrl = APP_URL + '/dashboard';

  if (event.action === 'view-pr' && event.notification.data?.prUrl) {
    targetUrl = event.notification.data.prUrl;
  } else if (event.action === 'open-spa' || !event.action) {
    targetUrl = event.notification.data?.url || APP_URL + '/dashboard';
  }

  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clients) => {
      // Focus existing tab if open
      for (const client of clients) {
        if (client.url.startsWith(APP_URL) && 'focus' in client) {
          client.navigate(targetUrl);
          return client.focus();
        }
      }
      // Otherwise open a new window
      return self.clients.openWindow(targetUrl);
    }),
  );
});

// ─── Periodic Stale PR Check (via message from main thread) ─

self.addEventListener('message', (event) => {
  if (event.data?.type === 'CHECK_STALE_PRS') {
    checkStalePRs();
  }
});

async function checkStalePRs() {
  try {
    const res = await fetch(APP_URL + '/api/notifications/stale-prs', {
      credentials: 'include',
    });

    if (!res.ok) return;

    const { stalePRs } = await res.json();

    if (!stalePRs || stalePRs.length === 0) return;

    for (const pr of stalePRs) {
      await self.registration.showNotification(`PR #${pr.number} needs review`, {
        body: `"${pr.title}" in ${pr.repo} has been open for ${pr.ageInDays} days`,
        icon: '/icon-192x192.png',
        tag: `stale-pr-${pr.number}`,
        data: {
          url: APP_URL + '/dashboard',
          prUrl: pr.url,
        },
        actions: [
          { action: 'open-spa', title: 'Go to PReminder' },
          { action: 'view-pr', title: 'View PR' },
        ],
      });
    }
  } catch (err) {
    console.error('[SW] Failed to check stale PRs:', err);
  }
}
