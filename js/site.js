(function () {
  "use strict";
  var $ = function (s, r) { return (r || document).querySelector(s); };
  var $$ = function (s, r) { return Array.prototype.slice.call((r || document).querySelectorAll(s)); };
  var root = document.documentElement;
  var reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  var fine = window.matchMedia("(hover: hover) and (pointer: fine)").matches;

  /* absolute failsafe: no [data-r] stays hidden */
  setTimeout(function () { $$("[data-r]").forEach(function (el) { el.classList.add("in"); }); }, 3000);

  /* ---------- the spotlight title (signature) ---------- */
  var title = $("#title"), spot = $("#spot"), letters = [];
  if (title) {
    var text = title.getAttribute("aria-label") || title.textContent;
    title.setAttribute("aria-label", text.trim());
    title.textContent = "";
    text.split(" ").forEach(function (word, wi, arr) {
      var w = document.createElement("span");
      w.className = "word"; w.setAttribute("aria-hidden", "true");
      word.split("").forEach(function (ch) {
        var s = document.createElement("span");
        s.className = "ltr"; s.textContent = ch; s.style.setProperty("--i", 0);
        s.style.animationDelay = (0.22 + letters.length * 0.04).toFixed(2) + "s";
        w.appendChild(s); letters.push(s);
      });
      title.appendChild(w);
      if (wi < arr.length - 1) title.appendChild(document.createTextNode(" "));
    });
  }

  var lx = window.innerWidth * 0.5, ly = window.innerHeight * 0.42;   // light position
  var tx = lx, ty = ly, target = null, lastMove = -9999, t0 = 0;

  function place() { if (spot) { root.style.setProperty("--mx", lx + "px"); root.style.setProperty("--my", ly + "px"); } }

  function litFor(cx, cy) {
    var R = Math.max(260, window.innerWidth * 0.27);
    for (var i = 0; i < letters.length; i++) {
      var r = letters[i].getBoundingClientRect();
      var dx = (r.left + r.width / 2) - cx, dy = (r.top + r.height / 2) - cy;
      var d = Math.sqrt(dx * dx + dy * dy);
      var t = Math.max(0, 1 - d / R); t = t * t * (3 - 2 * t);      // smoothstep falloff
      letters[i].style.setProperty("--i", t.toFixed(3));
    }
  }

  var heroVisible = true, hero = $(".hero");
  if (hero && "IntersectionObserver" in window) {
    new IntersectionObserver(function (e) { heroVisible = e[0].isIntersecting; },
      { threshold: 0 }).observe(hero);
  }

  if (reduce || (!fine && !("ontouchstart" in window))) {
    // static: a centred light, letters at a pleasant lit mid-state
    place();
    letters.forEach(function (s, i) { s.style.setProperty("--i", 0.5); });
    if (letters.length) litFor(lx, ly);
  } else {
    if (fine) {
      window.addEventListener("pointermove", function (e) {
        target = { x: e.clientX, y: e.clientY }; lastMove = performance.now();
      }, { passive: true });
    }
    var fromTouch = function (e) {
      if (!e.touches || !e.touches[0]) return;
      target = { x: e.touches[0].clientX, y: e.touches[0].clientY }; lastMove = performance.now();
    };
    window.addEventListener("touchstart", fromTouch, { passive: true });
    window.addEventListener("touchmove", fromTouch, { passive: true });
    var loop = function (now) {
      if (!t0) t0 = now;
      var idle = now - lastMove > 1400;
      if (target && !idle) { tx = target.x; ty = target.y; }
      else {                                   // drift on a slow path (mobile / idle)
        var e = (now - t0) / 1000;
        tx = window.innerWidth * (0.5 + 0.28 * Math.cos(e * 0.55));
        ty = window.innerHeight * (0.42 + 0.16 * Math.sin(e * 0.8));
      }
      lx += (tx - lx) * 0.12; ly += (ty - ly) * 0.12;
      place();
      if (heroVisible && letters.length) litFor(lx, ly);
      requestAnimationFrame(loop);
    };
    // let the page-load letter choreography land first, then the light takes over
    setTimeout(function () { requestAnimationFrame(loop); }, letters.length ? 1000 : 0);
  }

  /* ---------- register marquee: clone for a seamless loop ---------- */
  var mq = $("#mq");
  if (mq && !reduce) {
    $$(".item", mq).forEach(function (it) {
      var c = it.cloneNode(true); c.setAttribute("aria-hidden", "true"); mq.appendChild(c);
    });
  }

  /* ---------- the price grin ---------- */
  var price = $("#price"), buy = $("#buy"), reveal = price && $(".reveal-copy", price);
  if (buy && price && reveal) {
    buy.addEventListener("click", function () {
      price.classList.add("flipped");
      buy.parentNode.style.display = "none";
      reveal.setAttribute("tabindex", "-1");
      try { reveal.focus({ preventScroll: true }); } catch (e) { reveal.focus(); }
    });
  }

  /* ---------- quiet reveal (bulletproof) ---------- */
  var show = function (el) { el.classList.add("in"); };
  if (reduce || !("IntersectionObserver" in window)) { $$("[data-r]").forEach(show); return; }
  var io = new IntersectionObserver(function (entries, obs) {
    entries.forEach(function (en) {
      if (!en.isIntersecting) return;
      var el = en.target, sibs = $$("[data-r]", el.closest("section, .curtain, .colophon") || document);
      el.style.transitionDelay = (Math.min(Math.max(0, sibs.indexOf(el)), 5) * 0.05) + "s";
      show(el); obs.unobserve(el);
    });
  }, { rootMargin: "0px 0px -8% 0px", threshold: 0.12 });
  $$("[data-r]").forEach(function (el) { io.observe(el); });
  var passed = function () {
    $$("[data-r]").forEach(function (el) {
      if (!el.classList.contains("in") && el.getBoundingClientRect().top < window.innerHeight * 0.98) show(el);
    });
  };
  passed();
  window.addEventListener("scroll", passed, { passive: true });
  window.addEventListener("load", passed);
})();
