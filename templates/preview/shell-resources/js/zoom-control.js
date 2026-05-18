(function () {
  function init() {
    const zoomLevels = [0.75, 0.8, 0.9, 1, 1.1, 1.25, 1.5];
    let zoomIndex = 3;
    const zoomValueEl = document.getElementById('zoom-value');
    const btnZoomOut = document.getElementById('btn-zoom-out');
    const btnZoomIn = document.getElementById('btn-zoom-in');

    function applyZoom() {
      const level = zoomLevels[zoomIndex];
      if (zoomValueEl) zoomValueEl.textContent = Math.round(level * 100) + '%';
      document.documentElement.style.setProperty('--preview-zoom', level);
    }

    if (btnZoomOut) {
      btnZoomOut.addEventListener('click', () => {
        if (zoomIndex > 0) { zoomIndex--; applyZoom(); }
      });
    }
    if (btnZoomIn) {
      btnZoomIn.addEventListener('click', () => {
        if (zoomIndex < zoomLevels.length - 1) { zoomIndex++; applyZoom(); }
      });
    }
    applyZoom();
  }

  window.zoomControl = { init };
})();
