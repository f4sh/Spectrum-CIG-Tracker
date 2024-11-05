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
    'Soulcrusher-CIG': 4490,
    'Armeggadon-CIG': 4392587,
    'Swift-CIG': 3377,
    'Proxus-CIG': 478
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

chrome.cookies.onChanged.addListener(async (changeInfo) => {
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
        const iconPath = chrome.runtime.getURL("icons/icon-48.png");
        const notificationId = generateNotificationId('login-required');

        chrome.notifications.create(notificationId, {
            type: "basic",
            iconUrl: iconPath,
            title: "RSI Cookie Required",
            message: "Automated authentication of your Spectrum account and activation of the Tracker will occur in the next few seconds.",
            priority: 2
        });

        console.log("Notification sent: RSI Login Required");
        loginNotificationShown = true;
        await chrome.storage.local.set({ loginNotificationShown: true });
    }
}

function closeRSILoginPage(tabId) {
    if (tabId !== null) {
        chrome.tabs.remove(tabId, () => {
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

    chrome.tabs.query({ url: 'https://robertsspaceindustries.com/*' }, (tabs) => {
        if (tabs.length > 0) {
            rsiTabId = tabs[0].id;
            console.log("Reusing open RSI tab with ID:", rsiTabId);

            chrome.tabs.onUpdated.addListener(function listener(tabId, changeInfo) {
                if (tabId === rsiTabId && changeInfo.status === "complete") {
                    console.log("Existing RSI tab fully loaded; monitoring cookies.");
                    monitorCookies();
                    chrome.tabs.onUpdated.removeListener(listener);
                }
            });
        } else {
            chrome.tabs.create({ url: 'https://robertsspaceindustries.com/' }, (tab) => {
                rsiTabId = tab.id;
                console.log("Opened RSI page to gather cookies.");

                chrome.tabs.onUpdated.addListener(function listener(tabId, changeInfo) {
                    if (tabId === rsiTabId && changeInfo.status === "complete") {
                        console.log("New RSI tab fully loaded; monitoring cookies.");
                        monitorCookies();
                        chrome.tabs.onUpdated.removeListener(listener);
                    }
                });
            });
        }
    });
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
        const iconPath = chrome.runtime.getURL("icons/icon-48.png");
        const notificationId = generateNotificationId('redirection-failed');

        chrome.notifications.create(notificationId, {
            type: "basic",
            iconUrl: iconPath,
            title: "RSI Login",
            message: "Login to activate Spectrum Tracker.",
            priority: 2
        });

        console.log("Notification sent: Spectrum Redirection Issue");
        loginNotificationShown = true;
        await chrome.storage.local.set({ loginNotificationShown: true });
    }
}

async function openSpectrumLoginPage() {
    if (isRedirecting || spectrumTabId) return;
    isRedirecting = true;

    return new Promise((resolve) => {
        chrome.tabs.create({
            url: 'https://robertsspaceindustries.com/connect?jumpto=/spectrum/community/SC',
            active: false
        }, (tab) => {
            if (tab && tab.id) {
                spectrumTabId = tab.id;
                console.log("Opened Spectrum login page, waiting for redirection.");
            } else {
                console.error("Failed to open login page.");
                isRedirecting = false;
                resolve(null);
            }
        });
    });
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
    chrome.storage.local.get('trackMotd', (result) => {
        if (result.trackMotd) startMotdTracking();
    });
}

async function getTrackingInterval() {
    return new Promise((resolve) => {
        chrome.storage.local.get('interval', (result) => {
            resolve((result.interval || 60) * 1000);
        });
    });
}

chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
    if (tabId === spectrumTabId && changeInfo.status === "complete") {
        chrome.tabs.get(tabId, async (updatedTab) => {
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

    chrome.tabs.create({
        url: 'https://robertsspaceindustries.com/',
        active: false
    }, (tab) => {
        rsiTabId = tab.id;
        console.log("Opened RSI main page to gather cookies.");

        chrome.tabs.onUpdated.addListener(function listener(tabId, changeInfo) {
            if (tabId === rsiTabId && changeInfo.status === "complete") {
                console.log("Main RSI page fully loaded; gathering cookies.");

                monitorCookies();

                chrome.tabs.remove(rsiTabId, () => {
                    console.log("Closed RSI main page after cookie gathering.");
                    rsiTabId = null;
                    isRSITabOpened = false;
                });

                chrome.tabs.onUpdated.removeListener(listener);
            }
        });
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

    chrome.notifications.create({
        type: "basic",
        iconUrl: chrome.runtime.getURL("icons/icon-48.png"),
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
        chrome.cookies.getAll({ url: 'https://robertsspaceindustries.com/spectrum/' }, (cookies) => {
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
        chrome.cookies.remove({ url: 'https://robertsspaceindustries.com', name: 'Rsi-Token' }, () => {
            chrome.cookies.remove({ url: 'https://robertsspaceindustries.com', name: 'Rsi-XSRF' }, () => {
                console.log("Cleared RSI cookies.");
                resolve();
            });
        });
    });
}

let emojiMap = {};
let avocadoEmojiMap = {};

const hardcodedEmojis = {
    ':space_invader:': '👾',
    ':rocket:': '🚀',
    ':green_circle:': '🟢',
    ':red_circle:': '🔴',
    ':fire:': '🔥',
    ':pizza:': '🍕',
    ':tophat:': '🎩',
    ':monocle_face:': '🧐'
};

async function fetchEmojis(communityId) {
    console.log(`Fetching emojis for community ID: ${communityId}...`);

    const cookies = await getRSICookies();
    const rsiToken = cookies ? cookies.rsiToken : null;

    const response = await fetch("https://robertsspaceindustries.com/api/spectrum/community/fetch-emojis", {
        method: "POST",
        headers: {
            "Content-Type": "application/json",
            "Accept": "application/json",
            "x-rsi-token": rsiToken,
            "x-tavern-id": generateTavernId()
        },
        body: JSON.stringify({ community_id: communityId })
    });

    if (response.ok) {
        const data = await response.json();
        if (data.success) {

            if (communityId === "1") {
                emojiMap = {};
            } else if (communityId === "9711") {
                avocadoEmojiMap = {};
            }
            data.data.forEach(emoji => {
                if (communityId === "1") {
                    emojiMap[`:${emoji.short_name}:`] = emoji.media_url;
                } else if (communityId === "9711") {
                    avocadoEmojiMap[`:${emoji.short_name}:`] = emoji.media_url;
                }
            });
            console.log("Emojis fetched successfully:", communityId === "1" ? emojiMap : avocadoEmojiMap);
        } else {
            console.error("Error fetching emojis:", data.msg);
        }
    } else {
        console.error("Failed to fetch emojis:", response.statusText);
    }
}

function formatMessageWithEmojis(message, communityId) {

    const currentEmojiMap = communityId === "1" ? emojiMap : avocadoEmojiMap;

    for (const [emoticon, url] of Object.entries(currentEmojiMap)) {
        const regex = new RegExp(emoticon, 'g');
        message = message.replace(regex, `<img src="${url}" alt="${emoticon}" class="emoticon">`);
    }

    for (const [emoticon, emoji] of Object.entries(hardcodedEmojis)) {
        const regex = new RegExp(emoticon, 'g');
        message = message.replace(regex, emoji);
    }

    return message;
}

function createStandardNotification(message, username, avatarUrl, details) {
    const notificationOptions = {
        type: "basic",
        iconUrl: avatarUrl || 'icons/icon-48.png',
        title: `${username} says:`,
        message: message,
        priority: 2
    };

    chrome.notifications.create(`${username}-${Date.now()}`, notificationOptions);
}

async function createNotification(message, username, avatarUrl = null) {
    const source = message._source || {};
    const details = message.details || {};

    console.log("Message details:", JSON.stringify(details, null, 2));

    const communityId = details.community?.id;
    let formattedMessage;

    if (username === "MoTD") {
        formattedMessage = formatMessageWithEmojis(source.body || "", null);
    } else {
        if (!communityId) {
            console.error("Community ID is undefined. Cannot fetch emojis.");
            formattedMessage = formatMessageWithEmojis(source.body || "", null);
        } else {
            await fetchEmojis(communityId);
            formattedMessage = formatMessageWithEmojis(source.body || "", communityId);
        }
    }

    const notificationAvatarUrl = avatarUrl || details?.member?.avatar || 'icons/icon-48.png';
    const timeCreated = username === "MoTD" ? new Date(details.last_modified * 1000).toLocaleString() : new Date(source.time_created).toLocaleString();
    const messageId = message._id || `motd-${details.lobby?.name}-${details.last_modified}`;

    const messageType = message._index || (username === "MoTD" ? 'motd' : 'tavern_message');
    if (!lastMessageIds[messageType]) lastMessageIds[messageType] = {};

    if (lastMessageIds[messageType][username] === messageId) {
        console.log(`Notification for user ${username} with ${messageType} messageId ${messageId} has already been shown.`);
        return;
    }
    lastMessageIds[messageType][username] = messageId;

    let lobbyName = "Unknown Lobby";
    let titleText = `${details?.member?.nickname || 'Unknown'} posted a message`;
    let contextMessage = `Posted on: ${timeCreated} in ${lobbyName}`;
    let messageLink = null;

    if (username === "MoTD") {
        lobbyName = details.lobby?.name || "MoTD Lobby";
        titleText = `MoTD in ${lobbyName} changed`;
        contextMessage = `Updated on: ${timeCreated}`;
    } else if (messageType === 'tavern_forum_thread_op' || messageType === 'tavern_forum_thread_reply') {
        lobbyName = details.channel?.name || "Forum Thread";
        const communitySlug = details.community?.slug || 'SC';
        const threadSlug = details.thread?.slug || 'unknown-slug';
        const channelId = details.channel?.id || 'unknown-channel';

        messageLink = `https://robertsspaceindustries.com/spectrum/community/${communitySlug}/forum/${channelId}/thread/${threadSlug}/${messageId}`;
    } else if (messageType === 'tavern_message') {
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
        message: formattedMessage,
        contextMessage: contextMessage,
        priority: 2
    };

    chrome.notifications.create(messageId, notificationOptions, (notificationId) => {
        console.log(`Notification created for messageId: ${messageId}, username: ${username}`);

        chrome.storage.local.get(['notificationsHistory', 'notificationsShown', 'notificationsClicked'], (stats) => {
            let shownCount = (stats.notificationsShown || 0) + 1;
            chrome.storage.local.set({ notificationsShown: shownCount });

            let history = stats.notificationsHistory || [];
            const newNotification = {
                notificationId,
                username,
                avatarUrl: notificationAvatarUrl,
                timeCreated,
                lobbyName,
                messageLink,
                body: formattedMessage,
                title: notificationOptions.title
            };

            if (history.length >= 100) {
                history.shift();
                console.log("Oldest notification removed from history.");
            }
            history.push(newNotification);
            chrome.storage.local.set({ notificationsHistory: history }, () => {
                console.log("Notification added to history:", newNotification);
            });
        });

        if (username !== "MoTD" && messageLink) {
            chrome.notifications.onClicked.addListener(function listener(id) {
                if (id === notificationId) {
                    chrome.storage.local.get('notificationsClicked', (stats) => {
                        let clickedCount = (stats.notificationsClicked || 0) + 1;
                        chrome.storage.local.set({ notificationsClicked: clickedCount });
                        console.log(`Notification clicked for messageId: ${messageId}`);

                        chrome.tabs.query({ url: messageLink }, function (tabs) {
                            if (tabs.length > 0) {
                                chrome.tabs.update(tabs[0].id, { active: true });
                                console.log(`Focused existing tab for messageId: ${messageId}`);
                            } else {
                                chrome.tabs.create({ url: messageLink });
                                console.log(`Opened new tab for messageId: ${messageId}`);
                            }
                        });

                        chrome.notifications.onClicked.removeListener(listener);
                    });
                }
            });
        }
    });
}

const lastMessageIds = {
    'tavern_forum_thread_op': {},
    'tavern_forum_thread_reply': {},
    'tavern_message': {},
    'motd': null
};

chrome.storage.local.get('lastMessageIds', (result) => {
    if (result.lastMessageIds) {
        Object.assign(lastMessageIds, result.lastMessageIds);
    }
});

async function checkForNewMessages() {
    console.log("checkForNewMessages called");

    if (!isLoginConfirmed) {
        console.warn("Login not confirmed; skipping message checks.");
        return;
    }

    const selectedUsersResult = await chrome.storage.local.get('selectedUsers');
    const selectedUsers = selectedUsersResult.selectedUsers || [];

    console.log("Checking for new messages for users:", selectedUsers);

    for (const username of selectedUsers) {
        const userId = predefinedUsers[username];

        if (!userId) {
            console.error(`User ID not found for username: ${username}`);
            continue;
        }

        console.log(`Processing user: ${username}, userId: ${userId}`);

        try {
            const messages = await fetchUserMessages(userId);
            if (messages.length > 0) {
                const latestMessageByType = { chat: null, thread: null };

                for (const message of messages) {
                    const messageId = message._id;
                    const messageType = determineMessageType(message);

                    if (messageType !== 'motd' && !lastMessageIds[messageType]) {
                        lastMessageIds[messageType] = {};
                    }

                    if (messageType !== 'motd' &&
                        (!latestMessageByType[messageType] ||
                            new Date(message._source.time_created) > new Date(latestMessageByType[messageType]._source.time_created))) {
                        latestMessageByType[messageType] = message;
                    }
                }

                for (const [messageType, latestMessage] of Object.entries(latestMessageByType)) {
                    if (latestMessage && lastMessageIds[messageType][username] !== latestMessage._id) {
                        await createNotification(latestMessage, username);
                        lastMessageIds[messageType][username] = latestMessage._id;
                        console.log(`Notification sent for user ${username}, messageId: ${latestMessage._id}, type: ${messageType}`);
                    } else if (latestMessage) {
                        console.log(`Duplicate notification avoided for user ${username}, messageId: ${latestMessage._id}, type: ${messageType}`);
                    }
                }

                chrome.storage.local.set({ lastMessageIds });
            } else {
                console.log(`No new messages for userId ${userId}.`);
            }
        } catch (error) {
            console.error(`Error fetching messages for user ${username}:`, error);
        }
    }
}

async function checkForMotdUpdates() {
    const lobbies = [
        { id: "38230", name: "sc-testing-chat" },
        { id: "1355241", name: "etf-testing-chat" }
    ];

    for (const lobby of lobbies) {
        try {
            const data = await fetchMotd(lobby.id, lobby.name);
            if (data?.motd) {
                const motdMessage = data.motd.message;
                const lastModified = data.motd.last_modified;

                if (motdMessage && lastModified !== lastMessageIds.motd) {
                    lastMessageIds.motd = lastModified;
                    await sendMotdNotification(motdMessage, lobby.name, lastModified, data.motd.community?.id);
                    console.log(`Notification sent for MoTD update in ${lobby.name}`);
                    chrome.storage.local.set({ lastMessageIds });
                } else {
                    console.log(`Duplicate MoTD notification avoided for lobby: ${lobby.name}`);
                }
            } else {
                console.error(`MoTD data is missing for lobby: ${lobby.name}`);
            }
        } catch (error) {
            console.error(`Error fetching MoTD for lobby ${lobby.name}:`, error.message);
        }
    }
}

function determineMessageType(message) {
    if (message._index === 'tavern_forum_thread_op' || message._index === 'tavern_forum_thread_reply') {
        return 'thread';
    } else if (message._index === 'tavern_message') {
        return 'chat';
    } else if (message.details?.member?.nickname === 'MoTD') {
        return 'motd';
    } else {
        return 'chat';
    }
}

let previousMotdTimestamps = {};
let motdInterval = null;

chrome.runtime.onStartup.addListener(() => {
    chrome.storage.local.get(['selectedUsers', 'interval', 'tracking'], async (result) => {
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

chrome.storage.local.get('trackMotd', (result) => {
    motdTrackingEnabled = result.trackMotd || false;
    if (motdTrackingEnabled) {
        startMotdTracking();
    }
});

function startMotdTracking() {
    if (!motdInterval && motdTrackingEnabled) {
        console.log("Starting MoTD tracking.");
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

chrome.storage.onChanged.addListener((changes) => {
    if (changes.trackMotd) {
        motdTrackingEnabled = changes.trackMotd.newValue;
        if (motdTrackingEnabled) {
            startMotdTracking();
        } else {
            stopMotdTracking();
        }
    }
});

async function fetchMotd(lobbyId, lobbyName) {
    console.log(`Starting fetch for MoTD in lobby: ${lobbyName || 'unknown'} (ID: ${lobbyId})`);
    try {
        const loginData = await getRSICookies();
        if (!loginData || !loginData.rsiToken) {
            console.warn("RSI cookies are missing; attempting re-login.");
            await ensureRSILogin();
            console.log("Re-attempting MoTD fetch after login...");
            return await fetchMotd(lobbyId, lobbyName);
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
                return null;
            }
            return data.data;
        } else {
            console.error(`Failed to fetch MoTD for lobby ${lobbyName}: ${response.status}`);
            return null;
        }
    } catch (error) {
        console.error(`Error fetching MoTD for lobby ${lobbyName}:`, error.message);
        return null;
    }
}

async function sendMotdNotification(message, lobbyName, lastModified, communityId) {
    const notificationId = `motd-${lobbyName}-${lastModified}`;
    const defaultAvatarUrl = chrome.runtime.getURL("icons/icon-48.png");

    chrome.storage.local.get('shownMessageIds', (result) => {
        const shownMessageIds = result.shownMessageIds || {};

        if (shownMessageIds[notificationId]) {
            console.log(`Notification for MoTD in ${lobbyName} already shown.`);
            return;
        }

        shownMessageIds[notificationId] = true;
        chrome.storage.local.set({ shownMessageIds });

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
                communityId,
                last_modified: lastModified
            }
        };

        createNotification(motdNotification, 'MoTD', defaultAvatarUrl, notificationMessage);
        console.log(`Notification sent for MoTD update in ${lobbyName}`);
    });
}

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    if (message.action === 'startTracking') {
        const interval = message.interval * 1000;

        clearInterval(trackingInterval);
        trackingInterval = null;
        loginNotificationShown = false;
        isLoginConfirmed = false;
        isRSITabOpened = false;
        spectrumTabId = null;
        isRedirecting = false;

        openSpectrumLoginPage().then(() => {
            console.log("Waiting for Spectrum login redirection confirmation...");

            chrome.tabs.onUpdated.addListener(function listener(tabId, changeInfo, tab) {
                if (tabId === spectrumTabId && changeInfo.status === "complete") {
                    chrome.tabs.get(tabId, async (updatedTab) => {
                        if (updatedTab.url === "https://robertsspaceindustries.com/spectrum/community/SC") {
                            console.log("User redirected correctly to Spectrum; login confirmed.");

                            closeRSILoginPage(spectrumTabId);
                            await openAndCloseMainRSIPage();

                            isLoginConfirmed = true;
                            trackingInterval = setInterval(() => {
                                checkForNewMessages();
                            }, interval);

                            console.log(`Tracking messages started at an interval of ${interval / 1000} seconds.`);

                            chrome.storage.local.get('trackMotd', (result) => {
                                if (result.trackMotd && !motdInterval) {
                                    startMotdTracking();
                                    console.log("MoTD tracking started after user-initiated tracking start.");
                                }
                            });

                            chrome.tabs.onUpdated.removeListener(listener);
                        } else {
                            console.log("Waiting for proper Spectrum redirection...");
                        }
                    });
                }
            });
        });

        sendResponse({ success: true });
    } else if (message.action === 'stopTracking') {
        stopTrackingService();
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

let isTrackingInitialized = false;

async function initializeTracking() {
    console.log("initializeTracking called");

    chrome.storage.local.get(['selectedUsers', 'interval', 'tracking', 'trackMotd'], async (result) => {
        const interval = result.interval || 60;

        loginNotificationShown = false;
        isLoginEnsured = false;
        loginTabId = null;

        await openSpectrumLoginPage().then(() => {
            ensureRSILogin().then(async () => {
                console.log("Login ensured for tracking.");

                await openAndCloseMainRSIPage();

                if (trackingInterval) clearInterval(trackingInterval);
                if (motdInterval) clearInterval(motdInterval);

                if (result.tracking) {
                    trackingInterval = setInterval(() => {
                        checkForNewMessages();
                    }, interval * 1000);
                    console.log("Tracking started/resumed at an interval of", interval, "seconds.");
                }

                if (result.trackMotd) {
                    motdTrackingEnabled = true;
                    startMotdTracking();
                    console.log("MoTD tracking started/resumed.");
                }

                isTrackingInitialized = true;
            });
        });
    });
}

chrome.runtime.onStartup.addListener(async () => {
    console.log("Browser startup detected. Initializing tracking...");
    await initializeTracking();
});

chrome.runtime.onInstalled.addListener(async (details) => {
    if (details.reason === 'install' || details.reason === 'update') {
        console.log("Extension installed or updated. Initializing tracking...");

        const { tracking } = await chrome.storage.local.get('tracking');
        if (tracking) {
            console.log("Tracker was active before installation or update. Restarting tracking...");
            await initializeTracking();
        }
    }
});

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
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

            chrome.tabs.onUpdated.addListener(function listener(tabId, changeInfo, tab) {
                if (tabId === spectrumTabId && changeInfo.status === "complete") {
                    chrome.tabs.get(tabId, async (updatedTab) => {
                        if (updatedTab.url === "https://robertsspaceindustries.com/spectrum/community/SC") {
                            console.log("User redirected correctly to Spectrum; login confirmed.");

                            closeRSILoginPage(spectrumTabId);

                            await openAndCloseMainRSIPage();

                            isLoginConfirmed = true;
                            trackingInterval = setInterval(() => {
                                checkForNewMessages();
                            }, interval);

                            console.log(`Tracking messages started at an interval of ${interval / 1000} seconds.`);

                            chrome.storage.local.get('trackMotd', (result) => {
                                if (result.trackMotd && !motdInterval) {
                                    motdTrackingEnabled = true;
                                    startMotdTracking();
                                    console.log("MoTD tracking started after user-initiated tracking start.");
                                }
                            });

                            chrome.tabs.onUpdated.removeListener(listener);
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
