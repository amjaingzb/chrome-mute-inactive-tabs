const lastActiveByWindow = new Map();
let lastFocusedWindowId = null;

// --- NEW: helpers to pause/resume YouTube Shorts ---
async function pauseShortsIfNeeded(tab) {
  if (!tab?.id || !tab.url?.includes("youtube.com/shorts/")) return;
  try {
    await chrome.scripting.executeScript({
      target: { tabId: tab.id },
      func: () => {
        const tryPause = (attempts = 3) => {
          const v = document.querySelector("video");
          if (v) { if (!v.paused) v.pause(); return; }
          if (attempts > 0) setTimeout(() => tryPause(attempts - 1), 150);
        };
        tryPause();
      },
    });
  } catch (e) { console.warn("Could not pause Shorts:", e); }
}

async function resumeShortsIfNeeded(tab) {
  if (!tab?.id || !tab.url?.includes("youtube.com/shorts/")) return;
  try {
    await chrome.scripting.executeScript({
      target: { tabId: tab.id },
      func: () => {
        const tryPlay = (attempts = 3) => {
          const v = document.querySelector("video");
          if (v) { if (v.paused) v.play().catch(() => {}); return; }
          if (attempts > 0) setTimeout(() => tryPlay(attempts - 1), 150);
        };
        tryPlay();
      },
    });
  } catch (e) { console.warn("Could not resume Shorts:", e); }
}

// --- existing: safe mute/unmute with an extra pause step on mute ---
async function safeUpdateMute(tabId, muted) {
  if (!tabId || tabId === -1) return;
  try {
    const tab = await chrome.tabs.get(tabId);

    if (muted) {
      // Leaving this tab: pause Shorts first.
      await pauseShortsIfNeeded(tab);
    }

    await chrome.tabs.update(tabId, { muted });
  } catch (_) {
    // Tab may have closed or become unavailable; ignore.
  }
}

// When you activate a tab, unmute it and mute the previous one in that window.
chrome.tabs.onActivated.addListener(async ({ tabId, windowId }) => {
  // If we don't yet know the previous tab for this window, treat this as first activation.
  if (!lastActiveByWindow.has(windowId)) {
    const tabsInWindow = await chrome.tabs.query({ windowId });

    for (const t of tabsInWindow) {
      if (t.id === tabId) continue;
      // Pause Shorts (if needed) before muting
      await pauseShortsIfNeeded(t);
      try { await chrome.tabs.update(t.id, { muted: true }); } catch {}
    }

    try { await chrome.tabs.update(tabId, { muted: false }); } catch {}
    try {
      const currentTab = await chrome.tabs.get(tabId);
      await resumeShortsIfNeeded(currentTab);
    } catch {}

    lastActiveByWindow.set(windowId, tabId);
    return; // done with the first-activation path
  }

  // Normal path (subsequent activations)
  const prevTabId = lastActiveByWindow.get(windowId);
  if (prevTabId && prevTabId !== tabId) {
    await safeUpdateMute(prevTabId, true); // mutes + pauses Shorts if needed
  }

  await safeUpdateMute(tabId, false);      // unmute current
  try {
    const currentTab = await chrome.tabs.get(tabId);
    await resumeShortsIfNeeded(currentTab); // auto-resume Shorts if applicable
  } catch {}

  lastActiveByWindow.set(windowId, tabId);
});


// When window focus changes, ensure only the focused window’s active tab is unmuted.
chrome.windows.onFocusChanged.addListener(async (windowId) => {
  if (windowId === chrome.windows.WINDOW_ID_NONE) return;

  if (lastFocusedWindowId !== null && lastFocusedWindowId !== windowId) {
    const prevTabId = lastActiveByWindow.get(lastFocusedWindowId);
    if (prevTabId) await safeUpdateMute(prevTabId, true);
  }

  const [activeTab] = await chrome.tabs.query({ windowId, active: true });
  if (activeTab) {
    await safeUpdateMute(activeTab.id, false);
    // NEW: auto-resume Shorts if applicable
    await resumeShortsIfNeeded(activeTab);
    lastActiveByWindow.set(windowId, activeTab.id);
  }

  lastFocusedWindowId = windowId;
});

// Clean up mapping if a tracked tab is closed.
chrome.tabs.onRemoved.addListener((tabId, removeInfo) => {
  const winId = removeInfo.windowId;
  if (lastActiveByWindow.get(winId) === tabId) {
    lastActiveByWindow.delete(winId);
  }
});

// Initialize on startup/installation: capture current active tabs.
async function bootstrap() {
  const windows = await chrome.windows.getAll({ populate: true });
  for (const win of windows) {
    const activeTab = win.tabs?.find(t => t.active);
    if (activeTab) {
      await safeUpdateMute(activeTab.id, false);
      lastActiveByWindow.set(win.id, activeTab.id);
    }
  }
  const focused = windows.find(w => w.focused);
  if (focused) lastFocusedWindowId = focused.id;
}

chrome.runtime.onStartup.addListener(bootstrap);
chrome.runtime.onInstalled.addListener(bootstrap);

bootstrap(); // run immediately so first switch has state

