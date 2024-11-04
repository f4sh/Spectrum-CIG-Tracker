document.addEventListener('DOMContentLoaded', function () {
    const toggleTrackingButton = document.getElementById('toggleTracking');
    const intervalInput = document.getElementById('interval');
    const userCheckboxes = document.querySelectorAll('.user-selection input[type="checkbox"]');
    const runningTimeDiv = document.getElementById('runningTime');
    const statsDiv = document.getElementById('statsDiv');
    const viewHistoryButton = document.getElementById('viewHistory');

    let trackingIntervalId = null;
    let notificationsShown = 0;
    let notificationsClicked = 0;
    let shownMessageIds = {};

    browser.storage.local.get(['selectedUsers', 'interval', 'tracking', 'trackingStartTime', 'notificationsShown', 'notificationsClicked', 'shownMessageIds']).then((result) => {
        if (result.selectedUsers) {
            result.selectedUsers.forEach(user => {
                const checkbox = document.querySelector(`input[data-username="${user}"]`);
                if (checkbox) {
                    checkbox.checked = true;
                }
            });
        }
        if (result.interval) {
            intervalInput.value = result.interval;
        }
        if (result.tracking) {
            toggleTrackingButton.textContent = 'Stop Tracking';
            startUpdatingRunningTime(result.trackingStartTime);
            runningTimeDiv.style.display = 'block';
            notificationsShown = result.notificationsShown || 0;
            notificationsClicked = result.notificationsClicked || 0;
            shownMessageIds = result.shownMessageIds || {};
            updateStats();
        } else {
            runningTimeDiv.style.display = 'none';
            statsDiv.style.display = 'none';
        }
    });

    function validateIntervalInput() {
        const value = parseInt(intervalInput.value, 10);
        if (value < 5) {
            intervalInput.value = 5;
        }
    }

    intervalInput.addEventListener('input', validateIntervalInput);
    intervalInput.addEventListener('blur', validateIntervalInput);

    function saveSettings() {
        const selectedUsers = Array.from(userCheckboxes)
            .filter(checkbox => checkbox.checked)
            .map(checkbox => checkbox.getAttribute('data-username'));
        const interval = intervalInput.value;

        browser.storage.local.set({ selectedUsers, interval }).then(() => {
            console.log("Settings saved:", { selectedUsers, interval });

            if (toggleTrackingButton.textContent === 'Stop Tracking') {
                browser.runtime.sendMessage({ action: 'changeInterval', interval: Number(interval) });
                console.log("Changed tracking interval to", interval);
            }
        });
    }

    userCheckboxes.forEach(checkbox => {
        checkbox.addEventListener('change', (event) => {
            const username = checkbox.getAttribute('data-username');
            const checkedBoxes = Array.from(userCheckboxes).filter(box => box.checked);

            if (checkedBoxes.length > 8) {
                event.target.checked = false;
                alert("You can select a maximum of 8 users.");
            } else {
                document.getElementById('userCount').textContent = `Selected Users: ${checkedBoxes.length}/8`;

                if (event.target.checked) {
                    console.log(`User added: ${username}`);
                } else {
                    console.log(`User removed: ${username}`);
                }

                saveSettings();
            }
        });
    });

    intervalInput.addEventListener('change', saveSettings);

    function updateRunningTime(startTime) {
        const currentTime = new Date();
        const elapsedTime = Math.floor((currentTime - new Date(startTime)) / 1000);
        const hours = Math.floor(elapsedTime / 3600);
        const minutes = Math.floor((elapsedTime % 3600) / 60);
        const seconds = elapsedTime % 60;
        const formattedTime = `${hours.toString().padStart(2, '0')}h:${minutes.toString().padStart(2, '0')}m:${seconds.toString().padStart(2, '0')}s`;
        runningTimeDiv.textContent = `Tracking has been running for: ${formattedTime}`;
    }

    function startUpdatingRunningTime(startTime) {
        runningTimeDiv.style.display = 'block';
        updateRunningTime(startTime);
        trackingIntervalId = setInterval(() => updateRunningTime(startTime), 1000);
    }

    toggleTrackingButton.addEventListener('click', () => {
        const selectedUsers = Array.from(userCheckboxes)
            .filter(checkbox => checkbox.checked)
            .map(checkbox => checkbox.getAttribute('data-username'));
        const interval = intervalInput.value;

        if (toggleTrackingButton.textContent === 'Start Tracking') {
            const currentStartTime = new Date().toISOString();
            browser.storage.local.set({ selectedUsers, interval, tracking: true, trackingStartTime: currentStartTime }).then(() => {
                startUpdatingRunningTime(currentStartTime);
            });
            toggleTrackingButton.textContent = 'Stop Tracking';
            browser.runtime.sendMessage({ action: 'startTracking', users: selectedUsers, interval: Number(interval) });
            statsDiv.style.display = 'block';
        } else {
            browser.storage.local.set({ tracking: false, trackingStartTime: null }).then(() => {
                clearInterval(trackingIntervalId);
                runningTimeDiv.style.display = 'none';
                notificationsShown = 0;
                notificationsClicked = 0;
                updateStats();
            });
            toggleTrackingButton.textContent = 'Start Tracking';
            browser.runtime.sendMessage({ action: 'stopTracking' });
            statsDiv.style.display = 'none';
        }
    });

    function updateStats() {
        statsDiv.textContent = `Notifications Shown: ${notificationsShown}, Notifications Clicked: ${notificationsClicked}`;
        browser.storage.local.set({ notificationsShown, notificationsClicked, shownMessageIds });
    }

    viewHistoryButton.addEventListener('click', () => {
        browser.tabs.create({ url: browser.runtime.getURL('history.html') });
    });

    browser.storage.onChanged.addListener((changes, namespace) => {
        if (namespace === 'local') {
            if (changes.notificationsShown) {
                notificationsShown = changes.notificationsShown.newValue || 0;
            }
            if (changes.notificationsClicked) {
                notificationsClicked = changes.notificationsClicked.newValue || 0;
            }
            if (changes.shownMessageIds) {
                shownMessageIds = changes.shownMessageIds.newValue || {};
            }
            updateStats();
        }
    });
});

const motdCheckbox = document.getElementById('motdCheckbox');

function saveMotdSetting() {
    const trackMotd = motdCheckbox.checked;
    browser.storage.local.set({ trackMotd }).then(() => {
        console.log("MoTD tracking setting saved:", trackMotd);
    });
}

motdCheckbox.addEventListener('change', saveMotdSetting);

browser.storage.local.get('trackMotd').then((result) => {
    motdCheckbox.checked = result.trackMotd || false;
});

const year = new Date().getFullYear();
const footer = document.querySelector('.footer');
footer.textContent = '';
const copyrightText = document.createTextNode(`\u00A9 ${year} Spectrum CIG Tracker | `);
footer.appendChild(copyrightText);
const patchNotesLink = document.createElement('a');
patchNotesLink.href = "https://robertsspaceindustries.com/spectrum/community/AVOCADO/forum/31515/thread/stay-connected-with-cig-introducing-spectrum-cig-t";
patchNotesLink.textContent = "Release Notes";
patchNotesLink.target = "_blank";
patchNotesLink.rel = "noopener noreferrer";
footer.appendChild(patchNotesLink);
footer.appendChild(document.createTextNode(' | '));
const githubLink = document.createElement('a');
githubLink.href = "https://github.com/f4sh/Spectrum-CIG-Tracker";
githubLink.textContent = "GitHub";
githubLink.target = "_blank";
githubLink.rel = "noopener noreferrer";
footer.appendChild(githubLink);
footer.appendChild(document.createElement('br'));
const chromeAddonLink = document.createElement('a');
chromeAddonLink.href = "https://chromewebstore.google.com/detail/spectrum-cig-tracker/nfnjlibnekbfphhnempobclhhgnablaj";
chromeAddonLink.textContent = "Chrome Web Store";
chromeAddonLink.target = "_blank";
chromeAddonLink.rel = "noopener noreferrer";
footer.appendChild(chromeAddonLink);
footer.appendChild(document.createTextNode(' | '));
const firefoxAddonLink = document.createElement('a');
firefoxAddonLink.href = "https://addons.mozilla.org/en-US/firefox/addon/spectrum-cig-tracker/";
firefoxAddonLink.textContent = "Firefox Add-on";
firefoxAddonLink.target = "_blank";
firefoxAddonLink.rel = "noopener noreferrer";
footer.appendChild(firefoxAddonLink);
footer.appendChild(document.createElement('br'));
const licenseLink = document.createElement('a');
licenseLink.href = "https://opensource.org/licenses/MIT";
licenseLink.textContent = "MIT License";
licenseLink.target = "_blank";
licenseLink.rel = "noopener noreferrer";
footer.appendChild(licenseLink);
