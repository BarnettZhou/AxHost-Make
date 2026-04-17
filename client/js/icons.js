(function () {
  var url = 'https://lf1-cdn-tos.bytegoofy.com/obj/iconpark/icons_43205_25.ceb4fc3d756c331726094ad42b7d2e50.js';
  if (window.__axhostIconParkES5) {
    url = 'https://lf1-cdn-tos.bytegoofy.com/obj/iconpark/icons_43205_25.ceb4fc3d756c331726094ad42b7d2e50.es5.js';
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
