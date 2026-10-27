/* Advisory aggregates only. Admission and ownership remain server-enforced. */
(() => {
  const root = document.querySelector('#shared-usage');
  // jquery.terminal handles document-level keys; disclosure keys belong to the browser.
  for (const type of ['keydown', 'keypress', 'keyup']) root.addEventListener(type, event => event.stopPropagation());
  const summary = document.querySelector('#usage-summary');
  const breakdown = document.querySelector('#usage-breakdown');
  const reset = document.querySelector('#usage-reset');
  const activity = document.querySelector('#usage-activity');
  const freshness = document.querySelector('#usage-freshness');
  const announcement = document.querySelector('#usage-announcement');
  let snapshot, receivedAt = 0, attemptedAt = 0, loading = false, failed = false, previousState;
  let interactionAt = 0, activitySentAt = 0, sendingActivity = false, fallbackId;
  const duration = ms => ms <= 0 ? '0 s' : ms < 60000 ? '<1 min' : `${Math.floor(ms / 60000)} min`;
  function render() {
    const age = Date.now() - receivedAt;
    const serverNow = snapshot ? snapshot.serverTime + age : 0;
    const stale = snapshot && (age > 90000 || serverNow >= snapshot.resetAt);
    const state = failed ? 'unavailable' : stale ? 'stale' : !snapshot ? 'loading' :
      snapshot.occupiedSlots >= snapshot.slotLimit || snapshot.remainingMs < snapshot.commandMs ? 'limited' : 'available';
    root.dataset.state = state;
    if (!snapshot) summary.textContent = failed ? 'Shared server · usage unavailable' : 'Shared server · checking usage…';
    else {
      const suffix = state === 'unavailable' ? ' · unavailable (last known)' : stale ? ' · stale (last known)' : '';
      summary.textContent = `Shared server · ${snapshot.occupiedSlots}/${snapshot.slotLimit} slots occupied · ≈${duration(snapshot.remainingMs)} daily allowance available${suffix}`;
      breakdown.textContent = `Daily allowance: ≈${duration(snapshot.consumedMs)} consumed · ≈${duration(snapshot.reservedMs)} reserved · ${duration(snapshot.dailyLimitMs)} total.`;
      const left = Math.max(0, snapshot.resetAt - serverNow);
      const minutes = Math.ceil(left / 60000);
      reset.textContent = left ? `Resets in ${Math.floor(minutes / 60)}h ${minutes % 60}m · ${new Date(snapshot.resetAt).toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' })} (local time; midnight UTC).` : 'Reset time reached; awaiting fresh usage.';
      activity.textContent = `≈${snapshot.activeBrowsers} active browsers in the last 15 minutes.`;
    }
    freshness.textContent = failed ? 'Usage unavailable. Commands can still be submitted; the server checks capacity.' : stale ? 'Usage is stale; awaiting an update.' : snapshot ? 'Approximate snapshot · refreshes once per minute while visible.' : 'Checking shared usage…';
    if (state !== previousState && state !== 'loading') {
      announcement.textContent = state === 'limited' ? 'Shared server capacity or daily allowance is currently limited. See shared usage details.' : state === 'available' ? 'Shared server usage updated; capacity is available in this snapshot.' : `Shared server usage ${state}. Commands remain available.`;
    }
    previousState = state;
  }
  async function refresh() {
    if (document.hidden || loading || Date.now() - attemptedAt < 5000) return;
    attemptedAt = Date.now(); loading = true;
    try {
      const response = await fetch('/api/usage', { credentials: 'same-origin', signal: AbortSignal.timeout(8000) });
      if (!response.ok) throw new Error('Usage unavailable');
      const next = await response.json();
      for (const name of ['serverTime', 'resetAt', 'slotLimit', 'dailyLimitMs', 'commandMs', 'occupiedSlots', 'consumedMs', 'reservedMs', 'remainingMs', 'activeBrowsers']) {
        if (!Number.isFinite(next[name]) || next[name] < 0) throw new Error('Invalid usage');
      }
      snapshot = next; receivedAt = Date.now(); failed = false;
    } catch { failed = true; }
    finally { loading = false; render(); }
  }
  async function sendActivity() {
    if (document.hidden || !interactionAt || interactionAt <= activitySentAt || Date.now() - interactionAt >= 900000 || sendingActivity || Date.now() - activitySentAt < 60000) return;
    sendingActivity = true;
    const send = async () => {
      let browserId, last = 0;
      try {
        browserId = localStorage.getItem('bibref-activity-id');
        if (!/^[0-9a-f-]{36}$/i.test(browserId || '')) {
          browserId = crypto.randomUUID(); localStorage.setItem('bibref-activity-id', browserId);
        }
        last = Number(localStorage.getItem('bibref-activity-sent')) || 0;
      } catch { browserId = fallbackId ||= crypto.randomUUID(); }
      if (Date.now() - last < 60000) { activitySentAt = last; return; }
      activitySentAt = Date.now();
      try {
        const response = await fetch('/api/activity', { method: 'POST', credentials: 'same-origin',
          headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ browserId }), signal: AbortSignal.timeout(8000) });
        if (response.ok) { try { localStorage.setItem('bibref-activity-sent', String(activitySentAt)); } catch {} }
      } catch { /* Metrics must not interrupt research. */ }
    };
    try {
      if (navigator.locks) await navigator.locks.request('bibref-activity', send);
      else await send();
    } finally { sendingActivity = false; }
  }
  function interact(event) {
    if (!event.isTrusted || document.hidden) return;
    interactionAt = Date.now(); void sendActivity();
  }
  for (const event of ['pointerdown', 'pointermove', 'keydown']) document.addEventListener(event, interact, { passive: true, capture: true });
  let outcomeTimer;
  window.addEventListener('bibref-usage-change', () => {
    interactionAt = document.hidden ? interactionAt : Date.now(); void sendActivity();
    clearTimeout(outcomeTimer);
    outcomeTimer = setTimeout(refresh, Math.max(0, 5000 - (Date.now() - attemptedAt)));
  });
  document.addEventListener('visibilitychange', () => { render(); if (!document.hidden) void refresh(); });
  setInterval(() => { if (!document.hidden) { void refresh(); void sendActivity(); } }, 60000);
  setInterval(() => { if (!document.hidden) render(); }, 1000);
  void refresh();
})();
