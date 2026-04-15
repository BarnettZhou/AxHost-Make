(function () {
  const icons = {
    'document-folder': '<path d="M7 28L7 10C7 8.89543 7.89543 8 9 8L20 8L24 13L39 13C40.1046 13 41 13.8954 41 15L41 28C41 29.1046 40.1046 30 39 30H9C7.89543 30 7 29.1046 7 28Z" fill="none" stroke="currentColor" stroke-width="4" stroke-linejoin="round"/><path d="M15 30V39C15 40.1046 15.8954 41 17 41H41C42.1046 41 43 40.1046 43 39V26" fill="none" stroke="currentColor" stroke-width="4" stroke-linecap="round" stroke-linejoin="round"/>',
    'moon': '<path d="M28.0527 4.41085C22.5828 5.83692 18.5455 10.8106 18.5455 16.7273C18.5455 23.4894 23.965 28.9091 30.7273 28.9091C36.6439 28.9091 41.6176 24.8718 43.0437 19.4019C43.2409 20.2274 43.3485 21.0879 43.3485 21.9727C43.3485 32.6203 34.6203 41.3485 23.9727 41.3485C13.3252 41.3485 4.59705 32.6203 4.59705 21.9727C4.59705 11.3252 13.3252 2.59705 23.9727 2.59705C24.8576 2.59705 25.7181 2.70464 26.5436 2.90182" fill="none" stroke="currentColor" stroke-width="4" stroke-linecap="round" stroke-linejoin="round"/>',
    'sun-one': '<path d="M24 32C28.4183 32 32 28.4183 32 24C32 19.5817 28.4183 16 24 16C19.5817 16 16 19.5817 16 24C16 28.4183 19.5817 32 24 32Z" fill="none" stroke="currentColor" stroke-width="4" stroke-linejoin="round"/><path d="M24 8V4" stroke="currentColor" stroke-width="4" stroke-linecap="round" stroke-linejoin="round"/><path d="M24 44V40" stroke="currentColor" stroke-width="4" stroke-linecap="round" stroke-linejoin="round"/><path d="M8 24H4" stroke="currentColor" stroke-width="4" stroke-linecap="round" stroke-linejoin="round"/><path d="M44 24H40" stroke="currentColor" stroke-width="4" stroke-linecap="round" stroke-linejoin="round"/><path d="M12.6863 12.6863L9.85786 9.85786" stroke="currentColor" stroke-width="4" stroke-linecap="round" stroke-linejoin="round"/><path d="M38.1421 38.1421L35.3137 35.3137" stroke="currentColor" stroke-width="4" stroke-linecap="round" stroke-linejoin="round"/><path d="M12.6863 35.3137L9.85786 38.1421" stroke="currentColor" stroke-width="4" stroke-linecap="round" stroke-linejoin="round"/><path d="M38.1421 9.85786L35.3137 12.6863" stroke="currentColor" stroke-width="4" stroke-linecap="round" stroke-linejoin="round"/>',
    'folder-close': '<path d="M7 28L7 10C7 8.89543 7.89543 8 9 8L20 8L24 13L39 13C40.1046 13 41 13.8954 41 15L41 28C41 29.1046 40.1046 30 39 30H9C7.89543 30 7 29.1046 7 28Z" fill="none" stroke="currentColor" stroke-width="4" stroke-linejoin="round"/>',
    'folder-open': '<path d="M7 28L7 10C7 8.89543 7.89543 8 9 8L20 8L24 13L39 13C40.1046 13 41 13.8954 41 15L41 28C41 29.1046 40.1046 30 39 30H9C7.89543 30 7 29.1046 7 28Z" fill="none" stroke="currentColor" stroke-width="4" stroke-linejoin="round"/><path d="M43 26L35.8974 36.0616C35.3369 36.7773 34.4791 37.1667 33.5942 37.1667H12.5C10.567 37.1667 9 35.5997 9 33.6667V26" fill="none" stroke="currentColor" stroke-width="4" stroke-linecap="round" stroke-linejoin="round"/>',
    'setting-two': '<circle cx="24" cy="24" r="6" fill="none" stroke="currentColor" stroke-width="4"/><path d="M24 4V12M24 36V44M4 24H12M36 24H44M9.85786 9.85786L15.5147 15.5147M32.4853 32.4853L38.1421 38.1421M9.85786 38.1421L15.5147 32.4853M32.4853 15.5147L38.1421 9.85786" stroke="currentColor" stroke-width="4" stroke-linecap="round" stroke-linejoin="round"/>'
  };

  class AxhostIcon extends HTMLElement {
    connectedCallback() {
      const name = this.getAttribute('icon') || this.getAttribute('name') || '';
      const size = this.getAttribute('size') || '16';
      const paths = icons[name];
      if (!paths) {
        this.innerHTML = '';
        return;
      }
      this.innerHTML = `<svg width="${size}" height="${size}" style="display:inline-block;vertical-align:middle;" viewBox="0 0 48 48" fill="none" stroke="currentColor" stroke-width="4" stroke-linecap="round" stroke-linejoin="round">${paths}</svg>`;
    }
  }

  if (!customElements.get('axhost-icon')) {
    customElements.define('axhost-icon', AxhostIcon);
  }

  window.axhostIcons = icons;
})();
