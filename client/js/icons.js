(function () {
  const ES2019_URL = 'https://lf1-cdn-tos.bytegoofy.com/obj/iconpark/icons_43205_14.afe083f225fffe1b4dcd810437267dbc.js';
  const ES5_URL    = 'https://lf1-cdn-tos.bytegoofy.com/obj/iconpark/icons_43205_14.afe083f225fffe1b4dcd810437267dbc.es5.js';

  const url = window.__axhostIconParkES5 ? ES5_URL : ES2019_URL;

  if (!document.querySelector('script[data-iconpark]')) {
    const script = document.createElement('script');
    script.src = url;
    script.async = true;
    script.setAttribute('data-iconpark', 'true');
    document.head.appendChild(script);
  }
})();
