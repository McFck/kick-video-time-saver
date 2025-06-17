function extractStreamVideoData() {
  const scripts = document.querySelectorAll('script');

  for (const script of scripts) {
    const scriptContent = script.textContent || script.innerHTML;
    if (!scriptContent) continue;

    if (scriptContent.includes('channelSlug') && scriptContent.includes('dehydratedAt')) {
      const match = scriptContent.match(/self\.__next_f\.push\(\[1,"(\d+):(.*)"\]\);?/s);
      const escapedJsonString = match[2];
      const onceParsed = JSON.parse(`"${escapedJsonString}"`);
      const result = JSON.parse(onceParsed);

      const queries = result[3].state.queries;

      const liveStreamQuery = queries.find(query=>query.queryKey.join(' ').includes('Channel info'));
      const livestream = liveStreamQuery?.state?.data?.livestream ? { ...liveStreamQuery.state.data.livestream } : null;

      const vodQuery = queries.find(query=>query.queryKey.join(' ').includes('Channel video'));
      const vod = vodQuery?.state?.data?.livestream ? { ...vodQuery.state.data.livestream, uuid: vodQuery.state.data.uuid } : null;

      return {
        livestream,
        vod
      };
    }
  }
  return null;
}

function extractTimecode() {
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
}

class KickVideoTimeSaver {
  constructor() {
    this.video = null;
    this.streamId = null;
    this.saveInterval = null;
    this.isInitialized = false;
    this.lastSavedTime = 0;
    this.saveFrequency = 5000;
    this.streamInfo = null;
    this.engagedWatching = false;
    this.init();
  }

  async init() {
    this.waitForVideo();

    this.observeUrlChanges();
  }

  isVOD() {
    const url = window.location.href;
    return url.match(/kick\.com\/[^\/]+\/videos\/([^\/\?]+)/)
  }

  waitForVideo() {
    const checkForVideo = () => {
      const video = document.querySelector('video') ||
        document.querySelector('video[src]') ||
        document.querySelector('.video-player video');

      if (video && !this.isInitialized && this.isVOD()) {
        this.setupVideoHandlers(video);
      } else if (!video && this.isInitialized) {
        this.cleanup();
      }
    };

    checkForVideo();
    setInterval(checkForVideo, 2000);

    const observer = new MutationObserver(checkForVideo);
    observer.observe(document.body, {
      childList: true,
      subtree: true
    });
  }

  async setupVideoHandlers(video) {
    // this.streamInfo = extractStreamVideoData();
    this.video = video;
    this.streamId = this.getStreamId();
    this.isInitialized = true;

    console.log('Kick Video Time Saver: Video detected', this.streamId);

    this.engagedWatching = !!Object.values(await chrome.storage.local.get([`kick_video_time_${this.streamId}`]))?.length;

    video.addEventListener('loadedmetadata', () => {
      this.updateName();
      this.loadSavedTime();

      if (!this.engagedWatching) {
        let lastWatchTime = 0;
        let watchedSeconds = 0;
        const minWatchTime = Math.min(video.duration * 0.01, 15);
        const onSeeked = () => {
          lastWatchTime = video.currentTime;
        };

        const onTimeUpdate = () => {
          if (this.engagedWatching) {
            video.removeEventListener('seeked', onSeeked);
            video.removeEventListener('timeupdate', onTimeUpdate);
            return;
          }

          if (!video.paused && !video.seeking) {
            const now = video.currentTime;
            const delta = now - lastWatchTime;

            if (delta > 0) {
              watchedSeconds += delta;

              if (watchedSeconds >= minWatchTime) {
                this.engagedWatching = true;
                video.removeEventListener('seeked', onSeeked);
                video.removeEventListener('timeupdate', onTimeUpdate);
              }
            }
            lastWatchTime = now;
          }
        };

        video.addEventListener('seeked', onSeeked);
        video.addEventListener('timeupdate', onTimeUpdate);
      }
    });


    this.startPeriodicSave();

    video.addEventListener('pause', () => this.saveCurrentTime());
    video.addEventListener('seeked', () => this.saveCurrentTime());

    window.addEventListener('beforeunload', () => this.saveCurrentTime());

    // this.startNameUpdateInterval();
  }

  getStreamName() {
    const metaDescription = document.querySelector('meta[name="description"]');
    if (metaDescription && metaDescription.content) {
      const description = metaDescription.content.trim();
      if (description && description !== '') {
        return description;
      }
    }

    const title = document.title;
    if (title && title !== 'Kick') {
      return title.replace(' - Kick', '').trim();
    }

    return 'No title';
  }

  getStreamId() {
    const url = window.location.href;

    const videoMatch = url.match(/kick\.com\/[^\/]+\/videos\/([^\/\?]+)/);
    if (videoMatch) {
      return `video_${videoMatch[1]}`;
    }

    const streamMatch = url.match(/kick\.com\/([^\/\?]+)/);
    return streamMatch ? `stream_${streamMatch[1]}` : 'unknown';
  }

  async loadSavedTime() {
    try {
      const key = `kick_video_time_${this.streamId}`;
      const result = await chrome.storage.local.get([key]);
      const savedData = result[key];

      if (savedData && savedData.timestamp && this.video && !extractTimecode()) {
        // Wait a bit for video to be fully loaded
        setTimeout(() => {
          if (this.video && this.video.duration > savedData.timestamp) {
            this.video.currentTime = savedData.timestamp;
            console.log(`Kick Video Time Saver: Restored time to ${savedData.timestamp}s`);

            this.showNotification(`Resumed from ${this.formatTime(savedData.timestamp)}`);
          }
        }, 1000);
      }
    } catch (error) {
      console.error('Error loading saved time:', error);
    }
  }

  async saveCurrentTime() {
    if (!this.video || !this.streamId || !this.engagedWatching) return;

    const currentTime = this.video.currentTime;

    try {
      const key = `kick_video_time_${this.streamId}`;
      const data = {
        timestamp: currentTime,
        savedAt: Date.now(),
        streamId: this.streamId,
        streamName: this.streamName,
        // uuid: this.streamInfo.vod?.uuid ?? this.streamInfo?.livestream?.id ?? null,
        url: window.location.href
      };

      await chrome.storage.local.set({ [key]: data });
      this.lastSavedTime = currentTime;
    } catch (error) {
      console.error('Error saving time:', error);
    }
  }

  updateName() {
    const newName = this.getStreamName();
    if (newName !== this.streamName) {
      this.streamName = newName;
    }
  }

  startNameUpdateInterval() {
    if (this.streamId.startsWith('stream_')) {
      setInterval(() => {
        this.updateName();
      }, 30000);
    }
  }

  startPeriodicSave() {
    this.stopPeriodicSave();
    this.saveInterval = setInterval(() => {
      if (this.video && !this.video.paused) {
        this.saveCurrentTime();
      }
    }, this.saveFrequency);
  }

  stopPeriodicSave() {
    if (this.saveInterval) {
      clearInterval(this.saveInterval);
      this.saveInterval = null;
    }
  }

  cleanup() {
    this.stopPeriodicSave();
    this.video = null;
    this.streamId = null;
    this.streamName = 'No title';
    this.isInitialized = false;
    this.lastSavedTime = 0;
    this.streamInfo = null;
    this.engagedWatching = false;
  }

  observeUrlChanges() {
    let currentUrl = window.location.href;

    const observer = new MutationObserver(() => {
      if (window.location.href !== currentUrl) {
        currentUrl = window.location.href;
        // URL changed, reinitialize
        this.cleanup();
        setTimeout(() => this.waitForVideo(), 1000);
      }
    });

    observer.observe(document.body, {
      childList: true,
      subtree: true
    });
  }

  showNotification(message) {
    const notification = document.createElement('div');
    notification.textContent = `⏰ ${message}`;
    notification.style.cssText = `
      position: fixed;
      top: 20px;
      right: 20px;
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
  }

  formatTime(seconds) {
    const hrs = Math.floor(seconds / 3600);
    const mins = Math.floor((seconds % 3600) / 60);
    const secs = Math.floor(seconds % 60);

    if (hrs > 0) {
      return `${hrs}:${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
    }
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  }
}

const kickVideoTimeSaver = new KickVideoTimeSaver();