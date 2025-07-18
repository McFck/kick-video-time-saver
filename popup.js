const utils = window.KickTimeSaver.utils;

document.addEventListener('DOMContentLoaded', async function () {
    await loadSavedVideos();

    document.getElementById('clearAll').addEventListener('click', showConfirmDialog);
    document.getElementById('confirmCancel').addEventListener('click', hideConfirmDialog);
    document.getElementById('confirmOk').addEventListener('click', confirmClearAll);
});

function showConfirmDialog() {
    const overlay = document.getElementById('confirmOverlay');
    const elementsToBlur = ['savedVideos', 'status', 'clearAll'];

    elementsToBlur.forEach(id => {
        const element = document.getElementById(id);
        if (element) {
            element.classList.add('blurred');
        }
    });

    overlay.classList.add('show');
}

function hideConfirmDialog() {
    const overlay = document.getElementById('confirmOverlay');
    const elementsToBlur = ['savedVideos', 'status', 'clearAll'];

    elementsToBlur.forEach(id => {
        const element = document.getElementById(id);
        if (element) {
            element.classList.remove('blurred');
        }
    });

    overlay.classList.remove('show');
}

async function confirmClearAll() {
    hideConfirmDialog();
    await clearAllSavedTimes();
}

async function loadSavedVideos() {
    try {
        const result = await chrome.storage.local.get();
        const savedVideos = [];
        const keysToRemove = [];
        const oneMonthAgo = Date.now() - (30 * 24 * 60 * 60 * 1000); // 30 days in milliseconds

        for (const [key, value] of Object.entries(result)) {
            if (value.timestamp) {
                if (value.savedAt && value.savedAt < oneMonthAgo) {
                    keysToRemove.push(key);
                } else {
                    savedVideos.push({
                        streamId: key,
                        streamName: value.streamName || 'No title',
                        streamerName: value.streamerName || 'No name',
                        duration: value.duration,
                        timestamp: value.timestamp,
                        savedAt: value.savedAt,
                        url: value.url
                    });
                }
            }
        }

        if (keysToRemove.length > 0) {
            await chrome.storage.local.remove(keysToRemove);
        }

        displaySavedVideos(savedVideos);
    } catch (error) {
        document.getElementById('savedVideos').innerHTML =
            '<div class="no-data">Error loading saved times</div>';
    }
}

function getStreamerPageUrl(streamerName) {
    return `https://kick.com/${streamerName}`
}

function displaySavedVideos(videos) {
    const container = document.getElementById('savedVideos');
    const clearAllBtn = document.getElementById('clearAll');

    if (videos.length === 0) {
        clearAllBtn.disabled = true;
        container.innerHTML = '<div class="no-data-wrap"><div class="no-data">No saved timestamps yet</div></div>';
        return;
    }

    videos.sort((a, b) => b.savedAt - a.savedAt);

    container.innerHTML = videos.map(video => {
        let displayName = video.streamName;
        if (!displayName || displayName === 'No title') {
            if (video.streamId.startsWith('video_')) {
                displayName = 'Video: ' + video.streamId.substring(6, 14) + '...';
            } else if (video.streamId.startsWith('stream_')) {
                displayName = 'Stream: ' + video.streamId.substring(7);
            } else {
                displayName = video.streamId;
            }
        }

        if (displayName.length > 40) {
            displayName = displayName.substring(0, 37) + '...';
        }

        const videoUrl = video.url;
        const watchedPercentage = video.duration
            ? utils.getWatchedPercentage(video.timestamp, video.duration)
            : 0;

        return `
                <div class="video-item">
                    <div class="video-progress-fill" style="width: ${watchedPercentage}%;"></div>
                    <div class="video-info">
                        <div class="video-name" title="${escapeHtml(video.streamName || video.streamId)}">${escapeHtml(displayName)}</div>
                        <div class="info-block">
                            <a class="channel-info" href="${getStreamerPageUrl(video.streamerName)}" data-url="${getStreamerPageUrl(video.streamerName)}">
                                <img class="kick-icon" src="assets/kick.png">
                                <span>${video.streamerName}</span>
                            </a>
                            <div class="video-time">
                                ${utils.formatTime(video.timestamp)} / ${utils.formatTime(video.duration)} • ${utils.formatDate(video.savedAt)}
                            </div>
                        </div>
                        
                    </div>
                    <div class="video-actions">
                        <button class="go-btn" data-url="${escapeHtml(videoUrl)}">Go</button>
                        <button class="delete-btn" data-key="${video.streamId}">×</button>
                    </div>
                </div>
                `;
    }).join('');

    clearAllBtn.disabled = false;
    addButtonEventListeners();
}

function addButtonEventListeners() {
    document.querySelectorAll('.go-btn').forEach(button => {
        button.addEventListener('click', function () {
            const url = this.getAttribute('data-url');
            goToVideo(url);
        });
    });

    document.querySelectorAll('.delete-btn').forEach(button => {
        button.addEventListener('click', function () {
            const key = this.getAttribute('data-key');
            deleteSavedTime(key);
        });
    });

    document.querySelectorAll('.channel-info').forEach(button => {
        button.addEventListener('click', function () {
            const url = this.getAttribute('data-url');
            goToVideo(url);
        });
    });
}

function createTimestampUrl(originalUrl, timestamp) {
    try {
        const url = new URL(originalUrl);
        url.searchParams.set('t', Math.floor(timestamp));
        return url.toString();
    } catch (error) {
        console.error('Error creating timestamp URL:', error);
        return originalUrl;
    }
}

async function goToVideo(url) {
    try {
        const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });

        if (tab.url && tab.url.includes('kick.com')) {
            await chrome.tabs.update(tab.id, { url: url });
        } else {
            await chrome.tabs.create({ url: url });
        }

        window.close();
    } catch (error) {
        console.error('Error navigating to video:', error);
        window.open(url, '_blank');
        window.close();
    }
}

async function deleteSavedTime(key) {
    try {
        await chrome.storage.local.remove([key]);
        await loadSavedVideos();
    } catch (error) {
        console.error('Error deleting saved time:', error);
    }
}

async function clearAllSavedTimes() {
    try {
        const result = await chrome.storage.local.get();
        const keysToRemove = Object.keys(result).filter(key =>
            key.startsWith('kick_video_time_')
        );

        if (keysToRemove.length > 0) {
            await chrome.storage.local.remove(keysToRemove);
        }

        await loadSavedVideos();
    } catch (error) {
        console.error('Error clearing saved times:', error);
    }
}

function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}