(function () {
  function init(iframeEl) {
    let active = false;
    const touchDragHandlers = new WeakMap();
    const TOUCH_STYLE_ID = 'axhost-touch-emulation-style';

    function findScrollableParent(el, win) {
      while (el && el !== win.document.body) {
        const style = win.getComputedStyle(el);
        const canScrollY = /(auto|scroll)/.test(style.overflowY) && el.scrollHeight > el.clientHeight + 1;
        const canScrollX = /(auto|scroll)/.test(style.overflowX) && el.scrollWidth > el.clientWidth + 1;
        if (canScrollY || canScrollX) {
          return { el, canScrollY, canScrollX };
        }
        el = el.parentElement;
      }
      return { el: win, canScrollY: true, canScrollX: true };
    }

    function injectTouchStyle(doc) {
      if (!doc || !doc.head || doc.getElementById(TOUCH_STYLE_ID)) return;
      const style = doc.createElement('style');
      style.id = TOUCH_STYLE_ID;
      style.textContent = `
        * { user-select: none !important; -webkit-user-select: none !important; cursor: none !important; }
        #axhost-touch-cursor {
          position: fixed;
          width: 32px;
          height: 32px;
          border-radius: 50%;
          background: rgba(22, 119, 255, 0.15);
          border: 2px solid rgba(22, 119, 255, 0.5);
          pointer-events: none;
          transform: translate(-50%, -50%);
          z-index: 999999;
          transition: opacity 0.15s ease;
          opacity: 0;
        }
        #axhost-touch-cursor.visible { opacity: 1; }
      `;
      doc.head.appendChild(style);
    }

    function createTouchCursor(doc) {
      if (!doc || doc.getElementById('axhost-touch-cursor')) return;
      const cursor = doc.createElement('div');
      cursor.id = 'axhost-touch-cursor';
      doc.body.appendChild(cursor);
      return cursor;
    }

    function removeTouchStyle(doc) {
      if (!doc) return;
      const style = doc.getElementById(TOUCH_STYLE_ID);
      if (style) style.remove();
      const cursor = doc.getElementById('axhost-touch-cursor');
      if (cursor) cursor.remove();
    }

    function onTouchCursorMove(e) {
      if (!e.target) return;
      const doc = e.target.ownerDocument;
      if (!doc) return;
      const cursor = doc.getElementById('axhost-touch-cursor');
      if (cursor) {
        cursor.style.left = e.clientX + 'px';
        cursor.style.top = e.clientY + 'px';
        cursor.classList.add('visible');
      }
    }

    function onTouchCursorLeave(e) {
      if (!e.target) return;
      const doc = e.target.ownerDocument;
      if (!doc) return;
      const cursor = doc.getElementById('axhost-touch-cursor');
      if (cursor) cursor.classList.remove('visible');
    }

    function makeDragHandlers(doc, win) {
      let startX = 0, startY = 0;
      let startScrollLeft = 0, startScrollTop = 0;
      let scrollTarget = null;
      let canScrollX = false, canScrollY = false;
      let isDragging = false;
      let hasMoved = false;
      let velocityX = 0, velocityY = 0;
      let lastTime = 0, lastX = 0, lastY = 0;
      let momentumRaf = null;

      function cancelMomentum() {
        if (momentumRaf) {
          cancelAnimationFrame(momentumRaf);
          momentumRaf = null;
        }
      }

      function onMouseDown(e) {
        if (e.button !== 0) return;
        cancelMomentum();
        hasMoved = false;
        isDragging = true;
        startX = e.clientX;
        startY = e.clientY;
        lastX = e.clientX;
        lastY = e.clientY;
        lastTime = performance.now();
        velocityX = 0;
        velocityY = 0;
        const el = doc.elementFromPoint(e.clientX, e.clientY);
        const result = findScrollableParent(el, win);
        scrollTarget = result.el;
        canScrollX = result.canScrollX;
        canScrollY = result.canScrollY;
        if (scrollTarget === win) {
          startScrollLeft = win.pageXOffset;
          startScrollTop = win.pageYOffset;
        } else {
          startScrollLeft = scrollTarget.scrollLeft;
          startScrollTop = scrollTarget.scrollTop;
        }
        doc.addEventListener('mousemove', onMouseMove);
        doc.addEventListener('mouseup', onMouseUp);
        doc.addEventListener('mouseleave', onMouseUp);
      }

      function onMouseMove(e) {
        if (!isDragging) return;
        const now = performance.now();
        const dt = now - lastTime;
        const deltaX = startX - e.clientX;
        const deltaY = startY - e.clientY;
        if (Math.abs(deltaX) > 3 || Math.abs(deltaY) > 3) hasMoved = true;
        if (hasMoved) {
          e.preventDefault();
          let x = startScrollLeft;
          let y = startScrollTop;
          if (canScrollX) x += deltaX;
          if (canScrollY) y += deltaY;
          if (scrollTarget === win) {
            win.scrollTo(x, y);
          } else {
            scrollTarget.scrollLeft = x;
            scrollTarget.scrollTop = y;
          }
        }
        if (dt > 0) {
          velocityX = (lastX - e.clientX) / dt;
          velocityY = (lastY - e.clientY) / dt;
        }
        lastX = e.clientX;
        lastY = e.clientY;
        lastTime = now;
      }

      function startMomentum() {
        const deceleration = 0.95;
        const stopThreshold = 0.05;
        let prev = performance.now();

        function step(now) {
          const dt = now - prev;
          prev = now;
          if (Math.abs(velocityX) < stopThreshold && Math.abs(velocityY) < stopThreshold) {
            momentumRaf = null;
            return;
          }
          const dx = velocityX * dt;
          const dy = velocityY * dt;
          if (scrollTarget === win) {
            win.scrollBy(dx, dy);
          } else {
            scrollTarget.scrollLeft += dx;
            scrollTarget.scrollTop += dy;
          }
          const factor = Math.pow(deceleration, dt / 16);
          velocityX *= factor;
          velocityY *= factor;
          momentumRaf = requestAnimationFrame(step);
        }
        momentumRaf = requestAnimationFrame(step);
      }

      function onMouseUp(e) {
        if (!isDragging) return;
        isDragging = false;
        doc.removeEventListener('mousemove', onMouseMove);
        doc.removeEventListener('mouseup', onMouseUp);
        doc.removeEventListener('mouseleave', onMouseUp);
        if (hasMoved) {
          doc.addEventListener('click', suppressClick, true);
          setTimeout(() => doc.removeEventListener('click', suppressClick, true), 0);
          const speed = Math.sqrt(velocityX * velocityX + velocityY * velocityY);
          if (speed > 0.3) startMomentum();
        }
      }

      function suppressClick(e) {
        e.stopPropagation();
        e.preventDefault();
      }

      return { onMouseDown };
    }

    function attach() {
      const doc = iframeEl.contentDocument;
      const win = iframeEl.contentWindow;
      if (!doc || !win) return;
      injectTouchStyle(doc);
      createTouchCursor(doc);
      doc.addEventListener('mousemove', onTouchCursorMove);
      doc.addEventListener('mouseleave', onTouchCursorLeave);
      if (touchDragHandlers.has(doc)) return;
      const handlers = makeDragHandlers(doc, win);
      touchDragHandlers.set(doc, handlers);
      doc.addEventListener('mousedown', handlers.onMouseDown);
    }

    function detach() {
      const doc = iframeEl.contentDocument;
      if (!doc) return;
      removeTouchStyle(doc);
      doc.removeEventListener('mousemove', onTouchCursorMove);
      doc.removeEventListener('mouseleave', onTouchCursorLeave);
      const handlers = touchDragHandlers.get(doc);
      if (handlers) {
        doc.removeEventListener('mousedown', handlers.onMouseDown);
        touchDragHandlers.delete(doc);
      }
    }

    function sync() {
      if (active) attach();
      else detach();
    }

    return {
      attach: attach,
      detach: detach,
      sync: sync,
      setActive: function (val) { active = val; },
      isActive: function () { return active; }
    };
  }

  window.touchEmulation = { init: init };
})();
