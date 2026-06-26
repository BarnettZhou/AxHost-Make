/**
 * AxhostModal — unified modal component
 *
 * Usage:
 *   const modal = new AxhostModal({ title: '新建', body: '...', onConfirm: async () => {...} });
 *   modal.open();
 *
 *   // Static convenience
 *   const ok = await AxhostModal.confirm({ title: '确认', message: '确定删除？' });
 *   const name = await AxhostModal.prompt({ title: '新建', placeholder: '名称' });
 */

let _modalZIndex = 1100;

class AxhostModal {
  constructor(options = {}) {
    this._options = Object.assign({
      title: '',
      body: '',
      header: null,
      footer: null,
      width: '400px',
      closeOnMask: true,
      confirmText: '确定',
      cancelText: '取消',
      hideCancel: false,
      hideConfirm: false,
      onConfirm: null,
      onCancel: null,
      onClose: null,
    }, options);

    this._confirmText = this._options.confirmText;
    this._loading = false;
    this._onKeyDown = this._onKeyDown.bind(this);
    this._onOverlayClick = this._onOverlayClick.bind(this);
    this._buildDOM();
  }

  /* ---- DOM construction ---- */

  _buildDOM() {
    const z = ++_modalZIndex;
    this._el = document.createElement('div');
    this._el.className = 'axhost-modal';
    this._el.style.zIndex = z;
    this._el.innerHTML =
      '<div class="axhost-modal-overlay"></div>' +
      '<div class="axhost-modal-content" style="width:' + this._escape(this._options.width) + '">' +
        '<div class="axhost-modal-header"></div>' +
        '<div class="axhost-modal-body"></div>' +
        '<div class="axhost-modal-footer"></div>' +
      '</div>';

    this._overlay = this._el.querySelector('.axhost-modal-overlay');
    this._content = this._el.querySelector('.axhost-modal-content');
    this._headerEl = this._el.querySelector('.axhost-modal-header');
    this._bodyEl = this._el.querySelector('.axhost-modal-body');
    this._footerEl = this._el.querySelector('.axhost-modal-footer');

    // Header
    if (typeof this._options.header === 'function') {
      this._options.header(this._headerEl);
    } else {
      this._headerEl.innerHTML = '<h4 class="axhost-modal-title">' + this._escape(this._options.title) + '</h4>';
    }

    // Body
    if (typeof this._options.body === 'function') {
      this._options.body(this._bodyEl);
    } else if (this._options.body) {
      this._bodyEl.innerHTML = this._options.body;
    }

    // Footer
    if (typeof this._options.footer === 'function') {
      this._options.footer(this._footerEl);
    } else {
      this._renderDefaultFooter();
    }

    document.body.appendChild(this._el);
  }

  _renderDefaultFooter() {
    const cancelText = this._escape(this._options.cancelText);
    const confirmText = this._escape(this._options.confirmText);
    let html = '';
    if (!this._options.hideCancel) {
      html += '<button class="axhost-modal-btn axhost-modal-btn-cancel">' + cancelText + '</button>';
    }
    if (!this._options.hideConfirm) {
      html += '<button class="axhost-modal-btn axhost-modal-btn-primary">' + confirmText + '</button>';
    }
    this._footerEl.innerHTML = html;

    this._btnCancel = this._footerEl.querySelector('.axhost-modal-btn-cancel');
    this._btnConfirm = this._footerEl.querySelector('.axhost-modal-btn-primary');

    if (this._btnCancel) {
      this._btnCancel.addEventListener('click', () => this._handleCancel());
    }
    if (this._btnConfirm) {
      this._btnConfirm.addEventListener('click', () => this._handleConfirm());
    }
  }

  /* ---- Show / Hide ---- */

  open() {
    document.addEventListener('keydown', this._onKeyDown);

    if (this._options.closeOnMask && this._overlay) {
      this._overlay.addEventListener('click', this._onOverlayClick);
    }

    // Defer adding .open to next frame so the browser paints opacity:0 first,
    // otherwise the transition from 0→1 is skipped.
    requestAnimationFrame(() => {
      this._el.classList.add('open');
      const input = this._bodyEl.querySelector('input, textarea, select');
      if (input) setTimeout(() => input.focus(), 50);
    });
  }

  close() {
    if (this._loading) return; // don't close while loading
    this._el.classList.remove('open');
    document.removeEventListener('keydown', this._onKeyDown);
    if (this._overlay) {
      this._overlay.removeEventListener('click', this._onOverlayClick);
    }
    // Wait for CSS transition to complete before calling onClose
    const onClose = this._options.onClose;
    if (onClose) {
      var closed = false;
      const el = this._el;
      const done = function() {
        if (closed) return;
        closed = true;
        el.removeEventListener('transitionend', handler);
        onClose();
      };
      const handler = function() { done(); };
      this._el.addEventListener('transitionend', handler);
      // Fallback: if transitionend doesn't fire, call after 250ms
      setTimeout(done, 250);
    }
  }

  /* ---- Loading ---- */

  setLoading(loading) {
    this._loading = loading;
    if (this._btnConfirm) {
      this._btnConfirm.disabled = loading;
      this._btnConfirm.textContent = loading
        ? (this._confirmText.replace(/[.。]+$/, '') + '中...')
        : this._confirmText;
    }
    if (this._btnCancel) {
      this._btnCancel.disabled = loading;
    }
    // Prevent mask-close while loading
    if (loading) {
      if (this._overlay) this._overlay.removeEventListener('click', this._onOverlayClick);
    } else {
      if (this._options.closeOnMask && this._overlay) {
        this._overlay.addEventListener('click', this._onOverlayClick);
      }
    }
  }

  /* ---- Accessors ---- */

  getBody() { return this._bodyEl; }
  getElement() { return this._el; }

  /* ---- Internal handlers ---- */

  _onKeyDown(e) {
    if (e.key === 'Escape' && !this._loading) {
      this._handleCancel();
    }
  }

  _onOverlayClick(e) {
    if (e.target === this._overlay) {
      this._handleCancel();
    }
  }

  async _handleConfirm() {
    if (this._loading) return;
    const fn = this._options.onConfirm;
    if (!fn) { this.close(); return; }

    try {
      const result = fn();
      if (result && typeof result.then === 'function') {
        this.setLoading(true);
        try {
          await result;
          this.setLoading(false);
          this.close();
        } catch (_) {
          this.setLoading(false);
        }
      } else {
        this.close();
      }
    } catch (_) {
      // onConfirm threw synchronously — validation failed, keep modal open
    }
  }

  _handleCancel() {
    if (this._loading) return;
    if (this._options.onCancel) this._options.onCancel();
    this.close();
  }

  _escape(s) {
    return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  }

  /* ---- Static convenience methods ---- */

  static alert(options = {}) {
    const opts = typeof options === 'string'
      ? { title: '提示', message: options }
      : Object.assign({ title: '提示' }, options);
    return new Promise((resolve) => {
      const modal = new AxhostModal({
        title: opts.title,
        body: '<p style="margin:0;line-height:1.6;">' + String(opts.message || '').replace(/&/g, '&amp;').replace(/</g, '&lt;') + '</p>',
        confirmText: opts.confirmText || '确定',
        hideCancel: true,
        onConfirm: () => { resolve(); },
        onCancel: () => { resolve(); },
        onClose: () => { resolve(); },
        closeOnMask: opts.closeOnMask !== undefined ? opts.closeOnMask : true,
      });
      modal.open();
    });
  }

  static confirm(options = {}) {
    const opts = typeof options === 'string'
      ? { title: '确认', message: options }
      : Object.assign({ title: '确认' }, options);
    return new Promise((resolve) => {
      const modal = new AxhostModal({
        title: opts.title,
        body: '<p style="margin:0;line-height:1.6;">' + String(opts.message || '').replace(/&/g, '&amp;').replace(/</g, '&lt;') + '</p>',
        confirmText: opts.confirmText || '确定',
        cancelText: opts.cancelText || '取消',
        closeOnMask: opts.closeOnMask !== undefined ? opts.closeOnMask : true,
        onConfirm: () => { resolve(true); },
        onCancel: () => { resolve(false); },
        onClose: () => {},
      });
      modal.open();
    });
  }

  static prompt(options = {}) {
    const opts = typeof options === 'string'
      ? { title: '输入', placeholder: options }
      : Object.assign({ title: '输入' }, options);
    const validator = opts.validator || null;
    return new Promise((resolve) => {
      let submitted = false;
      const modal = new AxhostModal({
        title: opts.title,
        body: function(container) {
          container.innerHTML =
            '<input type="text" class="axhost-modal-input" placeholder="' +
            String(opts.placeholder || '').replace(/"/g, '&quot;') + '" value="' +
            String(opts.defaultValue || '').replace(/"/g, '&quot;') + '" autocomplete="off">';
        },
        confirmText: opts.confirmText || '确定',
        cancelText: opts.cancelText || '取消',
        closeOnMask: opts.closeOnMask !== undefined ? opts.closeOnMask : true,
        onConfirm: () => {
          const input = modal._bodyEl.querySelector('.axhost-modal-input');
          const value = (input ? input.value : '').trim();
          if (!value) {
            window.showToast && window.showToast('名称不能为空', 'error');
            throw new Error();
          }
          if (validator) {
            const err = validator(value);
            if (err) {
              window.showToast && window.showToast(err, 'error');
              throw new Error();
            }
          }
          submitted = true;
          resolve(value);
        },
        onCancel: () => { if (!submitted) resolve(null); },
        onClose: () => { if (!submitted) resolve(null); },
      });
      modal.open();
      // Submit on Enter
      const input = modal._bodyEl.querySelector('.axhost-modal-input');
      if (input) {
        input.addEventListener('keydown', function(e) {
          if (e.key === 'Enter') {
            e.preventDefault();
            if (modal._btnConfirm) modal._btnConfirm.click();
          }
        });
      }
    });
  }
}

window.AxhostModal = AxhostModal;
