(function () {
  function renderMarkdown(mdText) {
    if (!window.marked) return '<p>marked.js not loaded</p>';
    return window.marked.parse(mdText || '', {
      headerIds: false,
      mangle: false
    });
  }

  function escapeHtml(text) {
    return text
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;');
  }

  window.mdRenderer = { renderMarkdown, escapeHtml };
})();
