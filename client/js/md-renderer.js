(function () {
  function escapeHtml(text) {
    return text
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  /**
   * Parse a doc-link href into structured data.
   * Supported formats:
   *   - doc_name.md          → same-page doc
   *   - @page_hash/doc.md    → cross-page doc (type=page)
   *   - #component_hash/doc.md → cross-page doc (type=component)
   * Returns null for non-doc links.
   */
  function parseDocLink(href) {
    if (!href || typeof href !== 'string') return null;
    // Same-page doc link: ends with .md, no path separator, no @/# prefix
    if (/^[^/#@][^/]*\.md$/i.test(href)) {
      return { mode: 'same-page', doc: href };
    }
    // Cross-page link: @hash/doc.md
    const pageMatch = href.match(/^@([^/]+)\/(.+\.md)$/i);
    if (pageMatch) {
      return { mode: 'cross-page', type: 'page', path: pageMatch[1], doc: pageMatch[2] };
    }
    // Cross-component link: #hash/doc.md
    const compMatch = href.match(/^#([^/]+)\/(.+\.md)$/i);
    if (compMatch) {
      return { mode: 'cross-page', type: 'component', path: compMatch[1], doc: compMatch[2] };
    }
    return null;
  }

  function renderMarkdown(mdText) {
    if (!window.marked) return '<p>marked.js not loaded</p>';

    const renderer = new window.marked.Renderer();
    const originalLink = renderer.link.bind(renderer);
    renderer.link = function (token) {
      const parsed = parseDocLink(token.href);
      if (parsed) {
        const attrs = [
          'href="#"',
          `data-doc-link="${parsed.mode}"`,
          `data-doc-name="${escapeHtml(parsed.doc)}"`
        ];
        if (parsed.type) attrs.push(`data-doc-type="${parsed.type}"`);
        if (parsed.path) attrs.push(`data-doc-path="${escapeHtml(parsed.path)}"`);
        return `<a ${attrs.join(' ')}>${this.parser.parseInline(token.tokens)}</a>`;
      }
      // Fall back to standard link rendering
      return originalLink(token);
    };

    return window.marked.parse(mdText || '', {
      headerIds: false,
      mangle: false,
      renderer: renderer
    });
  }

  window.mdRenderer = { renderMarkdown, escapeHtml, parseDocLink };
})();
