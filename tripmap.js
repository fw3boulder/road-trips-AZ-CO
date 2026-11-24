// The trip's zoomable map: stops, full screen, Where am I, and tiles that come from the saved copy without a signal.
// TRIP (routes, towns, stops, day colors) is defined in the page. Full screen and Where am I follow fw3-terratrack
// roadbook/page.js at 5d81258.
(() => {
  const box = document.getElementById('mapbox'), full = document.getElementById('full'), out = document.getElementById('hereout');
  const still = () => { document.getElementById('stillmap').hidden = false; document.getElementById('livemap').hidden = true; };
  if (!window.L) { still(); box.querySelector('.mapbar').hidden = true; return; }
  const esc = s => String(s).replace(/[&<>"]/g, c => ({'&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;'})[c]);
  const m = L.map('livemap', {zoomSnap: 0.25, maxZoom: 17});

  // a tile we don't have is cut out of the nearest bigger one we do have, so zooming in never goes blank
  const tiles = L.tileLayer(TRIP.tiles, {maxZoom: 17, maxNativeZoom: 16, crossOrigin: true, attribution: TRIP.credit});
  const parent = async (z, x, y, size) => {
    for (let up = 1; z - up >= 6; up++) {
      const n = 2 ** up, u = L.Util.template(TRIP.tiles, {z: z - up, x: Math.floor(x / n), y: Math.floor(y / n)});
      const r = await caches.match(u).catch(() => null);
      if (!r) continue;
      const img = await createImageBitmap(await r.blob()), c = document.createElement('canvas'), s = img.width / n;
      c.width = c.height = size;
      c.getContext('2d').drawImage(img, (x % n) * s, (y % n) * s, s, s, 0, 0, size, size);
      return c.toDataURL('image/jpeg', 0.85);
    }
  };
  let got = false, lost = 0;
  tiles.on('tileload', () => { got = true; });
  tiles.on('tileerror', async e => {
    if (e.tile.dataset.tried) return;
    e.tile.dataset.tried = 1;
    const src = window.caches && await parent(e.coords.z, e.coords.x, e.coords.y, 256).catch(() => null);
    if (src) { got = true; e.tile.src = src; e.tile.classList.add('leaflet-tile-loaded'); e.tile.style.opacity = 1; } else if (++lost > 3 && !got && !box.classList.contains('big')) still();
  });
  tiles.addTo(m);

  const g = L.geoJSON(TRIP.route, {style: f => ({color: f.properties.color, weight: 5, opacity: .9}), interactive: false}).addTo(m);
  const days = {};
  g.eachLayer(l => { days[l.feature.properties.day] = l.getBounds(); });
  const fit = n => m.fitBounds(n ? days[n] : g.getBounds(), {padding: [24, 24], animate: false});
  fit();
  TRIP.towns.forEach(([a, b, n]) => L.circleMarker([a, b], {radius: 6, color: '#fff', weight: 2, fillColor: '#1b1b1b', fillOpacity: 1})
    .bindTooltip(n, {permanent: true, direction: 'right', className: 'town', offset: [6, 0]}).addTo(m));
  TRIP.stops.forEach(s => L.marker(s.at, {title: s.name, icon: L.divIcon({className: 'pin', iconSize: [32, 32], html: `<i style="border-color:${s.color}">${esc(s.icon)}️</i>`})})
    .bindPopup(`<b>Day ${s.day}: ${esc(s.name)}</b>${s.know ? '<br>' + esc(s.know) : ''}`, {maxWidth: 250, maxHeight: 220}).addTo(m));

  const show = (on, n) => {
    box.classList.toggle('big', on);
    document.body.classList.toggle('noscroll', on);
    full.textContent = on ? '✕ Close map' : '⛶ Full screen';
    m.invalidateSize({animate: false});
    if (on && n) fit(n);
  };
  const open = n => { if (!box.classList.contains('big')) history.pushState({map: 1}, ''); show(true, n); };
  full.addEventListener('click', () => box.classList.contains('big') ? history.back() : open());
  window.addEventListener('popstate', () => { if (box.classList.contains('big')) show(false); });
  document.querySelectorAll('.daymaplink').forEach(a => a.addEventListener('click', e => { e.preventDefault(); open(a.dataset.day); }));
  document.getElementById('all').addEventListener('click', () => fit());

  const size = () => m.getContainer().classList.toggle('far', m.getZoom() < 8.5);
  m.on('zoomend', size);
  size();

  let me;
  document.getElementById('here').addEventListener('click', () => {
    if (!navigator.geolocation) { out.textContent = '✕ No GPS here.'; return; }
    out.textContent = '… Looking for you';
    navigator.geolocation.getCurrentPosition(p => {
      const at = [p.coords.latitude, p.coords.longitude];
      if (me) me.remove();
      me = L.circleMarker(at, {radius: 9, color: '#fff', weight: 3, fillColor: '#1a73e8', fillOpacity: 1}).addTo(m);
      m.setView(at, Math.max(m.getZoom(), 12), {animate: false});
      out.textContent = `✓ Found you, within ${Math.round(p.coords.accuracy * 3.281)} ft`;
    }, e => { out.textContent = e.code === 1 ? '✕ Location is turned off for this page.' : '✕ No GPS fix yet: try again under open sky.'; },
    {enableHighAccuracy: true, timeout: 25000, maximumAge: 5000});
  });
  window.TRIPMAP = m;
})();
