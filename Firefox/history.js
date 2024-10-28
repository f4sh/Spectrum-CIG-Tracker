const predefinedUsers = {
    'Wakapedia-CIG': 429390,
    'Bearded-CIG': 19631,
    'Bault-CIG': 1,
    'Underscore-CIG': 556,
    'ZacPreece_CIG': 3154801,
    'KoakuCIG': 525336,
    'ABrown-CIG': 115933,
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

        const start = (currentPage - 1) * itemsPerPage;
        const end = start + itemsPerPage;
        const itemsToShow = filteredHistory.slice(start, end);

        itemsToShow.forEach(notification => {
            const item = document.createElement('div');
            item.classList.add('notification-block');

            const headerDiv = document.createElement('div');
            headerDiv.classList.add('notification-header');

            if (notification.username !== "MoTD") {
                const avatarImg = document.createElement('img');
                avatarImg.src = notification.avatarUrl;
                avatarImg.alt = notification.username;
                avatarImg.classList.add('notification-avatar');
                headerDiv.appendChild(avatarImg);
            }

            const titleDiv = document.createElement('div');

            if (notification.username !== "MoTD") {
                const usernameLink = document.createElement('a');
                usernameLink.classList.add('notification-username');
                usernameLink.textContent = notification.username;
                usernameLink.href = `https://robertsspaceindustries.com/spectrum/search?member=${encodeURIComponent(notification.username)}&page=1&q=&range=day&role&scopes=op%2Creply%2Cchat&sort=latest&visibility=nonerased`;
                usernameLink.target = '_blank';
                titleDiv.appendChild(usernameLink);
            } else {
                const usernameText = document.createElement('span');
                usernameText.classList.add('notification-username');
                usernameText.textContent = notification.username;
                titleDiv.appendChild(usernameText);
            }

            const timeDiv = document.createElement('div');
            timeDiv.classList.add('notification-time');
            timeDiv.textContent = `${notification.timeCreated} in ${notification.lobbyName}`;
            titleDiv.appendChild(timeDiv);
            headerDiv.appendChild(titleDiv);

            item.appendChild(headerDiv);

            const bodyDiv = document.createElement('div');
            bodyDiv.classList.add('notification-body');

            const lines = notification.body.split('\n');
            lines.forEach(line => {
                const lineElem = document.createElement('div');

                const linkRegex = /\[([^\]]+)\]\((https?:\/\/[^\s)]+)\)/g;
                let lastIndex = 0;
                let match;
                while ((match = linkRegex.exec(line)) !== null) {
                    if (match.index > lastIndex) {
                        lineElem.appendChild(document.createTextNode(line.slice(lastIndex, match.index)));
                    }

                    const anchor = document.createElement('a');
                    anchor.href = match[2];
                    anchor.target = '_blank';
                    anchor.classList.add('notification-link');
                    anchor.textContent = match[1];
                    lineElem.appendChild(anchor);

                    lastIndex = linkRegex.lastIndex;
                }

                if (lastIndex < line.length) {
                    lineElem.appendChild(document.createTextNode(line.slice(lastIndex)));
                }

                bodyDiv.appendChild(lineElem);
            });

            item.appendChild(bodyDiv);

            if (notification.username !== "MoTD" && notification.messageLink) {
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