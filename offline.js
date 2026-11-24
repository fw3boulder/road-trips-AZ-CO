// "Save for offline": stores this page and everything it shows on the phone.
(() => {
  const b = document.getElementById('save'), s = document.getElementById('savestate'), slug = b.dataset.slug;
  const name = 'trip-' + slug, done = t => { s.className = 'ok'; s.textContent = '✓ Saved' + t; b.textContent = 'Save again'; };
  if (!navigator.onLine) { document.getElementById('stillmap').hidden = false; document.getElementById('livemap').hidden = true; }
  if (location.protocol === 'file:' || !('serviceWorker' in navigator) || !window.caches) { b.hidden = true; return; }
  navigator.serviceWorker.register('sw.js');
  const when = () => { try { return localStorage.getItem(name); } catch (e) { return null; } };
  caches.has(name).then(h => { if (h && when()) done(' on ' + when()); });
  b.onclick = async () => {
    b.disabled = true; s.className = 'busy'; s.textContent = '… Saving';
    try {
      const urls = new Set([location.href.split(/[?#]/)[0], document.querySelector('link[href^="style.css"]').getAttribute('href'), document.querySelector('script[src^="offline.js"]').getAttribute('src'), 'favicon.svg', ...b.dataset.files.split(' ')]);
      document.querySelectorAll('img').forEach(i => { if (!i.closest('.leaflet-container')) urls.add(i.getAttribute('src')); });
      document.querySelectorAll('a[download]').forEach(a => urls.add(a.getAttribute('href')));
      await navigator.serviceWorker.ready;
      const tmp = [];
      for (const u of urls) { const r = await fetch(u, {cache: 'reload'}); if (!r.ok) throw u; tmp.push([u, r]); }
      await caches.delete(name);
      const c = await caches.open(name);
      for (const [u, r] of tmp) await c.put(u, r);
      const d = new Date().toLocaleDateString();
      try { localStorage.setItem(name, d); } catch (e) {}
      done(' on ' + d);
    } catch (e) { s.className = 'bad'; s.textContent = '✕ Not saved: try again with a good signal'; }
    b.disabled = false;
  };
})();
