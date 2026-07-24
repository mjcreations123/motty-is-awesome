/* Page controller.
 *
 * Everything here works with no WebGL, no three.js and no network: the acts are real
 * sections with real copy, the toggles are real controls, and the world is an enhancement
 * that gets driven from the same scroll position the document already has.
 */
(function () {
  "use strict";

  var doc = document, root = doc.documentElement, win = window;
  var $ = function (s, r) { return (r || doc).querySelector(s); };
  var $$ = function (s, r) { return Array.prototype.slice.call((r || doc).querySelectorAll(s)); };
  var reduce = win.matchMedia("(prefers-reduced-motion: reduce)").matches;
  var clamp = function (v, a, b) { return v < a ? a : v > b ? b : v; };

  var acts = $$(".act");
  var hudSect = $("#hud-sect"), hudName = $("#hud-name"), hudCount = $("#hud-count");
  var hudState = $("#hud-state"), hudTotal = $("#hud-total"), railWrap = $("#pips");
  var registry = $("#registry-rows"), canvas = $("#world");

  var tx = $("#t-x"), ty = $("#t-y"), tz = $("#t-z"), tLens = $("#t-lens");
  var tLensLabel = $("#t-lensLabel"), tAct = $("#t-act"), tP = $("#t-p"), tFill = $("#t-fill");
  var scaleFill = $("#scale-fill"), scaleLabel = $("#scale-label"), gzMode = $("#gz-mode");
  var gz = {
    lx: $("#gz-lx"), ly: $("#gz-ly"), lz: $("#gz-lz"),
    cx: $("#gz-cx"), cy: $("#gz-cy"), cz: $("#gz-cz")
  };

  /* project the three world axes onto the camera's own right/up vectors, so the gizmo
     shows where the world actually is from where the camera actually stands */
  function drawGizmo(cam) {
    if (!gz.lx) return;
    var m = cam.matrixWorld.elements;
    var rx = m[0], ry = m[1], rz = m[2];      /* camera right */
    var ux = m[4], uy = m[5], uz = m[6];      /* camera up */
    var R = 27, C = 42;
    var axes = [[1, 0, 0, "x"], [0, 1, 0, "y"], [0, 0, 1, "z"]];
    for (var i = 0; i < 3; i++) {
      var a = axes[i];
      var sx = C + (a[0] * rx + a[1] * ry + a[2] * rz) * R;
      var sy = C - (a[0] * ux + a[1] * uy + a[2] * uz) * R;
      var line = gz["l" + a[3]], dot = gz["c" + a[3]];
      line.setAttribute("x2", sx.toFixed(1));
      line.setAttribute("y2", sy.toFixed(1));
      dot.setAttribute("cx", sx.toFixed(1));
      dot.setAttribute("cy", sy.toFixed(1));
    }
  }

  var world = null;                      /* set once three.js lands, may stay null forever */
  var refused = 0;
  var current = -1;

  /* ---------- the pip rail: one per act, keeping the colour of every act visited ---------- */
  var pips = acts.map(function (a, i) {
    var el = doc.createElement("i");
    el.className = "pip";
    el.setAttribute("data-i", i);
    railWrap.appendChild(el);
    return el;
  });

  function setAccent(i) {
    var a = acts[i];
    var accent = a.getAttribute("data-accent") || "#E9EBEF";
    root.style.setProperty("--accent", accent);
    root.classList.toggle("is-paper", a.hasAttribute("data-paper"));
    root.classList.toggle("is-pale", a.hasAttribute("data-pale"));
    root.classList.toggle("is-paperworld", a.hasAttribute("data-paperworld"));
    pips.forEach(function (p, n) {
      p.classList.toggle("is-on", n <= i);
      if (n <= i) p.style.background = acts[n].getAttribute("data-accent") || "#E9EBEF";
      p.classList.toggle("is-now", n === i);
    });
  }

  function setAct(i) {
    if (i === current) return;
    current = i;
    var a = acts[i];
    if (hudSect) hudSect.textContent = ("0" + (i + 1)).slice(-2);
    if (hudName) hudName.textContent = a.getAttribute("data-name") || "";
    setAccent(i);
  }

  function bumpRefused(n) {
    refused += (n || 1);
    var s = ("00" + refused).slice(-3);
    if (hudCount) hudCount.textContent = s;
    if (hudTotal) hudTotal.textContent = s;
    root.classList.add("has-refused");
  }

  /* ---------- reveal: bulletproof, works without observers ---------- */
  function passed() {
    for (var i = 0; i < acts.length; i++) {
      var el = acts[i];
      if (!el.classList.contains("is-on") &&
          el.getBoundingClientRect().top < win.innerHeight * 0.78) el.classList.add("is-on");
    }
  }

  /* ---------- sub-beats: a long act is a scene with parts, not one caption ---------- */
  var subsByAct = acts.map(function (el) {
    var list = $$(".sub", el);
    if (!list.length) return null;
    var rail = doc.createElement("span");
    rail.className = "sub-rail";
    list.forEach(function () { rail.appendChild(doc.createElement("i")); });
    var host = $(".act__copy", el);
    if (host) host.appendChild(rail);
    return {
      list: list,
      pips: $$("i", rail),
      ranges: list.map(function (s, i) {
        var from = parseFloat(s.getAttribute("data-from"));
        var to = parseFloat(s.getAttribute("data-to"));
        if (isNaN(from)) from = i / list.length;
        if (isNaN(to)) to = (i + 1) / list.length;
        return [from, to];
      }),
      live: -1
    };
  });

  function driveSubs(idx, t) {
    var S = subsByAct[idx];
    if (!S) return;
    var want = S.ranges.length - 1;
    for (var i = 0; i < S.ranges.length; i++) {
      if (t >= S.ranges[i][0] && t < S.ranges[i][1]) { want = i; break; }
    }
    if (want === S.live) return;
    S.live = want;
    for (var j = 0; j < S.list.length; j++) {
      S.list[j].classList.toggle("is-live", j === want);
      S.pips[j].classList.toggle("on", j <= want);
    }
  }

  /* ---------- the scroll driver ---------- */
  var geom = [];
  function measureGeom() {
    geom = acts.map(function (el) {
      return { top: el.offsetTop, h: el.offsetHeight, dom: el.hasAttribute("data-dom") };
    });
  }

  function update() {
    var y = win.pageYOffset || doc.documentElement.scrollTop;
    var vh = win.innerHeight;
    var idx = 0;
    for (var i = 0; i < geom.length; i++) if (y + vh * 0.42 >= geom[i].top) idx = i;
    var g = geom[idx];
    var span = Math.max(1, g.h - vh);
    var t = clamp((y - g.top) / span, 0, 1);

    var docSpan = doc.documentElement.scrollHeight - vh;
    var state01 = docSpan > 0 ? clamp(y / docSpan, 0, 1) : 0;

    setAct(idx);
    driveSubs(idx, t);

    /* the shutter: the world hands over through black rather than through a scroll position */
    var fade = 1;
    if (g.dom) fade = 0;
    else {
      var inRamp = idx === 0 ? 1 : clamp(t / 0.035, 0, 1);
      var outRamp = idx === geom.length - 1 ? 1 : clamp((1 - t) / 0.035, 0, 1);
      fade = Math.min(inRamp, outRamp);
    }
    if (world) world.drive(idx, t, fade);

    /* act 02 strikes its registry rows off one custom property, no work per row */
    if (registry) registry.style.setProperty("--p", (idx === 1 ? t : (idx > 1 ? 1 : 0)).toFixed(4));

    /* alche's move: the instrument prints its own working. every number below is read
       off the live renderer, so it moves because the camera moves. */
    if (world && world.ctx) {
      var cam = world.ctx.camera;
      if (cam && tx) {
        tx.textContent = cam.position.x.toFixed(2);
        ty.textContent = cam.position.y.toFixed(2);
        tz.textContent = cam.position.z.toFixed(2);
        var ortho = !!cam.isOrthographicCamera;
        tLensLabel.textContent = ortho ? "zoom" : "fov";
        tLens.textContent = (ortho ? cam.zoom : cam.fov).toFixed(2);
        tAct.textContent = ("0" + (idx + 1)).slice(-2);
        tP.textContent = t.toFixed(3);
        tFill.style.width = (t * 100).toFixed(1) + "%";
        if (gzMode) gzMode.textContent = ortho ? "ortho" : "persp";
        drawGizmo(cam, ortho);
      }
    }
    if (scaleFill) scaleFill.style.height = (state01 * 100).toFixed(2) + "%";
    if (scaleLabel) scaleLabel.textContent = ("0" + (idx + 1)).slice(-2);

    /* the state readout flips once per act, at that act's flip frame */
    if (hudState) hudState.textContent = (!g.dom && t > 0.55) ? "decided" : "undecided";

    passed();
  }

  var ticking = false;
  function onScroll() {
    if (ticking) return;
    ticking = true;
    /* rAF is paused in a background tab, so measure inline there rather than queue an
       update that only lands whenever the tab is looked at again */
    if (doc.hidden) { ticking = false; return update(); }
    requestAnimationFrame(function () { ticking = false; update(); });
  }

  function remeasure() { measureGeom(); update(); }
  measureGeom(); update();
  win.addEventListener("scroll", onScroll, { passive: true });
  win.addEventListener("resize", remeasure);
  win.addEventListener("load", remeasure);
  setTimeout(remeasure, 1800);
  if (doc.fonts && doc.fonts.ready) doc.fonts.ready.then(remeasure);

  if (reduce) acts.forEach(function (a) { a.classList.add("is-on"); });

  /* ---------- act 07: show the form, not the content ---------- */
  var formToggle = $("#form-toggle");
  if (formToggle) {
    formToggle.addEventListener("change", function () {
      root.classList.toggle("form-only", formToggle.checked);
    });
  }

  /* ---------- act 09: the price ---------- */
  var price = $("#price"), buy = $("#buy");
  function flipPrice() {
    if (!price || price.classList.contains("flipped")) return;
    price.classList.add("flipped");
    if (buy) buy.setAttribute("aria-expanded", "true");
  }
  if (buy) buy.addEventListener("click", flipPrice);

  /* ---------- keyboard: refuse without a mouse ---------- */
  doc.addEventListener("keydown", function (e) {
    if (e.key === "r" || e.key === "R") {
      if (current === 3 && world && world.refuseNearest) world.refuseNearest();
    }
  });

  /* ================= the world, strictly an enhancement ================= */
  if (!canvas) return;
  try {
    var probe = doc.createElement("canvas");
    if (!(probe.getContext("webgl2") || probe.getContext("webgl"))) return;
  } catch (e) { return; }

  Promise.all([
    import("./world.js"),
    import("./acts.js"),
    doc.fonts && doc.fonts.ready ? doc.fonts.ready : Promise.resolve()
  ]).then(function (mods) {
    var W = mods[0], A = mods[1];
    return import("three").then(function (THREE) {
      var w = W.createWorld(THREE, canvas, A.ACTS, {
        onRefuse: function (n) { bumpRefused(n); },
        onAct: function () {}
      });
      w.ctx.hooks = { onRefuse: function (n) { bumpRefused(n); } };
      world = w;
      root.classList.add("world-on");
      update();
      return w;
    });
  }).catch(function () {
    root.classList.remove("world-on");     /* the static ground stays, every word still reads */
  });
})();
