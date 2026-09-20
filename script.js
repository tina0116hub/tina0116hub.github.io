/* ==========================================================================
 * script.js —— 个人主页渲染脚本
 * --------------------------------------------------------------------------
 * 读取 data/content.js（由 build-data.mjs 从《网站内容.xlsx》生成）
 * 功能：中英文切换、多切页路由、卡片/段落/列表/图片渲染
 * 无任何外部依赖，可直接放在 GitHub Pages、也可双击 index.html 本地预览
 * ========================================================================== */
(function () {
  'use strict';

  var DATA = window.SITE_DATA;                 // 由 data/content.js 提供
  var LS_KEY = 'homepage-lang';
  var HOME = { zh: '首页', en: 'Home' };
  var CV = { zh: '简历', en: 'CV' };
  var TBD_RE = /^\s*[\[【（(]?\s*(待填写|待补充|待定|tbd|to be filled)\s*[\]】）)]?\s*[.。]?\s*$/i;
  /* 这些标题是「通用标记」，只显示正文、不显示标题 */
  var HIDE_TITLE = /^(education|publication|project|paper|course|studentwork|internship|skill|skilllist|certlist|languages|ittools|award|item)$/i;

  var state = { lang: 'zh', route: 'home' };
  var app = null;

  /* --------------------------------------------------------------- 工具 */
  function $(sel) { return document.querySelector(sel); }
  function norm(v) {
    if (v === undefined || v === null) return '';
    return String(v).replace(/\u00a0/g, ' ').replace(/\r/g, '').trim();
  }
  function isTbd(s) { var v = norm(s); return v === '' || TBD_RE.test(v); }
  function el(tag, cls, text) {
    var n = document.createElement(tag);
    if (cls) n.className = cls;
    if (text !== undefined && text !== null && text !== '') n.textContent = text;
    return n;
  }
  function clear(node) { while (node.firstChild) node.removeChild(node.firstChild); }
  function val(pair, lang) {
    if (!pair) return '';
    var v = lang === 'en' ? norm(pair.en) : norm(pair.zh);
    return v || norm(pair.zh) || norm(pair.en);
  }
  function setting(key, fallback) {
    var s = DATA.settings[key];
    var v = s ? (state.lang === 'en' ? (norm(s.en) || norm(s.zh)) : norm(s.zh)) : '';
    return v || fallback || '';
  }
  function external(url) { return /^(https?:)?\/\//i.test(url) || /^mailto:/i.test(url); }
  function imgSrc(v) {
    var s = norm(v);
    if (!s) return '';
    if (/^(https?:)?\/\//i.test(s) || /^data:/i.test(s)) return s;
    s = s.replace(/\\/g, '/').replace(/^\.\//, '');
    if (s.indexOf('/') === -1) s = 'images/' + s;
    return encodeURI(s);
  }
  function splitList(s) {
    return String(s).replace(/\s*\n\s*/g, '；').split(/[;；]/)
      .map(function (x) { return x.trim(); }).filter(Boolean);
  }
  function pickYear(s) {
    var m = String(s).match(/((?:19|20)\d{2})\s*(?:[.\-\/年]\s*((?:19|20)\d{2}))?/);
    return m ? (m[2] ? m[1] + '–' + m[2] : m[1]) : '';
  }

  /* --------------------------------------------------------------- 导航 */
  function currentRoute() {
    var h = (location.hash || '').replace(/^#\/?/, '');
    return h ? decodeURIComponent(h) : 'home';
  }
  function findPage(route) {
    for (var i = 0; i < DATA.pages.length; i++) if (DATA.pages[i].id === route) return DATA.pages[i];
    return null;
  }
  function pageLabel(p) { return state.lang === 'en' ? (norm(p.labelEn) || p.labelZh) : p.labelZh; }

  function buildNav() {
    var nav = $('#navLinks');
    if (!nav) return;
    clear(nav);
    var route = currentRoute();
    var mk = function (href, label, active) {
      var a = el('a', 'nav-link', label);
      a.href = href;
      if (active) a.classList.add('active');
      nav.appendChild(a);
    };
    mk('#/', HOME[state.lang], route === 'home');
    DATA.pages.forEach(function (p) { mk('#/' + p.id, pageLabel(p), route === p.id); });
    mk('#/cv', CV[state.lang], route === 'cv');
  }

  /* --------------------------------------------------------------- 渲染 */
  function makeCard(item, opts) {
    opts = opts || {};
    var card = el('article', 'card reveal');
    var title = val({ zh: item.titleZh, en: item.titleEn }, state.lang);

    if (item.image) {
      var fig = el('figure', 'card-media');
      var im = el('img');
      im.src = imgSrc(item.image);
      im.alt = title;
      im.loading = 'lazy';
      im.addEventListener('error', function () { if (fig.parentNode) fig.parentNode.removeChild(fig); });
      fig.appendChild(im);
      card.appendChild(fig);
    }
    if (!opts.hideTitle) {
      if (isTbd(title)) card.appendChild(el('h3', 'card-title tbd', setting('uiTbd', '待填写')));
      else if (title && !HIDE_TITLE.test(title)) card.appendChild(el('h3', 'card-title', title));
    }

    var body = val({ zh: item.bodyZh, en: item.bodyEn }, state.lang);
    var wrap = el('div', 'card-body');
    if (isTbd(body)) {
      wrap.appendChild(el('p', 'tbd', setting('uiTbd', '待填写')));
    } else {
      String(body).split(/\n+/).forEach(function (line) { wrap.appendChild(el('p', null, line)); });
    }
    card.appendChild(wrap);

    if (item.link) {
      card.classList.add('has-link');
      card.setAttribute('role', 'link');
      card.setAttribute('tabindex', '0');
      card.dataset.link = item.link;
      var go = function () {
        if (external(item.link)) window.open(item.link, '_blank', 'noopener');
        else location.href = item.link;
      };
      card.addEventListener('click', function (e) { if (!e.target.closest('a')) go(); });
      card.addEventListener('keydown', function (e) {
        if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); go(); }
      });
    }
    return card;
  }

  function renderItems(container, items, opts) {
    opts = opts || {};
    var i = 0;
    while (i < items.length) {
      var it = items[i], type = norm(it.type);

      if (/卡片|card/i.test(type)) {
        var grid = el('div', 'card-grid');
        while (i < items.length && /卡片|card/i.test(norm(items[i].type))) {
          grid.appendChild(makeCard(items[i], opts));
          i++;
        }
        container.appendChild(grid);
        continue;
      }
      if (/小标题|标题|heading|subtitle/i.test(type)) {
        var t = val({ zh: it.titleZh, en: it.titleEn }, state.lang);
        if (t && !isTbd(t)) container.appendChild(el('h2', 'section-title reveal', t));
        i++; continue;
      }
      if (/列表|list/i.test(type)) {
        var arr = splitList(val({ zh: it.bodyZh, en: it.bodyEn }, state.lang));
        if (arr.length) {
          var ul = el('ul', 'ulist reveal');
          arr.forEach(function (x) { ul.appendChild(el('li', null, x)); });
          container.appendChild(ul);
        }
        i++; continue;
      }
      if (/图片|image|photo|figure/i.test(type)) {
        if (it.image) {
          var f = el('figure', 'figure reveal');
          var im2 = el('img');
          im2.src = imgSrc(it.image);
          im2.alt = val({ zh: it.bodyZh, en: it.bodyEn }, state.lang);
          im2.loading = 'lazy';
          im2.addEventListener('error', function () { if (f.parentNode) f.parentNode.removeChild(f); });
          f.appendChild(im2);
          var cap = val({ zh: it.bodyZh, en: it.bodyEn }, state.lang);
          if (cap && !isTbd(cap)) f.appendChild(el('figcaption', null, cap));
          container.appendChild(f);
        }
        i++; continue;
      }
      if (/分割线|divider|hr/i.test(type)) { container.appendChild(el('hr', 'divider')); i++; continue; }

      var body = val({ zh: it.bodyZh, en: it.bodyEn }, state.lang);
      var title = val({ zh: it.titleZh, en: it.titleEn }, state.lang);
      if (body || title) {
        if (title && !HIDE_TITLE.test(title) && !opts.hideTitle) {
          container.appendChild(el('h3', 'section-title reveal', title));
        }
        if (body) {
          if (isTbd(body)) container.appendChild(el('p', 'para tbd reveal', setting('uiTbd', '待填写')));
          else container.appendChild(el('p', 'para reveal', body));
        }
      }
      i++;
    }
  }

  function renderHome() {
    var wrap = el('div', 'page');
    var items = DATA.home || [];
    var info = {};
    items.forEach(function (it) {
      var k = norm(it.titleZh);
      if (k === '姓名') info.name = it;
      else if (k === '学校学院' || k === '学校') info.school = it;
      else if (k === '职称') info.title = it;
    });

    var heroTitle = setting('heroTitle') || val({ zh: info.name && info.name.bodyZh, en: info.name && info.name.bodyEn }, state.lang);
    var heroSub = setting('heroSubtitle') || val({ zh: info.school && info.school.bodyZh, en: info.school && info.school.bodyEn }, state.lang);
    var job = val({ zh: info.title && info.title.bodyZh, en: info.title && info.title.bodyEn }, state.lang);
    var photo = setting('heroImage') || (info.name && info.name.image) || '';

    if (heroTitle || heroSub) {
      var hero = el('section', 'hero');
      var inner = el('div', 'hero-inner');
      var box = el('div', 'hero-text');
      if (heroTitle) box.appendChild(el('h1', null, heroTitle));
      if (heroSub) box.appendChild(el('p', 'hero-sub', heroSub));

      var meta = el('div', 'hero-meta');
      var schoolTxt = val({ zh: info.school && info.school.bodyZh, en: info.school && info.school.bodyEn }, state.lang);
      var jobTxt = val({ zh: info.title && info.title.bodyZh, en: info.title && info.title.bodyEn }, state.lang);
      if (schoolTxt) meta.appendChild(el('span', null, '🏫 ' + schoolTxt));
      if (jobTxt) meta.appendChild(el('span', null, '🎓 ' + jobTxt));
      if (meta.childNodes.length) box.appendChild(meta);

      var btnText = setting('buttonText');
      if (btnText) {
        var btnRow = items.filter(function (x) { return norm(x.titleZh) === '按钮文字'; })[0];
        var btn = el('a', 'hero-btn', btnText);
        btn.href = (btnRow && btnRow.link) ? btnRow.link : '#/';
        box.appendChild(btn);
      }
      inner.appendChild(box);

      if (photo) {
        var ph = el('div', 'hero-photo');
        var pim = el('img');
        pim.src = imgSrc(photo);
        pim.alt = heroTitle;
        pim.addEventListener('error', function () { if (ph.parentNode) ph.parentNode.removeChild(ph); });
        ph.appendChild(pim);
        inner.appendChild(ph);
      }
      hero.appendChild(inner);
      wrap.appendChild(hero);
    }

    var skip = { '姓名': 1, '姓名的英文': 1, '学校学院': 1, '学校': 1, '职称': 1 };
    var rest = items.filter(function (it) { return !skip[norm(it.titleZh)]; });
    var sec = el('section', 'section');
    renderItems(sec, rest, { hideTitle: true });
    wrap.appendChild(sec);
    return wrap;
  }

  function renderPage(page) {
    var wrap = el('div', 'page');
    wrap.appendChild(el('h1', 'page-title', pageLabel(page)));
    var sec = el('section', 'section');
    renderItems(sec, page.items, {});
    wrap.appendChild(sec);
    return wrap;
  }

  function renderCv() {
    var wrap = el('div', 'page');
    wrap.appendChild(el('h1', 'page-title', CV[state.lang]));

    var info = {};
    (DATA.home || []).forEach(function (it) {
      var k = norm(it.titleZh);
      if (k === '姓名') info.name = it;
      else if (k === '学校学院' || k === '学校') info.school = it;
      else if (k === '职称') info.title = it;
    });

    var head = el('section', 'card');
    head.appendChild(el('h2', 'card-title', setting('heroTitle')));
    var line = [];
    var job = val({ zh: info.title && info.title.bodyZh, en: info.title && info.title.bodyEn }, state.lang);
    var school = val({ zh: info.school && info.school.bodyZh, en: info.school && info.school.bodyEn }, state.lang);
    if (job) line.push(job);
    if (school) line.push(school);
    if (line.length) head.appendChild(el('p', 'card-body', line.join(' · ')));
    var btn = el('button', null, state.lang === 'en' ? '🖨 Print / Save as PDF' : '🖨 打印 / 另存为 PDF');
    btn.type = 'button';
    btn.style.cssText = 'margin-top:12px;padding:8px 18px;border-radius:999px;border:1px solid var(--line);background:var(--accent);color:#fff;font:inherit;font-size:.9rem;cursor:pointer';
    btn.addEventListener('click', function () { window.print(); });
    head.appendChild(btn);
    wrap.appendChild(head);

    DATA.pages.forEach(function (p) {
      var sec = el('section', 'cv-block');
      sec.appendChild(el('h2', 'section-title', pageLabel(p)));
      p.items.forEach(function (it) {
        if (norm(it.type) === '设置') return;
        var body = val({ zh: it.bodyZh, en: it.bodyEn }, state.lang);
        var title = val({ zh: it.titleZh, en: it.titleEn }, state.lang);
        if (!body && !title) return;
        var row = el('div', 'cv-row');
        row.appendChild(el('div', 'cv-year', pickYear(body || title)));
        var content = el('div', 'cv-content');
        if (title && !isTbd(title) && !HIDE_TITLE.test(title)) content.appendChild(el('strong', null, title));
        var list = /列表|list/i.test(norm(it.type)) ? splitList(body) : [body];
        list.forEach(function (x) {
          if (!x) return;
          var p2 = el('p');
          p2.style.margin = '0 0 .3em';
          if (isTbd(x)) { p2.className = 'tbd'; p2.textContent = setting('uiTbd', '待填写'); }
          else p2.textContent = x;
          content.appendChild(p2);
        });
        row.appendChild(content);
        sec.appendChild(row);
      });
      wrap.appendChild(sec);
    });
    return wrap;
  }

  /* --------------------------------------------------------------- 主流程 */
  var io = null;
  function observe() {
    var nodes = document.querySelectorAll('.reveal');
    if (!('IntersectionObserver' in window)) {
      Array.prototype.forEach.call(nodes, function (n) { n.classList.add('in'); });
      return;
    }
    if (!io) {
      io = new IntersectionObserver(function (es) {
        es.forEach(function (e) { if (e.isIntersecting) { e.target.classList.add('in'); io.unobserve(e.target); } });
      }, { rootMargin: '0px 0px -40px 0px', threshold: 0.05 });
    }
    Array.prototype.forEach.call(nodes, function (n) { io.observe(n); });
  }

  function render() {
    if (!app) return;
    document.documentElement.lang = state.lang === 'en' ? 'en' : 'zh-CN';
    var title = setting('siteTitle', setting('heroTitle', 'Homepage'));
    document.title = title;
    var brand = $('#brand');
    if (brand) brand.textContent = title;
    var foot = $('#footerText');
    if (foot) foot.textContent = setting('footer');
    var fnote = $('#footerNote');
    if (fnote) fnote.textContent = setting('uiFooterNote');

    var route = currentRoute();
    clear(app);
    var page = findPage(route);
    app.appendChild(route === 'cv' ? renderCv() : (page ? renderPage(page) : renderHome()));
    buildNav();
    observe();

    var toTop = $('#toTop');
    if (toTop) toTop.title = setting('uiBackTop', '回到顶部');
  }

  function applyLang(lang, remember) {
    state.lang = lang === 'en' ? 'en' : 'zh';
    if (remember) { try { localStorage.setItem(LS_KEY, state.lang); } catch (e) {} }
    Array.prototype.forEach.call(document.querySelectorAll('.lang-btn'), function (b) {
      b.classList.toggle('active', b.getAttribute('data-lang') === state.lang);
    });
    render();
  }

  function showError(detail) {
    clear(app);
    var box = el('div', 'state-box error');
    box.appendChild(el('p', 'state-title', state.lang === 'en' ? 'Content failed to load' : '内容加载失败'));
    if (detail) box.appendChild(el('p', null, detail));
    var hint = el('div', 'state-hint');
    var lines = state.lang === 'en'
      ? ['<code>data/content.js</code> was not found or is empty.',
         'Run <code>node build-data.mjs</code> in the project folder to regenerate it from the spreadsheet, then refresh.']
      : ['没有找到 <code>data/content.js</code>，或者它是空的。',
         '请在项目文件夹执行 <code>node build-data.mjs</code>，它会根据《网站内容.xlsx》重新生成数据文件，然后刷新页面。'];
    lines.forEach(function (l) { var p = el('p'); p.innerHTML = l; hint.appendChild(p); });
    box.appendChild(hint);
    app.appendChild(box);
  }

  function boot() {
    app = $('#app');
    if (!app) return;

    var urlLang = new URLSearchParams(location.search).get('lang');
    if (urlLang) state.lang = /^en/i.test(urlLang) ? 'en' : 'zh';
    else {
      var saved = null;
      try { saved = localStorage.getItem(LS_KEY); } catch (e) {}
      if (saved === 'en' || saved === 'zh') state.lang = saved;
      else if (/^en/i.test(navigator.language || '')) state.lang = 'en';
    }

    /* 语言按钮 */
    Array.prototype.forEach.call(document.querySelectorAll('.lang-btn'), function (b) {
      b.classList.toggle('active', b.getAttribute('data-lang') === state.lang);
      b.addEventListener('click', function () { applyLang(b.getAttribute('data-lang'), true); closeNav(); });
    });

    /* 手机菜单 */
    var toggle = $('#navToggle');
    if (toggle) {
      toggle.addEventListener('click', function () {
        var nav = $('#navLinks');
        var open = nav.classList.toggle('open');
        toggle.setAttribute('aria-expanded', open ? 'true' : 'false');
        document.body.classList.toggle('nav-open', open);
      });
    }
    var nav = $('#navLinks');
    if (nav) nav.addEventListener('click', function (e) { if (e.target.tagName === 'A') closeNav(); });

    /* 回到顶部 + 进度条 */
    var toTop = $('#toTop');
    if (toTop) toTop.addEventListener('click', function () { window.scrollTo({ top: 0, behavior: 'smooth' }); });
    window.addEventListener('scroll', function () {
      var d = document.documentElement;
      var pct = d.scrollHeight > d.clientHeight ? (d.scrollTop / (d.scrollHeight - d.clientHeight)) * 100 : 0;
      var bar = $('#navProgress');
      if (bar) bar.style.width = pct + '%';
      if (toTop) toTop.classList.toggle('show', d.scrollTop > 320);
    }, { passive: true });

    /* 路由 */
    window.addEventListener('hashchange', function () {
      render();
      window.scrollTo({ top: 0, behavior: 'smooth' });
    });

    if (!DATA || !DATA.pages) { showError(); return; }
    applyLang(state.lang, false);
  }

  function closeNav() {
    var nav = $('#navLinks'), toggle = $('#navToggle');
    if (nav) nav.classList.remove('open');
    if (toggle) toggle.setAttribute('aria-expanded', 'false');
    document.body.classList.remove('nav-open');
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot);
  else boot();
})();
