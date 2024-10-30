const predefinedUsers = {
    'Wakapedia-CIG': 429390,
    'Bearded-CIG': 19631,
    'Bault-CIG': 1,
    'Underscore-CIG': 556,
    'ZacPreece_CIG': 3154801,
    'KoakuCIG': 525336,
    'ABrown_CIG': 115933,
    'Yogiklatt-CIG': 287195,
    'Wintermute-CIG': 3880356,
    'XLB-CIG': 3126689,
    'Soulcrusher-CIG': 4490
};

let trackingInterval = null;
let loginNotificationShown = false;
let isLoginRequired = false;
let loginTabId = null;
let spectrumTabId = null;
let isRSITabOpened = false;
let isRedirecting = false;
let currentCookies = null;
let initialToken = null;
const motdCheckInterval = 60000;
let isLoginConfirmed = false;

browser.cookies.onChanged.addListener(async (changeInfo) => {
    const isSpectrumCookie = changeInfo.cookie.domain.includes("robertsspaceindustries.com") && changeInfo.cookie.path.includes("/spectrum");

    if (isSpectrumCookie) {
        const cookieName = changeInfo.cookie.name;

        if ((cookieName === "Rsi-Token" || cookieName === "Rsi-XSRF") && !isLoginRequired) {
            currentCookies = await getRSICookies();
            console.log("Current cookies updated:", currentCookies);

            if (currentCookies && rsiTabId) {
                clearTimeout(cookieTimeout);
                closeRSILoginPage(rsiTabId);
                rsiTabId = null;
                isRSITabOpened = false;
            }
        } else if (isLoginRequired && cookieName === "Rsi-Token") {
            const newToken = changeInfo.cookie.value;
            console.log("Detected Rsi-Token change on Spectrum.");

            if (initialToken !== newToken) {
                console.log("Rsi-Token changed; login confirmed.");
                isLoginRequired = false;
                closeRSILoginPage(rsiTabId);
            }
        }
    }
});

function generateNotificationId(base) {
    return `${base}-${Date.now()}-${Math.random()}`;
}

async function notifyUserToLogIn() {
    if (!loginNotificationShown) {
        const iconPath = browser.runtime.getURL("icons/icon-48.png");
        const notificationId = generateNotificationId('login-required');

        await browser.notifications.create(notificationId, {
            type: "basic",
            iconUrl: iconPath,
            title: "RSI Cookie Required",
            message: "Automated authentication of your Spectrum account and activation of the Tracker will occur in the next few seconds.",
            priority: 2
        });

        console.log("Notification sent: RSI Login Required");
        loginNotificationShown = true;
        await browser.storage.local.set({ loginNotificationShown: true });
    }
}

function closeRSILoginPage(tabId) {
    if (tabId !== null) {
        browser.tabs.remove(tabId).then(() => {
            console.log(`Closed RSI login page, tab ID: ${tabId}`);
        });
        spectrumTabId = null;
        isRedirecting = false;
        isRSITabOpened = false;
    }
}

async function openAndCloseMainRSIPage() {
    if (isRSITabOpened) {
        console.log("Waiting for cookies, RSI page already open.");
        return;
    }

    isRSITabOpened = true;

    const tabs = await browser.tabs.query({ url: 'https://robertsspaceindustries.com/*' });
    if (tabs.length > 0) {
        rsiTabId = tabs[0].id;
        console.log("Reusing open RSI tab with ID:", rsiTabId);

        browser.tabs.onUpdated.addListener(function listener(tabId, changeInfo) {
            if (tabId === rsiTabId && changeInfo.status === "complete") {
                console.log("Existing RSI tab fully loaded; monitoring cookies.");
                monitorCookies();
                browser.tabs.onUpdated.removeListener(listener);
            }
        });
    } else {
        const tab = await browser.tabs.create({ url: 'https://robertsspaceindustries.com/' });
        rsiTabId = tab.id;
        console.log("Opened RSI page to gather cookies.");

        browser.tabs.onUpdated.addListener(function listener(tabId, changeInfo) {
            if (tabId === rsiTabId && changeInfo.status === "complete") {
                console.log("New RSI tab fully loaded; monitoring cookies.");
                monitorCookies();
                browser.tabs.onUpdated.removeListener(listener);
            }
        });
    }
}

function monitorCookies() {
    const checkInterval = setInterval(async () => {
        const cookies = await getRSICookies();
        if (cookies) {
            console.log("Cookies successfully gathered. Closing tab.");
            clearInterval(checkInterval);
            closeRSILoginPage(rsiTabId);
            rsiTabId = null;
            isRSITabOpened = false;
        }
    }, 1000);

    cookieTimeout = setTimeout(() => {
        clearInterval(checkInterval);
        console.log("Cookie gathering timed out, closing tab.");
        closeRSILoginPage(rsiTabId);
        rsiTabId = null;
        isRSITabOpened = false;
    }, 30000);
}

async function notifyUserRedirectionFailed() {
    if (!loginNotificationShown) {
        const iconPath = browser.runtime.getURL("icons/icon-48.png");
        const notificationId = generateNotificationId('redirection-failed');

        await browser.notifications.create(notificationId, {
            type: "basic",
            iconUrl: iconPath,
            title: "RSI Login",
            message: "Login to activate Spectrum Tracker.",
            priority: 2
        });

        console.log("Notification sent: Spectrum Redirection Issue");
        loginNotificationShown = true;
        await browser.storage.local.set({ loginNotificationShown: true });
    }
}

async function openSpectrumLoginPage() {
    if (isRedirecting || spectrumTabId) return;
    isRedirecting = true;

    const tab = await browser.tabs.create({ url: 'https://robertsspaceindustries.com/connect?jumpto=/spectrum/community/SC' });
    if (tab && tab.id) {
        spectrumTabId = tab.id;
        console.log("Opened Spectrum login page, waiting for redirection.");
    } else {
        console.error("Failed to open login page.");
        isRedirecting = false;
    }
}

async function startTrackingAfterRedirection() {
    if (!currentCookies || !isLoginConfirmed) {
        console.warn("Redirection not confirmed; tracking will not start.");
        return;
    }

    const interval = await getTrackingInterval();
    trackingInterval = setInterval(() => {
        checkForNewMessages();
    }, interval);

    console.log(`Tracking messages started at an interval of ${interval / 1000} seconds.`);
    const result = await browser.storage.local.get('trackMotd');
    if (result.trackMotd) startMotdTracking();
}

async function getTrackingInterval() {
    const result = await browser.storage.local.get('interval');
    return (result.interval || 60) * 1000;
}

browser.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
    if (tabId === spectrumTabId && changeInfo.status === "complete") {
        browser.tabs.get(tabId).then(async (updatedTab) => {
            if (updatedTab.url === "https://robertsspaceindustries.com/spectrum/community/SC") {
                console.log("User redirected correctly to Spectrum; login confirmed.");

                closeRSILoginPage(spectrumTabId);

                await openAndCloseMainRSIPage();

                isLoginConfirmed = true;
                startTrackingAfterRedirection();

                spectrumTabId = null;
                isRedirecting = false;
            } else {
                console.log("Waiting for proper redirection...");
            }
        });
    }
});

async function openAndCloseMainRSIPage() {
    if (isRSITabOpened) {
        console.log("Waiting for cookies, RSI page already open.");
        return;
    }

    isRSITabOpened = true;

    const tab = await browser.tabs.create({ url: 'https://robertsspaceindustries.com/' });
    rsiTabId = tab.id;
    console.log("Opened RSI main page to gather cookies.");

    browser.tabs.onUpdated.addListener(function listener(tabId, changeInfo) {
        if (tabId === rsiTabId && changeInfo.status === "complete") {
            console.log("Main RSI page fully loaded; gathering cookies.");

            monitorCookies();

            browser.tabs.remove(rsiTabId).then(() => {
                console.log("Closed RSI main page after cookie gathering.");
                rsiTabId = null;
                isRSITabOpened = false;
            });

            browser.tabs.onUpdated.removeListener(listener);
        }
    });
}

function stopTrackingService() {
    if (trackingInterval) {
        clearInterval(trackingInterval);
        trackingInterval = null;
        console.log("Stopped tracking messages.");
    }
    stopMotdTracking();

    isLoginConfirmed = false;
    isRSITabOpened = false;
    isRedirecting = false;
    spectrumTabId = null;
    loginTabId = null;
    currentCookies = null;

    browser.notifications.create({
        type: "basic",
        iconUrl: browser.runtime.getURL("icons/icon-48.png"),
        title: "Tracking Stopped",
        message: "Tracking was stopped automatically due to permission issues. Please log in again.",
        priority: 2
    });
}

async function ensureRSILogin() {
    currentCookies = await getRSICookies();
    if (currentCookies) {
        console.log("User is logged in; cookies valid.");
        return;
    }
    await openSpectrumLoginPage();
}

async function getRSICookies() {
    console.log("Retrieving RSI cookies from Spectrum...");
    return new Promise((resolve) => {
        browser.cookies.getAll({ url: 'https://robertsspaceindustries.com/spectrum/' }).then((cookies) => {
            const rsiToken = cookies.find(cookie => cookie.name === 'Rsi-Token');
            const xsrfToken = cookies.find(cookie => cookie.name === 'Rsi-XSRF');
            if (rsiToken && xsrfToken) {
                console.log("Spectrum RSI cookies retrieved:", { rsiToken: rsiToken.value, xsrfToken: xsrfToken.value });
                resolve({ rsiToken: rsiToken.value, xsrfToken: xsrfToken.value });
            } else {
                console.warn("RSI cookies not valid or missing; login required.");
                resolve(null);
            }
        });
    });
}

function generateTavernId() {
    const characters = 'abcdefghijklmnopqrstuvwxyz0123456789';
    let tavernId = '';
    for (let i = 0; i < 12; i++) {
        tavernId += characters.charAt(Math.floor(Math.random() * characters.length));
    }
    return tavernId;
}

async function fetchUserMessages(userId, retryCount = 0) {
    const maxRetries = 3;
    const delay = Math.pow(2, retryCount) * 1000;

    try {
        const loginData = await getRSICookies();
        if (!loginData || !loginData.rsiToken) {
            console.warn("RSI cookies are missing; attempting re-login.");
            await ensureRSILogin();

            if (retryCount < maxRetries) {
                await new Promise(resolve => setTimeout(resolve, delay));
                return fetchUserMessages(userId, retryCount + 1);
            } else {
                throw new Error("Max retries reached; unable to retrieve cookies.");
            }
        }

        const { rsiToken, xsrfToken } = loginData;
        const tavernId = generateTavernId();

        const body = {
            type: ["op", "reply", "chat"],
            text: "",
            page: 1,
            sort: "latest",
            range: "day",
            author: userId.toString(),
            visibility: "nonerased"
        };

        const headers = {
            'accept': 'application/json',
            'content-type': 'application/json',
            'x-rsi-token': rsiToken,
            'x-tavern-id': tavernId,
            ...(xsrfToken && { 'x-rsi-xsrf': xsrfToken })
        };

        const response = await fetch("https://robertsspaceindustries.com/api/spectrum/search/content/extended", {
            method: 'POST',
            headers,
            body: JSON.stringify(body),
            credentials: 'include'
        });

        if (response.ok) {
            const data = await response.json();
            if (data.success === 0 && data.code === 'ErrPermissionDenied') {
                console.warn("Permission Denied error in message fetch.");
                stopTrackingService();
                return [];
            }

            if (data.data?.hits?.hits.length > 0) {
                return data.data.hits.hits;
            } else {
                console.log(`No new messages for userId ${userId}.`);
                return [];
            }
        } else {
            if (response.status === 403 && retryCount < maxRetries) {
                await new Promise(resolve => setTimeout(resolve, delay));
                return fetchUserMessages(userId, retryCount + 1);
            }
            throw new Error(`Failed to fetch messages for userId ${userId}: ${response.status}`);
        }
    } catch (error) {
        console.error(`Error fetching messages for userId ${userId}:`, error.message);
        throw error;
    }
}

async function clearCookies() {
    return new Promise((resolve) => {
        browser.cookies.remove({ url: 'https://robertsspaceindustries.com', name: 'Rsi-Token' }).then(() => {
            browser.cookies.remove({ url: 'https://robertsspaceindustries.com', name: 'Rsi-XSRF' }).then(() => {
                console.log("Cleared RSI cookies.");
                resolve();
            });
        });
    });
}

async function createNotification(message, username, avatarUrl = null) {
    const source = message._source;
    const details = message.details;

    const notificationAvatarUrl = avatarUrl || details?.member?.avatar || 'icons/icon-48.png';
    const timeCreated = username === "MoTD" ? new Date(details.last_modified * 1000).toLocaleString() : new Date(source.time_created).toLocaleString();
    const messageId = message._id;

    let lobbyName = "Unknown Lobby";
    let titleText = `${details?.member?.nickname || 'Unknown'} posted a message`;
    let contextMessage = `Posted on: ${timeCreated} in ${lobbyName}`;
    let messageLink = null;

    if (username === "MoTD") {
        lobbyName = details.lobby?.name || "MoTD Lobby";
        titleText = `MoTD in ${lobbyName} changed`;
        contextMessage = `Updated on: ${timeCreated}`;
    } else if (message._index === 'tavern_forum_thread_op' || message._index === 'tavern_forum_thread_reply') {
        lobbyName = details.channel?.name || "Forum Thread";
        const communitySlug = details.community?.slug || 'SC';
        const threadSlug = details.thread?.slug || 'unknown-slug';
        const channelId = details.channel?.id || 'unknown-channel';

        messageLink = `https://robertsspaceindustries.com/spectrum/community/${communitySlug}/forum/${channelId}/thread/${threadSlug}/${messageId}`;
    } else if (message._index === 'tavern_message') {
        lobbyName = details.lobby?.name || details.channel?.name || "Chat Lobby";
        const lobbyId = details.lobby?.id || 'undefined';
        const communitySlug = details.community?.slug || 'SC';
        messageLink = `https://robertsspaceindustries.com/spectrum/community/${communitySlug}/lobby/${lobbyId}/message/${messageId}`;
    }

    contextMessage = username === "MoTD" ? `Updated on: ${timeCreated}` : `Posted on: ${timeCreated} in ${lobbyName}`;

    const notificationOptions = {
        type: "basic",
        iconUrl: notificationAvatarUrl,
        title: titleText,
        message: source.body,
        contextMessage: contextMessage,
        priority: 2
    };

    browser.notifications.create(messageId, notificationOptions).then((notificationId) => {
        console.log(`Notification created for messageId: ${messageId}, username: ${username}`);

        browser.storage.local.get(['notificationsHistory', 'notificationsShown', 'notificationsClicked']).then((stats) => {
            let shownCount = (stats.notificationsShown || 0) + 1;
            browser.storage.local.set({ notificationsShown: shownCount });

            let history = stats.notificationsHistory || [];
            const newNotification = {
                notificationId,
                username,
                avatarUrl: notificationAvatarUrl,
                timeCreated,
                lobbyName,
                messageLink,
                body: source.body,
                title: notificationOptions.title
            };

            if (history.length >= 50) {
                history.shift();
                console.log("Oldest notification removed from history.");
            }
            history.push(newNotification);
            browser.storage.local.set({ notificationsHistory: history }).then(() => {
                console.log("Notification added to history:", newNotification);
            });
        });

        if (username !== "MoTD" && messageLink) {
            browser.notifications.onClicked.addListener(function listener(id) {
                if (id === notificationId) {
                    browser.storage.local.get('notificationsClicked').then((stats) => {
                        let clickedCount = (stats.notificationsClicked || 0) + 1;
                        browser.storage.local.set({ notificationsClicked: clickedCount });
                        console.log(`Notification clicked for messageId: ${messageId}`);

                        browser.tabs.query({ url: messageLink }).then((tabs) => {
                            if (tabs.length > 0) {
                                browser.tabs.update(tabs[0].id, { active: true });
                                console.log(`Focused existing tab for messageId: ${messageId}`);
                            } else {
                                browser.tabs.create({ url: messageLink });
                                console.log(`Opened new tab for messageId: ${messageId}`);
                            }
                        });

                        browser.notifications.onClicked.removeListener(listener);
                    });
                }
            });
        }
    });
}

async function checkForNewMessages() {
    if (!isLoginConfirmed) {
        console.warn("Login not confirmed; skipping message checks.");
        return;
    }

    browser.storage.local.get('shownMessageIds').then(async (result) => {
        let shownMessageIds = result.shownMessageIds || {};
        browser.storage.local.get('selectedUsers').then(async (result) => {
            const selectedUsers = result.selectedUsers || [];
            console.log("Checking for new messages for users:", selectedUsers);
            for (const username of selectedUsers) {
                const userId = predefinedUsers[username];
                console.log(`Processing user: ${username}, userId: ${userId}`);
                try {
                    const messages = await fetchUserMessages(userId);
                    if (messages.length > 0) {
                        const latestMessage = messages[0];
                        const messageId = latestMessage._id;
                        if (!shownMessageIds[username] || shownMessageIds[username] !== messageId) {
                            await createNotification(latestMessage, username);
                            shownMessageIds[username] = messageId;
                            browser.storage.local.set({ shownMessageIds });
                            console.log(`Notification sent for user ${username}, messageId: ${messageId}`);
                        } else {
                            console.log(`Notification for user ${username} with messageId ${messageId} has already been shown.`);
                        }
                    } else {
                        console.log(`No new messages for userId ${userId}.`);
                    }
                } catch (error) {
                    console.error(`Error checking messages for user ${username}:`, error);
                }
            }
        });
    });
}

let previousMotdTimestamps = {};
let motdInterval = null;

browser.runtime.onStartup.addListener(() => {
    browser.storage.local.get(['selectedUsers', 'interval', 'tracking']).then(async (result) => {
        const interval = result.interval || 60;

        loginNotificationShown = false;
        isLoginEnsured = false;
        loginTabId = null;

        try {
            const cookies = await getRSICookies();
            if (!cookies && !loginNotificationShown) {
                await notifyUserToLogIn();
                loginNotificationShown = true;
            }
        } catch (error) {
            if (!loginNotificationShown) {
                await notifyUserToLogIn();
                loginNotificationShown = true;
            }
        }

        if (result.tracking) {
            trackingInterval = setInterval(() => {
                checkForNewMessages();
            }, interval * 1000);
            console.log("Tracking resumed on startup at an interval of", interval, "seconds.");
        }
    });
});

let motdTrackingEnabled = false;

function startMotdTracking() {
    if (!motdInterval && motdTrackingEnabled && trackingInterval) {
        motdInterval = setInterval(checkForMotdUpdates, motdCheckInterval);
        console.log(`Started MoTD tracking at an interval of ${motdCheckInterval / 1000} seconds.`);
    }
}

function stopMotdTracking() {
    if (motdInterval) {
        clearInterval(motdInterval);
        motdInterval = null;
        console.log("MoTD tracking stopped.");
    }
}

async function checkForMotdUpdates() {
    const lobbies = [
        { id: "38230", name: "sc-testing-chat" },
        { id: "1355241", name: "etf-testing-chat" }
    ];

    for (const lobby of lobbies) {
        await fetchMotd(lobby.id, lobby.name);
    }
}

browser.storage.onChanged.addListener((changes) => {
    if (changes.trackMotd) {
        motdTrackingEnabled = changes.trackMotd.newValue;
        if (motdTrackingEnabled && trackingInterval) {
            startMotdTracking();
        } else {
            stopMotdTracking();
        }
    }
});

async function fetchMotd(lobbyId, lobbyName) {
    console.log(`Starting fetch for MoTD in lobby: ${lobbyName} (ID: ${lobbyId})`);
    try {
        const loginData = await getRSICookies();
        if (!loginData || !loginData.rsiToken) {
            console.warn("RSI cookies are missing; attempting re-login.");
            await ensureRSILogin();
            console.log("Re-attempting MoTD fetch after login...");
            return fetchMotd(lobbyId, lobbyName);
        }

        const { rsiToken, xsrfToken } = loginData;
        const tavernId = generateTavernId();

        const response = await fetch("https://robertsspaceindustries.com/api/spectrum/lobby/getMotd", {
            method: 'POST',
            headers: {
                'authority': 'robertsspaceindustries.com',
                'accept': 'application/json',
                'content-type': 'application/json',
                'x-rsi-token': rsiToken,
                'x-tavern-id': tavernId,
                ...(xsrfToken && { 'x-rsi-xsrf': xsrfToken })
            },
            body: JSON.stringify({ lobby_id: lobbyId })
        });

        if (response.ok) {
            const data = await response.json();

            if (data.success === 0 && data.code === 'ErrPermissionDenied') {
                console.warn(`Permission Denied error in lobby: ${lobbyName}`);
                stopTrackingService();
                return;
            }

            const motdMessage = data.data?.motd?.message;
            const lastModified = data.data?.motd?.last_modified;
            if (motdMessage && lastModified !== previousMotdTimestamps[lobbyId]) {
                console.log(`New MoTD found for ${lobbyName}. Last modified: ${lastModified}`);
                previousMotdTimestamps[lobbyId] = lastModified;
                await sendMotdNotification(motdMessage, lobbyName, lastModified);
            } else {
                console.log(`No new MoTD for ${lobbyName} or already up-to-date.`);
            }
        } else {
            console.error(`Failed to fetch MoTD for lobby ${lobbyName}: ${response.status}`);
        }
    } catch (error) {
        console.error(`Error fetching MoTD for lobby ${lobbyName}:`, error.message);
    }
}

async function sendMotdNotification(message, lobbyName, lastModified) {
    const notificationId = `motd-${lobbyName}-${lastModified}`;
    const defaultAvatarUrl = browser.runtime.getURL("icons/icon-48.png");

    browser.storage.local.get('shownMessageIds').then((result) => {
        const shownMessageIds = result.shownMessageIds || {};

        if (shownMessageIds[notificationId]) {
            console.log(`Notification for MoTD in ${lobbyName} already shown.`);
            return;
        }

        shownMessageIds[notificationId] = true;
        browser.storage.local.set({ shownMessageIds });

        const notificationMessage = message.replace(/\n/g, ' ');
        const motdNotification = {
            _id: notificationId,
            _source: {
                time_created: lastModified * 1000,
                body: message
            },
            details: {
                member: { nickname: 'MoTD' },
                lobby: { name: lobbyName },
                community: { slug: 'SC' },
                last_modified: lastModified
            }
        };

        createNotification(motdNotification, 'MoTD', defaultAvatarUrl, notificationMessage);
        console.log(`Notification sent for MoTD update in ${lobbyName}`);
    });
}

browser.runtime.onMessage.addListener((message, sender, sendResponse) => {
    if (message.action === 'startTracking') {
        const intervalMinutes = message.interval / 60;

        browser.alarms.clear("messageCheckAlarm");
        trackingInterval = null;
        loginNotificationShown = false;
        isLoginConfirmed = false;
        isRSITabOpened = false;
        spectrumTabId = null;
        isRedirecting = false;

        openSpectrumLoginPage().then(() => {
            console.log("Waiting for Spectrum login redirection confirmation...");

            browser.tabs.onUpdated.addListener(function listener(tabId, changeInfo, tab) {
                if (tabId === spectrumTabId && changeInfo.status === "complete") {
                    browser.tabs.get(tabId).then(async (updatedTab) => {
                        if (updatedTab.url === "https://robertsspaceindustries.com/spectrum/community/SC") {
                            console.log("User redirected correctly to Spectrum; login confirmed.");

                            closeRSILoginPage(spectrumTabId);
                            await openAndCloseMainRSIPage();

                            isLoginConfirmed = true;

                            browser.alarms.create("messageCheckAlarm", { periodInMinutes: intervalMinutes });
                            console.log(`Tracking messages started with alarm set to ${intervalMinutes} minute(s).`);

                            browser.storage.local.get('trackMotd').then((result) => {
                                if (result.trackMotd && !motdInterval) {
                                    startMotdTracking();
                                    console.log("MoTD tracking started after user-initiated tracking start.");
                                }
                            });

                            browser.tabs.onUpdated.removeListener(listener);
                        } else {
                            console.log("Waiting for proper Spectrum redirection...");
                        }
                    });
                }
            });
        });

        sendResponse({ success: true });
    } else if (message.action === 'stopTracking') {
        browser.alarms.clear("messageCheckAlarm");
        stopTrackingService();
        sendResponse({ success: true });
    } else if (message.action === 'changeInterval') {
        const newIntervalMinutes = message.interval / 60;

        browser.alarms.clear("messageCheckAlarm");
        browser.alarms.create("messageCheckAlarm", { periodInMinutes: newIntervalMinutes });
        console.log(`Changed tracking interval to ${newIntervalMinutes} minute(s).`);

        sendResponse({ success: true });
    }
});

browser.alarms.onAlarm.addListener((alarm) => {
    if (alarm.name === "messageCheckAlarm") {
        console.log("Alarm triggered for checkForNewMessages.");
        checkForNewMessages();
    }
});

browser.runtime.onStartup.addListener(async () => {
    browser.storage.local.get(['selectedUsers', 'interval', 'tracking', 'trackMotd']).then(async (result) => {
        const interval = result.interval || 60;

        loginNotificationShown = false;
        isLoginEnsured = false;
        loginTabId = null;

        await openSpectrumLoginPage().then(() => {
            ensureRSILogin().then(async () => {
                console.log("Login ensured for tracking after startup.");

                await openAndCloseMainRSIPage();

                if (result.tracking && !trackingInterval) {
                    trackingInterval = setInterval(() => {
                        checkForNewMessages();
                    }, interval * 1000);
                    console.log("Tracking resumed on startup at an interval of", interval, "seconds.");

                    if (result.trackMotd && !motdInterval) {
                        startMotdTracking();
                        console.log("MoTD tracking resumed on startup.");
                    }
                }
            });
        });
    });
});

browser.runtime.onMessage.addListener((message, sender, sendResponse) => {
    if (message.action === 'startTracking') {
        const interval = message.interval * 1000;

        clearInterval(trackingInterval);
        trackingInterval = null;
        loginNotificationShown = false;
        isLoginConfirmed = false;
        isRSITabOpened = false;
        spectrumTabId = null;

        openSpectrumLoginPage().then(() => {
            console.log("Waiting for Spectrum login redirection confirmation...");

            browser.tabs.onUpdated.addListener(function listener(tabId, changeInfo, tab) {
                if (tabId === spectrumTabId && changeInfo.status === "complete") {
                    browser.tabs.get(tabId).then(async (updatedTab) => {
                        if (updatedTab.url === "https://robertsspaceindustries.com/spectrum/community/SC") {
                            console.log("User redirected correctly to Spectrum; login confirmed.");

                            closeRSILoginPage(spectrumTabId);

                            await openAndCloseMainRSIPage();

                            isLoginConfirmed = true;
                            trackingInterval = setInterval(() => {
                                checkForNewMessages();
                            }, interval);

                            console.log(`Tracking messages started at an interval of ${interval / 1000} seconds.`);

                            browser.storage.local.get('trackMotd').then((result) => {
                                if (result.trackMotd && !motdInterval) {
                                    startMotdTracking();
                                    console.log("MoTD tracking started after user-initiated tracking start.");
                                }
                            });

                            browser.tabs.onUpdated.removeListener(listener);
                        } else {
                            console.log("Waiting for proper Spectrum redirection...");
                        }
                    });
                }
            });
        });

        sendResponse({ success: true });
    } else if (message.action === 'stopTracking') {
        if (trackingInterval) {
            clearInterval(trackingInterval);
            trackingInterval = null;
            console.log("Stopped tracking messages.");
        }
        stopMotdTracking();
        sendResponse({ success: true });
    } else if (message.action === 'changeInterval') {
        if (trackingInterval) {
            clearInterval(trackingInterval);
            trackingInterval = setInterval(() => {
                checkForNewMessages();
            }, message.interval * 1000);
            console.log(`Changed tracking interval to ${message.interval} seconds.`);
        }
    }
});
