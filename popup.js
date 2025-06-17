document.addEventListener('DOMContentLoaded', async function() {
    await loadSavedVideos();
    
    document.getElementById('clearAll').addEventListener('click', clearAllSavedTimes);
});

async function loadSavedVideos() {
    try {
        const result = await chrome.storage.local.get();
        const savedVideos = [];
        const keysToRemove = [];
        const oneMonthAgo = Date.now() - (30 * 24 * 60 * 60 * 1000); // 30 days in milliseconds
        
        for (const [key, value] of Object.entries(result)) {
            if (key.startsWith('kick_video_time_') && value.timestamp) {
                if (value.savedAt && value.savedAt < oneMonthAgo) {
                    keysToRemove.push(key);
                } else {
                    savedVideos.push({
                        key: key,
                        streamId: value.streamId,
                        streamName: value.streamName || 'No title',
                        timestamp: value.timestamp,
                        savedAt: value.savedAt,
                        url: value.url
                    });
                }
            }
        }
        
        if (keysToRemove.length > 0) {
            await chrome.storage.local.remove(keysToRemove);
            console.log(`Removed ${keysToRemove.length} expired video timestamps (older than 30 days)`);
        }
        
        displaySavedVideos(savedVideos);
    } catch (error) {
        console.error('Error loading saved videos:', error);
        document.getElementById('savedVideos').innerHTML = 
            '<div class="no-data">Error loading saved times</div>';
    }
}

function displaySavedVideos(videos) {
    const container = document.getElementById('savedVideos');
    
    if (videos.length === 0) {
        container.innerHTML = '<div class="no-data">No saved timestamps yet</div>';
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
        
        const videoUrl = video.url; //createTimestampUrl(video.url, video.timestamp);
        
        return `
        <div class="video-item">
            <div class="video-info">
                <div class="video-name" title="${escapeHtml(video.streamName || video.streamId)}">${escapeHtml(displayName)}</div>
                <div class="video-time">
                    ${formatTime(video.timestamp)} • ${formatDate(video.savedAt)}
                </div>
            </div>
            <div class="video-actions">
                <button class="go-btn" data-url="${escapeHtml(videoUrl)}">Go</button>
                <button class="delete-btn" data-key="${video.key}">×</button>
            </div>
        </div>
        `;
    }).join('');
    
    addButtonEventListeners();
}

function addButtonEventListeners() {
    document.querySelectorAll('.go-btn').forEach(button => {
        button.addEventListener('click', function() {
            const url = this.getAttribute('data-url');
            goToVideo(url);
        });
    });
    
    document.querySelectorAll('.delete-btn').forEach(button => {
        button.addEventListener('click', function() {
            const key = this.getAttribute('data-key');
            deleteSavedTime(key);
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
    if (!confirm('Are you sure you want to clear all saved timestamps?')) {
        return;
    }
    
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

function formatTime(seconds) {
    const hrs = Math.floor(seconds / 3600);
    const mins = Math.floor((seconds % 3600) / 60);
    const secs = Math.floor(seconds % 60);
    
    if (hrs > 0) {
        return `${hrs}:${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
    }
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
}

function formatDate(timestamp) {
    const date = new Date(timestamp);
    const now = new Date();
    const diffMs = now - date;
    const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
    const diffDays = Math.floor(diffHours / 24);
    
    if (diffHours < 1) {
        return 'Just now';
    } else if (diffHours < 24) {
        return `${diffHours}h ago`;
    } else if (diffDays < 7) {
        return `${diffDays}d ago`;
    } else {
        return date.toLocaleDateString();
    }
}

function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}