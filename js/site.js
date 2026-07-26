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
  /* The engine branches its handle on pointer type, so the cue that describes that handle
     has to branch on the same thing. Switching it on viewport width told a touch tablet
     wider than 860px to drag something that only ever answers to a tap. */
  if (win.matchMedia("(pointer: coarse)").matches) root.classList.add("is-coarse");
  var clamp = function (v, a, b) { return v < a ? a : v > b ? b : v; };

  var acts = $$(".act");
  var hudSect = $("#hud-sect"), hudName = $("#hud-name"), hudCount = $("#hud-count");
  var hudTotal = $("#hud-total");
  var registry = $("#registry-rows"), canvas = $("#world");

  /* the splice: chapter card and letterbox bars, driven from the same scroll frame */
  var cut = $("#cut"), cutNum = $("#cut-num"), cutName = $("#cut-name");
  var cutPrev = $("#cut-prev"), cutRoll = $("#cut-roll");
  var barT = $(".lbar--t"), barB = $(".lbar--b");
  var coarse = root.classList.contains("is-coarse");

  /* film grain, drawn at runtime like every other texture on this page. the scanline
     gradient it replaces read as a cheap CRT filter; grain reads as stock. */
  (function grain() {
    var el = $(".scan");
    if (!el) return;
    var c = doc.createElement("canvas");
    c.width = c.height = 132;
    var x = c.getContext("2d");
    var d = x.createImageData(132, 132);
    for (var i = 0; i < d.data.length; i += 4) {
      var v = (Math.random() * 255) | 0;
      d.data[i] = d.data[i + 1] = d.data[i + 2] = v;
      d.data[i + 3] = 255;
    }
    x.putImageData(d, 0, 0);
    el.style.backgroundImage = "url(" + c.toDataURL() + ")";
  })();

  var world = null;                      /* set once three.js lands, may stay null forever */
  var refused = 0;
  var current = -1;

  function setAccent(i) {
    var a = acts[i];
    var accent = a.getAttribute("data-accent") || "#E9EBEF";
    root.style.setProperty("--accent", accent);
    root.classList.toggle("is-paper", a.hasAttribute("data-paper"));
    root.classList.toggle("is-pale", a.hasAttribute("data-pale"));
    root.classList.toggle("is-paperworld", a.hasAttribute("data-paperworld"));
  }

  function setAct(i) {
    if (i === current) return;
    if (current >= 0) retireSubs(current);
    current = i;
    var a = acts[i];
    if (hudSect) hudSect.textContent = ("0" + (i + 1)).slice(-2);
    if (hudName) hudName.textContent = a.getAttribute("data-name") || "";
    setAccent(i);
  }

  var refusedStatus = $("#refused-status"), sayRefused = 0;
  function bumpRefused(n) {
    refused += (n || 1);
    var s = ("00" + refused).slice(-3);
    if (hudCount) hudCount.textContent = s;
    if (hudTotal) hudTotal.textContent = s;
    root.classList.add("has-refused");
    /* Both counters sit inside aria-hidden chrome, so without this the one interaction on
       the page gives a screen reader nothing at all. Coalesced, because act 03 refuses a
       batch in a single call and a live region should not read a running commentary. */
    if (refusedStatus) {
      clearTimeout(sayRefused);
      sayRefused = setTimeout(function () {
        refusedStatus.textContent = refused + (refused === 1 ? " page refused" : " pages refused");
      }, 350);
    }
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

  /* Every sub-beat starts out of the tab order and out of the accessibility tree, because
     every one of them starts invisible. driveSubs only ever touches the act you are in, so
     without this the other eight acts kept all their hidden copy focusable: the price
     button sat at tab stop two, eight acts before it appears on screen. */
  if (!reduce) {
    subsByAct.forEach(function (S) {
      if (S) S.list.forEach(function (el) { el.inert = true; });
    });
  }

  /* leaving an act puts its copy back out of reach, and forgets which beat was live so it
     is recomputed rather than restored on the way back in */
  function retireSubs(i) {
    var S = subsByAct[i];
    if (!S || reduce) return;
    S.list.forEach(function (el) { el.inert = true; });
    S.live = -1;
  }

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
      /* Opacity hides a block from the eye and from nobody else: the price button sat at
         tab stop two, operable eight acts before it appears. inert takes the block out of
         the tab order and the accessibility tree together. Not under reduced motion, where
         every sub-beat is stacked and visible on purpose and all of it must stay readable. */
      if (!reduce) S.list[j].inert = (j !== want);
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

    setAct(idx);
    driveSubs(idx, t);

    /* the shutter: the world hands over through black rather than through a scroll position */
    var fade = 1;
    if (g.dom) fade = 0;
    else {
      var inRamp = idx === 0 ? 1 : clamp(t / 0.06, 0, 1);
      /* the last act does not cut out: it fades to true black for the end card */
      var outRamp = idx === geom.length - 1
        ? clamp((0.92 - t) / 0.08, 0, 1)
        : clamp((1 - t) / 0.06, 0, 1);
      fade = Math.min(inRamp, outRamp);
    }
    if (world) world.drive(idx, t, fade);

    /* act 02 strikes its registry rows off one custom property, no work per row */
    if (registry) registry.style.setProperty("--p", (idx === 1 ? t : (idx > 1 ? 1 : 0)).toFixed(4));

    driveCut(idx, t, g, fade);
    passed();
  }

  /* ---------- the splice ----------
     Every act change is cut like film, not faded like a slideshow. Into the boundary the
     frame whips (a scroll-scrubbed zoom or pan with a motion-blur smear), the letterbox
     tightens, and a chapter card holds the black: the number and name of the world you are
     entering, in that world's accent. All of it is a pure function of scroll, so scrubbing
     backwards runs the splice in reverse exactly. */
  var lastCard = -1, lastBoundary = -2;
  var easeOut3 = function (x) { return 1 - Math.pow(1 - x, 3); };
  function driveCut(idx, t, g, fade) {
    if (!cut) return;
    var last = idx === acts.length - 1;
    var cutP = g.dom ? clamp(1 - Math.min(t, 1 - t) / 0.06, 0, 1) : (1 - fade);
    /* the credits own the final black: no chapter card over them */
    if (last && t > 0.5) cutP = 0;
    var target = t > 0.5 ? Math.min(idx + 1, acts.length - 1) : idx;

    if (target !== lastCard) {
      lastCard = target;
      cutName.textContent = acts[target].getAttribute("data-name") || "";
      /* the card wears the accent of the world it announces, not the one being left */
      cut.style.setProperty("--accent", acts[target].getAttribute("data-accent") || "#E9EBEF");
    }
    /* the odometer: across boundary b the numeral rolls from act b+1 to act b+2,
       driven by the same scrub as the black, so it reverses exactly */
    var boundaryB = t > 0.5 ? idx : idx - 1;
    if (boundaryB !== lastBoundary && boundaryB >= 0) {
      lastBoundary = boundaryB;
      cutPrev.textContent = ("0" + (boundaryB + 1)).slice(-2);
      cutNum.textContent = ("0" + Math.min(boundaryB + 2, acts.length)).slice(-2);
    }
    var bp = boundaryB < 0 ? 1 : (t > 0.5 ? cutP * 0.5 : 1 - cutP * 0.5);
    if (cutRoll) cutRoll.style.transform = "translateY(" + (-easeOut3(bp) * 50).toFixed(2) + "%)";
    cut.style.opacity = (cutP * cutP).toFixed(3);

    if (reduce) return;
    var b = 1 + 0.55 * cutP;
    if (barT) { barT.style.transform = "scaleY(" + b.toFixed(3) + ")"; }
    if (barB) { barB.style.transform = "scaleY(" + b.toFixed(3) + ")"; }

    if (!g.dom && world) {
      var boundary = t > 0.5 ? idx : idx - 1;
      var side = t > 0.5 ? 1 : -1;          /* outgoing vs incoming half of the same cut */
      var kind = ((boundary % 3) + 3) % 3;  /* punch-in, whip-up, whip-across, repeating */
      var sc = kind === 0 ? 1 + 0.10 * cutP : 1 + 0.04 * cutP;
      var txv = 0, tyv = 0;
      if (kind === 1) tyv = -6 * side * cutP;
      if (kind === 2) txv = -6 * side * cutP;
      canvas.style.transform = "scale(" + sc.toFixed(4) + ") translate(" + txv.toFixed(2) + "vh," + tyv.toFixed(2) + "vh)";
      canvas.style.filter = cutP > 0.02 ? "blur(" + ((coarse ? 5 : 12) * cutP).toFixed(1) + "px)" : "";
    } else {
      canvas.style.transform = "";
      canvas.style.filter = "";
    }
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
  var formToggle = $("#form-toggle"), screenFrame = $("#screen-frame"), blinkT = 0;
  if (formToggle) {
    formToggle.addEventListener("change", function () {
      /* a projector blink between slides: interaction feedback, skipped for reduced motion */
      if (screenFrame && !reduce) {
        screenFrame.classList.add("blink");
        clearTimeout(blinkT);
        blinkT = setTimeout(function () {
          screenFrame.classList.remove("blink");
          root.classList.toggle("form-only", formToggle.checked);
        }, 130);
      } else {
        root.classList.toggle("form-only", formToggle.checked);
      }
    });
  }

  /* ---------- act 09: the purchase ----------
     It looks like a checkout because the joke needs one: the order is real-shaped, the
     button processes, and then the total recalculates to zero. No fields, no payment,
     nothing collected: the colophon already says it, a demonstration, not a store. */
  var price = $("#price"), buy = $("#buy");
  function settle() {
    price.classList.remove("processing");
    price.classList.add("flipped");
    buy.textContent = "it is yours";
    buy.disabled = true;
    buy.setAttribute("aria-expanded", "true");
  }
  function flipPrice() {
    if (!price || price.classList.contains("flipped") || price.classList.contains("processing")) return;
    if (reduce) return settle();
    price.classList.add("processing");
    buy.textContent = "processing";
    setTimeout(settle, 900);
  }
  if (buy) buy.addEventListener("click", flipPrice);

  /* ---------- keyboard: every pointer affordance has one ----------
     The canvas is one element shared by nine acts, so it becomes focusable only while the
     live act actually offers something, and it says what it offers. Arrow keys operate the
     seam only once the canvas is focused, because arrows are how a keyboard scrolls a page
     and an interaction must never take the scroll away from someone who needs it. */
  var LABELS = {
    refuse: "The output run. Press R to refuse a page.",
    grab: "The kiln. Use the up and down arrow keys to move the line of heat."
  };
  /* Driven by the world's own act change, never by the page's. The page switches act on the
     scroll frame; the world switches on its next render, so asking the world during the page's
     switch labels the canvas for the act that just ended. */
  function labelCanvas(act) {
    if (!act) return;
    var kind = act.refuseNearest ? "refuse" : act.grab ? "grab" : null;
    if (kind) {
      canvas.setAttribute("tabindex", "0");
      canvas.setAttribute("role", "application");
      canvas.setAttribute("aria-label", LABELS[kind]);
    } else {
      canvas.removeAttribute("tabindex");
      canvas.removeAttribute("role");
      canvas.setAttribute("aria-hidden", "true");
    }
    if (kind) canvas.removeAttribute("aria-hidden");
  }

  doc.addEventListener("keydown", function (e) {
    if (!world) return;
    if (e.key === "r" || e.key === "R") {
      if (world.refuseNearest()) e.preventDefault();
      return;
    }
    if (doc.activeElement !== canvas) return;
    if (e.key === "ArrowUp" && world.nudgeGrab(1)) e.preventDefault();
    else if (e.key === "ArrowDown" && world.nudgeGrab(-1)) e.preventDefault();
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
        onAct: function (i, act) { labelCanvas(act); }
      });
      w.ctx.hooks = { onRefuse: function (n) { bumpRefused(n); } };
      world = w;
      root.classList.add("world-on");
      update();
      /* a handle for the verification harness, off unless it is asked for. the automation
         browser reports the tab as hidden, so rAF is paused and frames have to be stepped
         by hand to check anything numerically. */
      if (win.location.search.indexOf("probe") > -1) win.__world = w;
      return w;
    });
  }).catch(function () {
    root.classList.remove("world-on");     /* the static ground stays, every word still reads */
  });
})();
