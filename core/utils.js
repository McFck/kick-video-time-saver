window.KickTimeSaver = window.KickTimeSaver || {};

window.KickTimeSaver.utils = {
    getSavedDataObj: async function (entryId) {
        const data = await chrome.storage.local.get([entryId]);
        return data ? data[entryId] : null;
    },
    setSavedDataObj: async function (entryId, data) {
        return chrome.storage.local.set({ [entryId]: data })
    },
    extractTimecode: function () {
        try {
            const parsedUrl = new URL(window.location.href);

            if (!parsedUrl.hostname.endsWith('kick.com')) {
                return null;
            }

            const tValue = parsedUrl.searchParams.get('t');
            return tValue;
        } catch (error) {
            return null;
        }
    },

    showNotification: function (message) {
        const notification = document.createElement('div');
        notification.textContent = `⏰ ${message}`;
        notification.style.cssText = `
      position: fixed;
      right: auto;
      left: auto;
      bottom: 0;
      background: #1f2937;
      color: white;
      padding: 12px 16px;
      border-radius: 8px;
      font-size: 14px;
      z-index: 10000;
      box-shadow: 0 4px 12px rgba(0,0,0,0.3);
      transition: opacity 0.3s ease;
    `;

        document.body.appendChild(notification);

        setTimeout(() => {
            notification.style.opacity = '0';
            setTimeout(() => {
                if (notification.parentNode) {
                    notification.parentNode.removeChild(notification);
                }
            }, 300);
        }, 3000);
    },

    formatTime: function (seconds) {
        const hrs = Math.floor(seconds / 3600);
        const mins = Math.floor((seconds % 3600) / 60);
        const secs = Math.floor(seconds % 60);

        if (hrs > 0) {
            return `${hrs.toString().padStart(2, '0')}:${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
        }
        return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
    },

    formatDate: function (timestamp) {
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
    },

    getWatchedPercentage: function(currentTime, duration) {
        const percentage = (currentTime / duration) * 100;
        return +((percentage).toFixed(2));
    }
};