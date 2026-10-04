(() => {
  const $ = (s, r = document) => r.querySelector(s);
  const $$ = (s, r = document) => [...r.querySelectorAll(s)];
  const main = $('main[data-game]');
  if (!main) return;

  /* ---------- Высота шапки (для отступов) ---------- */
  const header = $('.top');
  const setHeaderH = () => document.documentElement.style.setProperty('--header-h', header.offsetHeight + 'px');
  setHeaderH();
  window.addEventListener('resize', setHeaderH);

  /* ---------- Оглавление ---------- */
  const tocList = $('#toc-list');
  const tocLinks = new Map();
  $$('section[id]', main).forEach(sec => {
    const h = sec.querySelector(':scope > h2, :scope > h3');
    if (!h || sec.hasAttribute('data-notoc')) return;
    const li = document.createElement('li');
    if (h.tagName === 'H3') li.className = 'sub';
    const a = document.createElement('a');
    a.href = '#' + sec.id;
    a.textContent = h.childNodes[0] ? [...h.childNodes].filter(n => !(n.classList && n.classList.contains('src'))).map(n => n.textContent).join('').trim() : h.textContent;
    li.append(a);
    tocList.append(li);
    tocLinks.set(sec, a);
  });
  const setToc = open => document.body.classList.toggle('toc-open', open);
  $('#toc-btn').addEventListener('click', () => setToc(!document.body.classList.contains('toc-open')));
  $('#scrim').addEventListener('click', () => setToc(false));
  $('.toc-close')?.addEventListener('click', () => setToc(false));
  tocList.addEventListener('click', e => { if (e.target.closest('a')) setToc(false); });

  // Подсветка текущего раздела в оглавлении
  if ('IntersectionObserver' in window) {
    let current = null;
    const io = new IntersectionObserver(entries => {
      entries.forEach(en => {
        if (en.isIntersecting && tocLinks.has(en.target)) {
          current?.classList.remove('active');
          current = tocLinks.get(en.target);
          current.classList.add('active');
        }
      });
    }, { rootMargin: '-20% 0px -70% 0px' });
    tocLinks.forEach((_, sec) => io.observe(sec));
  }

  /* ---------- Поиск ---------- */
  const norm = s => s.toLowerCase().replace(/ё/g, 'е');
  const ENDINGS = /(иями|ями|ами|ого|его|ому|ему|ыми|ими|ах|ях|ов|ев|ой|ей|ий|ый|ая|яя|ое|ее|ые|ие|ую|юю|ом|ем|ам|ям|ть|а|я|о|е|ы|и|у|ю|ь)$/;
  const stem = w => {
    if (w.length <= 4) return w;
    const t = w.replace(ENDINGS, '');
    return t.length >= 3 ? t : w;
  };
  const esc = s => s.replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  const headingText = h => h ? [...h.childNodes].filter(n => !(n.classList && n.classList.contains('src'))).map(n => n.textContent).join('').trim() : '';

  const HEAD = ':scope > h2, :scope > h3, :scope > h4, :scope > .sh-body > h4';
  const index = $$('section[id]', main).map(sec => {
    const h = sec.querySelector(HEAD);
    const clone = sec.cloneNode(true);
    clone.querySelectorAll('section[id], .src').forEach(n => n.remove());
    if (h) clone.querySelector(HEAD).remove();
    const text = clone.textContent.replace(/\s+/g, ' ').trim();
    const parent = sec.parentElement.closest('section[id]');
    const title = headingText(h);
    return {
      sec, title, text,
      crumb: parent ? headingText(parent.querySelector(HEAD)) : '',
      ntext: norm(text),
      ntitle: norm(title + ' ' + (sec.dataset.keys || '')),
    };
  });

  const termsOf = q => [...new Set(norm(q).split(/[^a-zа-я0-9]+/i).filter(w => w.length >= 2).map(stem))];

  function search(q) {
    const terms = termsOf(q);
    if (!terms.length) return { terms, list: [] };
    const list = [];
    for (const it of index) {
      let score = 0, ok = true;
      for (const t of terms) {
        const inTitle = it.ntitle.includes(t);
        let n = 0, p = it.ntext.indexOf(t);
        while (p !== -1 && n < 30) { n++; p = it.ntext.indexOf(t, p + t.length); }
        if (!inTitle && !n) { ok = false; break; }
        score += (inTitle ? 12 : 0) + Math.min(n, 10);
      }
      if (ok) list.push({ it, score });
    }
    list.sort((a, b) => b.score - a.score);
    return { terms, list: list.slice(0, 50) };
  }

  function ranges(s, terms) {
    const ns = norm(s), r = [];
    terms.forEach(t => {
      let p = ns.indexOf(t);
      while (p !== -1) { r.push([p, p + t.length]); p = ns.indexOf(t, p + t.length); }
    });
    return r.sort((a, b) => a[0] - b[0]);
  }

  function markHtml(s, terms) {
    let out = '', last = 0;
    for (const [a, b] of ranges(s, terms)) {
      if (a < last) continue;
      out += esc(s.slice(last, a)) + '<mark>' + esc(s.slice(a, b)) + '</mark>';
      last = b;
    }
    return out + esc(s.slice(last));
  }

  function snippet(it, terms) {
    let pos = -1;
    for (const t of terms) { pos = it.ntext.indexOf(t); if (pos !== -1) break; }
    if (pos === -1) return it.text.slice(0, 160) + (it.text.length > 160 ? '…' : '');
    const start = Math.max(0, pos - 70);
    const end = Math.min(it.text.length, pos + 130);
    return (start > 0 ? '…' : '') + it.text.slice(start, end) + (end < it.text.length ? '…' : '');
  }

  const q = $('#q'), results = $('#results'), clearBtn = $('#q-clear');
  let current = { terms: [], list: [] };
  let active = -1;

  function setActive(i) {
    const items = $$('.r', results);
    if (!items.length) { active = -1; return; }
    active = (i + items.length) % items.length;
    items.forEach((el, k) => el.classList.toggle('active', k === active));
    items[active].scrollIntoView({ block: 'nearest' });
  }

  function render() {
    const v = q.value.trim();
    clearBtn.hidden = !q.value;
    if (v.length < 2) { results.hidden = true; results.innerHTML = ''; return; }
    current = search(v);
    const { terms, list } = current;
    results.innerHTML = list.length
      ? `<div class="r-count">Найдено разделов: ${list.length}</div>` + list.map((x, i) =>
        `<a class="r" href="#${x.it.sec.id}" data-i="${i}">` +
        (x.it.crumb ? `<span class="r-crumb">${esc(x.it.crumb)}</span>` : '') +
        `<span class="r-title">${markHtml(x.it.title, terms)}</span>` +
        `<span class="r-snip">${markHtml(snippet(x.it, terms), terms)}</span></a>`).join('')
      : '<div class="r-empty">Ничего не найдено. Попробуйте другое слово или его начало (например, «торг»).</div>';
    results.hidden = false;
    results.scrollTop = 0;
    active = -1;
    if (list.length) setActive(0);
  }

  let timer;
  q.addEventListener('input', () => { clearTimeout(timer); timer = setTimeout(render, 120); });
  q.addEventListener('focus', () => { if (q.value.trim().length >= 2) render(); });
  // Стрелки ↑/↓ — выбор результата, Enter — перейти, Esc — закрыть
  q.addEventListener('keydown', e => {
    if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
      e.preventDefault();
      if (results.hidden) { clearTimeout(timer); render(); return; }
      setActive(active + (e.key === 'ArrowDown' ? 1 : -1));
    } else if (e.key === 'Enter') {
      e.preventDefault();
      clearTimeout(timer);
      if (results.hidden || !results.querySelector('.r')) render();
      const items = $$('.r', results);
      (items[active] || items[0])?.click();
    } else if (e.key === 'Escape') {
      results.hidden = true;
      q.blur();
    }
  });
  results.addEventListener('mousemove', e => {
    const a = e.target.closest('.r');
    if (!a) return;
    const i = $$('.r', results).indexOf(a);
    if (i !== active) { $$('.r', results).forEach((el, k) => el.classList.toggle('active', k === i)); active = i; }
  });
  clearBtn.addEventListener('click', () => { q.value = ''; clearHits(); render(); q.focus(); });

  function clearHits() {
    $$('mark.hit', main).forEach(m => m.replaceWith(document.createTextNode(m.textContent)));
    main.normalize();
  }

  function highlightIn(root, terms) {
    const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
    const nodes = [];
    while (walker.nextNode()) nodes.push(walker.currentNode);
    for (const node of nodes) {
      const el = node.parentElement;
      if (el.closest('section[id]') !== root || el.closest('.src, mark')) continue;
      const s = node.nodeValue, r = ranges(s, terms);
      if (!r.length) continue;
      const frag = document.createDocumentFragment();
      let last = 0;
      for (const [a, b] of r) {
        if (a < last) continue;
        frag.append(s.slice(last, a));
        const m = document.createElement('mark');
        m.className = 'hit';
        m.textContent = s.slice(a, b);
        frag.append(m);
        last = b;
      }
      frag.append(s.slice(last));
      node.replaceWith(frag);
    }
  }

  results.addEventListener('click', e => {
    const a = e.target.closest('.r');
    if (!a) return;
    e.preventDefault();
    const { it } = current.list[+a.dataset.i];
    results.hidden = true;
    q.blur();
    clearHits();
    highlightIn(it.sec, current.terms);
    history.replaceState(null, '', '#' + it.sec.id);
    const hit = $$('mark.hit', it.sec).find(m => !m.closest('[hidden]'));
    // Если найдено в заголовке — показываем начало раздела, иначе первое совпадение
    const target = hit && !hit.closest('h2, h3, h4') ? hit : it.sec;
    const align = () => {
      const r = target.getBoundingClientRect();
      const offset = target === it.sec ? header.offsetHeight + 8 : Math.round(window.innerHeight / 3);
      window.scrollTo({ top: Math.max(0, r.top + window.scrollY - offset), behavior: 'instant' });
    };
    align();
    setTimeout(align, 350); // повторно — если картинки выше успели догрузиться
  });

  document.addEventListener('click', e => {
    if (!results.hidden && !results.contains(e.target) && !e.target.closest('.search-row')) results.hidden = true;
  });
  document.addEventListener('keydown', e => {
    if (e.key === '/' && document.activeElement !== q) { e.preventDefault(); q.focus(); q.select(); }
    if (e.key === 'Escape') { setToc(false); closeLb(); }
  });

  /* ---------- Просмотр картинок ---------- */
  const lb = document.createElement('div');
  lb.id = 'lightbox';
  lb.hidden = true;
  lb.innerHTML = '<button class="lb-close" aria-label="Закрыть">✕</button><span class="lb-hint">нажмите на картинку, чтобы увеличить</span><span class="lb-count"></span>' +
    '<button class="lb-nav lb-prev" aria-label="Предыдущая">‹</button><button class="lb-nav lb-next" aria-label="Следующая">›</button>' +
    '<div class="lb-scroll"><img alt=""></div><div class="lb-cap"></div>';
  document.body.append(lb);
  const lbImg = lb.querySelector('img');
  let gallery = null, gIndex = 0;

  function showLb(src, cap) {
    lbImg.src = src;
    lb.querySelector('.lb-cap').textContent = cap || '';
    lb.classList.remove('zoomed');
    const multi = !!(gallery && gallery.length > 1);
    lb.classList.toggle('has-gallery', multi);
    lb.querySelector('.lb-count').textContent = multi ? `${gIndex + 1} / ${gallery.length}` : '';
    lb.querySelector('.lb-scroll').scrollTo(0, 0);
    if (multi) [1, -1].forEach(d => { new Image().src = gallery[(gIndex + d + gallery.length) % gallery.length].src; });
  }
  function openLb(src, cap, items, index) {
    gallery = items || null;
    gIndex = index || 0;
    showLb(src, cap);
    lb.hidden = false;
    document.body.classList.add('lb-open');
    history.pushState({ lb: 1 }, '');
  }
  function stepLb(d) {
    if (!gallery || gallery.length < 2) return;
    gIndex = (gIndex + d + gallery.length) % gallery.length;
    const it = gallery[gIndex];
    showLb(it.src, it.cap);
    syncCarousel(it.el);
  }
  function closeLb(fromPop) {
    if (lb.hidden) return;
    lb.hidden = true;
    document.body.classList.remove('lb-open');
    lbImg.removeAttribute('src');
    if (!fromPop && history.state && history.state.lb) history.back();
  }
  window.addEventListener('popstate', () => closeLb(true));
  lbImg.addEventListener('click', e => { e.stopPropagation(); lb.classList.toggle('zoomed'); });
  lb.querySelector('.lb-prev').addEventListener('click', e => { e.stopPropagation(); stepLb(-1); });
  lb.querySelector('.lb-next').addEventListener('click', e => { e.stopPropagation(); stepLb(1); });
  lb.addEventListener('click', e => {
    if (e.target.closest('.lb-nav, .lb-count')) return;
    if (e.target.closest('.lb-close') || !e.target.closest('img')) closeLb();
  });
  document.addEventListener('keydown', e => {
    if (lb.hidden) return;
    if (e.key === 'ArrowRight') stepLb(1);
    if (e.key === 'ArrowLeft') stepLb(-1);
  });

  // Свайп влево/вправо в просмотре — следующая/предыдущая страница
  let touch0 = null;
  lb.addEventListener('touchstart', e => {
    const zoomedByPinch = window.visualViewport && window.visualViewport.scale > 1.05;
    touch0 = e.touches.length === 1 && !lb.classList.contains('zoomed') && !zoomedByPinch
      ? { x: e.touches[0].clientX, y: e.touches[0].clientY } : null;
  }, { passive: true });
  lb.addEventListener('touchend', e => {
    if (!touch0 || !gallery) return;
    const t = e.changedTouches[0], dx = t.clientX - touch0.x, dy = t.clientY - touch0.y;
    touch0 = null;
    if (Math.abs(dx) > 50 && Math.abs(dx) > Math.abs(dy) * 1.5) stepLb(dx < 0 ? 1 : -1);
  }, { passive: true });

  const capOf = el => el.dataset.caption || el.closest('figure')?.querySelector('figcaption')?.textContent || el.alt || '';
  document.addEventListener('click', e => {
    const t = e.target.closest('main figure img, [data-zoom]');
    if (!t) return;
    e.preventDefault();
    const group = t.closest('[data-gallery]');
    if (group) {
      const els = $$('[data-zoom]', group);
      const items = els.map(el => ({ src: el.dataset.zoom, cap: capOf(el), el }));
      const i = Math.max(0, els.indexOf(t));
      openLb(items[i].src, items[i].cap, items, i);
    } else {
      openLb(t.dataset.zoom || t.currentSrc || t.src, capOf(t));
    }
  });

  /* ---------- Всплывающие карточки (щиты) ---------- */
  const cards = $$('.sh-card', main);
  if (cards.length) {
    const pop = document.createElement('div');
    pop.id = 'popup';
    pop.hidden = true;
    pop.setAttribute('role', 'dialog');
    pop.setAttribute('aria-modal', 'true');
    pop.innerHTML = '<div class="pop-panel"><button class="pop-close" aria-label="Закрыть">✕</button><div class="pop-body"></div>' +
      '<div class="pop-nav"><button class="icon-btn pop-prev" aria-label="Предыдущий">‹ Назад</button><span class="pop-count"></span>' +
      '<button class="icon-btn pop-next" aria-label="Следующий">Дальше ›</button></div></div>';
    document.body.append(pop);
    const body = $('.pop-body', pop);
    let ci = 0;
    const renderPop = i => {
      ci = (i + cards.length) % cards.length;
      const c = cards[ci], img = $('.sh-img', c);
      body.innerHTML = `<div class="pop-head"><img class="pop-img" src="${img.getAttribute('src')}" alt="${esc(img.alt)}">` +
        `<span class="sh-label">${$('.sh-label', c)?.innerHTML || ''}</span><h3>${$('h4', c).innerHTML}</h3>${$('.sh-vp', c)?.outerHTML || ''}</div>` +
        `<div class="pop-text">${$('.sh-full', c).innerHTML}</div>`;
      $('.pop-count', pop).textContent = `${ci + 1} / ${cards.length}`;
      body.scrollTop = 0;
    };
    const openPop = i => {
      renderPop(i);
      pop.hidden = false;
      document.body.classList.add('pop-open');
      history.pushState({ pop: 1 }, '');
      $('.pop-close', pop).focus({ preventScroll: true });
    };
    const closePop = fromPop => {
      if (pop.hidden) return;
      pop.hidden = true;
      document.body.classList.remove('pop-open');
      cards[ci].focus({ preventScroll: true });
      if (!fromPop && history.state && history.state.pop) history.back();
    };
    cards.forEach((c, i) => {
      c.addEventListener('click', () => openPop(i));
      c.addEventListener('keydown', e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); openPop(i); } });
    });
    $('.pop-close', pop).addEventListener('click', () => closePop());
    $('.pop-prev', pop).addEventListener('click', () => renderPop(ci - 1));
    $('.pop-next', pop).addEventListener('click', () => renderPop(ci + 1));
    pop.addEventListener('click', e => { if (e.target === pop) closePop(); });
    // «Назад» на телефоне закрывает окно (если поверх не открыт просмотр страницы)
    window.addEventListener('popstate', () => { if (!(history.state && history.state.pop)) closePop(true); });
    document.addEventListener('keydown', e => {
      if (pop.hidden || !lb.hidden) return;
      if (e.key === 'Escape') closePop();
      if (e.key === 'ArrowRight') renderPop(ci + 1);
      if (e.key === 'ArrowLeft') renderPop(ci - 1);
    }, { capture: true });
    // Свайп влево/вправо — соседний щит
    let p0 = null;
    pop.addEventListener('touchstart', e => { p0 = e.touches.length === 1 ? { x: e.touches[0].clientX, y: e.touches[0].clientY } : null; }, { passive: true });
    pop.addEventListener('touchend', e => {
      if (!p0) return;
      const t = e.changedTouches[0], dx = t.clientX - p0.x, dy = t.clientY - p0.y;
      p0 = null;
      if (Math.abs(dx) > 60 && Math.abs(dx) > Math.abs(dy) * 1.5) renderPop(ci + (dx < 0 ? 1 : -1));
    }, { passive: true });
  }

  /* ---------- Лента страниц буклета (свайп влево/вправо) ---------- */
  function syncCarousel(el) {
    const track = el && el.closest('.pages-carousel');
    if (!track) return;
    track.scrollTo({ left: el.offsetLeft - (track.clientWidth - el.offsetWidth) / 2, behavior: 'instant' });
  }
  $$('.pages-wrap').forEach(wrap => {
    const track = $('.pages-carousel', wrap), items = $$('.pg', track), count = $('.pc-count', wrap);
    const current = () => {
      const c = track.scrollLeft + track.clientWidth / 2;
      let best = 0, bd = Infinity;
      items.forEach((it, i) => { const d = Math.abs(it.offsetLeft + it.offsetWidth / 2 - c); if (d < bd) { bd = d; best = i; } });
      return best;
    };
    const update = () => { count.textContent = `${current() + 1} / ${items.length}`; };
    const go = d => {
      const it = items[Math.max(0, Math.min(items.length - 1, current() + d))];
      track.scrollTo({ left: it.offsetLeft - (track.clientWidth - it.offsetWidth) / 2, behavior: 'smooth' });
    };
    $('.pc-prev', wrap).addEventListener('click', () => go(-1));
    $('.pc-next', wrap).addEventListener('click', () => go(1));
    track.addEventListener('scroll', () => requestAnimationFrame(update), { passive: true });
    update();
  });

  /* ---------- Ползунок быстрой прокрутки (сенсорные экраны) ---------- */
  if (window.matchMedia('(pointer: coarse)').matches) {
    const fs = document.createElement('div');
    fs.id = 'fastscroll';
    fs.innerHTML = '<div class="fs-thumb" role="scrollbar" aria-label="Быстрая прокрутка"><span></span></div><div class="fs-label" hidden></div>';
    document.body.append(fs);
    const thumb = $('.fs-thumb', fs), label = $('.fs-label', fs);
    let hideTimer, dragging = false, grab = 0;
    const metrics = () => {
      const top = header.offsetHeight + 8;
      return { top, h: window.innerHeight - top - 84, th: thumb.offsetHeight, max: document.documentElement.scrollHeight - window.innerHeight };
    };
    const place = () => {
      const m = metrics();
      if (m.max <= 0) return;
      thumb.style.transform = `translateY(${m.top + (window.scrollY / m.max) * (m.h - m.th)}px)`;
    };
    const show = () => {
      fs.classList.add('show');
      clearTimeout(hideTimer);
      if (!dragging) hideTimer = setTimeout(() => fs.classList.remove('show'), 1600);
    };
    const sectionAt = y => {
      let t = '';
      $$('main > section[id]').forEach(s => { if (s.offsetTop <= y) t = headingText(s.querySelector(':scope > h2')) || t; });
      return t;
    };
    window.addEventListener('scroll', () => { place(); if (!document.body.classList.contains('lb-open')) show(); }, { passive: true });
    window.addEventListener('resize', place);
    thumb.addEventListener('pointerdown', e => {
      dragging = true;
      try { thumb.setPointerCapture(e.pointerId); } catch (_) { /* захват не обязателен */ }
      grab = e.clientY - thumb.getBoundingClientRect().top;
      fs.classList.add('show', 'drag');
      clearTimeout(hideTimer);
      e.preventDefault();
    });
    thumb.addEventListener('pointermove', e => {
      if (!dragging) return;
      const m = metrics();
      const y = Math.max(0, Math.min(m.h - m.th, e.clientY - grab - m.top));
      window.scrollTo({ top: (y / (m.h - m.th)) * m.max, behavior: 'instant' });
      const title = sectionAt(window.scrollY + m.top + 40);
      label.hidden = !title;
      label.textContent = title;
      label.style.top = (m.top + y + m.th / 2) + 'px';
    });
    const end = () => { if (!dragging) return; dragging = false; fs.classList.remove('drag'); label.hidden = true; show(); };
    thumb.addEventListener('pointerup', end);
    thumb.addEventListener('pointercancel', end);
    place();
  }

  /* ---------- Переход по ссылке с #якорем ---------- */
  window.addEventListener('load', () => {
    const el = location.hash && document.getElementById(decodeURIComponent(location.hash.slice(1)));
    if (el && !(history.state && history.state.lb)) {
      window.scrollTo({ top: el.getBoundingClientRect().top + window.scrollY - header.offsetHeight - 8, behavior: 'instant' });
    }
  });

  /* ---------- Наверх ---------- */
  const top = document.createElement('button');
  top.id = 'to-top';
  top.setAttribute('aria-label', 'Наверх');
  top.textContent = '↑';
  top.hidden = true;
  top.addEventListener('click', () => window.scrollTo({ top: 0 }));
  document.body.append(top);
  window.addEventListener('scroll', () => { top.hidden = window.scrollY < 900; }, { passive: true });
})();
