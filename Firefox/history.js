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
    'Proxus-CIG': 478,
    'Spectral-CIG': 4178
};

let currentPage = 1;
const itemsPerPage = 10;
let currentDeveloperFilter = 'all';
let currentMessageTypeFilter = 'all';
let currentDateFilter = 'all';

document.addEventListener('DOMContentLoaded', () => {
    console.log("DOM fully loaded and parsed.");

    populateDeveloperDropdown();
    setupMessageTypeFilter();
    setupDateFilter();
    loadHistory();

    const clearButton = document.getElementById('clearHistoryButton');
    if (clearButton) {
        clearButton.addEventListener('click', () => {
            console.log("Clear History button clicked.");
            clearHistory();
        });
    } else {
        console.error("Clear History button not found in the DOM.");
    }
});

browser.storage.onChanged.addListener((changes, namespace) => {
    if (namespace === 'local' && changes.notificationsHistory) {
        loadHistory();
    }
});

function populateDeveloperDropdown() {
    const developerDropdown = document.getElementById('developerFilter');
    developerDropdown.innerHTML = '<option value="all">All Developers</option>';

    const motdOption = document.createElement('option');
    motdOption.value = 'MoTD';
    motdOption.textContent = 'MoTD';
    developerDropdown.appendChild(motdOption);

    for (const username in predefinedUsers) {
        const option = document.createElement('option');
        option.value = username;
        option.textContent = username;
        developerDropdown.appendChild(option);
    }

    developerDropdown.addEventListener('change', () => {
        currentDeveloperFilter = developerDropdown.value;
        currentPage = 1;
        loadHistory();
    });
}

function setupMessageTypeFilter() {
    const messageTypeFilter = document.getElementById('messageTypeFilter');
    messageTypeFilter.addEventListener('change', () => {
        currentMessageTypeFilter = messageTypeFilter.value;
        currentPage = 1;
        loadHistory();
    });
}

function setupDateFilter() {
    const dateFilter = document.getElementById('dateFilter');
    dateFilter.innerHTML = '<option value="all">All Days</option><option value="today">Today</option><option value="yesterday">Yesterday</option>';

    dateFilter.addEventListener('change', () => {
        currentDateFilter = dateFilter.value;
        currentPage = 1;
        loadHistory();
    });
}

function loadHistory() {
    browser.storage.local.get('notificationsHistory').then((result) => {
        const history = result.notificationsHistory || [];

        history.forEach(notification => {
            const dateRegex = /(\d{4})-(\d{2})-(\d{2}), (\d{1,2}):(\d{2}):(\d{2}) ([ap]\.m\.)/i;
            const match = notification.timeCreated.match(dateRegex);

            if (match) {
                let [_, year, month, day, hours, minutes, seconds, period] = match;
                hours = parseInt(hours, 10);
                minutes = parseInt(minutes, 10);
                seconds = parseInt(seconds, 10);

                if (period.toLowerCase() === 'p.m.' && hours !== 12) {
                    hours += 12;
                } else if (period.toLowerCase() === 'a.m.' && hours === 12) {
                    hours = 0;
                }

                notification.notificationDate = new Date(year, month - 1, day, hours, minutes, seconds);
            } else {
                console.warn("Date format did not match expected pattern:", notification.timeCreated);
                notification.notificationDate = new Date(0);
            }
        });

        history.sort((a, b) => b.notificationDate - a.notificationDate);

        const uniqueHistory = removeDuplicateMessages(history);

        const filteredHistory = filterHistoryByDeveloperAndType(uniqueHistory);
        const dateFilteredHistory = filterHistoryByDate(filteredHistory);
        const totalPages = Math.ceil(dateFilteredHistory.length / itemsPerPage);
        const historyContainer = document.getElementById('historyContainer');
        const paginationContainer = document.getElementById('paginationContainer');

        historyContainer.textContent = '';
        paginationContainer.textContent = '';

        if (dateFilteredHistory.length === 0) {
            const noHistoryMessage = document.createElement('p');
            noHistoryMessage.textContent = 'No history available.';
            historyContainer.appendChild(noHistoryMessage);
            return;
        }

        const start = (currentPage - 1) * itemsPerPage;
        const end = start + itemsPerPage;
        const itemsToShow = dateFilteredHistory.slice(start, end);

        itemsToShow.forEach(notification => {
            const item = document.createElement('div');
            item.classList.add('notification-block');

            const header = document.createElement('div');
            header.classList.add('notification-header');

            if (notification.username !== "MoTD") {
                const avatar = document.createElement('img');
                avatar.src = notification.avatarUrl;
                avatar.alt = notification.username;
                avatar.classList.add('notification-avatar');
                header.appendChild(avatar);
            }

            const titleContainer = document.createElement('div');

            const title = document.createElement('div');
            title.classList.add('notification-title');
            if (notification.username !== "MoTD") {
                const usernameLink = document.createElement('a');
                usernameLink.href = `https://robertsspaceindustries.com/spectrum/search?member=${encodeURIComponent(notification.username)}&page=1&q=&range=day&role&scopes=op%2Creply%2Cchat&sort=latest&visibility=nonerased`;
                usernameLink.target = "_blank";
                usernameLink.classList.add('notification-username');
                usernameLink.textContent = notification.username;
                title.appendChild(usernameLink);
            } else {
                title.textContent = notification.username;
            }
            titleContainer.appendChild(title);

            const time = document.createElement('div');
            time.classList.add('notification-time');
            time.textContent = `${notification.notificationDate.toLocaleString()} in ${notification.lobbyName}`;
            titleContainer.appendChild(time);

            header.appendChild(titleContainer);
            item.appendChild(header);

            const body = document.createElement('div');
            body.classList.add('notification-body');
            body.appendChild(formatMessage(notification.body));
            item.appendChild(body);

            if (notification.username !== "MoTD") {
                const viewMessageLink = document.createElement('a');
                viewMessageLink.href = notification.messageLink;
                viewMessageLink.target = "_blank";
                viewMessageLink.classList.add('notification-link');
                viewMessageLink.textContent = 'View Message';
                item.appendChild(viewMessageLink);
            }

            const copyLink = document.createElement('a');
            copyLink.href = "#";
            copyLink.classList.add('copy-link');
            copyLink.dataset.username = notification.username;
            copyLink.dataset.lobby = notification.lobbyName;
            copyLink.dataset.time = notification.notificationDate.toLocaleString();
            copyLink.dataset.body = notification.body;
            copyLink.textContent = 'Copy Message';
            copyLink.addEventListener('click', (event) => {
                event.preventDefault();
                copyNotification(copyLink);
            });
            item.appendChild(copyLink);

            historyContainer.appendChild(item);
        });

        for (let i = 1; i <= totalPages; i++) {
            const pageButton = document.createElement('button');
            pageButton.textContent = i;
            pageButton.classList.add('page-button');
            if (i === currentPage) pageButton.classList.add('active');
            pageButton.addEventListener('click', () => {
                currentPage = i;
                loadHistory();
            });
            paginationContainer.appendChild(pageButton);
        }
    });
}

function removeDuplicateMessages(history) {
    const uniqueMessages = {};

    return history.filter(notification => {
        const key = `${notification.username}-${notification.messageLink}-${notification.lobbyName}`;

        if (!uniqueMessages[key]) {
            uniqueMessages[key] = true;
            return true;
        }
        return false;
    });
}

function copyNotification(element) {
    const username = element.getAttribute('data-username');
    const lobby = element.getAttribute('data-lobby');
    const timeCreated = element.getAttribute('data-time');
    const body = element.getAttribute('data-body');

    const formattedText = `
\`\`\`
${body}
\`\`\`
~ ${username} in ${lobby} ${timeCreated}
    `;

    navigator.clipboard.writeText(formattedText.trim()).then(() => {
        alert("Message copied to clipboard!");
        console.log("Message copied:", formattedText);
    }).catch(err => {
        console.error("Error copying message:", err);
    });
}

function clearHistory() {
    console.log("clearHistory function called.");

    const userConfirmed = confirm("Are you sure you want to delete the history? This action cannot be undone.");
    if (userConfirmed) {
        browser.storage.local.remove('notificationsHistory').then(() => {
            console.log("Notification history cleared.");

            currentPage = 1;
            loadHistory();

            const historyContainer = document.getElementById('historyContainer');
            historyContainer.innerHTML = '<p>No history available.</p>';
            document.getElementById('paginationContainer').textContent = '';
        }).catch((error) => {
            console.error("Error clearing notification history:", error);
        });
    } else {
        console.log("History deletion canceled by the user.");
    }
}

function formatMessage(message) {
    const fragment = document.createDocumentFragment();
    const replacements = [
        { regex: /Audience: /g, tag: 'strong', label: 'Audience: ' },
        { regex: /Alpha Patch [\d.]+:/g, tag: 'strong' },
        { regex: /Server Info: /g, tag: 'strong', label: 'Server Info: ' },
        { regex: /Long Term Persistence:/g, tag: 'strong', label: 'Long Term Persistence:' },
        { regex: /Testing\/Feedback Focus/g, tag: 'strong', label: 'Testing/Feedback Focus' },
        { regex: /New Global Event:/g, tag: 'strong', label: 'New Global Event:' },
        { regex: /Known Issues/g, tag: 'strong', label: 'Known Issues' },
        { regex: /Features & Gameplay/g, tag: 'strong', label: 'Features & Gameplay' },
        { regex: /Bug Fixes/g, tag: 'strong', label: 'Bug Fixes' },
        { regex: /Technical/g, tag: 'strong', label: 'Technical' },
        { regex: /Fixed - /g, tag: 'span', prefix: '• Fixed - ' }
    ];

    const sections = message.split(/(?<=[.!?])\s|\n/);

    sections.forEach(section => {
        const p = document.createElement('p');

        replacements.forEach(({ regex, tag, label, prefix }) => {
            if (regex.test(section)) {
                const parts = section.split(regex);

                parts.forEach((part, index) => {
                    if (index > 0) {
                        const element = document.createElement(tag);
                        element.textContent = label || part.trim();
                        p.appendChild(element);

                        if (prefix) {
                            const prefixNode = document.createTextNode(prefix);
                            p.insertBefore(prefixNode, element);
                        }
                    } else {
                        const textNode = document.createTextNode(part);
                        p.appendChild(textNode);
                    }
                });
                section = '';
            }
        });

        const urlRegex = /(https?:\/\/[^\s.,!?;)]+)/g;
        let lastIndex = 0;
        let match;

        while ((match = urlRegex.exec(section)) !== null) {
            const textBeforeLink = section.slice(lastIndex, match.index);
            if (textBeforeLink) {
                p.appendChild(document.createTextNode(textBeforeLink));
            }

            const link = document.createElement('a');
            link.href = match[0];
            link.textContent = match[0];
            link.target = "_blank";
            link.classList.add("notification-url");
            p.appendChild(link);

            lastIndex = match.index + match[0].length;
        }

        p.appendChild(document.createTextNode(section.slice(lastIndex)));

        fragment.appendChild(p);
    });

    return fragment;
}

function filterHistoryByDeveloperAndType(history) {
    return history.filter(notification => {
        const developerMatch = (currentDeveloperFilter === 'all' || notification.username === currentDeveloperFilter);
        const isMotd = notification.username === 'MoTD';
        const isChat = notification.messageLink && notification.messageLink.includes('/lobby/');
        const isThread = notification.messageLink && notification.messageLink.includes('/forum/');

        const messageTypeMatch = (
            currentMessageTypeFilter === 'all' ||
            (currentMessageTypeFilter === 'chat' && isChat) ||
            (currentMessageTypeFilter === 'thread' && isThread) ||
            (currentMessageTypeFilter === 'motd' && isMotd)
        );

        return developerMatch && messageTypeMatch;
    });
}

function filterHistoryByDate(history) {
    const now = new Date();
    const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const yesterdayStart = new Date(todayStart);
    yesterdayStart.setDate(todayStart.getDate() - 1);

    return history.filter(notification => {
        const timeCreated = notification.timeCreated;

        const dateRegex = /(\d{4})-(\d{2})-(\d{2}), (\d{1,2}):(\d{2}):(\d{2}) ([ap]\.m\.)/i;
        const match = timeCreated.match(dateRegex);

        if (!match) {
            console.warn("Date format did not match expected pattern:", timeCreated);
            return false;
        }

        let [_, year, month, day, hours, minutes, seconds, period] = match;
        hours = parseInt(hours, 10);
        minutes = parseInt(minutes, 10);
        seconds = parseInt(seconds, 10);

        if (period.toLowerCase() === 'p.m.' && hours !== 12) {
            hours += 12;
        } else if (period.toLowerCase() === 'a.m.' && hours === 12) {
            hours = 0;
        }

        const notificationDate = new Date(year, month - 1, day, hours, minutes, seconds);

        if (currentDateFilter === 'today') {
            return notificationDate >= todayStart && notificationDate < now;
        } else if (currentDateFilter === 'yesterday') {
            return notificationDate >= yesterdayStart && notificationDate < todayStart;
        }

        return true;
    });
}
