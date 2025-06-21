;(function(window) {
  const Observer = window.Observer;
  const utils = window.KickTimeSaver.utils;
  const { build } = window.indicatorBuilder;

  const observer = new Observer();
  const handled = new Set();

  function findBase() {
    if (document.querySelector('#channel-content')) {
      return '#channel-content';
    } else if (document.querySelector('main[data-theatre-mode-container]')) {
      return 'main[data-theatre-mode-container]';
    } else {
      return '.grid.h-full.grid-cols-1';
    }
  }

  const baseSelector  = findBase();
  const thumbSelector = `${baseSelector} a.group.relative.aspect-video.w-full.select-none`;

  async function processElement(el) {
    if (handled.has(el)) return;
    handled.add(el);

    const parts   = el.href.split('/');
    const videoId = `${parts[parts.length - 1]}`;
    const videoData = (await utils.getSavedDataObj(videoId));

    if (videoData && Object.keys(videoData).length > 0) {
      build(el, videoId, videoData);
    }
  }

  function manualScan() {
    document.querySelectorAll(thumbSelector).forEach(el => {
      void processElement(el);
    });
  }

  function startWatching() {
    observer.observeTargetElementsSeparately(
      document.body,
      false,
      thumbSelector,
      processElement
    );
  }

  setTimeout(() => {
    manualScan();
    startWatching();
  }, 500);

})(window);