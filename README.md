# Smart Tab Muter & YouTube Shorts Manager

A lightweight, high-performance Chrome Extension (Manifest V3) designed for seamless multitasking. It automatically mutes inactive tabs and intelligently pauses/resumes YouTube Shorts right where you left off, ensuring your media stays synchronized without background resource drain.

---

## ✨ Key Features

* **Smart Tab Audio Management:** Automatically mutes audio on background tabs and instantly unmutes your active workspace tab.
* **YouTube Shorts State Preservation:** Dynamically tracks active YouTube Shorts streams. When you switch away, it pauses the active short and records its state; when you return, it automatically resumes playback *only* if it was paused by the extension (fully respecting your manual manual pauses!).
* **Instant Toggle Hotkey:** Use `Alt + Shift + M` at any time to toggle the extension on or off instantly, complete with an indicator badge.
* **Zero Bloat:** Built using Manifest V3 service workers with minimal resource consumption and zero external tracking dependencies.

---

## 🚀 Quick Installation Guide

Since this extension is packaged for developers and privacy-conscious users, you can install it locally in under a minute:

1. **Download the Release:** Go to the [Releases](https://github.com/amjaingzb/chrome-mute-inactive-tabs/releases) page, download the **`Source code (zip)`** for the latest release (`v1.0.0`), and extract it to a folder on your computer.
2. **Open Extensions Page:** Open Google Chrome, type `chrome://extensions/` in the address bar, and press Enter.
3. **Enable Developer Mode:** Toggle the **Developer mode** switch in the top-right corner of the extensions page.
4. **Load the Extension:** Click the **Load unpacked** button in the top-left corner and select your extracted extension folder.

---

## ⌨️ Keyboard Shortcuts

* **`Alt + Shift + M`**: Enable or disable the extension globally. *(Note: You can customize this shortcut anytime under `chrome://extensions/shortcuts`)*.

---

## 🛠️ Technical Stack

* **Architecture:** Chrome Extension Manifest V3 (Service Worker)
* **APIs Used:** `chrome.tabs`, `chrome.scripting`, `chrome.commands`, `chrome.action`
* **DOM Targeting:** Resilient multi-selector matching (`#shorts-player`, active reel renderers, and standard HTML5 video elements) to handle YouTube's dynamic single-page architecture.

---

## 🤝 Contributing & Feedback

Feel free to open an issue or submit a pull request if you have suggestions for improvements or encounter any edge cases!
