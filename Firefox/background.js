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

browser.cookies.onChanged.addListener(async (changeInfo) => {
    const isSpectrumCookie = changeInfo.cookie.domain.includes("robertsspaceindustries.com") && changeInfo.cookie.path.includes("/spectrum");

    if (isSpectrumCookie) {
        const cookieName = changeInfo.cookie.name;

        if ((cookieName === "Rsi-Token" || cookieName === "Rsi-XSRF") && !isLoginRequired) {
            currentCookies = await getRSICookies();
            console.log("Current cookies updated:", currentCookies);

            if (currentCookies && loginTabId) {
                clearTimeout(cookieTimeout);
                closeRSILoginPage(loginTabId);
                loginTabId = null;
                isRSITabOpened = false;
            }
        } else if (isLoginRequired && cookieName === "Rsi-Token") {
            const newToken = changeInfo.cookie.value;
            console.log("Detected Rsi-Token change on Spectrum.");

            if (initialToken !== newToken) {
                console.log("Rsi-Token changed; login confirmed.");
                isLoginRequired = false;
                closeRSILoginPage(loginTabId);
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

    const tab = await browser.tabs.create({
        url: 'https://robertsspaceindustries.com/connect?jumpto=/spectrum/community/SC',
        active: false
    });
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

browser.tabs.onUpdated.addListener((tabId, changeInfo) => {
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
        const tab = await browser.tabs.create({
            url: 'https://robertsspaceindustries.com/',
            active: false
        });
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
    await browser.cookies.remove({ url: 'https://robertsspaceindustries.com', name: 'Rsi-Token' });
    await browser.cookies.remove({ url: 'https://robertsspaceindustries.com', name: 'Rsi-XSRF' });
    console.log("Cleared RSI cookies.");
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
                const map = communityId === "1" ? emojiMap : avocadoEmojiMap;
                map[`:${emoji.short_name}:`] = emoji.media_url;
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

    const formattedMessage = formatMessageWithEmojis(source.body, details.community.id);

    const notificationOptions = {
        type: "basic",
        iconUrl: notificationAvatarUrl,
        title: titleText,
        message: formattedMessage,
        contextMessage: contextMessage,
        priority: 2
    };

    const notificationId = await browser.notifications.create(messageId, notificationOptions);
    console.log(`Notification created for messageId: ${messageId}, username: ${username}`);

    const stats = await browser.storage.local.get(['notificationsHistory', 'notificationsShown', 'notificationsClicked']);
    let shownCount = (stats.notificationsShown || 0) + 1;
    await browser.storage.local.set({ notificationsShown: shownCount });

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
    await browser.storage.local.set({ notificationsHistory: history });
    console.log("Notification added to history:", newNotification);

    if (username !== "MoTD" && messageLink) {
        const listener = async (id) => {
            if (id === notificationId) {
                const stats = await browser.storage.local.get('notificationsClicked');
                let clickedCount = (stats.notificationsClicked || 0) + 1;
                await browser.storage.local.set({ notificationsClicked: clickedCount });
                console.log(`Notification clicked for messageId: ${messageId}`);

                const tabs = await browser.tabs.query({ url: messageLink });
                if (tabs.length > 0) {
                    await browser.tabs.update(tabs[0].id, { active: true });
                    console.log(`Focused existing tab for messageId: ${messageId}`);
                } else {
                    await browser.tabs.create({ url: messageLink });
                    console.log(`Opened new tab for messageId: ${messageId}`);
                }

                browser.notifications.onClicked.removeListener(listener);
            }
        };
        browser.notifications.onClicked.addListener(listener);
    }
}

const lastMessageIds = {};

async function checkForNewMessages() {
    if (!isLoginConfirmed) {
        console.warn("Login not confirmed; skipping message checks.");
        return;
    }

    const selectedUsersResult = await browser.storage.local.get('selectedUsers');
    const selectedUsers = selectedUsersResult.selectedUsers || [];

    console.log("Checking for new messages for users:", selectedUsers);

    for (const username of selectedUsers) {
        const userId = predefinedUsers[username];
        console.log(`Processing user: ${username}, userId: ${userId}`);

        try {
            const messages = await fetchUserMessages(userId);
            if (messages.length > 0) {
                for (const message of messages) {
                    const messageId = message._id;
                    const messageType = determineMessageType(message);

                    if (!lastMessageIds[messageType]) lastMessageIds[messageType] = {};

                    if (lastMessageIds[messageType][username] !== messageId) {
                        await createNotification(message, username);
                        lastMessageIds[messageType][username] = messageId;
                        console.log(`Notification sent for user ${username}, messageId: ${messageId}, type: ${messageType}`);
                    } else {
                        console.log(`No new ${messageType} messages for user ${username}; messageId: ${messageId} already shown.`);
                    }
                }
            } else {
                console.log(`No new messages for userId ${userId}.`);
            }
        } catch (error) {
            console.error(`Error fetching messages for user ${username}:`, error);
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
    if (motdTrackingEnabled && !motdInterval) {
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
        if (motdTrackingEnabled) {
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

    const result = await browser.storage.local.get('shownMessageIds');
    const shownMessageIds = result.shownMessageIds || {};

    if (shownMessageIds[notificationId]) {
        console.log(`Notification for MoTD in ${lobbyName} already shown.`);
        return;
    }

    shownMessageIds[notificationId] = true;
    await browser.storage.local.set({ shownMessageIds });

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
}

async function initializeTracking() {
    const result = await browser.storage.local.get(['selectedUsers', 'interval', 'tracking', 'trackMotd']);
    const intervalMinutes = (result.interval || 60) / 60;

    loginNotificationShown = false;
    loginTabId = null;
    isLoginEnsured = false;

    try {
        await openSpectrumLoginPage();
        await ensureRSILogin();
        console.log("Login ensured for tracking.");

        await openAndCloseMainRSIPage();

        if (result.tracking) {
            browser.alarms.create("messageCheckAlarm", { periodInMinutes: intervalMinutes });
            console.log(`Tracking started/resumed with alarm set at ${intervalMinutes} minute(s).`);
        }

        if (result.trackMotd) {
            startMotdTracking();
            console.log("MoTD tracking started/resumed.");
        }
    } catch (error) {
        console.error("Error during initializeTracking:", error.message);
    }
}


browser.runtime.onStartup.addListener(async () => {
    console.log("Browser startup detected. Initializing tracking...");
    await initializeTracking();
});

browser.runtime.onInstalled.addListener(async (details) => {
    if (details.reason === 'update' || details.reason === 'install') {
        console.log("Extension installed or updated. Initializing tracking...");

        const { tracking } = await browser.storage.local.get('tracking');
        if (tracking) {
            console.log("Tracker was active before the update. Restarting tracking...");
            await initializeTracking();
        }
    }
});

browser.alarms.onAlarm.addListener((alarm) => {
    if (alarm.name === "messageCheckAlarm") {
        console.log("Alarm triggered for checkForNewMessages.");
        checkForNewMessages();
    }
});

browser.runtime.onMessage.addListener((message, sender, sendResponse) => {
    if (message.action === 'startTracking') {
        const intervalMinutes = message.interval / 60;

        browser.alarms.clear("messageCheckAlarm").catch(() => console.warn("No previous alarm to clear"));
        trackingInterval = null;
        loginNotificationShown = false;
        isLoginConfirmed = false;
        isRSITabOpened = false;
        spectrumTabId = null;
        isRedirecting = false;

        openSpectrumLoginPage().then(() => {
            console.log("Waiting for Spectrum login redirection confirmation...");

            browser.tabs.onUpdated.addListener(function listener(tabId, changeInfo) {
                if (tabId === spectrumTabId && changeInfo.status === "complete") {
                    browser.tabs.get(tabId).then(async (updatedTab) => {
                        if (updatedTab.url === "https://robertsspaceindustries.com/spectrum/community/SC") {
                            console.log("User redirected correctly to Spectrum; login confirmed.");

                            closeRSILoginPage(spectrumTabId);
                            await openAndCloseMainRSIPage();

                            isLoginConfirmed = true;
                            browser.alarms.create("messageCheckAlarm", { periodInMinutes: intervalMinutes });
                            console.log(`Tracking messages started with alarm set to ${intervalMinutes} minute(s).`);

                            const result = await browser.storage.local.get('trackMotd');
                            if (result.trackMotd) {
                                startMotdTracking();
                                console.log("MoTD tracking started after user-initiated tracking start.");
                            }

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
        console.log("Stopped MoTD tracking.");
        sendResponse({ success: true });

    } else if (message.action === 'changeInterval') {
        if (trackingInterval) {
            clearInterval(trackingInterval);
            trackingInterval = setInterval(() => {
                checkForNewMessages();
            }, message.interval * 1000);
            console.log(`Changed tracking interval to ${message.interval} seconds.`);
        }
        sendResponse({ success: true });
    }
});
