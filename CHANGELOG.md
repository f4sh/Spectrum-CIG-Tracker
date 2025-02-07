# Changelog

## [2.0] - November 11, 2024

### Improvements:
- **Increased User Tracking Limit**: Now supports tracking up to 9 developers.
- **New CIG Team Members for Tracking**: Added Spectral-CIG to the available tracking list.

---

## [1.9] - November 8, 2024

### Bug Fixes:
- **Aligning with the prior fix in notifications**: Fixed duplicate filtering in history to ensure only unique messages are displayed across different lobbies.

---

## [1.8] - November 7, 2024

### Bug Fixes:
- **Custom Emoji Handling**: Reverted to using shortcodes for CIG-provided emojis due to OS notifications not supporting server-fetched custom emoji images.
- **Date and Time Sorting**: Enhanced sorting to handle identical timestamps with a unique fallback, ensuring consistent order for notifications.

---

## [1.7] - November 6, 2024

### Bug Fixes:
- **HTML Entity Decoding**: Resolved display issues for notifications containing special characters (e.g., apostrophes) by implementing custom entity decoding for better readability.
- **Expanded Emoji Support**: Added more emojis to fix a bug where only shortcode was visible, ensuring emojis appear in notifications as intended.
- **Error Handling**: Improved error logging for clearer diagnostics, particularly for cookie and API-related issues.

---

## [1.6] - November 5, 2024

### Bug Fixes:
- **Display Most Recent Messages**: Now shows only the most recent MoTD, and the last message / thread per CIG developer, as intended.
- **Excessive Notifications Fixed**: Implemented safeguards to prevent multiple intervals, resolving repeated notifications.

---

## [1.5] - November 4, 2024

### Improvements:
- **Independent Tracking for Message Types**: Notifications now separately cover chat, threads, and MoTD updates, ensuring users receive distinct updates for each type without redundancy.
- **Formatted Message Display**: Improved readability in notifications.
- **Automatic Tracking Resumption on Update**: Tracking state is retained after extension updates, with login prompts if re-authentication is needed.

### Bug Fixes:
- **Encoding Fix**: Special characters now display correctly.
- **Retry Mechanism for Message Retrieval**: Temporary network issues are handled gracefully without stopping tracking.

---

## [1.4] - November 3, 2024

> **Note for Firefox Users**: Version 1.4 was not published on Firefox. Firefox users will receive the features of 1.3, 1.4 and 1.5 in a combined 1.5 release.

### New Features:
- **Clear History Button**: Allows users to erase all notification history with a single click.
- **Copy Message Feature**: Provides a convenient way to copy notifications in a preformatted, Spectrum-friendly format.

### Improvements:
- **Increased User Tracking Limit**: Now supports tracking up to 8 developers.
- **Extended Notification History**: History limit increased from 50 to 100 messages, allowing users to retain a more extensive record of past notifications.
- **New CIG Team Members for Tracking**: Added Swift-CIG and Proxus-CIG to the available tracking list.

---

## [1.3] - November 2, 2024

> **Note for Firefox Users**: Version 1.3 was not published on Firefox. Firefox users will receive the features of 1.3 in a combined future release.

### Improvements:
- **Emoji Support**: Basic emojis frequently used by CIG are now supported, along with custom emojis from the sc-testing and etf communities.
- **Tab Creation Update**: `tabs.create` now uses `active: false` for improved tab management.
- **Date Filtering**: Added filtering by date for easier browsing.
- **User Tracking Update**: Increased tracked users limit to 5, with Armeggadon-CIG added to the tracking list.

---

## [1.2] - October 29, 2024

- **New Tab Spam Fix**: Resolved excessive new tab opening and implemented various bug fixes for enhanced performance and stability.

---

## [1.1] - October 29, 2024

- **Temporary Reversion**: Rolled back to version 0.8 (1.1 in store) due to a critical bug causing excessive new tab spamming.

---

## [1.0] - October 28, 2024

### Bug Fixes:
- **Cookie Verification Tabs**: Fixed issue with multiple cookie verification tabs opening. Now, only one RSI website tab and one Spectrum page will open on browser launch.

### Major Release:
- **Stable Release**: This release marks a significant milestone, reflecting stability and readiness for broader use.

---

## [0.8] - October 27, 2024

- **MoTD Check**: Enabled automatic monitoring of the Message of the Day (MoTD) with desktop notifications, similar to CIG developer tracking.

---

## [0.7] - October 26, 2024

### Improvements:
- **History UI Enhancements**: Improved navigation and filtering for browsing past notifications.
- **Expanded Developer Tracking**: Increased tracking limit from 3 to 4 CIG developers.

---

## [0.6] - October 25, 2024

### Bug Fixes and Improvements:
- **Enhanced Login Handling**: Improved authentication flow with auto-redirection and retry logic for login verification.
- **Consistent Startup Timing**: Addressed timing inconsistencies on browser startup, providing smoother operation.
- **Streamlined Notifications**: Clearer messaging for login failures or authentication issues.

---

## [0.5] - October 24, 2024

### Cookie-Based Functionality:
- **Cookie Dependency**: The extension relies on cookies for authentication and tracking. It will prompt login if cookies are missing and handle redirection automatically. Keeping the RSI site open is unnecessary after logging in; the extension uses stored cookies.

### Initial Features:
- **Real-Time Notifications**: Provides near real-time notifications for messages posted by CIG developers.
- **Customizable Tracking**: Track up to three developers from a predefined list.
- **User-Friendly Interface**: Seamless navigation and message tracking.
- **Login Alerts**: Fallback alerts for failed authentication or Spectrum redirection issues.
