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
  /* Film, not screensaver: ACES grading is most of the difference between a three.js demo
     and something that reads shot. The two light-ground acts opt out via act.noGrade,
     because a clear colour is not tone mapped and a graded card on an ungraded paper
     ground would read as dirt. */
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.12;
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
    /* Reduced motion runs frame() once and latches, but entering an act also rebuilds its
       fog at the density the act was BORN with, so a latched still frame re-entered later
       kept the wrong atmosphere. Re-entry now earns exactly one fresh frame() call. */
    ctx.actState.__staticDone = false;

    grab.on = false; grab.dy = 0;          /* the handle belongs to the act, not to the page */
    renderer.toneMapping = act.noGrade ? THREE.NoToneMapping : THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = act.exposure || 1.12;
    if (act.bg != null) bgTarget.set(act.bg);
    /* Every act change happens behind the cut, so the ground snaps rather than easing:
       easing it leaked the previous act's ground into the first settled frames. */
    bg.copy(bgTarget);
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

  /* A handle the visitor can take hold of, offered by any act that sets `grab: true`.
     The engine owns the listeners for two reasons: an act never has to guard against firing
     while it is not the live one, and the handle is dropped the instant the page cuts away.
     grab.dy is normalised viewport units, so an act scales it into its own world.
     Mouse gets a real drag. Touch gets a tap, because a vertical drag on a phone is the
     page scrolling and an interaction must never fight the scroll for the same gesture. */
  var grab = { on: false, dy: 0, y0: 0, base: 0 };
  ctx.grab = grab;
  function grabbable() {
    var s = slots[activeIndex];
    return !!(s && s.act.grab);
  }
  canvas.addEventListener("pointerdown", function (e) {
    if (!grabbable()) return;
    if (e.pointerType === "touch") {
      grab.dy = -((e.clientY / window.innerHeight) * 2 - 1);
      return;
    }
    grab.on = true; grab.y0 = e.clientY; grab.base = grab.dy;
    try { canvas.setPointerCapture(e.pointerId); } catch (err) { /* no capture, drag still works */ }
  });
  canvas.addEventListener("pointermove", function (e) {
    if (!grab.on) return;
    grab.dy = grab.base - ((e.clientY - grab.y0) / window.innerHeight) * 2;
    if (grab.dy > 1) grab.dy = 1; else if (grab.dy < -1) grab.dy = -1;
  });
  function release() { grab.on = false; }
  canvas.addEventListener("pointerup", release);
  canvas.addEventListener("pointercancel", release);

  /* PORTRAIT FRAMING.
     three.js fov is VERTICAL, so on a 375x812 phone (aspect 0.46 against the 16:9 these
     scenes were composed for) the horizontal extent collapses to about a quarter and every
     subject composed off the centre line leaves the frame. The page was scrolling through a
     film whose subject was out of shot. Widening the lens back by the full ratio would need
     a ~106 degree fov, which is a fisheye, so this recovers the geometric mean of the two
     and caps it: subjects come back into frame without the edges bending. */
  var DESIGN_ASPECT = 16 / 9, MAX_FOV = 66;
  function frameGain() {
    var a = window.innerWidth / window.innerHeight;
    return a >= DESIGN_ASPECT ? 1 : Math.sqrt(DESIGN_ASPECT / a);
  }
  function correctFov(f) {
    var g = frameGain();
    if (g === 1) return f;
    var out = Math.atan(Math.tan(f * Math.PI / 360) * g) * 360 / Math.PI;
    return out > MAX_FOV ? MAX_FOV : out;
  }

  function resize() {
    var w = window.innerWidth, h = window.innerHeight;
    renderer.setSize(w, h, false);
    persp.aspect = w / h;
    persp.updateProjectionMatrix();
    /* the orthographic act gets the same treatment: its horizontal half-extent is
       half * aspect, so a portrait viewport needs a taller frustum to hold the survey */
    var half = 34 * frameGain();
    ortho.top = half; ortho.bottom = -half;
    ortho.left = -half * (w / h); ortho.right = half * (w / h);
    ortho.updateProjectionMatrix();
  }
  resize();
  window.addEventListener("resize", resize);

  var rafId = 0, t0 = performance.now(), lastFade = -1;
  var designFov = 55, lastFov = -1;   /* see the portrait framing note above */
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

    /* Three acts add the pointer straight into the camera position, and camera() runs every
       frame even in the reduced-motion branch. Left running, this gave somebody who asked
       for less motion a camera that follows the mouse continuously. */
    if (!reduce) {
      pointer.x += (pointer.tx - pointer.x) * 0.05;
      pointer.y += (pointer.ty - pointer.y) * 0.05;
    }

    ctx.t = reduce ? (s.act.restT != null ? s.act.restT : 0.72) : drive.t;
    ctx.clock = clock;
    ctx.root = s.root;
    ctx.pickable = s.pickable;
    ctx.actState = ctx.state[s.act.id];
    ctx.camera = s.act.ortho ? ortho : persp;

    bg.lerp(bgTarget, 0.1);
    renderer.setClearColor(bg, 1);

    if (s.act.camera) s.act.camera(ctx);

    /* The act just wrote the shot it wants at 16:9. Re-derive it for this viewport.
       The design value is tracked rather than recomputed from the camera, so an act that
       only sets fov once (or guards on `c.fov !== want`) cannot compound the correction
       frame after frame. */
    if (!ctx.camera.isOrthographicCamera) {
      var want = ctx.camera.fov;
      if (want !== lastFov) designFov = want;      /* the act rewrote it: new design value */
      var fixed = correctFov(designFov);
      if (Math.abs(ctx.camera.fov - fixed) > 1e-4) {
        ctx.camera.fov = fixed;
        ctx.camera.updateProjectionMatrix();
      }
      lastFov = fixed;
    }
    if (s.act.frame && !reduce) s.act.frame(ctx);
    else if (s.act.frame) {
      /* Reduced motion runs frame() once and latches, which is right for anything driven by
         the clock. It is wrong for an act whose state is driven by the visitor's own hand:
         the kiln's seam lives in frame(), so latching left a reduced-motion visitor able to
         take the handle and watch the camera follow a seam that never moved. */
      if (!ctx.actState.__staticDone || (s.act.grab && grab.dy !== ctx.actState.__lastDy)) {
        s.act.frame(ctx);
        ctx.actState.__staticDone = true;
        ctx.actState.__lastDy = grab.dy;
      }
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

    /* Keyboard paths for the two things the page offers a pointer. The engine forwards to
       whichever act is live, so no act has to know a key handler exists and no key handler
       has to know which act is on screen. Both are no-ops on acts that do not offer them. */
    refuseNearest: function () {
      var s = slots[activeIndex];
      if (s && s.act.refuseNearest) return s.act.refuseNearest(ctx);
      return false;
    },
    nudgeGrab: function (dir) {
      var s = slots[activeIndex];
      if (!s || !s.act.grab) return false;
      grab.dy = Math.max(-1, Math.min(1, grab.dy + dir * 0.08));
      return true;
    },
    /* what the live act lets the visitor do, so the page can label the canvas honestly
       instead of the page and the world each guessing about the other */
    affords: function () {
      var s = slots[activeIndex];
      return { grab: !!(s && s.act.grab), refuse: !!(s && s.act.refuseNearest) };
    },

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

/* A camera journey: keyframes of {t, pos:[x,y,z], look:[x,y,z], fov}. Each leg is eased
   independently, so an act reads as a sequence of moves (approach, arrive, traverse, settle)
   rather than one long lerp. Driven entirely by scroll position, so scrubbing back is exact. */
export function flyPath(keys, t, camera, opts) {
  var i = 0;
  while (i < keys.length - 2 && t > keys[i + 1].t) i++;
  var a = keys[i], b = keys[i + 1];
  var span = Math.max(1e-6, b.t - a.t);
  var raw = clamp01((t - a.t) / span);
  var k = (opts && opts.linear) ? raw : ease(raw);
  var px = lerp(a.pos[0], b.pos[0], k), py = lerp(a.pos[1], b.pos[1], k), pz = lerp(a.pos[2], b.pos[2], k);
  var lx = lerp(a.look[0], b.look[0], k), ly = lerp(a.look[1], b.look[1], k), lz = lerp(a.look[2], b.look[2], k);
  var drift = opts && opts.drift ? opts.drift : 0;
  if (drift && opts.pointer) {
    px += opts.pointer.x * drift;
    py += -opts.pointer.y * drift * 0.6;
  }
  camera.position.set(px, py, pz);
  if (opts && opts.noRotate) {
    camera.rotation.set(0, 0, 0);
  } else {
    camera.lookAt(lx, ly, lz);
  }
  var f = lerp(a.fov, b.fov, k);
  if (camera.isOrthographicCamera) {
    if (camera.zoom !== f) { camera.zoom = f; camera.updateProjectionMatrix(); }
  } else if (Math.abs(camera.fov - f) > 0.001) {
    camera.fov = f; camera.updateProjectionMatrix();
  }
  return k;
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
