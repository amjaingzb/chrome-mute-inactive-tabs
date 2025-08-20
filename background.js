const lastActiveByWindow = new Map();
let lastFocusedWindowId = null;

// --- NEW: helpers to pause/resume YouTube Shorts ---
async function pauseShortsIfNeeded(tab) {
  if (!tab?.id) return;
  if (!tab.url || !tab.url.includes("youtube.com/shorts/")) return;

  try {
    await chrome.scripting.executeScript({
      target: { tabId: tab.id },
      func: () => {
        const video = document.querySelector("video");
        if (video && !video.paused) video.pause();
      },
    });
  } catch (e) {
    console.warn("Could not pause Shorts:", e);
  }
}

async function resumeShortsIfNeeded(tab) {
  if (!tab?.id) return;
  if (!tab.url || !tab.url.includes("youtube.com/shorts/")) return;

  try {
    await chrome.scripting.executeScript({
      target: { tabId: tab.id },
      func: () => {
        const video = document.querySelector("video");
        if (video && video.paused) {
          // May be blocked by autoplay policy on some setups; ok to ignore.
          video.play().catch(() => {});
        }
      },
    });
  } catch (e) {
    console.warn("Could not resume Shorts:", e);
  }
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
  const prevTabId = lastActiveByWindow.get(windowId);
  if (prevTabId && prevTabId !== tabId) {
    await safeUpdateMute(prevTabId, true); // mute the tab you just left (and pause Shorts if needed)
  }

  await safeUpdateMute(tabId, false);       // unmute the tab you switched to

  // NEW: if it's a Shorts tab, try to auto-resume
  try {
    const currentTab = await chrome.tabs.get(tabId);
    await resumeShortsIfNeeded(currentTab);
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

