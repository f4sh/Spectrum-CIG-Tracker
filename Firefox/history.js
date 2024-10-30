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

function loadHistory() {
    browser.storage.local.get('notificationsHistory').then((result) => {
        const history = result.notificationsHistory || [];
        history.sort((a, b) => new Date(b.timeCreated) - new Date(a.timeCreated));

        const filteredHistory = filterHistoryByDeveloperAndType(history);
        const totalPages = Math.ceil(filteredHistory.length / itemsPerPage);
        const historyContainer = document.getElementById('historyContainer');
        const paginationContainer = document.getElementById('paginationContainer');

        historyContainer.innerHTML = '';
        paginationContainer.innerHTML = '';

        const start = (currentPage - 1) * itemsPerPage;
        const end = start + itemsPerPage;
        const itemsToShow = filteredHistory.slice(start, end);

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
            const usernameElement = document.createElement('div');
            usernameElement.classList.add('notification-title');

            if (notification.username !== "MoTD") {
                const usernameLink = document.createElement('a');
                usernameLink.href = `https://robertsspaceindustries.com/spectrum/search?member=${encodeURIComponent(notification.username)}&page=1&q=&range=day&role&scopes=op%2Creply%2Cchat&sort=latest&visibility=nonerased`;
                usernameLink.target = '_blank';
                usernameLink.textContent = notification.username;
                usernameLink.classList.add('notification-username');
                usernameElement.appendChild(usernameLink);
            } else {
                usernameElement.textContent = notification.username;
            }

            const timeElement = document.createElement('div');
            timeElement.classList.add('notification-time');
            timeElement.textContent = `${notification.timeCreated} in ${notification.lobbyName}`;

            titleContainer.appendChild(usernameElement);
            titleContainer.appendChild(timeElement);
            header.appendChild(titleContainer);
            item.appendChild(header);

            const body = document.createElement('div');
            body.classList.add('notification-body');
            body.appendChild(formatMessage(notification.body));
            item.appendChild(body);

            if (notification.username !== "MoTD") {
                const messageLink = document.createElement('a');
                messageLink.href = notification.messageLink;
                messageLink.target = '_blank';
                messageLink.classList.add('notification-link');
                messageLink.textContent = 'View Message';
                item.appendChild(messageLink);
            }

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
    const div = document.createElement('div');
    const lines = message.split('\n');

    lines.forEach(line => {
        const p = document.createElement('p');

        const parts = line.split(/(Audience: |Alpha Patch [\d.]+:|Server Info: |Long Term Persistence:|Testing\/Feedback Focus|New Global Event:|Known Issues|Features & Gameplay|Bug Fixes|Technical|Fixed - )/g);

        parts.forEach(part => {
            const span = document.createElement('span');

            if (part.startsWith('Audience: ')) {
                span.appendChild(document.createElement('strong')).textContent = 'Audience: ';
            } else if (part.startsWith('Alpha Patch')) {
                span.appendChild(document.createElement('strong')).textContent = part;
            } else if (part.startsWith('Server Info: ')) {
                span.appendChild(document.createElement('strong')).textContent = 'Server Info: ';
            } else if (part.startsWith('Long Term Persistence:')) {
                span.appendChild(document.createElement('strong')).textContent = 'Long Term Persistence:';
            } else if (part.startsWith('Testing/Feedback Focus')) {
                span.appendChild(document.createElement('strong')).textContent = 'Testing/Feedback Focus';
            } else if (part.startsWith('New Global Event:')) {
                span.appendChild(document.createElement('strong')).textContent = 'New Global Event:';
            } else if (part.startsWith('Known Issues')) {
                span.appendChild(document.createElement('strong')).textContent = 'Known Issues';
            } else if (part.startsWith('Features & Gameplay')) {
                span.appendChild(document.createElement('strong')).textContent = 'Features & Gameplay';
            } else if (part.startsWith('Bug Fixes')) {
                span.appendChild(document.createElement('strong')).textContent = 'Bug Fixes';
            } else if (part.startsWith('Technical')) {
                span.appendChild(document.createElement('strong')).textContent = 'Technical';
            } else if (part.startsWith('Fixed - ')) {
                span.textContent = '• Fixed - ' + part.slice(8);
            } else {
                span.textContent = part;
            }

            p.appendChild(span);
        });

        div.appendChild(p);
    });

    return div;
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
