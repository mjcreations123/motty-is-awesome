/* The world engine.
 *
 * The previous build failed for one structural reason: it was a single continuous scene, so every
 * beat could only ever be a different part of the same world. Here each act owns its own scene
 * graph, its own camera grammar, its own projection, fog, ground colour and accent, and only one
 * act is ever live. Acts hand over through black, which is a cut rather than a scroll position.
 *
 * An act is a plain object:
 *   { id, accent, bg, fog, fov, ortho, build(ctx), frame(ctx), camera(ctx), pick(ctx, hit) }
 * ctx carries { THREE, root, camera, t (0..1 through this act), clock, pointer, state, pickable }.
 * Acts with no `build` are DOM acts: the canvas is simply not drawn while they are live.
 */

export function createWorld(THREE, canvas, acts, hooks) {
  var small = window.innerWidth < 760;
  var coarse = window.matchMedia("(pointer: coarse)").matches;
  var reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  var renderer = new THREE.WebGLRenderer({ canvas: canvas, antialias: !small, powerPreference: "high-performance" });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, coarse ? 1.25 : 1.75));
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.setClearColor(0x08090B, 1);
  renderer.localClippingEnabled = true;          /* the Kiln bisects a slab with clip planes */
  renderer.shadowMap.enabled = !small;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;

  var scene = new THREE.Scene();
  var persp = new THREE.PerspectiveCamera(55, 1, 0.1, 900);
  var ortho = new THREE.OrthographicCamera(-50, 50, 30, -30, -400, 900);
  var pointer = { x: 0, y: 0, tx: 0, ty: 0 };

  var ctx = {
    THREE: THREE, scene: scene, renderer: renderer, camera: persp, ortho: ortho,
    small: small, coarse: coarse, reduce: reduce, pointer: pointer,
    root: null, t: 0, clock: 0, state: {}, pickable: [], hooks: hooks || {}
  };

  var slots = acts.map(function (act) {
    return { act: act, root: null, pickable: [], built: false };
  });

  var activeIndex = -1;
  var bg = new THREE.Color(0x08090B), bgTarget = new THREE.Color(0x08090B);

  function ensureBuilt(i) {
    var s = slots[i];
    if (s.built || !s.act.build) { s.built = true; return s; }
    s.root = new THREE.Group();
    s.root.visible = false;
    scene.add(s.root);
    ctx.root = s.root;
    ctx.pickable = s.pickable;
    ctx.state[s.act.id] = ctx.state[s.act.id] || {};
    ctx.actState = ctx.state[s.act.id];
    s.act.build(ctx);
    s.built = true;
    return s;
  }

  function setAct(i) {
    if (i === activeIndex) return;
    var prev = slots[activeIndex];
    if (prev && prev.root) prev.root.visible = false;
    activeIndex = i;
    var s = ensureBuilt(i), act = s.act;
    if (s.root) s.root.visible = true;

    ctx.root = s.root;
    ctx.pickable = s.pickable;
    ctx.actState = ctx.state[act.id] = ctx.state[act.id] || {};

    if (act.bg != null) bgTarget.set(act.bg);
    scene.fog = act.fog ? act.fog(THREE) : null;
    ctx.camera = act.ortho ? ortho : persp;
    if (!act.ortho) { persp.fov = act.fov || 55; persp.updateProjectionMatrix(); }
    if (act.enter) act.enter(ctx);
    if (hooks && hooks.onAct) hooks.onAct(i, act);
  }

  /* preload the next act during the current one, so a cut never stalls on a build */
  var preloaded = -1;
  function preload(i) {
    if (i === preloaded || i >= slots.length || i < 0) return;
    preloaded = i;
    ensureBuilt(i);
    var s = slots[i];
    if (s.root) s.root.visible = false;
  }

  window.addEventListener("pointermove", function (e) {
    pointer.tx = (e.clientX / window.innerWidth) * 2 - 1;
    pointer.ty = (e.clientY / window.innerHeight) * 2 - 1;
  }, { passive: true });

  var ray = new THREE.Raycaster(), ndc = new THREE.Vector2();
  function pickAt(cx, cy) {
    var s = slots[activeIndex];
    if (!s || !s.pickable.length || !s.act.pick) return;
    ndc.x = (cx / window.innerWidth) * 2 - 1;
    ndc.y = -(cy / window.innerHeight) * 2 + 1;
    ray.setFromCamera(ndc, ctx.camera);
    var hit = ray.intersectObjects(s.pickable, false)[0];
    if (hit) s.act.pick(ctx, hit);
  }
  canvas.addEventListener("pointerup", function (e) { pickAt(e.clientX, e.clientY); });

  function resize() {
    var w = window.innerWidth, h = window.innerHeight;
    renderer.setSize(w, h, false);
    persp.aspect = w / h;
    persp.updateProjectionMatrix();
    var half = 34;
    ortho.top = half; ortho.bottom = -half;
    ortho.left = -half * (w / h); ortho.right = half * (w / h);
    ortho.updateProjectionMatrix();
  }
  resize();
  window.addEventListener("resize", resize);

  var rafId = 0, t0 = performance.now(), lastFade = -1;
  var drive = { index: 0, t: 0, fade: 1 };

  function frame() {
    rafId = requestAnimationFrame(frame);
    render();
  }

  function render() {
    var clock = (performance.now() - t0) / 1000;
    setAct(drive.index);
    preload(drive.index + 1);

    var s = slots[activeIndex];
    if (drive.fade !== lastFade) {
      canvas.style.opacity = drive.fade;
      lastFade = drive.fade;
    }
    if (!s || !s.root || drive.fade <= 0.004) return;   /* DOM act, or shutter closed */

    pointer.x += (pointer.tx - pointer.x) * 0.05;
    pointer.y += (pointer.ty - pointer.y) * 0.05;

    ctx.t = reduce ? (s.act.restT != null ? s.act.restT : 0.72) : drive.t;
    ctx.clock = clock;
    ctx.root = s.root;
    ctx.pickable = s.pickable;
    ctx.actState = ctx.state[s.act.id];
    ctx.camera = s.act.ortho ? ortho : persp;

    bg.lerp(bgTarget, 0.1);
    renderer.setClearColor(bg, 1);

    if (s.act.camera) s.act.camera(ctx);
    if (s.act.frame && !reduce) s.act.frame(ctx);
    else if (s.act.frame && reduce && !ctx.actState.__staticDone) {
      s.act.frame(ctx); ctx.actState.__staticDone = true;
    }

    renderer.render(scene, ctx.camera);
  }

  /* cancel on the way out, so repeated tab switches can never stack render loops */
  function start() { if (!rafId) { render(); rafId = requestAnimationFrame(frame); } }
  function stop() { if (rafId) { cancelAnimationFrame(rafId); rafId = 0; } }
  document.addEventListener("visibilitychange", function () { document.hidden ? stop() : start(); });
  start();

  return {
    drive: function (index, t, fade) { drive.index = index; drive.t = t; drive.fade = fade; },
    step: function () { render(); },
    ctx: ctx,
    renderer: renderer
  };
}

/* ------------------------------------------------------------------ *
 * shared drawing helpers. every texture on this page is drawn here at
 * runtime: there is not one image file in the build.
 * ------------------------------------------------------------------ */

export function makeTexture(THREE, renderer, w, h, draw, opts) {
  var c = document.createElement("canvas");
  c.width = w; c.height = h;
  draw(c.getContext("2d"), w, h);
  var t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = renderer.capabilities.getMaxAnisotropy();
  if (opts && opts.repeat) {
    t.wrapS = t.wrapT = THREE.RepeatWrapping;
    t.repeat.set(opts.repeat[0], opts.repeat[1]);
  }
  return t;
}

/* The average page: a hero bar, three cards, a call to action, a footer rule.
   An abstract layout diagram on purpose. No browser chrome, no fake product UI,
   and no readable copy, so nothing leaks at any zoom. */
export function averagePageTexture(THREE, renderer, ink, ground) {
  return makeTexture(THREE, renderer, 512, 320, function (g, w, h) {
    if (ground) { g.fillStyle = ground; g.fillRect(0, 0, w, h); }
    g.strokeStyle = ink; g.fillStyle = ink; g.lineWidth = 4;
    g.strokeRect(10, 10, 492, 300);
    g.fillRect(44, 52, 258, 19);
    g.fillRect(44, 82, 186, 12);
    g.strokeRect(44, 112, 84, 27);
    for (var i = 0; i < 3; i++) g.strokeRect(44 + i * 146, 178, 124, 82);
    g.fillRect(44, 282, 424, 6);
  });
}

/* A directed page: violently asymmetric, one huge block, one hard colour field,
   one hairline system. The visual opposite of the average. */
export function directedPageTexture(THREE, renderer, accent) {
  return makeTexture(THREE, renderer, 768, 1024, function (g, w, h) {
    g.fillStyle = "#0C0E12"; g.fillRect(0, 0, w, h);
    g.fillStyle = accent || "#FF7A18";
    g.fillRect(w * 0.44, h * 0.52, w * 0.62, h * 0.46);
    g.fillStyle = "#E9EBEF";
    g.fillRect(-20, h * 0.10, w * 0.52, h * 0.11);
    g.fillRect(60, h * 0.245, w * 0.30, h * 0.028);
    g.strokeStyle = "rgba(233,235,239,.55)"; g.lineWidth = 3;
    [0.34, 0.40, 0.455].forEach(function (y) {
      g.beginPath(); g.moveTo(60, h * y); g.lineTo(w - 60, h * y); g.stroke();
    });
    g.fillStyle = "rgba(233,235,239,.85)";
    g.fillRect(60, h * 0.60, w * 0.24, h * 0.012);
    g.fillRect(60, h * 0.645, w * 0.17, h * 0.012);
    g.strokeStyle = "rgba(233,235,239,.8)"; g.lineWidth = 4;
    g.strokeRect(6, 6, w - 12, h - 12);
  });
}

/* Telemetry rows. Field names are generic craft parameters; values are
   non-semantic glyph runs, so zooming a screenshot reveals nothing. */
export function rowTexture(THREE, renderer, label, ink, ground) {
  return makeTexture(THREE, renderer, 512, 72, function (g, w, h) {
    if (ground) { g.fillStyle = ground; g.fillRect(0, 0, w, h); }
    g.font = '500 26px "Martian Mono", ui-monospace, monospace';
    g.textBaseline = "middle";
    g.fillStyle = ink;
    g.fillText(label, 10, h / 2);
    g.globalAlpha = 0.55;
    g.textAlign = "right";
    g.fillText("█████", w - 12, h / 2);
    g.globalAlpha = 1; g.textAlign = "left";
  });
}

export function radialShadow(THREE, renderer) {
  return makeTexture(THREE, renderer, 256, 256, function (g, w, h) {
    var r = g.createRadialGradient(w / 2, h / 2, 2, w / 2, h / 2, w / 2);
    r.addColorStop(0, "rgba(0,0,0,.72)");
    r.addColorStop(0.55, "rgba(0,0,0,.28)");
    r.addColorStop(1, "rgba(0,0,0,0)");
    g.fillStyle = r; g.fillRect(0, 0, w, h);
  });
}

export function ease(t) { return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2; }
export function easeOut(t) { return 1 - Math.pow(1 - t, 3); }
export function clamp(v, a, b) { return v < a ? a : v > b ? b : v; }
export function clamp01(v) { return v < 0 ? 0 : v > 1 ? 1 : v; }
export function lerp(a, b, t) { return a + (b - a) * t; }
/* deterministic noise, so every visitor sees the same world */
export function mulberry32(a) {
  return function () {
    a |= 0; a = a + 0x6D2B79F5 | 0;
    var t = Math.imul(a ^ a >>> 15, 1 | a);
    t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t;
    return ((t ^ t >>> 14) >>> 0) / 4294967296;
  };
}
