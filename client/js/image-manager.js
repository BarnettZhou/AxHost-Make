(function () {
  var btnImages = document.getElementById('btn-images');
  if (!btnImages) return;

  function resolveImageUrl(filename) {
    if (window.__axhostBasePath) return window.__axhostBasePath + 'images/' + filename;
    if (window.__axhostProjectId) return '/projects/' + window.__axhostProjectId + '/prototype/images/' + filename;
    return '/prototype/images/' + filename;
  }

  function buildGalleryBody(container, images, onRename) {
    container.innerHTML = '';
    if (images.length === 0) {
      container.classList.remove('img-gallery-grid');
      container.innerHTML = '<div style="text-align:center;color:var(--text-muted);padding:40px 0;">暂无图片，拖入图片或点击右上角上传</div>';
      return;
    }
    container.classList.add('img-gallery-grid');
    images.forEach(function (img) {
      var card = document.createElement('div');
      card.className = 'img-gallery-card';
      card.innerHTML =
        '<div class="img-gallery-thumb"><img src="' + resolveImageUrl(img.filename) + '" alt="" loading="lazy"></div>' +
        '<div class="img-gallery-info">' +
          '<span class="img-gallery-name" title="点击重命名">' + escapeHtml(img.name) + '</span>' +
          '<span class="img-gallery-hash">' + escapeHtml(img.hash) + '</span>' +
        '</div>';
      card.querySelector('.img-gallery-name').addEventListener('click', function () {
        startRename(card, img, onRename);
      });
      container.appendChild(card);
    });
  }

  function startRename(card, img, onRename) {
    var nameSpan = card.querySelector('.img-gallery-name');
    var currentName = img.name;
    var input = document.createElement('input');
    input.type = 'text';
    input.className = 'img-gallery-name-input';
    input.value = currentName;
    nameSpan.replaceWith(input);
    input.focus();
    input.select();

    function finish(save) {
      var newName = save ? input.value.trim() : currentName;
      if (save && newName && newName !== currentName) {
        onRename(img.hash, newName, function (success) {
          if (success) img.name = newName;
          var span = document.createElement('span');
          span.className = 'img-gallery-name';
          span.title = '点击重命名';
          span.textContent = img.name;
          span.addEventListener('click', function () { startRename(card, img, onRename); });
          input.replaceWith(span);
        });
      } else {
        var span = document.createElement('span');
        span.className = 'img-gallery-name';
        span.title = '点击重命名';
        span.textContent = currentName;
        span.addEventListener('click', function () { startRename(card, img, onRename); });
        input.replaceWith(span);
      }
    }

    input.addEventListener('keydown', function (e) {
      if (e.key === 'Enter') { e.preventDefault(); finish(true); }
      else if (e.key === 'Escape') { e.preventDefault(); finish(false); }
    });
    input.addEventListener('blur', function () { finish(true); });
  }

  function escapeHtml(str) {
    return String(str).replace(/[&<>"']/g, function (m) { return ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'})[m]; });
  }

  function uploadImageFile(file, callback) {
    var reader = new FileReader();
    reader.onload = function () {
      window.apiClient.postUploadImage({
        name: file.name,
        data: reader.result
      }).then(function (res) {
        if (res.code !== 0) { callback(new Error(res.message || '上传失败')); return; }
        callback(null, res.filename);
      }).catch(function (err) {
        callback(err);
      });
    };
    reader.onerror = function () { callback(new Error('读取文件失败')); };
    reader.readAsDataURL(file);
  }

  function refreshGallery(galleryModal) {
    window.apiClient.getImagesList().then(function (res) {
      if (res.code === 0) {
        galleryModal._images = res.data || [];
        buildGalleryBody(galleryModal.getBody(), galleryModal._images, doRename);
      }
    });
  }

  // Cleanup unused images sub-flow
  function showCleanupModal(galleryModal) {
    var images = galleryModal._images;
    if (!images || images.length === 0) {
      window.showToast('没有图片可清理', 'error');
      return;
    }

    var total = images.length;
    var scanModal = new AxhostModal({
      title: '扫描未引用图片',
      width: '400px',
      hideCancel: true,
      hideConfirm: true,
      body: function(container) {
        container.innerHTML =
          '<div style="text-align:center;padding:20px 0;">' +
            '<div style="margin-bottom:12px;color:var(--text-main);">正在扫描文档引用...</div>' +
            '<div class="img-cleanup-progress-wrap"><div class="img-cleanup-progress-bar" style="width:0%"></div></div>' +
            '<div class="img-cleanup-progress-text" style="margin-top:8px;font-size:12px;color:var(--text-muted);">0 / ' + total + '</div>' +
          '</div>';
      }
    });
    scanModal.open();

    var progressBar = scanModal.getBody().querySelector('.img-cleanup-progress-bar');
    var progressText = scanModal.getBody().querySelector('.img-cleanup-progress-text');
    var progress = 0;
    var timer = setInterval(function () {
      progress = Math.min(progress + Math.ceil(total * 0.08), Math.floor(total * 0.85));
      if (progressBar) progressBar.style.width = (progress / total * 100) + '%';
      if (progressText) progressText.textContent = progress + ' / ' + total;
      if (progress >= Math.floor(total * 0.85)) clearInterval(timer);
    }, 80);

    window.apiClient.postImagesScanUnused().then(function (result) {
      clearInterval(timer);
      if (progressBar) progressBar.style.width = '100%';
      if (progressText) progressText.textContent = total + ' / ' + total;

      var unused = result.data.unused || [];

      setTimeout(function () {
        scanModal.close();

        if (unused.length === 0) {
          window.showToast('所有图片均被引用，无需清理', 'success');
          return;
        }

        var listHtml = unused.map(function (img) {
          return '<div style="display:flex;justify-content:space-between;align-items:center;padding:4px 0;font-size:13px;">' +
            '<span>' + escapeHtml(img.name) + '</span>' +
            '<span style="font-size:11px;color:var(--text-muted);font-family:monospace;">' + escapeHtml(img.hash) + '</span>' +
            '</div>';
        }).join('');

        new AxhostModal({
          title: '未引用图片（' + unused.length + '）',
          width: '420px',
          confirmText: '确定清除',
          body: function(container) {
            container.innerHTML =
              '<p style="margin:0 0 12px;font-size:13px;color:var(--text-muted);">以下图片未被任何文档引用：</p>' +
              '<div style="max-height:260px;overflow-y:auto;margin-bottom:8px;">' + listHtml + '</div>';
          },
          onConfirm: function () {
            var hashes = unused.map(function (img) { return img.hash; });
            return window.apiClient.postImagesDelete({ hashes: hashes }).then(function () {
              var hashSet = {};
              hashes.forEach(function (h) { hashSet[h] = true; });
              galleryModal._images = galleryModal._images.filter(function (img) { return !hashSet[img.hash]; });
              buildGalleryBody(galleryModal.getBody(), galleryModal._images, doRename);
              window.showToast('已清除 ' + unused.length + ' 张图片', 'success');
            }).catch(function (err) {
              window.showToast('清除失败: ' + err.message, 'error');
            });
          }
        }).open();
      }, 300);
    }).catch(function (err) {
      clearInterval(timer);
      scanModal.close();
      window.showToast('扫描失败: ' + err.message, 'error');
    });
  }

  function doRename(hash, name, callback) {
    window.apiClient.postImagesRename({ hash: hash, name: name }).then(function (res) {
      if (res.code === 0) { callback(true); }
      else { window.showToast('重命名失败', 'error'); callback(false); }
    }).catch(function (err) {
      window.showToast('重命名失败: ' + err.message, 'error');
      callback(false);
    });
  }

  function openGallery() {
    window.apiClient.getImagesList().then(function (res) {
      if (res.code !== 0) { window.showToast('加载图片列表失败', 'error'); return; }
      var images = res.data || [];
      var uploadInput = document.createElement('input');
      uploadInput.type = 'file';
      uploadInput.accept = '.jpg,.jpeg,.png,.webp,.gif,.svg';
      uploadInput.multiple = true;

      var modal = new AxhostModal({
        title: '',
        width: '960px',
        hideCancel: true,
        hideConfirm: true,
        header: function (container) {
          container.innerHTML =
            '<span style="font-size:18px;font-weight:600;">图片管理</span>' +
            '<div style="margin-left:auto;display:flex;gap:8px;">' +
              '<button class="img-gallery-upload-btn" title="上传图片">上传</button>' +
              '<button class="img-gallery-cleanup-btn" title="清理未引用的图片">清理未引用</button>' +
            '</div>';
          container.querySelector('.img-gallery-upload-btn').addEventListener('click', function () {
            uploadInput.click();
          });
          container.querySelector('.img-gallery-cleanup-btn').addEventListener('click', function () {
            showCleanupModal(modal);
          });
        },
        body: function (container) {
          container.style.height = '560px';
          container.style.overflowY = 'auto';
          buildGalleryBody(container, images, doRename);

          // Drag-and-drop upload
          container.addEventListener('dragover', function (e) {
            e.preventDefault();
            e.stopPropagation();
            container.classList.add('img-gallery-dragover');
          });
          container.addEventListener('dragleave', function (e) {
            e.preventDefault();
            e.stopPropagation();
            container.classList.remove('img-gallery-dragover');
          });
          container.addEventListener('drop', function (e) {
            e.preventDefault();
            e.stopPropagation();
            container.classList.remove('img-gallery-dragover');
            var files = e.dataTransfer && e.dataTransfer.files;
            if (!files || files.length === 0) return;
            var pending = files.length;
            var hasError = false;
            Array.prototype.forEach.call(files, function (file) {
              if (!/^image\/(png|jpeg|gif|webp|svg\+xml)$/i.test(file.type) && !/\.(png|jpe?g|gif|webp|svg)$/i.test(file.name)) {
                pending--;
                return;
              }
              uploadImageFile(file, function (err) {
                if (err) hasError = true;
                pending--;
                if (pending === 0) {
                  refreshGallery(modal);
                  if (hasError) window.showToast('部分图片上传失败', 'error');
                  else window.showToast('上传完成', 'success');
                }
              });
            });
            if (pending === 0) window.showToast('不支持的文件类型', 'error');
          });
        }
      });
      modal._images = images;

      uploadInput.addEventListener('change', function () {
        var files = uploadInput.files;
        if (!files || files.length === 0) return;
        var pending = files.length;
        var hasError = false;
        Array.prototype.forEach.call(files, function (file) {
          uploadImageFile(file, function (err) {
            if (err) hasError = true;
            pending--;
            if (pending === 0) {
              refreshGallery(modal);
              if (hasError) window.showToast('部分图片上传失败', 'error');
              else window.showToast('上传完成', 'success');
            }
          });
        });
        uploadInput.value = '';
      });

      modal.open();
    }).catch(function (err) {
      window.showToast('加载图片列表失败: ' + err.message, 'error');
    });
  }

  btnImages.addEventListener('click', openGallery);
})();
