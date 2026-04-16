(function () {
  var url = 'https://lf1-cdn-tos.bytegoofy.com/obj/iconpark/icons_43205_22.8bcafb19c6aa9e850713e85f41c2a53c.js';
  if (window.__axhostIconParkES5) {
    url = 'https://lf1-cdn-tos.bytegoofy.com/obj/iconpark/icons_43205_22.8bcafb19c6aa9e850713e85f41c2a53c.es5.js';
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
