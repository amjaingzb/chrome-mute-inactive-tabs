// Keeps the last active tab per window so we only mute what you just left.
const lastActiveByWindow = new Map();
let lastFocusedWindowId = null;

async function safeUpdateMute(tabId, muted) {
  if (!tabId || tabId === -1) return;
  try {
    await chrome.tabs.update(tabId, { muted });
  } catch (_) {
    // Tab may have closed or become unavailable; ignore.
  }
}

// When you activate a tab, unmute it and mute the previous one in that window.
chrome.tabs.onActivated.addListener(async ({ tabId, windowId }) => {
  const prevTabId = lastActiveByWindow.get(windowId);
  if (prevTabId && prevTabId !== tabId) {
    await safeUpdateMute(prevTabId, true);   // mute the tab you just left
  }
  await safeUpdateMute(tabId, false);        // unmute the tab you switched to
  lastActiveByWindow.set(windowId, tabId);
});

// When window focus changes, ensure only the focused window’s active tab is unmuted.
chrome.windows.onFocusChanged.addListener(async (windowId) => {
  // If focus left Chrome entirely
  if (windowId === chrome.windows.WINDOW_ID_NONE) return;

  // Mute the last focused window's active tab (if different window)
  if (lastFocusedWindowId !== null && lastFocusedWindowId !== windowId) {
    const prevTabId = lastActiveByWindow.get(lastFocusedWindowId);
    if (prevTabId) await safeUpdateMute(prevTabId, true);
  }

  // Unmute the newly focused window's active tab
  const [activeTab] = await chrome.tabs.query({ windowId, active: true });
  if (activeTab) {
    await safeUpdateMute(activeTab.id, false);
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
      await safeUpdateMute(activeTab.id, false); // make sure current active is unmuted
      lastActiveByWindow.set(win.id, activeTab.id);
      // Optionally, mute all others in the window. Commented out to keep it minimal.
      // for (const t of win.tabs) if (t.id !== activeTab.id) await safeUpdateMute(t.id, true);
    }
  }
  const focused = windows.find(w => w.focused);
  if (focused) lastFocusedWindowId = focused.id;
}

chrome.runtime.onStartup.addListener(bootstrap);
chrome.runtime.onInstalled.addListener(bootstrap);

