/* Nine acts, nine worlds. Each owns its own geometry, camera grammar, projection,
 * scale and palette. Two of them are DOM only and appear here as stubs so the
 * engine still counts them. Nothing is shared between acts except the chrome. */

import {
  makeTexture, averagePageTexture, directedPageTexture, rowTexture, radialShadow,
  ease, easeOut, clamp01, lerp, mulberry32
} from "./world.js";

var TAU = Math.PI * 2;

/* ============================================================================
 * 01 — THE DEFAULT ROOM
 * You are standing inside the average website before you realise that is what it is.
 * Camera: one straight backward dolly, zero rotation. Scale: one room. No accent.
 * ========================================================================== */
export const actRoom = {
  id: "room", accent: null, bg: 0x1A1C20, fov: 38, restT: 0.85,
  fog: function (T) { return new T.FogExp2(0x1A1C20, 0.028); },

  build: function (ctx) {
    var T = ctx.THREE, root = ctx.root, S = ctx.actState;
    var W = 14, H = 6, zNear = 26, zFar = -13;
    var wallMat = new T.MeshLambertMaterial({ color: 0x2A2C31, side: T.DoubleSide });

    function plane(w, h, pos, rot) {
      var m = new T.Mesh(new T.PlaneGeometry(w, h), wallMat);
      m.position.set(pos[0], pos[1], pos[2]);
      m.rotation.set(rot[0], rot[1], rot[2]);
      root.add(m);
      return m;
    }
    var len = zNear - zFar, cz = (zNear + zFar) / 2;
    plane(W, len, [0, -H / 2, cz], [-Math.PI / 2, 0, 0]);          // floor
    plane(W, len, [0, H / 2, cz], [Math.PI / 2, 0, 0]);            // ceiling
    plane(len, H, [-W / 2, 0, cz], [0, Math.PI / 2, 0]);           // left
    plane(len, H, [W / 2, 0, cz], [0, -Math.PI / 2, 0]);           // right

    /* hairline seams, so the box reads as built rather than as a void */
    var edges = new T.LineSegments(
      new T.EdgesGeometry(new T.BoxGeometry(W, H, len)),
      new T.LineBasicMaterial({ color: 0x4A4E56 })
    );
    edges.position.z = cz;
    root.add(edges);

    /* the one page on the wall, then 200 of it in dead alignment behind.
       each clone is scaled by its distance so it projects to the same rectangle:
       from head on you still see exactly one page. */
    var REF = 4, z0 = -11, step = 0.62;
    var N = ctx.small ? 110 : 200;
    var panel = new T.InstancedMesh(
      new T.PlaneGeometry(3.2, 1.8),
      new T.MeshLambertMaterial({
        map: averagePageTexture(T, ctx.renderer, "#AEB6C0", "#35383F"),
        side: T.DoubleSide
      }),
      N
    );
    var m4 = new T.Matrix4(), q = new T.Quaternion(), v = new T.Vector3(), s = new T.Vector3();
    var d0 = REF - z0;
    for (var i = 0; i < N; i++) {
      var z = z0 - i * step;
      var k = (REF - z) / d0;
      v.set(0, 0.35, z); s.set(k, k, 1);
      m4.compose(v, q, s);
      panel.setMatrixAt(i, m4);
    }
    panel.instanceMatrix.needsUpdate = true;
    panel.count = 1;
    root.add(panel);
    S.panel = panel; S.N = N;

    /* the glow the clones make once there are too many to see individually */
    var glow = new T.Mesh(
      new T.PlaneGeometry(60, 34),
      new T.MeshBasicMaterial({ color: 0x8C939E, transparent: true, opacity: 0 })
    );
    glow.position.set(0, 0.35, z0 - N * step * 0.55);
    root.add(glow);
    S.glow = glow;

    var ceil = new T.PointLight(0xDCE2EA, 120, 30, 2);
    ceil.position.set(0, H / 2 - 0.4, 2);
    root.add(ceil);
    S.ceil = ceil;
    /* a second, dimmer source on the wall, so the one page is legible as the subject */
    var onPanel = new T.PointLight(0xC9D2DC, 26, 14, 2);
    onPanel.position.set(0, 1.2, -7.5);
    root.add(onPanel);
    S.onPanel = onPanel;
    root.add(new T.AmbientLight(0x4A4E56, 1.15));
  },

  camera: function (ctx) {
    var c = ctx.camera, p = ease(ctx.t);
    c.position.set(0, 0, lerp(4, 22, p));       /* pure translation, no rotation anywhere */
    c.rotation.set(0, 0, 0);
    c.fov = lerp(38, 52, p);
    c.updateProjectionMatrix();
  },

  frame: function (ctx) {
    var S = ctx.actState, t = ctx.t;
    var k = clamp01((t - 0.42) / 0.48);
    S.panel.count = 1 + Math.floor(k * (S.N - 1));
    S.glow.material.opacity = k * 0.1;
    S.ceil.intensity = lerp(90, 14, clamp01((t - 0.86) / 0.14));
  }
};

/* 02 — THE REGISTRY. Paper, ink, redaction. Pure DOM, no canvas. */
export const actRegistry = { id: "registry", accent: "#B82A14", dom: true };

/* ============================================================================
 * 03 — THE ASSEMBLY FLOOR
 * How the sameness is manufactured: a machine the size of a shoebox, from above.
 * Camera: the only orbit on the page, long lens. Scale: tabletop. Accent: ice.
 * ========================================================================== */
export const actFloor = {
  id: "floor", accent: "#6FD3FF", bg: 0x08090B, fov: 28, restT: 0.75,
  fog: function () { return null; },

  build: function (ctx) {
    var T = ctx.THREE, root = ctx.root, S = ctx.actState, small = ctx.small;
    var ICE = 0x6FD3FF;

    var plan = makeTexture(T, ctx.renderer, 1024, 1024, function (g, w, h) {
      g.fillStyle = "#0D1116"; g.fillRect(0, 0, w, h);
      g.strokeStyle = "rgba(111,211,255,.22)"; g.lineWidth = 2;
      for (var i = 0; i <= 32; i++) {
        var u = (i / 32) * w;
        g.beginPath(); g.moveTo(u, 0); g.lineTo(u, h); g.stroke();
        g.beginPath(); g.moveTo(0, u); g.lineTo(w, u); g.stroke();
      }
      g.fillStyle = "rgba(111,211,255,.10)";
      g.fillRect(90, 120, 380, 240); g.fillRect(560, 150, 330, 300); g.fillRect(180, 640, 620, 220);
      g.strokeStyle = "rgba(111,211,255,.55)"; g.setLineDash([4, 6]); g.lineWidth = 3;
      for (var j = 0; j < 14; j++) {
        g.beginPath(); g.moveTo(560 + j * 26, 640); g.lineTo(560 + j * 26 + 90, 900); g.stroke();
      }
      g.setLineDash([]);
      g.font = '600 18px "Martian Mono", ui-monospace, monospace';
      g.fillStyle = "rgba(150,225,255,.85)";
      for (var b = 0; b < 8; b++) g.fillText("BAY " + (b + 1), 100 + (b % 4) * 230, 80 + Math.floor(b / 4) * 500);
    });

    var slab = new T.Mesh(new T.BoxGeometry(20, 0.7, 14),
      new T.MeshLambertMaterial({ color: 0x232932 }));
    slab.position.y = -0.35;
    root.add(slab);
    var top = new T.Mesh(new T.PlaneGeometry(20, 14), new T.MeshBasicMaterial({ map: plan }));
    top.rotation.x = -Math.PI / 2; top.position.y = 0.011;
    root.add(top);

    var lipMat = new T.MeshLambertMaterial({ color: 0x232830 });
    [[0, 0.35, 7.1, 20.4, 0.7, 0.4], [0, 0.35, -7.1, 20.4, 0.7, 0.4],
     [10.1, 0.35, 0, 0.4, 0.7, 14.6], [-10.1, 0.35, 0, 0.4, 0.7, 14.6]].forEach(function (L) {
      var m = new T.Mesh(new T.BoxGeometry(L[3], L[4], L[5]), lipMat);
      m.position.set(L[0], L[1], L[2]); root.add(m);
    });

    /* two rails carrying the identical product */
    var railMat = new T.MeshLambertMaterial({ color: 0x2E3641 });
    [-1.5, 1.5].forEach(function (z) {
      var r = new T.Mesh(new T.BoxGeometry(17, 0.22, 0.5), railMat);
      r.position.set(0, 0.5, z); root.add(r);
    });

    var NP = small ? 60 : 120;
    var panels = new T.InstancedMesh(
      new T.PlaneGeometry(2.0, 1.25),
      new T.MeshBasicMaterial({
        map: averagePageTexture(T, ctx.renderer, "#B6E4FA"), alphaTest: 0.4, side: T.DoubleSide
      }), NP);
    root.add(panels);
    S.panels = { mesh: panels, n: NP, m4: new T.Matrix4(), v: new T.Vector3(),
                 q: new T.Quaternion(), s: new T.Vector3(1, 1, 1),
                 e: new T.Euler(-Math.PI / 2, 0, 0) };
    S.stamped = new T.Color(0xFF3B21);
    S.plain = new T.Color(0x9FD8F2);
    for (var i = 0; i < NP; i++) panels.setColorAt(i, S.plain);
    if (panels.instanceColor) panels.instanceColor.needsUpdate = true;

    /* the press */
    var press = new T.Group();
    var frame = new T.Mesh(new T.BoxGeometry(2.6, 3.6, 3.4),
      new T.MeshLambertMaterial({ color: 0x3A4552 }));
    frame.position.y = 2.4; press.add(frame);
    var arm = new T.Mesh(new T.BoxGeometry(2.2, 1.0, 2.8),
      new T.MeshLambertMaterial({ color: 0x55636F }));
    arm.position.y = 1.4; press.add(arm);
    press.position.set(3.4, 0.4, 0);
    root.add(press);
    S.arm = arm;

    /* the column that feeds it */
    var col = new T.Mesh(new T.CylinderGeometry(0.6, 0.75, 7, 18, 1, true),
      new T.MeshBasicMaterial({ color: ICE, transparent: true, opacity: 0.4, side: T.DoubleSide }));
    col.position.set(-6.5, 3.5, 0); root.add(col);
    var colCore = new T.Mesh(new T.CylinderGeometry(0.22, 0.22, 7.2, 12),
      new T.MeshBasicMaterial({ color: 0xE6F7FF }));
    colCore.position.copy(col.position); root.add(colCore);
    S.col = col;

    /* trusses and bolts, the detail that makes it read as a machine */
    var truss = new T.InstancedMesh(new T.BoxGeometry(0.14, 0.14, 14),
      new T.MeshLambertMaterial({ color: 0x2A323C }), 12);
    var m4 = new T.Matrix4(), q = new T.Quaternion(), v = new T.Vector3(), s = new T.Vector3(1, 1, 1);
    for (var t2 = 0; t2 < 12; t2++) {
      v.set(-8.6 + t2 * 1.6, 6.4, 0);
      m4.compose(v, q, s); truss.setMatrixAt(t2, m4);
    }
    truss.instanceMatrix.needsUpdate = true; root.add(truss);

    var bolt = new T.InstancedMesh(new T.CylinderGeometry(0.09, 0.09, 0.16, 8),
      new T.MeshLambertMaterial({ color: 0x424B57 }), 60);
    var rnd = mulberry32(7);
    for (var b2 = 0; b2 < 60; b2++) {
      v.set((rnd() - 0.5) * 19, 0.08, (rnd() - 0.5) * 13);
      m4.compose(v, q, s); bolt.setMatrixAt(b2, m4);
    }
    bolt.instanceMatrix.needsUpdate = true; root.add(bolt);

    /* the machine is drawn, not just lit: ice outlines on every solid, so it reads crisp
       against the void instead of dissolving into one soft blue mass */
    var edgeMat = new T.LineBasicMaterial({ color: ICE, transparent: true, opacity: 0.55 });
    [[20, 0.7, 14, 0, -0.35, 0], [2.6, 3.6, 3.4, 3.4, 2.8, 0], [2.2, 1.0, 2.8, 3.4, 1.8, 0]]
      .forEach(function (B) {
        var ln = new T.LineSegments(
          new T.EdgesGeometry(new T.BoxGeometry(B[0], B[1], B[2])), edgeMat);
        ln.position.set(B[3], B[4], B[5]); root.add(ln);
      });

    root.add(new T.HemisphereLight(0x6E93B0, 0x0B1016, 1.1));
    var pl = new T.PointLight(ICE, 300, 34, 2); pl.position.set(-6.5, 3.5, 0); root.add(pl);
    var key = new T.DirectionalLight(0xE6F4FF, 2.6); key.position.set(11, 18, 9); root.add(key);
    var fill = new T.DirectionalLight(0x6E93B0, 0.5); fill.position.set(-12, 8, -6); root.add(fill);
  },

  camera: function (ctx) {
    var c = ctx.camera, p = ease(ctx.t);
    /* the only orbit on the page: a long lens, a fixed 40 degree elevation, azimuth sweeping */
    var az = lerp(-0.62, 0.42, p), rad = lerp(48, 31, p), el = 40 * Math.PI / 180;
    c.position.set(
      Math.sin(az) * rad * Math.cos(el),
      Math.sin(el) * rad,
      Math.cos(az) * rad * Math.cos(el)
    );
    c.lookAt(3.4, 1.0, 0);        /* the machine sits left of the copy column */
  },

  frame: function (ctx) {
    var S = ctx.actState, t = ctx.t, clock = ctx.clock;
    var P = S.panels, span = 17;
    for (var i = 0; i < P.n; i++) {
      var x = ((i / P.n) * span + clock * 2.2) % span - span / 2;
      P.v.set(x, 0.66, (i % 2 ? 1.5 : -1.5));
      P.q.setFromEuler(P.e);
      P.m4.compose(P.v, P.q, P.s);
      P.mesh.setMatrixAt(i, P.m4);
    }
    P.mesh.instanceMatrix.needsUpdate = true;

    /* the press punches, and one page is refused */
    var punch = t > 0.66 ? Math.max(0, Math.sin((clock * 2.4) % Math.PI)) : 0;
    S.arm.position.y = 1.4 - punch * 0.85;
    S.col.material.opacity = 0.34 + Math.sin(clock * 1.9) * 0.09;

    if (t > 0.70 && !S.didStamp) {
      S.didStamp = true;
      for (var k = 0; k < P.n; k += 9) P.mesh.setColorAt(k, S.stamped);
      if (P.mesh.instanceColor) P.mesh.instanceColor.needsUpdate = true;
      if (ctx.hooks.onRefuse) ctx.hooks.onRefuse(Math.ceil(P.n / 9));
    }
  }
};

/* ============================================================================
 * 04 — THE OUTPUT RUN
 * On the belt. The fastest camera on the page and the only forward flight.
 * Scale: inside a tube. Accent: vermilion. This is the interaction that earned its place.
 * ========================================================================== */
export const actRun = {
  id: "run", accent: "#FF3B21", bg: 0x111318, fov: 62, restT: 0.5,
  fog: function (T) { return new T.FogExp2(0x111318, 0.032); },

  build: function (ctx) {
    var T = ctx.THREE, root = ctx.root, S = ctx.actState, small = ctx.small;
    var GAP = 3.4, CX = 2.7, CY = 1.95;
    var COLS = small ? 5 : 7, ROWS = 5, LAYERS = small ? 16 : 26;
    var HC = (COLS - 1) / 2, HR = (ROWS - 1) / 2;
    var cells = [];
    for (var L = 0; L < LAYERS; L++)
      for (var cx = -HC; cx <= HC; cx++)
        for (var cy = -HR; cy <= HR; cy++) {
          if (cx === 0 && Math.abs(cy) <= 1) continue;
          cells.push([cx, cy, -L * GAP]);
        }

    var mesh = new T.InstancedMesh(
      new T.PlaneGeometry(1.94, 1.21),
      new T.MeshBasicMaterial({
        map: averagePageTexture(T, ctx.renderer, "#DCE3EC"), alphaTest: 0.42, side: T.DoubleSide
      }), cells.length);
    var m4 = new T.Matrix4(), q = new T.Quaternion(), e = new T.Euler();
    var v = new T.Vector3(), s = new T.Vector3(1, 1, 1), col = new T.Color();
    var rnd = mulberry32(11);
    for (var i = 0; i < cells.length; i++) {
      var c = cells[i];
      v.set(c[0] * CX + (rnd() - 0.5) * 0.22, c[1] * CY + (rnd() - 0.5) * 0.16, c[2] + (rnd() - 0.5) * 0.5);
      e.set((rnd() - 0.5) * 0.05, -c[0] * 0.13, (rnd() - 0.5) * 0.03);
      m4.compose(v, q.setFromEuler(e), s);
      mesh.setMatrixAt(i, m4);
      var g = 0.30 + rnd() * 0.24;
      mesh.setColorAt(i, col.setRGB(g, g * 1.03, g * 1.12));
    }
    mesh.instanceMatrix.needsUpdate = true;
    if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
    root.add(mesh);
    ctx.pickable.push(mesh);

    /* speed streaks, so the rush is felt and not just measured */
    var STR = small ? 90 : 200;
    var streak = new T.InstancedMesh(new T.BoxGeometry(0.015, 0.015, 3),
      new T.MeshBasicMaterial({ color: 0x9AA4B2, transparent: true, opacity: 0.35 }), STR);
    for (var k = 0; k < STR; k++) {
      var a = rnd() * TAU, r = 2.4 + rnd() * 7;
      v.set(Math.cos(a) * r, Math.sin(a) * r * 0.62, -rnd() * LAYERS * GAP);
      m4.compose(v, q.setFromEuler(e.set(0, 0, 0)), s);
      streak.setMatrixAt(k, m4);
    }
    streak.instanceMatrix.needsUpdate = true;
    root.add(streak);

    S.mesh = mesh; S.end = -(LAYERS - 1) * GAP; S.gone = {};
    S.stamp = new T.Color(0xFF3B21); S.count = cells.length;
  },

  pick: function (ctx, hit) {
    var S = ctx.actState;
    if (hit.instanceId == null || S.gone[hit.instanceId]) return;
    S.gone[hit.instanceId] = 1;
    S.mesh.setColorAt(hit.instanceId, S.stamp);
    if (S.mesh.instanceColor) S.mesh.instanceColor.needsUpdate = true;
    if (ctx.hooks.onRefuse) ctx.hooks.onRefuse(1);
  },

  camera: function (ctx) {
    var c = ctx.camera, S = ctx.actState;
    /* front loaded: most of the distance early, so it decelerates into the exit */
    var p = easeOut(ctx.t);
    var z = lerp(6, S.end - 6, p);
    c.position.set(ctx.pointer.x * 1.15, ctx.pointer.y * -0.7, z);
    c.rotation.z = Math.sin(ctx.clock * 1.6) * 0.014;
    c.lookAt(ctx.pointer.x * 0.5, ctx.pointer.y * -0.3, z - 11);
  }
};

/* ============================================================================
 * 05 — THE INSTRUMENT
 * Mercury's lesson taken literally: the object is built from the product's own material.
 * Camera: dead still, only the lens breathes. Scale: arm's length. Accent: phosphor.
 * ========================================================================== */
export const actInstrument = {
  id: "instrument", accent: "#7BE38A", bg: 0x08090B, fov: 34, restT: 0.6,
  fog: function () { return null; },

  build: function (ctx) {
    var T = ctx.THREE, root = ctx.root, S = ctx.actState, small = ctx.small;
    var FIELDS = [
      ["TYPE SCALE", "MOTION", "CONTRAST", "GRID"],
      ["GROUND", "ACCENT", "RHYTHM", "WEIGHT"],
      ["TEXTURE", "DEPTH", "SPACING", "VOICE"]
    ];
    var rings = [];

    /* four instanced batches per ring, so a 144 row instrument costs 12 draw calls */
    function ring(radius, count, tiltX, tiltY, w, h, labels) {
      var g = new T.Group();
      var per = Math.ceil(count / labels.length);
      var batches = [];
      var m4 = new T.Matrix4(), q = new T.Quaternion(), e = new T.Euler();
      var v = new T.Vector3(), s = new T.Vector3(1, 1, 1);
      var idx = 0;
      labels.forEach(function (label) {
        var n = Math.min(per, count - idx);
        if (n <= 0) return;
        var im = new T.InstancedMesh(
          new T.PlaneGeometry(w, h),
          new T.MeshBasicMaterial({
            map: rowTexture(T, ctx.renderer, label, "#D6DEE6"),
            transparent: true, opacity: 0.26, side: T.DoubleSide, depthWrite: false
          }), n);
        for (var k = 0; k < n; k++, idx++) {
          var a = (idx / count) * TAU;
          v.set(Math.cos(a) * radius, Math.sin(a) * radius, 0);
          e.set(0, 0, a + (Math.sin(a) > 0 ? -Math.PI / 2 : Math.PI / 2));
          m4.compose(v, q.setFromEuler(e), s);
          im.setMatrixAt(k, m4);
        }
        im.instanceMatrix.needsUpdate = true;
        g.add(im); batches.push(im);
      });

      var pts = [];
      for (var i = 0; i <= 96; i++) {
        var a2 = (i / 96) * TAU;
        pts.push(new T.Vector3(Math.cos(a2) * radius, Math.sin(a2) * radius, 0));
      }
      var loop = new T.Line(new T.BufferGeometry().setFromPoints(pts),
        new T.LineBasicMaterial({ color: 0xE9EBEF, transparent: true, opacity: 0.28 }));
      g.add(loop);
      g.userData = { batches: batches, loop: loop };
      g.rotation.x = tiltX; g.rotation.y = tiltY;
      root.add(g); rings.push(g);
      return g;
    }

    ring(5.0, small ? 40 : 64, 0, 0, 0.95, 0.24, FIELDS[0]);
    ring(3.6, small ? 30 : 48, 62 * Math.PI / 180, 0, 0.8, 0.2, FIELDS[1]);
    ring(2.4, small ? 20 : 32, -38 * Math.PI / 180, 0.4, 0.66, 0.17, FIELDS[2]);

    /* six cubes carry the mark that means refused */
    var cubes = new T.InstancedMesh(new T.BoxGeometry(0.16, 0.16, 0.16),
      new T.MeshBasicMaterial({ color: 0xFF3B21 }), 6);
    var m4 = new T.Matrix4(), q2 = new T.Quaternion(), v = new T.Vector3(), s = new T.Vector3(1, 1, 1);
    for (var i = 0; i < 6; i++) {
      var a = (i / 6) * TAU;
      v.set(Math.cos(a) * 2.4, Math.sin(a) * 2.4, 0);
      m4.compose(v, q2, s); cubes.setMatrixAt(i, m4);
    }
    cubes.instanceMatrix.needsUpdate = true;
    rings[2].add(cubes);

    S.rings = rings;
    root.add(new T.AmbientLight(0xffffff, 1));
  },

  camera: function (ctx) {
    var c = ctx.camera;
    /* never moves, and sits off axis so the instrument holds the frame beside the copy */
    c.position.set(3.6, 0, 20);
    c.rotation.set(0, 0, 0);
    c.fov = lerp(34, 31, ctx.t);
    c.updateProjectionMatrix();
  },

  frame: function (ctx) {
    var S = ctx.actState, t = ctx.t;
    /* spin is driven by scroll, not the clock, so scrolling back unwinds it exactly */
    S.rings[0].rotation.z = t * 2.1;
    S.rings[1].rotation.z = -t * 2.8;
    S.rings[2].rotation.z = t * 3.6;
    /* three sub beats: each ring in turn hard cuts from outline to solid phosphor */
    var active = t < 0.34 ? 0 : t < 0.67 ? 1 : 2;
    for (var i = 0; i < 3; i++) {
      var on = i === active, ud = S.rings[i].userData;
      ud.loop.material.opacity = on ? 0.55 : 0.12;
      for (var b = 0; b < ud.batches.length; b++) {
        var m = ud.batches[b].material;
        m.opacity = on ? 0.95 : 0.15;
        m.color.set(on ? 0x7BE38A : 0xE9EBEF);
      }
    }
  }
};

/* ============================================================================
 * 06 — THE KILN
 * One slab bisected by a rising bar of light. Cold blueprint below, warm solid above.
 * Camera: the only vertical crane on the page. Scale: a 16m hall. Accent: ember + ice.
 * ========================================================================== */
export const actKiln = {
  id: "kiln", accent: "#FF7A18", bg: 0x0F0B07, fov: 46, restT: 0.7,
  fog: function (T) { return new T.FogExp2(0x0F0B07, 0.026); },

  build: function (ctx) {
    var T = ctx.THREE, root = ctx.root, S = ctx.actState, small = ctx.small;

    var wood = makeTexture(T, ctx.renderer, 512, 512, function (g, w, h) {
      g.fillStyle = "#4A3A2A"; g.fillRect(0, 0, w, h);
      for (var i = 0; i < 380; i++) {
        var x = Math.random() * w, jit = (Math.random() - 0.5) * 0.16;
        g.fillStyle = "rgba(" + Math.round(74 * (1 + jit)) + "," + Math.round(58 * (1 + jit)) + "," + Math.round(42 * (1 + jit)) + ",1)";
        g.fillRect(x, 0, 1 + Math.random() * 2, h);
      }
    }, { repeat: [3, 1] });
    var woodMat = new T.MeshLambertMaterial({ map: wood, color: 0xC9A987 });

    /* floorboards, posts, roof frame */
    var floor = new T.Mesh(new T.PlaneGeometry(20, 16), woodMat);
    floor.rotation.x = -Math.PI / 2; floor.receiveShadow = !small;
    root.add(floor);

    var postMat = new T.MeshLambertMaterial({ color: 0x3A2C1F });
    [[-7, 7], [7, 7], [-7, -7], [7, -7]].forEach(function (P) {
      var m = new T.Mesh(new T.BoxGeometry(0.42, 9, 0.42), postMat);
      m.position.set(P[0], 4.5, P[1]); root.add(m);
    });
    var beams = new T.InstancedMesh(new T.BoxGeometry(15, 0.3, 0.3), postMat, 12);
    var m4 = new T.Matrix4(), q = new T.Quaternion(), e = new T.Euler(), v = new T.Vector3(), s = new T.Vector3(1, 1, 1);
    for (var b = 0; b < 12; b++) {
      v.set(0, 9 + (b % 3) * 0.9, -7 + b * 1.25);
      e.set(0, 0, (b % 3) * 0.16 * (b % 2 ? 1 : -1));
      m4.compose(v, q.setFromEuler(e), s); beams.setMatrixAt(b, m4);
    }
    beams.instanceMatrix.needsUpdate = true; root.add(beams);

    /* stacked timber at the edges */
    var stack = new T.InstancedMesh(new T.BoxGeometry(0.4, 0.4, 5), woodMat, small ? 40 : 90);
    var rnd = mulberry32(3);
    for (var i = 0; i < stack.count; i++) {
      var side = i % 2 ? 1 : -1;
      v.set(side * (8.2 + (i % 3) * 0.45), 0.25 + Math.floor(i / 6) * 0.42, -5 + (i % 11) * 1.0);
      m4.compose(v, q, s); stack.setMatrixAt(i, m4);
    }
    stack.instanceMatrix.needsUpdate = true; root.add(stack);

    /* the plinth and the one slab, built twice from the same geometry */
    var plinth = new T.Mesh(new T.BoxGeometry(3.4, 0.9, 2.2),
      new T.MeshLambertMaterial({ color: 0x2A2118 }));
    plinth.position.y = 0.45; plinth.receiveShadow = !small; root.add(plinth);

    var slabGeo = new T.BoxGeometry(3.3, 4.4, 0.11);
    var below = new T.Plane(new T.Vector3(0, -1, 0), 3);
    var above = new T.Plane(new T.Vector3(0, 1, 0), -3);
    S.below = below; S.above = above;

    var cold = new T.Mesh(slabGeo, new T.MeshBasicMaterial({
      color: 0x7FB2FF, wireframe: true, clippingPlanes: [below]
    }));
    cold.position.set(0, 2.5, 0); root.add(cold);

    var warmTex = directedPageTexture(T, ctx.renderer, "#FF7A18");
    var warm = new T.Mesh(slabGeo, new T.MeshLambertMaterial({
      map: warmTex, emissive: 0xFFFFFF, emissiveMap: warmTex, clippingPlanes: [above]
    }));
    warm.position.set(0, 2.5, 0); warm.castShadow = !small; root.add(warm);
    S.cold = cold; S.warm = warm;

    /* the bar itself */
    var bar = new T.Mesh(new T.PlaneGeometry(6.8, 0.1),
      new T.MeshBasicMaterial({ color: 0xFFC98A }));
    bar.position.set(0, 3, 0.14); root.add(bar);
    S.bar = bar;
    var barLight = new T.PointLight(0xFF7A18, 60, 12, 2);
    barLight.position.set(0, 3, 1.2); root.add(barLight);
    S.barLight = barLight;

    /* six lanterns: two real lights, four convincing fakes */
    var bulbGeo = new T.SphereGeometry(0.075, 8, 8);
    var bulbMat = new T.MeshBasicMaterial({ color: 0xFFD8A0 });
    var spots = [[-5, 5.4, -4], [5, 5.4, -4], [-5, 5.4, 3], [5, 5.4, 3], [0, 6.1, -6], [0, 6.1, 5]];
    spots.forEach(function (P, idx) {
      var m = new T.Mesh(bulbGeo, bulbMat); m.position.set(P[0], P[1], P[2]); root.add(m);
      if (idx < 2) {
        var pl = new T.PointLight(0xFFB265, 40, 16, 2);
        pl.position.set(P[0], P[1], P[2]); root.add(pl);
      }
    });

    root.add(new T.AmbientLight(0x6B4520, 2.4));
    var key = new T.DirectionalLight(0xFFD3A0, 2.0);
    key.position.set(5, 12, 6);
    if (!small) {
      key.castShadow = true;
      key.shadow.mapSize.set(1024, 1024);
      key.shadow.camera.left = -10; key.shadow.camera.right = 10;
      key.shadow.camera.top = 10; key.shadow.camera.bottom = -10;
    }
    root.add(key);

    /* contact shadow under the plinth, the trick used everywhere a real map is too dear */
    var cs = new T.Mesh(new T.PlaneGeometry(6, 4),
      new T.MeshBasicMaterial({ map: radialShadow(T, ctx.renderer), transparent: true, depthWrite: false }));
    cs.rotation.x = -Math.PI / 2; cs.position.y = 0.02; root.add(cs);
  },

  camera: function (ctx) {
    var c = ctx.camera, p = ease(ctx.t);
    var barY = lerp(1.1, 5.2, p);
    c.position.set(-2.4 + ctx.pointer.x * 0.5, barY + 0.7, 9.6);
    c.lookAt(-2.4, barY, 0);     /* the slab holds the right of frame, beside the copy */
  },

  frame: function (ctx) {
    var S = ctx.actState, p = ease(ctx.t);
    var barY = lerp(0.9, 4.9, p) + (S.drag || 0);
    S.below.constant = barY;
    S.above.constant = -barY;
    S.bar.position.y = barY;
    S.barLight.position.y = barY;
    S.barLight.intensity = 44 + Math.sin(ctx.clock * 3) * 8;
  }
};

/* 07 — THE RECORD. Dark specimen sheet, the negative of act 02. Pure DOM. */
export const actRecord = { id: "record", accent: null, dom: true };

/* ============================================================================
 * 08 — THE LEDGER FIELD
 * Orthographic. No perspective, no vanishing point, and the whole world goes pale.
 * Camera: a lateral truck across a plan sheet. Scale: a city from altitude.
 * ========================================================================== */
export const actLedger = {
  id: "ledger", accent: "#B82A14", bg: 0xDDE0E4, ortho: true, restT: 0.55,
  fog: function (T) { return new T.Fog(0xDDE0E4, 90, 340); },

  build: function (ctx) {
    var T = ctx.THREE, root = ctx.root, S = ctx.actState, small = ctx.small;

    var sheet = makeTexture(T, ctx.renderer, 2048, 2048, function (g, w, h) {
      g.fillStyle = "#DDE0E4"; g.fillRect(0, 0, w, h);
      g.strokeStyle = "#B9BEC6"; g.lineWidth = 2;
      for (var i = 0; i <= 40; i++) {
        var u = (i / 40) * w;
        g.beginPath(); g.moveTo(u, 0); g.lineTo(u, h); g.stroke();
        g.beginPath(); g.moveTo(0, u); g.lineTo(w, u); g.stroke();
      }
      g.strokeStyle = "#8A9099"; g.lineWidth = 4;
      g.strokeRect(40, 40, w - 80, h - 80);
      g.fillStyle = "#5A6068";
      g.font = '600 30px "Martian Mono", ui-monospace, monospace';
      g.fillText("LEDGER", 70, 100);
      g.font = '20px "Martian Mono", ui-monospace, monospace';
      g.fillText("SHEET 01 OF 01", 70, 140);
      g.fillText("NO TWO ALIKE", w - 340, 100);
      /* north arrow and a scale bar, so it reads as a survey and not wallpaper */
      g.beginPath(); g.moveTo(w - 160, h - 200); g.lineTo(w - 130, h - 120); g.lineTo(w - 190, h - 120);
      g.closePath(); g.fillStyle = "#5A6068"; g.fill();
      g.fillRect(80, h - 130, 300, 8);
      for (var k2 = 0; k2 <= 6; k2++) g.fillRect(80 + k2 * 50, h - 148, 3, 26);
      g.font = '16px "Martian Mono", ui-monospace, monospace';
      for (var b = 0; b < 40; b += 4) {
        g.fillText(String(1000 + b), 60 + (b / 4) * 190, 190);
      }
    });

    var ground = new T.Mesh(new T.PlaneGeometry(420, 420),
      new T.MeshBasicMaterial({ map: sheet }));
    ground.rotation.x = -Math.PI / 2;
    root.add(ground);

    /* every unclaimed plot, as outlines, in one buffer */
    var N = small ? 520 : 1400;
    var pts = [];
    var rnd = mulberry32(19);
    var cols = 50, rows = Math.ceil(N / 50);
    for (var i = 0; i < N; i++) {
      var cx = (i % cols - cols / 2) * 7.4 + (rnd() - 0.5) * 1.2;
      var cz = (Math.floor(i / cols) - rows / 2) * 7.4 + (rnd() - 0.5) * 1.2;
      var w2 = 2.3, d2 = 1.6;
      var a = [cx - w2, 0.02, cz - d2], b2 = [cx + w2, 0.02, cz - d2];
      var c2 = [cx + w2, 0.02, cz + d2], d3 = [cx - w2, 0.02, cz + d2];
      pts.push(a[0], a[1], a[2], b2[0], b2[1], b2[2]);
      pts.push(b2[0], b2[1], b2[2], c2[0], c2[1], c2[2]);
      pts.push(c2[0], c2[1], c2[2], d3[0], d3[1], d3[2]);
      pts.push(d3[0], d3[1], d3[2], a[0], a[1], a[2]);
    }
    var plotGeo = new T.BufferGeometry();
    plotGeo.setAttribute("position", new T.Float32BufferAttribute(pts, 3));
    var plots = new T.LineSegments(plotGeo,
      new T.LineBasicMaterial({ color: 0x5A6068, transparent: true, opacity: 0.5 }));
    root.add(plots);
    S.plots = plots;

    /* the one plot that is claimed, and the only object with height in the world */
    var tower = new T.Mesh(new T.BoxGeometry(7.4, 17, 5.2),
      new T.MeshLambertMaterial({ color: 0x14171C }));
    tower.position.set(0, 8.5, 0);
    root.add(tower);
    var cap = new T.Mesh(new T.PlaneGeometry(7.4, 5.2),
      new T.MeshBasicMaterial({ map: directedPageTexture(T, ctx.renderer, "#B82A14") }));
    cap.rotation.x = -Math.PI / 2; cap.position.set(0, 17.03, 0);
    root.add(cap);
    var mark = new T.Mesh(new T.PlaneGeometry(8.4, 0.9),
      new T.MeshBasicMaterial({ color: 0xB82A14 }));
    mark.rotation.x = -Math.PI / 2; mark.position.set(0, 0.06, 4.2);
    root.add(mark);

    root.add(new T.HemisphereLight(0xFFFFFF, 0xBFC5CC, 2.2));
    var dl = new T.DirectionalLight(0xFFFFFF, 0.8); dl.position.set(-30, 40, 20); root.add(dl);
  },

  camera: function (ctx) {
    var c = ctx.camera, p = ease(ctx.t);
    c.position.set(lerp(-120, 120, p), 90, 120);
    c.lookAt(lerp(-120, 120, p), 0, 0);
    c.zoom = lerp(0.55, 1.2, p);
    c.updateProjectionMatrix();
  }
};

/* ============================================================================
 * 09 — THE COMMISSION
 * One object, real relief, a raking light, the page's only real shadow, then a dead stop.
 * ========================================================================== */
export const actCommission = {
  id: "commission", accent: "#E8C77A", bg: 0x08090B, fov: 40, restT: 0.75,
  fog: function (T) { return new T.FogExp2(0x08090B, 0.014); },

  build: function (ctx) {
    var T = ctx.THREE, root = ctx.root, S = ctx.actState, small = ctx.small;

    var floor = new T.Mesh(new T.PlaneGeometry(80, 80),
      new T.MeshPhongMaterial({ color: 0x14161B, shininess: 6 }));
    floor.rotation.x = -Math.PI / 2; floor.position.y = -3.2;
    floor.receiveShadow = !small;
    root.add(floor);

    var plinth = new T.Mesh(new T.BoxGeometry(5.4, 1.2, 2.4),
      new T.MeshPhongMaterial({ color: 0x1B1E24, shininess: 8 }));
    plinth.position.y = -2.6; plinth.receiveShadow = !small; root.add(plinth);

    /* the slab, with the layout as physical relief rather than a printed picture */
    var body = new T.Mesh(new T.BoxGeometry(4.4, 6.2, 0.22),
      new T.MeshPhongMaterial({ color: 0x191C22, shininess: 10 }));
    body.position.y = 1.1; body.castShadow = !small; root.add(body);

    var ribMat = new T.MeshPhongMaterial({ color: 0x3C4450, shininess: 16 });
    var ribs = [
      [0, 3.55, 3.4, 0.62], [-0.75, 2.55, 1.9, 0.22], [-1.05, 2.12, 1.3, 0.16],
      [-0.6, 1.2, 2.6, 0.1], [-0.6, 0.95, 2.6, 0.1], [-0.6, 0.7, 2.0, 0.1],
      [0.95, -0.35, 2.0, 1.5], [-0.95, -1.5, 1.9, 0.9], [0, -2.6, 3.9, 0.3]
    ];
    ribs.forEach(function (R) {
      var m = new T.Mesh(new T.BoxGeometry(R[2], R[3], 0.13), ribMat);
      m.position.set(R[0], 1.1 + R[1], 0.17);
      m.castShadow = !small;
      root.add(m);
    });
    var strip = new T.Mesh(new T.BoxGeometry(0.16, 2.2, 0.02),
      new T.MeshBasicMaterial({ color: 0xFF3B21 }));
    strip.position.set(1.72, 0.6, 0.2); root.add(strip);

    /* the salvaged average page, leaning against the plinth, waiting to be struck */
    var leaner = new T.Mesh(new T.PlaneGeometry(1.9, 1.2),
      new T.MeshPhongMaterial({
        map: averagePageTexture(T, ctx.renderer, "#6E757F", "#1A1D22"),
        shininess: 4, side: T.DoubleSide
      }));
    leaner.position.set(-3.1, -2.55, 1.5);
    leaner.rotation.set(-0.34, 0.22, 0.06);
    root.add(leaner);
    S.leaner = leaner;

    var key = new T.SpotLight(0xFFE6B4, 5200, 52, 0.5, 0.85, 2);
    key.position.set(-9, 8, 11); key.target.position.set(0, 1, 0);
    if (!small) { key.castShadow = true; key.shadow.mapSize.set(1024, 1024); }
    root.add(key); root.add(key.target);
    S.key = key;

    var rim = new T.SpotLight(0xFF5A38, 900, 40, 0.75, 0.95, 2);
    rim.position.set(10, 4, -5); rim.target.position.set(0, 1, 0);
    root.add(rim); root.add(rim.target);

    /* very little fill, so the raking light does the modelling and the relief reads */
    var lift = new T.DirectionalLight(0x8894A6, 0.22);
    lift.position.set(2, 6, 10); root.add(lift);
    root.add(new T.AmbientLight(0x232A34, 0.55));
  },

  camera: function (ctx) {
    var c = ctx.camera;
    /* pushes in, then stops dead and stays square for the rest of the act */
    var p = ease(clamp01(ctx.t / 0.6));
    c.position.set(3.4, 1.1, lerp(26, 14.5, p));
    c.rotation.set(0, 0, 0);
    c.lookAt(3.4, 1.1, 0);       /* the object holds the left, the price holds the right */
  },

  frame: function (ctx) {
    var S = ctx.actState, t = ctx.t;
    /* the key light rakes across the face, so the relief is legible only as it passes */
    var sweep = clamp01(t / 0.62);
    S.key.position.x = lerp(-11, 9, sweep);
    S.key.position.y = lerp(7, 5.5, sweep);
    if (t > 0.66 && !S.struck) {
      S.struck = true;
      S.leaner.material.color.set(0xFF3B21);
      S.leaner.material.emissive && S.leaner.material.emissive.set(0x2A0800);
      if (ctx.hooks.onRefuse) ctx.hooks.onRefuse(1);
    }
    if (S.struck) {
      S.leaner.rotation.z = Math.min(S.leaner.rotation.z + 0.02, 0.5);
      S.leaner.position.y = Math.max(S.leaner.position.y - 0.012, -3.0);
    }
  }
};

export const ACTS = [
  actRoom, actRegistry, actFloor, actRun, actInstrument,
  actKiln, actRecord, actLedger, actCommission
];
