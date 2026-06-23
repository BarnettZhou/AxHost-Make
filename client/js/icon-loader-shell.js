// IconPark CDN loader — 供 Shell/Preview 宿主环境使用，原型页面请使用 icon-loader.js
(function () {
  var url = 'https://lf1-cdn-tos.bytegoofy.com/obj/iconpark/icons_43205_80.cbfd60ce464bec045be80ca130edb5de.js';
  if (window.__axhostIconParkES5) {
    url = 'https://lf1-cdn-tos.bytegoofy.com/obj/iconpark/icons_43205_80.cbfd60ce464bec045be80ca130edb5de.es5.js';
  }
  if (!document.querySelector('script[data-iconpark]')) {
    var script = document.createElement('script');
    script.src = url;
    script.defer = true;
    script.setAttribute('data-iconpark', 'true');
    var current = document.currentScript;
    if (current && current.parentNode) {
      current.parentNode.insertBefore(script, current);
    } else {
      document.head.appendChild(script);
    }
  }
})();
