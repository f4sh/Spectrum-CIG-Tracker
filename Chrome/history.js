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
    populateDeveloperDropdown();
    setupMessageTypeFilter();
    setupDateFilter();
    loadHistory();
});

chrome.storage.onChanged.addListener((changes, namespace) => {
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
    chrome.storage.local.get('notificationsHistory', (result) => {
        const history = result.notificationsHistory || [];

        history.sort((a, b) => new Date(b.timeCreated) - new Date(a.timeCreated));

        const uniqueHistory = removeDuplicateMessages(history);

        const filteredHistory = filterHistoryByDeveloperAndType(uniqueHistory);
        const dateFilteredHistory = filterHistoryByDate(filteredHistory);
        const totalPages = Math.ceil(dateFilteredHistory.length / itemsPerPage);
        const historyContainer = document.getElementById('historyContainer');
        const paginationContainer = document.getElementById('paginationContainer');

        historyContainer.innerHTML = '';

        if (dateFilteredHistory.length === 0) {
            historyContainer.innerHTML = '<p>No history available.</p>';
            paginationContainer.innerHTML = '';
            return;
        }

        const start = (currentPage - 1) * itemsPerPage;
        const end = start + itemsPerPage;
        const itemsToShow = dateFilteredHistory.slice(start, end);

        itemsToShow.forEach(notification => {
            const item = document.createElement('div');
            item.classList.add('notification-block');

            const formattedBody = formatMessage(notification.body);

            const usernameLink = notification.username !== "MoTD"
                ? `<a href="https://robertsspaceindustries.com/spectrum/search?member=${encodeURIComponent(notification.username)}&page=1&q=&range=day&role&scopes=op%2Creply%2Cchat&sort=latest&visibility=nonerased" target="_blank" class="notification-username">${notification.username}</a>`
                : notification.username;

            item.innerHTML = `
                <div class="notification-header">
                    ${notification.username !== "MoTD" ? `<img src="${notification.avatarUrl}" alt="${notification.username}" class="notification-avatar">` : ''}
                    <div>
                        <div class="notification-title">${usernameLink}</div>
                        <div class="notification-time">${notification.timeCreated} in ${notification.lobbyName}</div>
                    </div>
                </div>
                <div class="notification-body">${formattedBody}</div>
                ${notification.username !== "MoTD" ? `<a href="${notification.messageLink}" target="_blank" class="notification-link">View Message</a>` : ''}
                <a href="#" class="copy-link" data-username="${notification.username}" data-lobby="${notification.lobbyName}" data-time="${notification.timeCreated}" data-body="${notification.body}">Copy Message</a>
            `;
            historyContainer.appendChild(item);
        });

        paginationContainer.innerHTML = '';
        for (let i = 1; i <= totalPages; i++) {
            const pageButton = document.createElement('button');
            pageButton.innerText = i;
            pageButton.classList.add('page-button');
            if (i === currentPage) pageButton.classList.add('active');
            pageButton.addEventListener('click', () => {
                currentPage = i;
                loadHistory();
            });
            paginationContainer.appendChild(pageButton);
        }

        document.querySelectorAll('.copy-link').forEach(link => {
            link.addEventListener('click', (event) => {
                event.preventDefault();
                copyNotification(event.target);
            });
        });
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

document.addEventListener('DOMContentLoaded', () => {
    populateDeveloperDropdown();
    setupMessageTypeFilter();
    setupDateFilter();
    loadHistory();

    const clearHistoryButton = document.getElementById('clearHistoryButton');
    clearHistoryButton.addEventListener('click', () => {
        clearHistory();
    });
});

function clearHistory() {
    const userConfirmed = confirm("Are you sure you want to delete the history? This action cannot be undone.");
    if (userConfirmed) {
        chrome.storage.local.remove('notificationsHistory', () => {
            console.log("Notification history cleared.");
            loadHistory();
        });
    } else {
        console.log("History deletion canceled by the user.");
    }
}

function formatMessage(message) {
    message = message.replace(/(https?:\/\/[^\s]+[^\s.,!?;)])/g, '<a href="$1" target="_blank" class="notification-url">$1</a>');
    message = message.replace(/([.!?])\s+/g, '$1<br><br>');

    return message
        .replace(/(Audience: )/g, `<br><br><strong>Audience:</strong> `)
        .replace(/(Alpha Patch [\d.]+):/g, `<strong>$1:</strong><br><br>`)
        .replace(/Server Info: /g, `<br><br><strong>Server Info:</strong> `)
        .replace(/Long Term Persistence:/g, `<br><br><strong>Long Term Persistence:</strong>`)
        .replace(/Testing\/Feedback Focus/g, `<br><br><strong>Testing/Feedback Focus</strong><br><br>`)
        .replace(/New Global Event:/g, `<br><br><strong>New Global Event:</strong>`)
        .replace(/Known Issues/g, `<br><br><strong>Known Issues</strong><br><br>`)
        .replace(/Features & Gameplay/g, `<br><br><strong>Features & Gameplay</strong><br><br>`)
        .replace(/Bug Fixes/g, `<br><br><strong>Bug Fixes</strong><br><br>`)
        .replace(/Technical/g, `<br><br><strong>Technical</strong><br><br>`)
        .replace(/\n/g, '<br><br>');
}


function filterHistoryByDeveloperAndType(history) {
    return history.filter(notification => {
        const developerMatch = (currentDeveloperFilter === 'all' || notification.username === currentDeveloperFilter);
        const messageTypeMatch = (
            currentMessageTypeFilter === 'all' ||
            (currentMessageTypeFilter === 'chat' && notification.messageLink && notification.messageLink.includes('/lobby/')) ||
            (currentMessageTypeFilter === 'thread' && notification.messageLink && notification.messageLink.includes('/forum/')) ||
            (currentMessageTypeFilter === 'all' && notification.username === 'MoTD')
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
        const notificationDate = new Date(notification.timeCreated);

        if (currentDateFilter === 'today') {
            return notificationDate >= todayStart && notificationDate < now;
        } else if (currentDateFilter === 'yesterday') {
            return notificationDate >= yesterdayStart && notificationDate < todayStart;
        }
        return true;
    });
}
