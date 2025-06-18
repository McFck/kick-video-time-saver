const utils = window.KickTimeSaver.utils;

class KickVideoTimeSaver {
  constructor() {
    this.video = null;
    this.streamId = null;
    this.saveInterval = null;
    this.isInitialized = false;
    this.isLoaded = false;
    this.lastSavedTime = 0;
    this.saveFrequency = 5000;
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
    this.video = video;
    this.streamId = this.getStreamId();
    this.isInitialized = true;

    console.log('Kick Video Time Saver: Video detected', this.streamId);

    video.addEventListener('loadedmetadata', () => {
      this.updateName();
      this.loadSavedTime();
    });


    this.startPeriodicSave();

    video.addEventListener('pause', () => this.saveCurrentTime());
    video.addEventListener('seeked', () => this.saveCurrentTime());

    window.addEventListener('beforeunload', () => this.saveCurrentTime());
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
      return videoMatch[1];
    }

    return 'unknown';
  }

  async loadSavedTime() {
    try {
      const key = this.streamId;
      const result = await chrome.storage.local.get([key]);
      const savedData = result[key];

      if (savedData && savedData.timestamp && this.video && !utils.extractTimecode()) {
        // Wait a bit for video to be fully loaded
        setTimeout(() => {
          if (this.video && this.video.duration > savedData.timestamp) {
            this.video.currentTime = savedData.timestamp;
            console.log(`Kick Video Time Saver: Restored time to ${savedData.timestamp}s`);
            this.isLoaded = true;
          }
        }, 1000);
      }
    } catch (error) {
      console.error('Error loading saved time:', error);
      this.isLoaded = true;
    }
  }

  async saveCurrentTime() {
    if (!this.video || !this.streamId || !this.isLoaded) return;

    const currentTime = this.video.currentTime;
    const duration = this.video.duration;
    console.log(duration)

    try {
      const key = this.streamId
      const data = {
        timestamp: currentTime,
        duration,
        savedAt: Date.now(),
        streamId: this.streamId,
        streamName: this.streamName,
        url: window.location.href
      };

      console.log('saved time', currentTime);
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
    this.isLoaded = false;
    this.lastSavedTime = 0;
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
}

const kickVideoTimeSaver = new KickVideoTimeSaver();