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
let isLoginEnsured = false;
let loginTabId = null;
let currentCookies = {};
let isLoggingIn = false;
let initialToken = null;
let tokenChangeTimeout = null;
let redirectionTimeout = null;
let rsiTabId = null;
let spectrumTabId = null;

const motdCheckInterval = 60000;

chrome.cookies.onChanged.addListener(async (changeInfo) => {
    const isSpectrumPath = changeInfo.cookie.domain.includes("robertsspaceindustries.com") && changeInfo.cookie.path.includes("/spectrum");

    if (isSpectrumPath) {
        if (!isLoggingIn && (changeInfo.cookie.name === "Rsi-Token" || changeInfo.cookie.name === "Rsi-XSRF")) {
            console.log(`Cookie change detected on Spectrum: ${changeInfo.cookie.name}`);
            currentCookies = await getRSICookies();
            console.log("Updated current cookies:", currentCookies);
        } else if (isLoggingIn && changeInfo.cookie.name === "Rsi-Token") {
            const newToken = changeInfo.cookie.value;
            console.log(`Detected Rsi-Token change on Spectrum: old token = ${initialToken}, new token = ${newToken}`);

            if (initialToken !== newToken) {
                console.log("Rsi-Token changed; user likely logged in.");
                loginTabId = null;
                isLoggingIn = false;
            } else {
                console.log("Rsi-Token unchanged; still waiting for login...");
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
    if (tabId) {
        chrome.tabs.remove(tabId, () => {
            console.log("Closed RSI login page, tab ID:", tabId);
        });
    }
}

async function openAndCloseMainRSIPage() {
    return new Promise((resolve) => {
        chrome.tabs.query({ url: 'https://robertsspaceindustries.com/*' }, (tabs) => {
            if (tabs.length > 0) {
                rsiTabId = tabs[0].id;
                console.log("RSI page already open, reusing tab ID:", rsiTabId);
                resolve();
            } else {
                chrome.tabs.create({ url: 'https://robertsspaceindustries.com/' }, (tab) => {
                    rsiTabId = tab.id;
                    console.log("Opened main RSI page to retrieve cookies.");

                    setTimeout(() => {
                        closeRSILoginPage(rsiTabId);
                        rsiTabId = null;
                        resolve();
                    }, 2000);
                });
            }
        });
    });
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
    return new Promise((resolve) => {
        chrome.tabs.query({ url: 'https://robertsspaceindustries.com/connect?jumpto=/spectrum/community/SC' }, (tabs) => {
            if (tabs.length > 0) {
                spectrumTabId = tabs[0].id;
                console.log("Spectrum login page already open, reusing tab ID:", spectrumTabId);
                resolve(spectrumTabId);
            } else {
                chrome.tabs.create({ url: 'https://robertsspaceindustries.com/connect?jumpto=/spectrum/community/SC' }, (tab) => {
                    if (tab && tab.id) {
                        spectrumTabId = tab.id;
                        console.log("Opened Spectrum login page.");
                    } else {
                        console.error("Failed to open login page: No tab ID available.");
                    }

                    redirectionTimeout = setTimeout(async () => {
                        console.log("Redirection to Spectrum community page not detected in time.");
                        await notifyUserRedirectionFailed();
                        spectrumTabId = null;
                    }, 5000);

                    resolve(tab ? tab.id : null);
                });
            }
        });
    });
}

chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
    if (changeInfo.url === 'https://robertsspaceindustries.com/spectrum/community/SC' && tabId === spectrumTabId) {
        console.log("Detected redirection to Spectrum community page; closing the tab.");
        clearTimeout(redirectionTimeout);
        closeRSILoginPage(tabId);
        spectrumTabId = null;
    }
});

async function ensureRSILogin() {
    try {
        console.log("Ensuring RSI login...");
        await openAndCloseMainRSIPage();
        console.log("Proceeding to Spectrum login page.");
        await openSpectrumLoginPage();
    } catch (error) {
        console.error("Error in ensureRSILogin:", error.message);
        setTimeout(async () => {
            try {
                console.log("Retrying RSI login...");
                await openSpectrumLoginPage();
            } catch (retryError) {
                console.error("Retry failed in ensureRSILogin:", retryError.message);
            }
        }, 2000);
    }
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
                console.warn("Required Spectrum cookies not found. Login required.");
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
            return fetchUserMessages(userId, retryCount + 1);
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

        console.log(`Fetching messages for userId: ${userId}`);
        console.log("Request Payload:", JSON.stringify(body, null, 2));
        console.log("Headers - x-rsi-token:", rsiToken, ", x-tavern-id:", tavernId);

        const headers = {
            'accept': 'application/json',
            'content-type': 'application/json',
            'x-rsi-token': rsiToken,
            'x-tavern-id': tavernId,
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/85.0.4183.121 Safari/537.36'
        };
        if (xsrfToken) headers['x-rsi-xsrf'] = xsrfToken;

        const response = await fetch("https://robertsspaceindustries.com/api/spectrum/search/content/extended", {
            method: 'POST',
            headers,
            body: JSON.stringify(body),
            credentials: 'include'
        });

        if (response.ok) {
            const data = await response.json();
            if (data && data.data && data.data.hits && Array.isArray(data.data.hits.hits)) {
                console.log(`Messages retrieved for userId ${userId}:`, data.data.hits.hits);
                return data.data.hits.hits;
            } else {
                throw new Error('Invalid response structure: no hits found');
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

async function createNotification(message, username, avatarUrl = null) {
    const source = message._source;
    const details = message.details;

    const notificationAvatarUrl = avatarUrl || details?.member?.avatar || 'icons/icon-48.png';
    const timeCreated = username === "MoTD" ? new Date(details.last_modified * 1000).toLocaleString() : new Date(source.time_created).toLocaleString();
    const messageId = message._id;

    let lobbyName = "Unknown Lobby";
    let titleText = `${details?.member?.nickname || 'Unknown'} posted a message`;
    let contextMessage = `Posted on: ${timeCreated} in ${lobbyName}`;

    if (username === "MoTD") {
        lobbyName = details.lobby?.name || "MoTD Lobby";
        titleText = `MoTD in ${lobbyName} changed`;
        contextMessage = `Updated on: ${timeCreated}`;
    } else if (message._index === 'tavern_message') {
        lobbyName = details.lobby?.name || details.channel?.name || "Chat Lobby";
    } else if (message._index === 'tavern_forum_thread_reply') {
        lobbyName = details.thread?.title || details.channel?.name || "Forum Thread";
    }

    contextMessage = username === "MoTD" ? `Updated on: ${timeCreated}` : `Posted on: ${timeCreated} in ${lobbyName}`;

    const communitySlug = details.community?.slug === 'SC' ? 'SC' : details.community?.slug || 'SC';
    let messageLink = null;
    if (username !== "MoTD") {
        if (message._index === 'tavern_forum_thread_reply') {
            const threadDetails = details.thread || {};
            const threadSlug = threadDetails.slug || 'unknown-slug';
            messageLink = `https://robertsspaceindustries.com/spectrum/community/${communitySlug}/forum/3/thread/${threadSlug}/${messageId}`;
        } else if (message._index === 'tavern_message') {
            const lobbyId = details.lobby?.id || 'undefined';
            messageLink = `https://robertsspaceindustries.com/spectrum/community/${communitySlug}/lobby/${lobbyId}/message/${messageId}`;
        } else {
            messageLink = `https://robertsspaceindustries.com/spectrum/community/${communitySlug}/message/${messageId}`;
        }
    }

    const notificationOptions = {
        type: "basic",
        iconUrl: notificationAvatarUrl,
        title: titleText,
        message: source.body,
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
                body: source.body,
                title: notificationOptions.title
            };

            if (history.length >= 50) {
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

async function checkForNewMessages() {
    chrome.storage.local.get('shownMessageIds', async (result) => {
        let shownMessageIds = result.shownMessageIds || {};

        chrome.storage.local.get('selectedUsers', async (result) => {
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

                        console.log(`Latest message for userId ${userId}:`, latestMessage);

                        if (!shownMessageIds[username] || shownMessageIds[username] !== messageId) {
                            await createNotification(latestMessage, username);
                            shownMessageIds[username] = messageId;
                            chrome.storage.local.set({ shownMessageIds });
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

function startMotdTracking() {
    if (!motdInterval) {
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

chrome.storage.onChanged.addListener((changes) => {
    if (changes.trackMotd) {
        if (changes.trackMotd.newValue) {
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
            return fetchMotd(lobbyId, lobbyName); // Retry fetch after re-login
        }

        const { rsiToken, xsrfToken } = loginData;
        const tavernId = generateTavernId();
        console.log(`Generated tavern ID: ${tavernId}`);

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

        console.log(`MoTD fetch response status for ${lobbyName}: ${response.status}`);

        if (response.ok) {
            const data = await response.json();
            console.log(`MoTD response data for ${lobbyName}:`, data);

            const motdMessage = data.data.motd?.message;
            const lastModified = data.data.motd?.last_modified;

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
    const defaultAvatarUrl = chrome.runtime.getURL("icons/icon-48.png");

    chrome.storage.local.get('shownMessageIds', (result) => {
        let shownMessageIds = result.shownMessageIds || {};

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

        if (!trackingInterval) {
            trackingInterval = setInterval(() => {
                checkForNewMessages();
            }, interval);

            ensureRSILogin().then(() => {
                console.log("Login ensured for tracking.");
            });

            console.log(`Started tracking messages at an interval of ${message.interval} seconds.`);

            chrome.storage.local.get('trackMotd', (result) => {
                if (result.trackMotd && !motdInterval) {
                    startMotdTracking();
                }
            });
        }

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

chrome.runtime.onStartup.addListener(async () => {
    chrome.storage.local.get(['selectedUsers', 'interval', 'tracking', 'trackMotd'], async (result) => {
        const interval = result.interval || 60;

        loginNotificationShown = false;
        isLoginEnsured = false;
        loginTabId = null;

        try {
            const cookies = await getRSICookies();
            if (!cookies) {
                await notifyUserToLogIn();
                loginNotificationShown = true;
            }
        } catch (error) {
            if (!loginNotificationShown) {
                await notifyUserToLogIn();
                loginNotificationShown = true;
            }
        }

        if (result.tracking && !trackingInterval) {
            trackingInterval = setInterval(() => {
                checkForNewMessages();
            }, interval * 1000);
            console.log("User tracking resumed on startup at an interval of", interval, "seconds.");
        }

        if (result.trackMotd && !motdInterval) {
            startMotdTracking();
            console.log("MoTD tracking resumed on startup.");
        }
    });
});

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    if (message.action === 'startTracking') {
        const interval = message.interval * 1000;

        if (!trackingInterval) {
            trackingInterval = setInterval(() => {
                checkForNewMessages();
            }, interval);

            ensureRSILogin().then(() => {
                console.log("Login ensured for tracking.");
            });

            console.log(`Started tracking messages at an interval of ${message.interval} seconds.`);

            chrome.storage.local.get('trackMotd', (result) => {
                if (result.trackMotd && !motdInterval) {
                    startMotdTracking();
                }
            });
        }

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
