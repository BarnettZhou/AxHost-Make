(function () {
  var url = 'https://lf1-cdn-tos.bytegoofy.com/obj/iconpark/icons_43205_34.835049b2e3a5e33f583f4270ad21a5a4.js';
  if (window.__axhostIconParkES5) {
    url = 'https://lf1-cdn-tos.bytegoofy.com/obj/iconpark/icons_43205_34.835049b2e3a5e33f583f4270ad21a5a4.es5.js';
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
