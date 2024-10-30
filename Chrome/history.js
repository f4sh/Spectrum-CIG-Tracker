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

let currentPage = 1;
const itemsPerPage = 5;
let currentDeveloperFilter = 'all';
let currentMessageTypeFilter = 'all';

document.addEventListener('DOMContentLoaded', () => {
    populateDeveloperDropdown();
    setupMessageTypeFilter();
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

function loadHistory() {
    chrome.storage.local.get('notificationsHistory', (result) => {
        const history = result.notificationsHistory || [];
        history.sort((a, b) => new Date(b.timeCreated) - new Date(a.timeCreated));

        const filteredHistory = filterHistoryByDeveloperAndType(history);
        const totalPages = Math.ceil(filteredHistory.length / itemsPerPage);
        const historyContainer = document.getElementById('historyContainer');
        const paginationContainer = document.getElementById('paginationContainer');

        historyContainer.innerHTML = '';

        const start = (currentPage - 1) * itemsPerPage;
        const end = start + itemsPerPage;
        const itemsToShow = filteredHistory.slice(start, end);

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
    });
}

function formatMessage(message) {
    return message
        .replace(/(Audience: )/g, `<br><br><strong>Audience:</strong> `)
        .replace(/(Alpha Patch [\d.]+):/g, `<strong>$1:</strong><br>`)
        .replace(/Server Info: /g, `<br><strong>Server Info:</strong> `)
        .replace(/Long Term Persistence:/g, `<br><strong>Long Term Persistence:</strong>`)
        .replace(/Testing\/Feedback Focus/g, `<br><strong>Testing/Feedback Focus</strong><br>`)
        .replace(/New Global Event:/g, `<br><strong>New Global Event:</strong>`)
        .replace(/Known Issues/g, `<br><br><strong>Known Issues</strong><br>`)
        .replace(/Features & Gameplay/g, `<br><br><strong>Features & Gameplay</strong><br>`)
        .replace(/Bug Fixes/g, `<br><br><strong>Bug Fixes</strong><br>`)
        .replace(/Technical/g, `<br><br><strong>Technical</strong><br>`)
        .replace(/Fixed - /g, `<br>• Fixed - `)
        .replace(/\n/g, '<br>');
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
