// "Save for offline": stores this page, everything it shows, and the map along the route on the phone.
(() => {
  const b = document.getElementById('save'), s = document.getElementById('savestate'), slug = b.dataset.slug;
  const name = 'trip-' + slug, tname = 'tiles-' + slug;
  if (location.protocol === 'file:' || !('serviceWorker' in navigator) || !window.caches) { b.hidden = true; return; }
  navigator.serviceWorker.register('sw.js');
  const get = k => { try { return localStorage.getItem(k); } catch (e) { return null; } };
  const set = (k, v) => { try { localStorage.setItem(k, v); } catch (e) {} };
  const say = (c, t) => { s.className = c; s.textContent = t; };
  const state = () => {
    if (!get(name)) return;
    b.textContent = 'Save again';
    if (get(tname)) say('ok', '✓ Saved with the map on ' + get(tname)); else say('busy', '! Page saved, map not saved yet');
  };
  Promise.all([caches.has(name), caches.has(tname)]).then(([p, t]) => {
    try { if (!p) localStorage.removeItem(name); if (!t) localStorage.removeItem(tname); } catch (e) {}
    state();
  });

  // the tiles to keep: whole trip far out, a strip along the route closer in, and close detail around each stop
  const wanted = () => {
    const out = new Set(), X = (lon, z) => (lon + 180) / 360 * 2 ** z;
    const Y = (lat, z) => { const q = Math.sin(lat * Math.PI / 180); return (0.5 - Math.log((1 + q) / (1 - q)) / (4 * Math.PI)) * 2 ** z; };
    const around = (x, y, z, r) => { for (let i = Math.floor(x - r); i <= Math.floor(x + r); i++) for (let j = Math.floor(y - r); j <= Math.floor(y + r); j++) out.add(`${z}/${j}/${i}`); };
    const tilesFor = (km, lat, z) => km / (40075 * Math.cos(lat * Math.PI / 180) / 2 ** z);
    for (const f of TRIP.route.features) {
      const c = f.geometry.coordinates;
      for (let z = 6; z <= 13; z++) for (let i = 1; i < c.length; i++) {
        const [x0, y0, x1, y1] = [X(c[i - 1][0], z), Y(c[i - 1][1], z), X(c[i][0], z), Y(c[i][1], z)];
        const n = Math.max(1, Math.ceil(Math.hypot(x1 - x0, y1 - y0) * 2)), r = z <= 10 ? 1 : tilesFor(3.2, c[i][1], z);
        for (let k = 0; k <= n; k++) around(x0 + (x1 - x0) * k / n, y0 + (y1 - y0) * k / n, z, r);
      }
    }
    for (const [lat, lon] of [...TRIP.stops.map(t => t.at), ...TRIP.towns]) for (const z of [14, 15]) around(X(lon, z), Y(lat, z), z, tilesFor(1.6, lat, z));
    return [...out].map(t => { const [z, y, x] = t.split('/'); return TRIP.tiles.replace('{z}', z).replace('{y}', y).replace('{x}', x); });
  };

  async function savePage() {
    const href = q => document.querySelector(q);
    const urls = new Set([location.href.split(/[?#]/)[0], href('link[href^="style.css"]').getAttribute('href'), 'favicon.svg', ...b.dataset.files.split(' ')]);
    document.querySelectorAll('script[src*=".js?v="]').forEach(x => urls.add(x.getAttribute('src')));
    document.querySelectorAll('img').forEach(i => { if (!i.closest('.leaflet-container')) urls.add(i.getAttribute('src')); });
    document.querySelectorAll('a[download]').forEach(a => urls.add(a.getAttribute('href')));
    await navigator.serviceWorker.ready;
    const tmp = [];
    for (const u of urls) { const r = await fetch(u, {cache: 'reload'}); if (!r.ok) throw u; tmp.push([u, r]); }
    await caches.delete(name);
    const c = await caches.open(name);
    for (const [u, r] of tmp) await c.put(u, r);
    set(name, new Date().toLocaleDateString());
  }

  // tiles already kept stay, so a save that was cut off picks up where it stopped
  async function saveTiles() {
    const c = await caches.open(tname), all = wanted(), have = new Set((await c.keys()).map(k => k.url)), todo = all.filter(u => !have.has(u));
    let i = 0, done = all.length - todo.length, missed = 0;
    const work = async () => {
      while (i < todo.length) {
        const u = todo[i++];
        try {
          const r = await fetch(u);
          if (r.ok) await c.put(u, r); else if (r.status !== 404) missed++;
        } catch (e) { if (e.name === 'QuotaExceededError') throw e; missed++; if (missed > 20) throw e; }
        if (++done % 10 === 0) say('busy', `… Saving the map: ${Math.floor(done / all.length * 100)}%`);
      }
    };
    await Promise.all([1, 2, 3, 4, 5, 6].map(work));
    if (missed) throw new Error('missed');
    set(tname, new Date().toLocaleDateString());
  }

  b.onclick = async () => {
    b.disabled = true; say('busy', '… Saving');
    if (navigator.storage && navigator.storage.persist) navigator.storage.persist().catch(() => {});
    try { await savePage(); } catch (e) { say('bad', '✕ Not saved: try again with a good signal'); b.disabled = false; return; }
    try { await saveTiles(); state(); } catch (e) {
      say('bad', e && e.name === 'QuotaExceededError' ? '✕ Page saved, but the phone has no room for the map' : '✕ Page saved, map only partly: tap again with a good signal');
      b.textContent = 'Save again';
    }
    b.disabled = false;
  };
  window.TRIPTILES = wanted;
})();
