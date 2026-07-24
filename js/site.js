/* motty is awesome v3 - "The Average"
   One continuous scroll-driven flight through five chambers, all built from the skill's
   own material. Page behaviour is set up first and never depends on WebGL or the CDN. */
(function () {
  "use strict";

  var doc = document, root = doc.documentElement, win = window;
  var $ = function (s, r) { return (r || doc).querySelector(s); };
  var $$ = function (s, r) { return Array.prototype.slice.call((r || doc).querySelectorAll(s)); };
  var reduce = win.matchMedia("(prefers-reduced-motion: reduce)").matches;
  var clamp = function (v, a, b) { return v < a ? a : v > b ? b : v; };

  var state = { prog: 0, active: 0, one: false };

  /* ---------------------------- page ---------------------------- */
  var beats = $$(".beat");
  var hudSect = $("#hud-sect"), hudName = $("#hud-name"), hudCount = $("#hud-count");
  var railFill = $("#rail-fill");

  function setActive(i) {
    if (i === state.active && hudSect.textContent) return;
    state.active = i;
    var b = beats[i];
    if (hudSect) hudSect.textContent = ("0" + i).slice(-2);
    if (hudName) hudName.textContent = b ? (b.getAttribute("data-name") || "") : "";
    if (i >= 2) root.classList.add("can-refuse");
    /* the destination stays lit for the rest of the page, including when the visitor
       lands deep or jumps past the reveal beat */
    if (i >= beats.length - 3) state.one = true;
  }

  function passed() {
    for (var i = 0; i < beats.length; i++) {
      var b = beats[i];
      if (!b.classList.contains("is-on") &&
          b.getBoundingClientRect().top < win.innerHeight * 0.72) b.classList.add("is-on");
    }
  }

  function measure() {
    var h = doc.documentElement.scrollHeight - win.innerHeight;
    state.prog = h > 0 ? clamp((win.pageYOffset || doc.documentElement.scrollTop) / h, 0, 1) : 0;
    if (railFill) railFill.style.transform = "scaleY(" + state.prog + ")";

    var mid = win.innerHeight * 0.5, best = 0, bestD = Infinity;
    for (var i = 0; i < beats.length; i++) {
      var r = beats[i].getBoundingClientRect();
      var d = Math.abs(r.top + r.height * 0.5 - mid);
      if (d < bestD) { bestD = d; best = i; }
    }
    setActive(best);
    passed();
  }

  var ticking = false;
  function onScroll() {
    if (ticking) return;
    ticking = true;
    /* rAF is paused in a background tab, so measure inline there rather than queue
       an update that only lands whenever the tab is looked at again */
    if (doc.hidden) { ticking = false; return measure(); }
    requestAnimationFrame(function () { ticking = false; measure(); });
  }
  win.addEventListener("scroll", onScroll, { passive: true });
  win.addEventListener("resize", onScroll);
  win.addEventListener("load", measure);
  setTimeout(measure, 2400);
  measure();

  if (reduce) beats.forEach(function (b) { b.classList.add("is-on"); });

  var price = $("#price"), buy = $("#buy");
  if (price && buy) {
    buy.addEventListener("click", function () {
      price.classList.add("flipped");
      buy.parentNode.style.display = "none";
      var rc = $(".reveal-copy", price);
      if (rc) {
        rc.setAttribute("tabindex", "-1");
        try { rc.focus({ preventScroll: true }); } catch (e) { rc.focus(); }
      }
    });
  }

  /* refusal tally, a plain state readout (never an animated counter) */
  var refusedCount = 0;
  function bumpRefused() {
    refusedCount++;
    if (hudCount) hudCount.textContent = ("00" + refusedCount).slice(-3);
    root.classList.add("refusing", "refused-once");
  }

  /* ---------------------------- the world ---------------------------- */
  var canvas = $("#world");
  if (!canvas) return;
  try {
    var probe = doc.createElement("canvas");
    if (!(probe.getContext("webgl2") || probe.getContext("webgl"))) return;
  } catch (e) { return; }

  Promise.all([
    import("three"),
    doc.fonts && doc.fonts.ready ? doc.fonts.ready : Promise.resolve()
  ]).then(function (mods) {
    var THREE = mods[0];
    var small = win.innerWidth < 760;

    var renderer = new THREE.WebGLRenderer({ canvas: canvas, antialias: !small, powerPreference: "high-performance" });
    renderer.setPixelRatio(Math.min(win.devicePixelRatio || 1, 2));
    renderer.setClearColor(0x08090B, 1);
    renderer.outputColorSpace = THREE.SRGBColorSpace;

    var scene = new THREE.Scene();
    scene.fog = new THREE.FogExp2(0x08090B, 0.0335);
    var camera = new THREE.PerspectiveCamera(60, 1, 0.1, 500);

    var START_Z = 8, END_Z = -250, ARRIVE = 0.78;

    function tex(c) {
      var t = new THREE.CanvasTexture(c);
      t.colorSpace = THREE.SRGBColorSpace;
      t.anisotropy = renderer.capabilities.getMaxAnisotropy();
      return t;
    }

    /* the average: a hero bar, three cards, one call to action. an abstract layout
       diagram on purpose. no browser chrome, no fake product UI, no invented copy. */
    function averageTexture() {
      var c = doc.createElement("canvas"); c.width = 512; c.height = 320;
      var g = c.getContext("2d");
      g.strokeStyle = "#DCE3EC"; g.fillStyle = "#DCE3EC"; g.lineWidth = 4;
      g.strokeRect(10, 10, 492, 300);
      g.fillRect(44, 52, 258, 19);
      g.fillRect(44, 82, 186, 12);
      g.strokeRect(44, 112, 84, 27);
      for (var i = 0; i < 3; i++) g.strokeRect(44 + i * 146, 178, 124, 82);
      g.fillRect(44, 282, 424, 6);
      return tex(c);
    }

    /* the one that survives: composed, asymmetric, and the only colour in the world */
    function directedTexture() {
      var c = doc.createElement("canvas"); c.width = 512; c.height = 320;
      var g = c.getContext("2d");
      g.fillStyle = "#0B0D11"; g.fillRect(0, 0, 512, 320);
      g.fillStyle = "#FF4A1C"; g.fillRect(-30, 34, 196, 286);
      g.save(); g.translate(322, 176); g.rotate(-0.30);
      g.fillStyle = "#E9EBEF"; g.fillRect(-124, -17, 344, 34); g.restore();
      g.strokeStyle = "#3FD8C0"; g.lineWidth = 4;
      g.beginPath(); g.moveTo(196, 296); g.lineTo(496, 244); g.stroke();
      g.fillStyle = "#E9EBEF";
      g.fillRect(238, 52, 156, 14); g.fillRect(238, 78, 82, 14);
      g.fillStyle = "rgba(233,235,239,.42)"; g.fillRect(420, 52, 58, 8);
      g.fillStyle = "#3FD8C0"; g.fillRect(238, 118, 34, 34);
      g.strokeStyle = "rgba(233,235,239,.7)"; g.lineWidth = 5; g.strokeRect(3, 3, 506, 314);
      return tex(c);
    }

    function lineTexture(str, hex) {
      var c = doc.createElement("canvas"); c.width = 512; c.height = 72;
      var g = c.getContext("2d");
      g.font = '500 30px "Martian Mono", ui-monospace, monospace';
      g.textBaseline = "middle";
      g.fillStyle = hex || "#B9C2CE";
      g.fillText(str, 6, 38);
      return tex(c);
    }

    var group = new THREE.Group(); scene.add(group);
    var m4 = new THREE.Matrix4(), q = new THREE.Quaternion(), e = new THREE.Euler();
    var pos = new THREE.Vector3(), scl = new THREE.Vector3(1, 1, 1), col = new THREE.Color();
    var rnd = function (n) { return (Math.random() - 0.5) * n; };
    var pickable = [];

    /* --------- chamber one: the corridor of identical pages (z 0 to -95) --------- */
    var GAP_Z = 3.5, CELL_X = 2.62, CELL_Y = 1.92;
    var COLS = small ? 5 : 7, ROWS = 5;
    var HC = (COLS - 1) / 2, HR = (ROWS - 1) / 2;
    var avgMap = averageTexture();

    function lattice(layers, z0, gap) {
      var cells = [];
      for (var L = 0; L < layers; L++)
        for (var cx = -HC; cx <= HC; cx++)
          for (var cy = -HR; cy <= HR; cy++) {
            if (cx === 0 && Math.abs(cy) <= 1) continue;      // hollow the flight path
            cells.push([cx, cy, z0 - L * gap]);
          }
      var mesh = new THREE.InstancedMesh(
        new THREE.PlaneGeometry(1.94, 1.21),
        new THREE.MeshBasicMaterial({ map: avgMap, alphaTest: 0.42, side: THREE.DoubleSide }),
        cells.length
      );
      var zs = new Float32Array(cells.length);
      for (var i = 0; i < cells.length; i++) {
        var c = cells[i];
        zs[i] = c[2] + rnd(0.5);
        pos.set(c[0] * CELL_X + rnd(0.22), c[1] * CELL_Y + rnd(0.16), zs[i]);
        e.set(rnd(0.05), -c[0] * 0.13 + rnd(0.05), rnd(0.03));
        m4.compose(pos, q.setFromEuler(e), scl);
        mesh.setMatrixAt(i, m4);
        var v = 0.30 + Math.random() * 0.24;
        mesh.setColorAt(i, col.setRGB(v, v * 1.03, v * 1.12));
      }
      mesh.instanceMatrix.needsUpdate = true;
      if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
      mesh.userData.zs = zs;
      group.add(mesh); pickable.push(mesh);
      return mesh;
    }

    var avgMesh = lattice(small ? 17 : 28, 0, GAP_Z);

    /* --------- chamber two: the registry (z -102 to -160) --------- */
    var TELLS = [
      "EM DASHES", "COUNT UP ANIMATIONS", "PURPLE GRADIENT HERO", "GRADIENT TEXT",
      "HERO + THREE CARDS", "GLASSMORPHISM", "FABRICATED TESTIMONIALS", "STOCK PHOTO SMILES",
      "FLOATING 3D BLOB", "ELEVATE YOUR BRAND", "CENTERED EVERYTHING", "INTER, ALWAYS",
      "NEON ON NEAR BLACK", "FAKE BROWSER CHROME", "SEAMLESS AND ROBUST", "PILL BUTTONS"
    ];
    var tellMats = TELLS.map(function (t) {
      return new THREE.MeshBasicMaterial({ map: lineTexture(t), alphaTest: 0.3, side: THREE.DoubleSide });
    });
    var stripGeo = new THREE.PlaneGeometry(5.2, 0.73);
    var strikeGeo = new THREE.PlaneGeometry(1, 0.055).translate(0.5, 0, 0);
    var strikeMat = new THREE.MeshBasicMaterial({ color: 0xFF4A1C });
    var strips = [];
    var REG_Z0 = -102, REG_COLS = small ? 6 : 9, REG_GAP = 6.4;
    var REG_ROWS = [-2.8, -0.35, 2.1];
    var k = 0;
    for (var wsi = 0; wsi < 2; wsi++) {
      var sideX = wsi === 0 ? -6.4 : 6.4;
      for (var cIdx = 0; cIdx < REG_COLS; cIdx++) {
        for (var rIdx = 0; rIdx < REG_ROWS.length; rIdx++) {
          var s = new THREE.Mesh(stripGeo, tellMats[k % tellMats.length]); k++;
          var sz = REG_Z0 - cIdx * REG_GAP - (rIdx * 1.7);
          s.position.set(sideX, REG_ROWS[rIdx] + rnd(0.3), sz);
          s.rotation.y = wsi === 0 ? Math.PI / 2 : -Math.PI / 2;
          var strike = new THREE.Mesh(strikeGeo, strikeMat);
          strike.position.set(-2.6, 0, 0.02);
          strike.scale.x = 0.0001;
          s.add(strike);
          s.userData = { z: sz, strike: strike, done: false };
          group.add(s); strips.push(s); pickable.push(s);
        }
      }
    }

    /* --------- chamber three: the method, light travelling with you (z -164 to -196) --------- */
    var methodMesh = lattice(small ? 6 : 10, -164, GAP_Z);
    var methodZs = methodMesh.userData.zs;
    var methodBase = new Float32Array(methodZs.length);
    for (var mi = 0; mi < methodZs.length; mi++) methodBase[mi] = 0.13 + Math.random() * 0.07;

    /* --------- chamber four: the ledger rings (z -200 to -222) --------- */
    var AXES = ["GROUND", "FACE", "BONES", "MOTION", "SIGNATURE", "PALETTE", "RHYTHM", "VOICE",
                "IMAGERY", "SCALE", "TEXTURE", "GRID", "ACCENT", "DEPTH", "CONTRAST", "SPACING"];
    var axisMats = AXES.map(function (a) {
      return new THREE.MeshBasicMaterial({ map: lineTexture(a, "#D2DAE4"), alphaTest: 0.3, side: THREE.DoubleSide });
    });
    var rowGeo = new THREE.PlaneGeometry(3.05, 0.43);
    var rings = [];
    var RING_Z = [-202, -212, -222, -232], RING_N = small ? 11 : 15;
    var RING_R = [4.4, 5.3, 4.0, 5.9];
    for (var ri = 0; ri < RING_Z.length; ri++) {
      var ring = new THREE.Group();
      ring.position.z = RING_Z[ri];
      for (var n = 0; n < RING_N; n++) {
        var a = (n / RING_N) * Math.PI * 2 + ri * 0.21;
        var row = new THREE.Mesh(rowGeo, axisMats[(n + ri * 3) % axisMats.length]);
        row.position.set(Math.cos(a) * RING_R[ri], Math.sin(a) * RING_R[ri], 0);
        /* face the incoming camera and run along the tangent, flipping the top half
           so every word stays the right way up around the dial */
        row.rotation.z = a + (Math.sin(a) > 0 ? -Math.PI / 2 : Math.PI / 2);
        ring.add(row);
      }
      ring.userData.spin = (ri % 2 ? -1 : 1) * (0.05 + ri * 0.012);
      group.add(ring); rings.push(ring);
    }

    /* --------- waypoint frames, one per beat --------- */
    var frameMat = new THREE.LineBasicMaterial({ color: 0x333B46 });
    var tickMat = new THREE.LineBasicMaterial({ color: 0xFF4A1C, transparent: true, opacity: 0.55 });
    function rectPts(w, h) { var x = w / 2, y = h / 2; return [-x, -y, 0, x, -y, 0, x, y, 0, -x, y, 0]; }
    for (var f = 0; f < beats.length; f++) {
      var fz = START_Z + (END_Z - START_Z) * ((f + 0.55) / beats.length);
      var gl = new THREE.BufferGeometry();
      gl.setAttribute("position", new THREE.Float32BufferAttribute(rectPts(13.6, 8.4), 3));
      var loop = new THREE.LineLoop(gl, frameMat); loop.position.z = fz; group.add(loop);
      var tp = [], X = 6.8, Y = 4.2, kk = 1.05;
      [[-1, -1], [1, -1], [1, 1], [-1, 1]].forEach(function (sg) {
        tp.push(sg[0] * X, sg[1] * Y, 0, sg[0] * (X - kk), sg[1] * Y, 0);
        tp.push(sg[0] * X, sg[1] * Y, 0, sg[0] * X, sg[1] * (Y - kk * 0.72), 0);
      });
      var gt = new THREE.BufferGeometry();
      gt.setAttribute("position", new THREE.Float32BufferAttribute(tp, 3));
      var ticks = new THREE.LineSegments(gt, tickMat); ticks.position.z = fz; group.add(ticks);
    }

    /* --------- chamber five: the destination --------- */
    var oneMat = new THREE.MeshBasicMaterial({
      map: directedTexture(), side: THREE.DoubleSide, fog: false, transparent: true, opacity: 0
    });
    var one = new THREE.Mesh(new THREE.PlaneGeometry(5.6, 3.5), oneMat);
    one.position.set(-2.4, -0.15, END_Z - 8.5);
    scene.add(one);

    /* --------- camera + interaction --------- */
    var camZ = null, tx = 0, ty = 0, cx2 = 0, cy2 = 0;
    win.addEventListener("pointermove", function (ev) {
      tx = (ev.clientX / win.innerWidth) * 2 - 1;
      ty = (ev.clientY / win.innerHeight) * 2 - 1;
    }, { passive: true });

    var ray = new THREE.Raycaster(), ndc = new THREE.Vector2(), gone = {};
    var stamp = new THREE.Color(0xFF4A1C);
    canvas.addEventListener("pointerdown", function (ev) {
      ndc.x = (ev.clientX / win.innerWidth) * 2 - 1;
      ndc.y = -(ev.clientY / win.innerHeight) * 2 + 1;
      ray.setFromCamera(ndc, camera);
      var hit = ray.intersectObjects(pickable, false)[0];
      if (!hit) return;
      var o = hit.object;
      if (o.isInstancedMesh) {
        var key = o.id + ":" + hit.instanceId;
        if (hit.instanceId == null || gone[key]) return;
        gone[key] = 1;
        o.setColorAt(hit.instanceId, stamp);
        if (o.instanceColor) o.instanceColor.needsUpdate = true;
        if (o === methodMesh) methodBase[hit.instanceId] = -1;   // stays refused, stops pulsing
        bumpRefused();
      } else if (o.userData && o.userData.strike && !o.userData.done) {
        o.userData.done = true;
        o.userData.strike.scale.x = 5.2;
        bumpRefused();
      }
    });

    function resize() {
      var w = win.innerWidth, h = win.innerHeight;
      renderer.setSize(w, h, false);
      camera.aspect = w / h; camera.updateProjectionMatrix();
    }
    resize(); win.addEventListener("resize", resize);
    root.classList.add("world-on");

    var running = false, t0 = performance.now();
    function frame() {
      if (!running) return;
      requestAnimationFrame(frame);
      var t = (performance.now() - t0) / 1000;

      if (reduce) {
        camZ = -6;
        camera.position.set(0, 0, camZ);
        camera.lookAt(0, 0, camZ - 10);
      } else {
        /* the flight completes as the reveal beat lands, then the camera creeps
           so the last beats play out in front of the destination */
        var p = state.prog, pf = Math.min(1, p / ARRIVE);
        var want = START_Z + (END_Z - START_Z) * pf + Math.max(0, p - ARRIVE) / (1 - ARRIVE) * -3.2;
        camZ = (camZ === null) ? want : camZ + (want - camZ) * 0.075;
        cx2 += (tx * 1.25 - cx2) * 0.045;
        cy2 += (-ty * 0.82 - cy2) * 0.045;
        camera.position.set(cx2, cy2, camZ);
        camera.lookAt(cx2 * 0.42, cy2 * 0.42, camZ - 11);
        group.rotation.z = Math.sin(t * 0.11) * 0.009;
      }

      /* the registry strikes itself out as you pass */
      for (var i = 0; i < strips.length; i++) {
        var sp = strips[i], d = camZ - sp.userData.z;
        if (d < -30 || d > 46) continue;
        if (sp.userData.done) continue;
        var tt = clamp((14 - d) / 14, 0, 1);
        sp.userData.strike.scale.x = Math.max(0.0001, tt * 5.2);
        if (tt >= 1) sp.userData.done = true;
      }

      /* the method chamber lights up around you as decisions get made */
      if (methodMesh.instanceColor) {
        var changed = false;
        for (var j = 0; j < methodZs.length; j++) {
          var b = methodBase[j];
          if (b < 0) continue;
          var dz = Math.abs(methodZs[j] - camZ);
          if (dz > 26) continue;
          var lit = dz < 15 ? (1 - dz / 15) : 0;
          var v = b + lit * 0.6;
          methodMesh.setColorAt(j, col.setRGB(v, v * 1.02, v * 1.08));
          changed = true;
        }
        if (changed) methodMesh.instanceColor.needsUpdate = true;
      }

      for (var r = 0; r < rings.length; r++) rings[r].rotation.z = t * rings[r].userData.spin;

      oneMat.opacity += ((state.one ? 1 : 0) - oneMat.opacity) * 0.045;
      one.rotation.y = Math.sin(t * 0.24) * 0.10;

      renderer.render(scene, camera);
    }
    function start() { if (!running) { running = true; frame(); } }
    function stop() { running = false; }
    doc.addEventListener("visibilitychange", function () { doc.hidden ? stop() : start(); });
    start();

  }).catch(function () {
    root.classList.remove("world-on");
  });
})();
