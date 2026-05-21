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

  /* ------------------------------------------------------------------
   *  Color text extension for marked.js
   *  Syntax: {#red colored text}  or  {#dc3737 colored text}
   *  ------------------------------------------------------------------ */
  function normalizeColor(color) {
    if (!color) return null;
    if (color.startsWith('#')) {
      const hex = color.slice(1);
      const isValid = /^([0-9a-fA-F]{3}|[0-9a-fA-F]{4}|[0-9a-fA-F]{6}|[0-9a-fA-F]{8})$/.test(hex);
      return isValid ? color : null;
    }
    if (/^([0-9a-fA-F]{3}|[0-9a-fA-F]{4}|[0-9a-fA-F]{6}|[0-9a-fA-F]{8})$/.test(color)) {
      return '#' + color;
    }
    if (/^[a-zA-Z][a-zA-Z0-9-]*$/.test(color)) {
      return color;
    }
    return null;
  }

  let colorExtRegistered = false;
  function ensureColorExt() {
    if (colorExtRegistered || !window.marked) return;
    colorExtRegistered = true;

    const colorTextExt = {
      name: 'colorText',
      level: 'inline',
      start(src) { return src.indexOf('{#'); },
      tokenizer(src, tokens) {
        const rule = /^\{#([a-zA-Z0-9#]+)\s+([^}]*)\}/;
        const match = rule.exec(src);
        if (match) {
          return {
            type: 'colorText',
            raw: match[0],
            color: match[1],
            tokens: this.lexer.inlineTokens(match[2].trim())
          };
        }
      },
      renderer(token) {
        const color = token.color;
        const normalized = normalizeColor(color);
        if (!normalized) {
          return escapeHtml(token.raw);
        }
        return `<span style="color: ${escapeHtml(normalized)};">${this.parser.parseInline(token.tokens)}</span>`;
      }
    };

    window.marked.use({
      extensions: [colorTextExt],
      walkTokens(token) {
        if (token.type !== 'blockquote' || !token.tokens || !token.tokens.length) return;
        const first = token.tokens[0];
        if (first.type !== 'paragraph' || !first.tokens || !first.tokens.length) return;
        for (let i = 0; i < first.tokens.length; i++) {
          const t = first.tokens[i];
          if (t.type === 'text') {
            const match = t.text.match(/^\[(info|success|warning|error|default)\]\s*/);
            if (match) {
              token._alertType = match[1];
              t.text = t.text.slice(match[0].length);
              if (!t.text) {
                first.tokens.splice(i, 1);
                if (!first.tokens.length) {
                  token.tokens.shift();
                }
              }
            }
            break;
          }
        }
      }
    });
  }

  function resolveImagePath(filename) {
    if (window.__axhostBasePath) {
      return window.__axhostBasePath + 'images/' + filename;
    }
    if (window.__axhostProjectId) {
      return '/projects/' + window.__axhostProjectId + '/prototype/images/' + filename;
    }
    return '/prototype/images/' + filename;
  }

  function renderMarkdown(mdText) {
    if (!window.marked) return '<p>marked.js not loaded</p>';
    ensureColorExt();

    const renderer = new window.marked.Renderer();
    const originalLink = renderer.link.bind(renderer);
    const originalBlockquote = renderer.blockquote.bind(renderer);
    const originalImage = renderer.image.bind(renderer);

    renderer.blockquote = function (token) {
      if (token._alertType) {
        const html = this.parser.parse(token.tokens);
        return `<blockquote class="axhost-alert axhost-alert-${token._alertType}">\n${html}</blockquote>`;
      }
      return originalBlockquote(token);
    };

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
      return originalLink(token);
    };

    renderer.image = function (token) {
      const href = token.href;
      if (href && href.startsWith('$')) {
        const src = resolveImagePath(href.slice(1));
        const alt = token.text || '';
        return `<img src="${escapeHtml(src)}" alt="${escapeHtml(alt)}">`;
      }
      return originalImage(token);
    };

    return window.marked.parse(mdText || '', {
      headerIds: false,
      mangle: false,
      renderer: renderer
    });
  }

  window.mdRenderer = { renderMarkdown, escapeHtml, parseDocLink };
})();
