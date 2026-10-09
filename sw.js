/* Service worker всего сайта: за столом интернета может не быть,
   поэтому счётчики лежат в кэше целиком, а правила докладываются по мере чтения
   (или сразу все — кнопкой «Сохранить для офлайна» на вкладке «Правила»).

   Стратегии:
   - страницы — сначала сеть, потом кэш: обновления доезжают при перезагрузке,
     а без сети открывается сохранённая копия;
   - картинки правил — сначала кэш, они не меняются; лежат в отдельном кэше,
     который не сбрасывается при смене версии;
   - остальные свои файлы — сначала кэш с тихим обновлением в фоне;
   - шрифты Google — сначала кэш, иначе качаем и кладём в кэш.

   Добавили новую игру — допишите её файлы в ASSETS и поднимите VERSION. */

const VERSION = 'v7';
const APP = 'bg-app-' + VERSION;
const MEDIA = 'bg-media';
const FONTS = 'bg-fonts';

const ASSETS = [
  './', 'manifest.webmanifest', 'icons/icon-192.png', 'icons/icon-512.png', 'icons/apple-touch-icon.png',
  'score/7-wonders-duel/', 'score/7-wonders-duel/img/board.webp', 'score/7-wonders-duel/img/coin.png',
  'score/7-wonders-duel/img/g-builders.png', 'score/7-wonders-duel/img/g-magistrates.png',
  'score/7-wonders-duel/img/g-moneylenders.png', 'score/7-wonders-duel/img/g-scientists.png',
  'score/7-wonders-duel/img/g-shipowners.png', 'score/7-wonders-duel/img/g-tacticians.png',
  'score/7-wonders-duel/img/g-traders.png', 'score/7-wonders-duel/img/icon-192.png',
  'score/7-wonders-duel/img/icon.png', 'score/7-wonders-duel/img/laurel.png',
  'score/7-wonders-duel/img/marker.png', 'score/7-wonders-duel/img/military.png',
  'score/7-wonders-duel/img/parchment.jpg', 'score/7-wonders-duel/img/progress.png',
  'score/7-wonders-duel/img/pt-agriculture.png', 'score/7-wonders-duel/img/pt-architecture.png',
  'score/7-wonders-duel/img/pt-economy.png', 'score/7-wonders-duel/img/pt-law.png',
  'score/7-wonders-duel/img/pt-masonry.png', 'score/7-wonders-duel/img/pt-mathematics.png',
  'score/7-wonders-duel/img/pt-philosophy.png', 'score/7-wonders-duel/img/pt-strategy.png',
  'score/7-wonders-duel/img/pt-theology.png', 'score/7-wonders-duel/img/pt-urbanism.png',
  'score/7-wonders-duel/img/w-appian.jpg', 'score/7-wonders-duel/img/w-artemis.jpg',
  'score/7-wonders-duel/img/w-circus.jpg', 'score/7-wonders-duel/img/w-colossus.jpg',
  'score/7-wonders-duel/img/w-gardens.jpg', 'score/7-wonders-duel/img/w-library.jpg',
  'score/7-wonders-duel/img/w-lighthouse.jpg', 'score/7-wonders-duel/img/w-mausoleum.jpg',
  'score/7-wonders-duel/img/w-piraeus.jpg', 'score/7-wonders-duel/img/w-pyramids.jpg',
  'score/7-wonders-duel/img/w-sphinx.jpg', 'score/7-wonders-duel/img/w-zeus.jpg',
  'score/7-wonders-duel/img/wonder.png', 'score/agricola/icon-192.png',
  'score/agricola/', 'score/cascadia/', 'score/cascadia/img/art-bear.png',
  'score/cascadia/img/art-elk.png', 'score/cascadia/img/art-fox.png', 'score/cascadia/img/art-hawk.png',
  'score/cascadia/img/art-salmon.png', 'score/cascadia/img/bear.png', 'score/cascadia/img/elk.png',
  'score/cascadia/img/forest.png', 'score/cascadia/img/fox.png', 'score/cascadia/img/hawk.png',
  'score/cascadia/img/icon-192.png', 'score/cascadia/img/icon.png', 'score/cascadia/img/meeple.png',
  'score/cascadia/img/mountain.png', 'score/cascadia/img/pad.jpg', 'score/cascadia/img/paper.jpg',
  'score/cascadia/img/pine.png', 'score/cascadia/img/prairie.png', 'score/cascadia/img/river.png',
  'score/cascadia/img/salmon.png', 'score/cascadia/img/seal.png', 'score/cascadia/img/sum-hab.png',
  'score/cascadia/img/sum-wild.png', 'score/cascadia/img/wetland.png', 'score/cascadia/img/wood.jpg',
  'score/great-western-trail/', 'score/great-western-trail/img/building.png',
  'score/great-western-trail/img/cattle.png', 'score/great-western-trail/img/city.png',
  'score/great-western-trail/img/disc.png', 'score/great-western-trail/img/ex-building.jpg',
  'score/great-western-trail/img/ex-cattle.jpg', 'score/great-western-trail/img/ex-city.jpg',
  'score/great-western-trail/img/ex-disc.jpg', 'score/great-western-trail/img/ex-hazard.jpg',
  'score/great-western-trail/img/ex-market.jpg', 'score/great-western-trail/img/ex-objective.jpg',
  'score/great-western-trail/img/ex-station.jpg', 'score/great-western-trail/img/ex-workers.jpg',
  'score/great-western-trail/img/hazard.png', 'score/great-western-trail/img/icon-192.png',
  'score/great-western-trail/img/icon.png', 'score/great-western-trail/img/m-bandits.png',
  'score/great-western-trail/img/m-buildings.png', 'score/great-western-trail/img/m-certs.png',
  'score/great-western-trail/img/m-hazards.png', 'score/great-western-trail/img/m-objectives.png',
  'score/great-western-trail/img/m-stations.png', 'score/great-western-trail/img/m-workers.png',
  'score/great-western-trail/img/market.png', 'score/great-western-trail/img/master.png',
  'score/great-western-trail/img/money.png', 'score/great-western-trail/img/objective.png',
  'score/great-western-trail/img/parchment.jpg', 'score/great-western-trail/img/station.png',
  'score/great-western-trail/img/worker.png', 'score/orleans/', 'score/orleans/img/brocade.png',
  'score/orleans/img/ch-craftsman.png', 'score/orleans/img/ch-farmer.png', 'score/orleans/img/ch-knight.png',
  'score/orleans/img/ch-merchant.png', 'score/orleans/img/ch-monk.png', 'score/orleans/img/ch-sailor.png',
  'score/orleans/img/ch-scholar.png', 'score/orleans/img/cheese.png', 'score/orleans/img/citizen.png',
  'score/orleans/img/coin.png', 'score/orleans/img/grain.png', 'score/orleans/img/icon-192.png',
  'score/orleans/img/icon.png', 'score/orleans/img/parchment.jpg', 'score/orleans/img/star.png',
  'score/orleans/img/station.png', 'score/orleans/img/tile-brocade.jpg', 'score/orleans/img/tile-cheese.jpg',
  'score/orleans/img/tile-grain.jpg', 'score/orleans/img/tile-wine.jpg', 'score/orleans/img/tile-wool.jpg',
  'score/orleans/img/wine.png', 'score/orleans/img/wool.png', 'score/white-castle-duel/',
  'score/white-castle-duel/img/coin.png', 'score/white-castle-duel/img/seal.png', 'score/white-castle-duel/img/food.png', 'score/white-castle-duel/img/iron.png',
  'score/white-castle-duel/img/pearl.png', 'score/white-castle-duel/img/flag.png', 'score/white-castle-duel/img/katana.png', 'score/white-castle-duel/img/kabuto.png',
  'score/white-castle-duel/img/origami-blue.png', 'score/white-castle-duel/img/origami-white.png', 'score/white-castle-duel/img/icon-192.png', 'score/white-castle-duel/img/fan.png',
  'score/star-realms/app.js',
  'score/star-realms/', 'score/star-realms/style.css', 'score/star-realms/icons/apple-touch-icon.png',
  'score/star-realms/icons/icon-192.png', 'rules/7-wonders-duel.html', 'rules/castles-of-burgundy.html',
  'rules/cascadia.html', 'rules/dune-imperium-uprising.html', 'rules/img/dune/cover.jpg',
  'rules/assets/style.css', 'rules/assets/app.js', 'rules/img/7wd/cover.jpg',
  'rules/img/cob/thumb.jpg', 'rules/img/csc/cover.jpg'
];

self.addEventListener('install', e => {
  e.waitUntil((async () => {
    const cache = await caches.open(APP);
    /* по одному: если один файл вдруг не найдётся, установка не должна падать целиком */
    await Promise.allSettled(ASSETS.map(u => cache.add(new Request(u, {cache: 'reload'}))));
    self.skipWaiting();
  })());
});

self.addEventListener('activate', e => {
  e.waitUntil((async () => {
    /* трогаем только свои старые версии: на этом же домене могут жить кэши других сайтов */
    await Promise.all((await caches.keys()).map(k => k.startsWith('bg-app-') && k !== APP ? caches.delete(k) : null));
    await self.clients.claim();
  })());
});

const putCopy = (cacheName, req, res) => {
  if (res && (res.ok || res.type === 'opaque')) {
    const copy = res.clone();
    caches.open(cacheName).then(c => c.put(req, copy)).catch(() => {});
  }
  return res;
};
const cached = req => caches.match(req, {ignoreSearch: true});

self.addEventListener('fetch', e => {
  const req = e.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);

  if (req.mode === 'navigate') {
    e.respondWith((async () => {
      try { return putCopy(APP, req, await fetch(req)); }
      catch (err) {
        return (await cached(req)) || (await caches.match('./'))
          || new Response('Нет сети и нет сохранённой копии.', {status: 503, headers: {'Content-Type': 'text/plain; charset=utf-8'}});
      }
    })());
    return;
  }

  if (url.origin === location.origin) {
    const media = url.pathname.includes('/rules/img/');
    e.respondWith((async () => {
      /* точное совпадение вместе с «?v=…»: новая версия стиля не должна подменяться старой из кэша */
      const hit = await caches.match(req);
      if (hit) {
        if (!media) e.waitUntil(fetch(req).then(r => putCopy(APP, req, r)).catch(() => {}));
        return hit;
      }
      try { return putCopy(media ? MEDIA : APP, req, await fetch(req)); }
      catch (err) { return (await cached(req)) || new Response('', {status: 504}); }
    })());
    return;
  }

  if (/fonts\.(googleapis|gstatic)\.com$/.test(url.hostname)) {
    e.respondWith((async () => {
      const hit = await caches.match(req);
      if (hit) return hit;
      try { return putCopy(FONTS, req, await fetch(req)); }
      catch (err) { return new Response('', {status: 504}); }
    })());
  }
});
