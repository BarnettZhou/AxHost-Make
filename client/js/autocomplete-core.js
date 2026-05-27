(function () {
  function escapeHtml(str) {
    return str.replace(/[&<>"']/g, function (m) { return ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'})[m]; });
  }

  async function loadScanData(type, cache) {
    if (type === 'pages' && cache.pages) return cache.pages;
    if (type === 'components' && cache.components) return cache.components;
    try {
      var res = await window.apiClient.getScan(type);
      if (res.code === 0) {
        var list = flattenNodes(res.data || [], type);
        if (type === 'pages') cache.pages = list;
        else cache.components = list;
        return list;
      }
    } catch (e) { console.error('loadScanData error:', e); }
    return [];
  }

  function flattenNodes(nodes, type, parentNames) {
    parentNames = parentNames || [];
    var result = [];
    for (var i = 0; i < nodes.length; i++) {
      var node = nodes[i];
      var currentNames = parentNames.concat(node.name);
      if (node.type === 'page' || node.type === 'component') {
        result.push({
          name: node.name,
          path: node.path,
          type: type,
          breadcrumb: currentNames.join(' / ')
        });
      }
      if (node.children && node.children.length) {
        result.push.apply(result, flattenNodes(node.children, type, currentNames));
      }
    }
    return result;
  }

  function getCaretCoordinates(textarea, position) {
    var div = document.createElement('div');
    var style = getComputedStyle(textarea);
    var properties = [
      'boxSizing','width','height','overflowX','overflowY',
      'borderTopWidth','borderRightWidth','borderBottomWidth','borderLeftWidth',
      'paddingTop','paddingRight','paddingBottom','paddingLeft',
      'fontStyle','fontVariant','fontWeight','fontStretch','fontSize',
      'fontFamily','lineHeight','textTransform','textIndent','textDecoration',
      'letterSpacing','wordSpacing','tabSize','whiteSpace'
    ];
    div.style.position = 'fixed';
    div.style.visibility = 'hidden';
    div.style.whiteSpace = 'pre-wrap';
    div.style.wordWrap = 'break-word';
    for (var i = 0; i < properties.length; i++) {
      div.style[properties[i]] = style[properties[i]];
    }
    div.style.width = textarea.clientWidth + 'px';

    var taRect = textarea.getBoundingClientRect();
    div.style.left = taRect.left + 'px';
    div.style.top = taRect.top + 'px';

    var text = textarea.value.substring(0, position);
    var span = document.createElement('span');
    span.innerHTML = escapeHtml(text).replace(/\n/g, '<br/>');
    var caret = document.createElement('span');
    caret.textContent = '|';
    div.appendChild(span);
    div.appendChild(caret);
    document.body.appendChild(div);

    var caretRect = caret.getBoundingClientRect();
    document.body.removeChild(div);
    return { left: caretRect.left, top: caretRect.top + caretRect.height };
  }

  function ensureDropdown(id, className) {
    var el = document.getElementById(id);
    if (!el) {
      el = document.createElement('div');
      el.id = id;
      el.className = className || 'prompt-autocomplete';
      document.body.appendChild(el);
    }
    return el;
  }

  function hideDropdown(el) {
    if (el) el.classList.remove('open');
  }

  function updateActiveItem(el, state) {
    if (!state || !el) return;
    el.querySelectorAll('.prompt-ac-item').forEach(function (item, idx) {
      var isActive = idx === state.selectedIndex;
      item.classList.toggle('active', isActive);
      if (isActive) {
        item.scrollIntoView({ block: 'nearest' });
      }
    });
  }

  function buildDropdownItems(filtered, escFn, selectFn, dropdown) {
    dropdown.innerHTML = '';
    filtered.forEach(function (item, idx) {
      var div = document.createElement('div');
      div.className = 'prompt-ac-item' + (idx === 0 ? ' active' : '');
      var metaHtml = item.breadcrumb ? '<div class="prompt-ac-meta">' + escFn(item.breadcrumb) + '</div>' : '';
      div.innerHTML = '<div class="prompt-ac-name">' + escFn(item.name) + '</div>' + metaHtml;
      div.addEventListener('mousedown', function (e) {
        e.preventDefault();
        selectFn(item);
      });
      dropdown.appendChild(div);
    });
  }

  function positionDropdown(dropdown, textarea, startPos) {
    var coords = getCaretCoordinates(textarea, startPos);
    var taRect = textarea.getBoundingClientRect();
    dropdown.style.left = coords.left + 'px';
    dropdown.style.top = coords.top + 'px';
    dropdown.style.minWidth = taRect.width + 'px';
    dropdown.classList.add('open');

    // If dropdown overflows right edge, align to right side of window
    var dr = dropdown.getBoundingClientRect();
    var margin = 12;
    if (dr.right > window.innerWidth - margin) {
      dropdown.style.left = (window.innerWidth - dr.width - margin) + 'px';
    }
  }

  function filterItems(items, keyword, maxItems) {
    if (!keyword) return items.slice(0, maxItems || 20);
    var kw = keyword.toLowerCase();
    return items.filter(function (it) {
      return it.name.toLowerCase().indexOf(kw) !== -1 || (it.breadcrumb && it.breadcrumb.toLowerCase().indexOf(kw) !== -1);
    }).slice(0, maxItems || 20);
  }

  function handleKeyNav(e, acState, acDropdown, selectFn) {
    if (!acState) return;
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      acState.selectedIndex = (acState.selectedIndex + 1) % acState.items.length;
      updateActiveItem(acDropdown, acState);
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      acState.selectedIndex = (acState.selectedIndex - 1 + acState.items.length) % acState.items.length;
      updateActiveItem(acDropdown, acState);
    } else if (e.key === 'Enter' || e.key === 'Tab') {
      e.preventDefault();
      selectFn(acState.items[acState.selectedIndex]);
    } else if (e.key === 'Escape') {
      e.preventDefault();
      if (acDropdown) acDropdown.classList.remove('open');
    }
  }

  window.acCore = {
    escapeHtml: escapeHtml,
    loadScanData: loadScanData,
    flattenNodes: flattenNodes,
    getCaretCoordinates: getCaretCoordinates,
    ensureDropdown: ensureDropdown,
    hideDropdown: hideDropdown,
    updateActiveItem: updateActiveItem,
    buildDropdownItems: buildDropdownItems,
    positionDropdown: positionDropdown,
    filterItems: filterItems,
    handleKeyNav: handleKeyNav
  };
})();
