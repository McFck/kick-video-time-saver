; (function (window) {
  async function build(videoElement, videoId, videoData) {
    if (!videoData) return;

    const badge = document.createElement('div');
    badge.classList.add(
      'z-controls', 'absolute', 'rounded', 'bg-[#070809]', 'bg-opacity-80',
      'px-1.5', 'py-1', 'text-xs', 'font-semibold', 'bottom-1.5', 'right-1.5'
    );
    badge.innerText = 'Continue';
    videoElement.appendChild(badge);

    if (videoData.duration) {
      const pct = (videoData.timestamp / videoData.duration) * 100;
      const bar = document.createElement('div');
      bar.classList.add('h-1', 'bg-primary', 'absolute', 'bottom-0');
      bar.style.width = `${pct}%`;
      videoElement.appendChild(bar);
    }
  }

  window.indicatorBuilder = { build };
})(window);