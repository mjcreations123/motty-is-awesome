/* Nine acts, nine worlds. Each owns its own geometry, camera grammar, projection,
 * scale and palette. Two of them are DOM only and appear here as stubs so the
 * engine still counts them. Nothing is shared between acts except the chrome. */

import {
  makeTexture, averagePageTexture, directedPageTexture, rowTexture, radialShadow,
  flyPath, ease, easeOut, clamp01, lerp, mulberry32
} from "./world.js";

var TAU = Math.PI * 2;

/* ============================================================================
 * 01 — THE DEFAULT ROOM
 * You are standing inside the average website before you realise that is what it is.
 * Camera: one straight backward dolly, zero rotation. Scale: one room. No accent.
 * ========================================================================== */
var ROOM_Z0 = -11;          /* where the one page hangs */
var ROOM_LOCK = 5.165;      /* tan(fov/2) * (camZ - z0) held constant = the vertigo lock */

export const actRoom = {
  id: "room", accent: null, bg: 0x1A1C20, fov: 38, restT: 0.85,
  /* light fog only: the retreat is long, and the stack has to stay legible at the far end */
  fog: function (T) { return new T.FogExp2(0x1A1C20, 0.011); },

  build: function (ctx) {
    var T = ctx.THREE, root = ctx.root, S = ctx.actState, small = ctx.small;
    var W = 14, H = 6, LEN = 39;
    var rnd = mulberry32(7);

    /* Everything that is "the room" lives in one group measured from a near origin, so the
       shell can LENGTHEN behind you: you dolly back eighteen units and the exit retreats
       twenty two, which is why you never reach the door. */
    var shell = new T.Group();
    shell.position.z = 26;
    root.add(shell);
    S.shell = shell;

    var floorTex = makeTexture(T, ctx.renderer, 512, 512, function (g, w, h) {
      g.fillStyle = "#26282C"; g.fillRect(0, 0, w, h);
      g.strokeStyle = "rgba(150,156,166,.14)"; g.lineWidth = 2;
      for (var i = 1; i < 4; i++) {
        var u = (i / 4) * w;
        g.beginPath(); g.moveTo(u, 0); g.lineTo(u, h); g.stroke();
        g.beginPath(); g.moveTo(0, u); g.lineTo(w, u); g.stroke();
      }
      g.fillStyle = "rgba(210,216,226,.05)";
      for (var k = 0; k < 900; k++) g.fillRect(rnd() * w, rnd() * h, 1, 1);
      g.fillStyle = "rgba(0,0,0,.10)"; g.fillRect(128, 256, 128, 128);
    }, { repeat: [7, 22] });

    var ceilTex = makeTexture(T, ctx.renderer, 512, 512, function (g, w, h) {
      g.fillStyle = "#232529"; g.fillRect(0, 0, w, h);
      g.strokeStyle = "rgba(190,196,206,.20)"; g.lineWidth = 3;
      for (var i = 1; i < 4; i++) {
        var u = (i / 4) * w;
        g.beginPath(); g.moveTo(u, 0); g.lineTo(u, h); g.stroke();
        g.beginPath(); g.moveTo(0, u); g.lineTo(w, u); g.stroke();
      }
    }, { repeat: [7, 22] });

    var wallMat = new T.MeshLambertMaterial({ color: 0x2A2C31, side: T.DoubleSide });
    var floor = new T.Mesh(new T.PlaneGeometry(W, LEN), new T.MeshLambertMaterial({ map: floorTex }));
    floor.rotation.x = -Math.PI / 2; floor.position.set(0, -H / 2, -LEN / 2); shell.add(floor);
    var ceil = new T.Mesh(new T.PlaneGeometry(W, LEN), new T.MeshLambertMaterial({ map: ceilTex }));
    ceil.rotation.x = Math.PI / 2; ceil.position.set(0, H / 2, -LEN / 2); shell.add(ceil);
    var wl = new T.Mesh(new T.PlaneGeometry(LEN, H), wallMat);
    wl.rotation.y = Math.PI / 2; wl.position.set(-W / 2, 0, -LEN / 2); shell.add(wl);
    var wr = new T.Mesh(new T.PlaneGeometry(LEN, H), wallMat);
    wr.rotation.y = -Math.PI / 2; wr.position.set(W / 2, 0, -LEN / 2); shell.add(wr);
    S.floorTex = floorTex; S.ceilTex = ceilTex;

    /* skirting, dado and cove: three continuous lines converging on the vanishing point,
       which is what makes a four screen pure translation legible at all */
    var trimMat = new T.MeshLambertMaterial({ color: 0x33363C });
    var trim = new T.InstancedMesh(new T.BoxGeometry(1, 1, 1), trimMat, 6);
    var m4 = new T.Matrix4(), q = new T.Quaternion(), v = new T.Vector3(), s = new T.Vector3();
    [[-6.96, -2.65, 0.12, 0.30], [6.96, -2.65, 0.12, 0.30],
     [-6.96, 0.15, 0.10, 0.06], [6.96, 0.15, 0.10, 0.06],
     [-6.96, 2.86, 0.14, 0.22], [6.96, 2.86, 0.14, 0.22]].forEach(function (P, i) {
      v.set(P[0], P[1], -LEN / 2); s.set(P[2], P[3], LEN);
      m4.compose(v, q, s); trim.setMatrixAt(i, m4);
    });
    trim.instanceMatrix.needsUpdate = true; shell.add(trim);

    /* recessed ceiling troughs, kept OUT of the shell so they never stretch */
    var TROUGH = small ? 34 : 60;
    var troughs = new T.InstancedMesh(new T.PlaneGeometry(1, 1),
      new T.MeshBasicMaterial({ side: T.FrontSide }), TROUGH);
    var col = new T.Color(), e = new T.Euler(Math.PI / 2, 0, 0);
    var half = TROUGH / 2;
    S.tubeZ = new Float32Array(half);
    for (var i2 = 0; i2 < half; i2++) {
      var z = 24 - i2 * 2.2, x = (i2 % 2) ? 2.6 : -2.6;
      S.tubeZ[i2] = z;
      v.set(x, H / 2 - 0.005, z); s.set(2.4, 0.56, 1);
      m4.compose(v, q.setFromEuler(e), s);
      troughs.setMatrixAt(i2 * 2, m4);
      troughs.setColorAt(i2 * 2, col.setHex(0x141619));
      v.set(x, H / 2 - 0.02, z); s.set(2.2, 0.42, 1);
      m4.compose(v, q, s);
      troughs.setMatrixAt(i2 * 2 + 1, m4);
      troughs.setColorAt(i2 * 2 + 1, col.setHex(0xC9D0DA));
    }
    troughs.instanceMatrix.needsUpdate = true;
    if (troughs.instanceColor) troughs.instanceColor.needsUpdate = true;
    root.add(troughs);
    S.troughs = troughs; S.half = half;

    /* a door frame standing in the mouth, retreating faster than you do */
    var door = new T.InstancedMesh(new T.BoxGeometry(1, 1, 1),
      new T.MeshLambertMaterial({ color: 0x3C4046 }), 3);
    [[-3.2, 0, 0.16, 5.2], [3.2, 0, 0.16, 5.2], [0, 2.6, 6.56, 0.22]].forEach(function (P, i) {
      v.set(P[0], P[1], 0); s.set(P[2], P[3], 0.30);
      m4.compose(v, q, s); door.setMatrixAt(i, m4);
    });
    door.instanceMatrix.needsUpdate = true;
    root.add(door);
    S.door = door;

    /* the one page, and the stack behind it. every clone is rescaled EVERY FRAME so its
       projected size matches the front one exactly: head on you see a single rectangle,
       no matter where the camera is. that is what breaks at the end. */
    var N = small ? 110 : 200, step = 0.62;
    var panel = new T.InstancedMesh(
      new T.PlaneGeometry(3.2, 1.8),
      new T.MeshLambertMaterial({
        map: averagePageTexture(T, ctx.renderer, "#AEB6C0", "#35383F"), side: T.DoubleSide
      }), N);
    panel.count = 1;
    root.add(panel);
    S.panel = panel; S.N = N; S.step = step;
    S.m4 = new T.Matrix4(); S.q = new T.Quaternion();
    S.v = new T.Vector3(); S.s = new T.Vector3();

    var glow = new T.Mesh(new T.PlaneGeometry(60, 34),
      new T.MeshBasicMaterial({ color: 0x8C939E, transparent: true, opacity: 0 }));
    glow.position.set(0, 0.35, ROOM_Z0 - N * step * 0.55);
    root.add(glow);
    S.glow = glow;

    var lamp = new T.PointLight(0xDCE2EA, 120, 34, 2);
    lamp.position.set(0, H / 2 - 0.4, 2); root.add(lamp); S.lamp = lamp;
    var onPanel = new T.PointLight(0xC9D2DC, 30, 40, 2);
    onPanel.position.set(0, 0.35, -14); root.add(onPanel); S.onPanel = onPanel;
    root.add(new T.AmbientLight(0x4A4E56, 1.05));
  },

  camera: function (ctx) {
    var c = ctx.camera, t = ctx.t;
    /* Six legs of pure -Z translation. Through the first three the lens is scored so
       tan(fov/2) * (camZ - z0) stays constant: you travel five units and the page does
       not change size by a pixel, while the room rushes past. Then the lock breaks. */
    var camZ, fov;
    if (t < 0.34) {
      camZ = t < 0.16 ? lerp(4.0, 1.15, easeOut(t / 0.16))
                      : lerp(1.15, 6.30, ease((t - 0.16) / 0.18));
      fov = 2 * Math.atan(ROOM_LOCK / (camZ - ROOM_Z0)) * 180 / Math.PI;
    } else if (t < 0.56) {
      camZ = lerp(6.30, 11.60, easeOut((t - 0.34) / 0.22)); fov = lerp(33.2, 44, ease((t - 0.34) / 0.22));
    } else if (t < 0.80) {
      camZ = lerp(11.60, 17.80, easeOut((t - 0.56) / 0.24)); fov = lerp(44, 50, (t - 0.56) / 0.24);
    } else {
      camZ = lerp(17.80, 22.0, easeOut((t - 0.80) / 0.20)); fov = lerp(50, 52, (t - 0.80) / 0.20);
    }
    c.position.set(0, 0.35, camZ);
    c.rotation.set(0, 0, 0);          /* zero rotation for the whole act, on every axis */
    if (Math.abs(c.fov - fov) > 0.001) { c.fov = fov; c.updateProjectionMatrix(); }
    ctx.actState.camZ = camZ;
  },

  frame: function (ctx) {
    var S = ctx.actState, t = ctx.t, camZ = S.camZ != null ? S.camZ : 4;

    /* the shell lengthens behind you from t 0.30, so the exit outruns the camera */
    var grow = lerp(1, 2.15, ease(clamp01((t - 0.30) / 0.55)));
    S.shell.scale.z = grow;
    S.floorTex.repeat.y = 22 * grow;
    S.ceilTex.repeat.y = 22 * grow;
    S.door.position.z = 26 - 39 * grow;

    /* how many clones are revealed, and how far the stack has fanned out of alignment */
    var reveal = clamp01((t - 0.30) / 0.44);
    var count = 1 + Math.floor(reveal * (S.N - 1));
    S.panel.count = count;
    var fan = ease(clamp01((t - 0.86) / 0.14));

    var base = camZ - ROOM_Z0;
    for (var i = 0; i < count; i++) {
      var z = ROOM_Z0 - i * S.step;
      var kAligned = (camZ - z) / base;      /* projects to exactly the front page's size */
      var k = lerp(kAligned, 1, fan);        /* ...until the fan releases them to true size */
      S.v.set(0, 0.35, z); S.s.set(k, k, 1);
      S.m4.compose(S.v, S.q, S.s);
      S.panel.setMatrixAt(i, S.m4);
    }
    S.panel.instanceMatrix.needsUpdate = true;

    S.glow.material.opacity = reveal * 0.1;

    /* the troughs go out far to near, and the two nearest stutter */
    var kill = clamp01((t - 0.72) / 0.20);
    var col = S.__c || (S.__c = new ctx.THREE.Color());
    for (var j = 0; j < S.half; j++) {
      var depth = 1 - (j / S.half);
      var on = depth > kill;
      var b = on ? 1 : 0.06;
      if (on && j >= S.half - 2) {
        b *= 0.35 + 0.65 * (Math.sin(ctx.clock * 17) * Math.sin(ctx.clock * 6.3) > -0.4 ? 1 : 0);
      }
      S.troughs.setColorAt(j * 2 + 1, col.setRGB(0.788 * b, 0.816 * b, 0.855 * b));
    }
    if (S.troughs.instanceColor) S.troughs.instanceColor.needsUpdate = true;

    /* the room light dies and the stack keeps its own, so the last thing you see is the
       tunnel of nested rectangles the clones collapsed into */
    S.lamp.intensity = lerp(120, 8, clamp01((t - 0.82) / 0.18));
    S.onPanel.intensity = lerp(30, 95, clamp01((t - 0.72) / 0.28));
  }
};

/* ============================================================================
 * 02 — THE REGISTRY
 * A pale archive wall of filed entries, most of them closed. Keeps the tonal
 * inversion the flat version had, but as a place you travel through rather than a
 * document you scroll past. Camera: a close tracking shot along the wall.
 * ========================================================================== */
export const actRegistry = {
  id: "registry", accent: "#B82A14", bg: 0xE7E4DD, fov: 46, restT: 0.5,
  fog: function (T) { return new T.Fog(0xE7E4DD, 30, 110); },

  build: function (ctx) {
    var T = ctx.THREE, root = ctx.root, S = ctx.actState, small = ctx.small;

    /* an index card, drawn twice: one that can be read and one that cannot */
    function card(withheld) {
      return makeTexture(T, ctx.renderer, 256, 160, function (g, w, h) {
        g.fillStyle = "#F4F2EC"; g.fillRect(0, 0, w, h);
        g.strokeStyle = "rgba(20,22,26,.34)"; g.lineWidth = 2;
        g.strokeRect(4, 4, w - 8, h - 8);
        g.fillStyle = "rgba(20,22,26,.20)"; g.fillRect(16, 26, w - 32, 2);
        if (withheld) {
          g.fillStyle = "#3A3730";
          g.fillRect(16, 44, w - 60, 20);
          g.fillRect(16, 76, w - 120, 20);
        } else {
          g.fillStyle = "#14161A";
          g.fillRect(16, 46, w - 78, 13);
          g.fillRect(16, 78, w - 132, 13);
        }
        g.fillStyle = "rgba(20,22,26,.28)"; g.fillRect(16, h - 34, 52, 8);
      });
    }

    var GX = 2.45, GY = 1.62;
    var COLS = small ? 34 : 74, ROWS = 12;
    S.COLS = COLS; S.GX = GX;
    var geo = new T.PlaneGeometry(2.15, 1.34);
    var pub = new T.InstancedMesh(geo, new T.MeshLambertMaterial({ map: card(false) }), COLS * ROWS);
    var wit = new T.InstancedMesh(geo, new T.MeshLambertMaterial({ map: card(true) }), COLS * ROWS);
    var m4 = new T.Matrix4(), q = new T.Quaternion(), e = new T.Euler();
    var v = new T.Vector3(), s = new T.Vector3(1, 1, 1), col = new T.Color();
    var rnd = mulberry32(31);
    var px = [], wx = [], np = 0, nw = 0;

    for (var c = 0; c < COLS; c++) {
      for (var r = 0; r < ROWS; r++) {
        var x = (c - COLS / 2) * GX + (rnd() - 0.5) * 0.06;
        var y = (r - (ROWS - 1) / 2) * GY + (rnd() - 0.5) * 0.04;
        var open = rnd() < 0.14;      /* a few are already common knowledge */
        v.set(x, y, (rnd() - 0.5) * 0.05);
        e.set(0, (rnd() - 0.5) * 0.02, (rnd() - 0.5) * 0.012);
        m4.compose(v, q.setFromEuler(e), s);
        if (open) { pub.setMatrixAt(np, m4); pub.setColorAt(np, col.setHex(0xffffff)); px.push(x); np++; }
        else { wit.setMatrixAt(nw, m4); wit.setColorAt(nw, col.setHex(0xffffff)); wx.push(x); nw++; }
      }
    }
    pub.count = np; wit.count = nw;
    pub.instanceMatrix.needsUpdate = true; wit.instanceMatrix.needsUpdate = true;
    if (pub.instanceColor) pub.instanceColor.needsUpdate = true;
    if (wit.instanceColor) wit.instanceColor.needsUpdate = true;
    root.add(pub); root.add(wit);
    S.pub = pub; S.wit = wit;
    S.px = Float32Array.from(px); S.wx = Float32Array.from(wx);

    /* the rails the cards are filed in */
    var rails = new T.InstancedMesh(new T.BoxGeometry(1, 1, 1),
      new T.MeshLambertMaterial({ color: 0xC9C4B8 }), ROWS + 1);
    for (var q2 = 0; q2 <= ROWS; q2++) {
      v.set(0, (q2 - ROWS / 2) * GY - GY / 2 + 0.06, -0.18);
      s.set(COLS * GX + 8, 0.035, 0.34);
      m4.compose(v, q.setFromEuler(e.set(0, 0, 0)), s);
      rails.setMatrixAt(q2, m4);
    }
    rails.instanceMatrix.needsUpdate = true;
    root.add(rails);
    s.set(1, 1, 1);

    var back = new T.Mesh(new T.PlaneGeometry(COLS * GX + 44, ROWS * GY + 34),
      new T.MeshLambertMaterial({ color: 0xDAD6CC }));
    back.position.z = -1.2;
    root.add(back);

    /* tier plaques bolted to the wall, so the three tiers are labelled in the world */
    function plaque(label, rule) {
      return makeTexture(T, ctx.renderer, 1024, 168, function (g, w, h) {
        g.fillStyle = "#E7E4DD"; g.fillRect(0, 0, w, h);
        g.fillStyle = "#B82A14"; g.fillRect(0, 0, 12, h);
        g.font = '500 46px "Martian Mono", ui-monospace, monospace';
        g.fillStyle = "#B82A14"; g.fillText(label, 36, 64);
        g.font = '400 25px "Martian Mono", ui-monospace, monospace';
        g.fillStyle = "#5C574C"; g.fillText(rule, 36, 118);
      });
    }
    [["ABSOLUTE", "nothing lifts it", 5.7], ["HARD", "lifted only in writing", 0.25],
     ["OFF", "chosen against, and logged", -5.2]].forEach(function (P, idx) {
      var m = new T.Mesh(new T.PlaneGeometry(7.6, 1.25),
        new T.MeshBasicMaterial({ map: plaque(P[0], P[1]) }));
      m.position.set(-COLS * GX / 2 + 10 + idx * (COLS * GX / 3.4), P[2], 0.3);
      root.add(m);
    });

    root.add(new T.HemisphereLight(0xFFFFFF, 0xBDB8AC, 2.6));
    var key = new T.DirectionalLight(0xFFFDF6, 1.0);
    key.position.set(-8, 10, 14); root.add(key);
    S.lamp = new T.PointLight(0xFFF2DC, 260, 46, 2);
    S.lamp.position.set(0, 0, 5);
    root.add(S.lamp);
  },

  camera: function (ctx) {
    /* a close tracking shot along the wall. it still has perspective, so it cannot be
       confused with act 08's flat orthographic truck. */
    var t = ctx.t, c = ctx.camera, S = ctx.actState;
    var span = S.COLS * S.GX;
    var x = lerp(-span / 2 + 12, span / 2 - 12, t);
    var z = t < 0.20 ? lerp(34, 21, ease(t / 0.20))
          : t < 0.72 ? lerp(21, 17, ease((t - 0.20) / 0.52))
          : lerp(17, 30, ease((t - 0.72) / 0.28));
    var y = Math.sin(t * Math.PI) * 2.6 - 0.4;
    c.position.set(x + ctx.pointer.x * 0.8, y + ctx.pointer.y * -0.5, z);
    c.rotation.set(0, 0, 0);
    c.lookAt(x + 1.1, y * 0.5, 0);       /* barely any yaw: it must read as a wall */
  },

  frame: function (ctx) {
    var S = ctx.actState, t = ctx.t, col = S.__c || (S.__c = new ctx.THREE.Color());
    var span = S.COLS * S.GX;
    var head = lerp(-span / 2 + 10, span / 2 - 10, t);
    S.lamp.position.x = head;

    /* everything behind the reading head has been dealt with and closed */
    for (var i = 0; i < S.wit.count; i++) {
      var d = S.wx[i] < head - 1.2;
      S.wit.setColorAt(i, col.setRGB(d ? 0.70 : 1, d ? 0.64 : 1, d ? 0.61 : 1));
    }
    if (S.wit.instanceColor) S.wit.instanceColor.needsUpdate = true;
    /* the open cards stay bright: they are the ones you are allowed to read */
    for (var j = 0; j < S.pub.count; j++) {
      var near = Math.abs(S.px[j] - head) < 7;
      S.pub.setColorAt(j, col.setRGB(1, near ? 1 : 0.94, near ? 0.97 : 0.88));
    }
    if (S.pub.instanceColor) S.pub.instanceColor.needsUpdate = true;
  }
};

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
    /* The only orbit on the page. Elevation is pinned at 40 degrees for the whole act, but
       the orbit is now staged: hold wide, swing in over the intake, traverse the belt, rise
       for the press, settle. */
    var KEYS = [
      { t: 0.00, az: -0.72, rad: 50, look: [-2.0, 2.4, 0] },
      { t: 0.20, az: -0.46, rad: 44, look: [-4.0, 2.0, 0] },
      { t: 0.44, az: -0.10, rad: 36, look: [0.0, 1.4, 0] },
      { t: 0.66, az: 0.18, rad: 30, look: [3.0, 1.6, 0] },
      { t: 0.86, az: 0.36, rad: 26, look: [3.4, 2.2, 0] },
      { t: 1.00, az: 0.44, rad: 29, look: [2.0, 1.4, 0] }
    ];
    var t = ctx.t, i = 0;
    while (i < KEYS.length - 2 && t > KEYS[i + 1].t) i++;
    var a = KEYS[i], b = KEYS[i + 1];
    var k = ease(clamp01((t - a.t) / Math.max(1e-6, b.t - a.t)));
    var az = lerp(a.az, b.az, k), rad = lerp(a.rad, b.rad, k), el = 40 * Math.PI / 180;
    var lx = lerp(a.look[0], b.look[0], k), ly = lerp(a.look[1], b.look[1], k);
    var c = ctx.camera;
    c.position.set(
      Math.sin(az) * rad * Math.cos(el) + lx,
      Math.sin(el) * rad,
      Math.cos(az) * rad * Math.cos(el)
    );
    c.lookAt(lx, ly, 0);
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
    S.stamp = new T.Color(0xFF3B21); S.count = cells.length; S.cells = cells;
  },

  refuse: function (ctx, id) {
    var S = ctx.actState;
    if (id == null || S.gone[id]) return false;
    S.gone[id] = 1;
    S.mesh.setColorAt(id, S.stamp);
    if (S.mesh.instanceColor) S.mesh.instanceColor.needsUpdate = true;
    if (ctx.hooks.onRefuse) ctx.hooks.onRefuse(1);
    return true;
  },

  pick: function (ctx, hit) { actRun.refuse(ctx, hit.instanceId); },

  /* The keyboard path for the one interaction on the page. It refuses the nearest panel
     still standing ahead of the camera, so somebody who never touches a pointer gets the
     same thing a click gives, rather than a cue describing something they cannot do. */
  refuseNearest: function (ctx) {
    var S = ctx.actState, camZ = ctx.camera.position.z;
    if (!S.mesh) return false;
    var best = -1, bestD = Infinity;
    for (var i = 0; i < S.count; i++) {
      if (S.gone[i]) continue;
      var dz = S.cells[i][2] - camZ;
      if (dz > 0) continue;                     /* already flown past */
      if (-dz < bestD) { bestD = -dz; best = i; }
    }
    return actRun.refuse(ctx, best < 0 ? null : best);
  },

  camera: function (ctx) {
    var c = ctx.camera, S = ctx.actState, t = ctx.t;
    /* Held at the mouth, then the fastest run on the page, front loaded so it decelerates
       hard into the exit. The bank is scored off t, not the clock, so scrubbing is exact. */
    var p = t < 0.08 ? lerp(0, 0.02, t / 0.08)
                     : 0.30 * t + 0.70 * (1 - Math.pow(1 - t, 2.2));
    var z = lerp(9, S.end - 7, p);
    var bank = Math.sin(t * Math.PI * 3.1) * 0.016 * (1 - t);
    var lat = Math.sin(t * Math.PI * 2.2) * 0.9;
    c.position.set(lat + ctx.pointer.x * 1.0, ctx.pointer.y * -0.6, z);
    c.rotation.set(0, 0, 0);
    c.lookAt(lat * 0.4 + ctx.pointer.x * 0.4, ctx.pointer.y * -0.25, z - 11);
    c.rotation.z += bank;
  }
};

/* ============================================================================
 * 05 — THE INSTRUMENT
 * Mercury's lesson taken literally: the object is built from the product's own material.
 * Camera: dead still, only the lens breathes. Scale: arm's length. Accent: phosphor.
 * ========================================================================== */
export const actInstrument = {
  id: "instrument", accent: "#7BE38A", bg: 0x08090B, fov: 34, restT: 0.8,
  fog: function () { return null; },

  build: function (ctx) {
    var T = ctx.THREE, root = ctx.root, S = ctx.actState, small = ctx.small;
    var GREEN = 0x7BE38A, DIM = 0xD6DEE6;

    /* the rig carries the whole instrument, so the CAMERA can stay welded in place while
       the object still travels: on this act the journey belongs to the thing being looked at */
    var rig = new T.Group();
    rig.position.set(0, 0, -10.5);
    root.add(rig);
    S.rig = rig;

    /* two texture sets per field: an unprinted one with the value outlined, and a printed
       one in phosphor. a ring does not merely brighten when it decides, it reprints. */
    function fieldTex(label, printed) {
      return makeTexture(T, ctx.renderer, 512, 72, function (g, w, h) {
        g.font = '500 26px "Martian Mono", ui-monospace, monospace';
        g.textBaseline = "middle";
        g.fillStyle = printed ? "#7BE38A" : "#D6DEE6";
        g.fillText(label, 10, h / 2);
        if (printed) {
          g.fillRect(w - 96, 22, 84, 28);
          g.fillRect(10, h / 2 + 16, g.measureText(label).width, 2);
        } else {
          g.strokeStyle = "#D6DEE6"; g.lineWidth = 3;
          g.strokeRect(w - 96, 22, 84, 28);
        }
      });
    }

    var FIELDS = [
      ["GROUND", "FACE", "BONES"],
      ["MOTION", "SIGNATURE", "VOICE"],
      ["RHYTHM", "WEIGHT", "DEPTH"]
    ];
    var rings = [], m4 = new T.Matrix4(), q = new T.Quaternion(), e = new T.Euler();
    var v = new T.Vector3(), s = new T.Vector3(1, 1, 1), col = new T.Color();

    function ring(radius, count, tiltX, tiltY, w, h, labels) {
      var g = new T.Group();
      var per = Math.ceil(count / labels.length), idx = 0;
      var batches = [];
      labels.forEach(function (label) {
        var n = Math.min(per, count - idx);
        if (n <= 0) return;
        var dimMap = fieldTex(label, false), litMap = fieldTex(label, true);
        var im = new T.InstancedMesh(
          new T.PlaneGeometry(w, h),
          new T.MeshBasicMaterial({ map: dimMap, transparent: true, opacity: 0.26,
            side: T.DoubleSide, depthWrite: false }), n);
        for (var k = 0; k < n; k++, idx++) {
          var a = (idx / count) * TAU;
          v.set(Math.cos(a) * radius, Math.sin(a) * radius, 0);
          e.set(0, 0, a + (Math.sin(a) > 0 ? -Math.PI / 2 : Math.PI / 2));
          m4.compose(v, q.setFromEuler(e), s);
          im.setMatrixAt(k, m4);
        }
        im.instanceMatrix.needsUpdate = true;
        im.userData = { dim: dimMap, lit: litMap };
        g.add(im); batches.push(im);
      });

      /* a graduated bezel rather than a plain hairline: it makes rotation readable */
      var pts = [], i, a2;
      for (i = 0; i < 128; i++) {
        a2 = (i / 128) * TAU;
        var a3 = ((i + 1) / 128) * TAU;
        pts.push(Math.cos(a2) * radius, Math.sin(a2) * radius, 0,
                 Math.cos(a3) * radius, Math.sin(a3) * radius, 0);
      }
      for (i = 0; i < 36; i++) {
        a2 = (i / 36) * TAU;
        var len = (i % 9 === 0) ? 0.28 : 0.12;
        pts.push(Math.cos(a2) * radius, Math.sin(a2) * radius, 0,
                 Math.cos(a2) * (radius - len), Math.sin(a2) * (radius - len), 0);
      }
      for (i = 0; i <= 16; i++) {
        a2 = (i / 16) * (40 * Math.PI / 180) - 0.35;
        var a4 = ((i + 1) / 16) * (40 * Math.PI / 180) - 0.35;
        pts.push(Math.cos(a2) * (radius + 0.34), Math.sin(a2) * (radius + 0.34), 0,
                 Math.cos(a4) * (radius + 0.34), Math.sin(a4) * (radius + 0.34), 0);
      }
      var bg = new T.BufferGeometry();
      bg.setAttribute("position", new T.Float32BufferAttribute(pts, 3));
      var bezel = new T.LineSegments(bg,
        new T.LineBasicMaterial({ color: 0xE9EBEF, transparent: true, opacity: 0.2 }));
      g.add(bezel);

      g.userData = { batches: batches, bezel: bezel, tiltX: tiltX, tiltY: tiltY };
      g.rotation.x = tiltX; g.rotation.y = tiltY;
      rig.add(g); rings.push(g);
      return g;
    }

    ring(5.0, small ? 56 : 96, 0, 0, 0.95, 0.24, FIELDS[0]);
    ring(3.6, small ? 40 : 72, 62 * Math.PI / 180, 0, 0.8, 0.2, FIELDS[1]);
    ring(2.4, small ? 28 : 48, -38 * Math.PI / 180, 0.4, 0.66, 0.17, FIELDS[2]);
    S.rings = rings;

    /* the housing. without it the void has no scale and no motion is legible at all. */
    var cage = [];
    function circle(n, r, fn) {
      for (var i = 0; i < n; i++) {
        var a = (i / n) * TAU, b = ((i + 1) / n) * TAU;
        var p1 = fn(a, r), p2 = fn(b, r);
        cage.push(p1[0], p1[1], p1[2], p2[0], p2[1], p2[2]);
      }
    }
    circle(64, 6.4, function (a, r) { return [Math.cos(a) * r, Math.sin(a) * r, 0]; });
    circle(64, 6.4, function (a, r) { return [Math.cos(a) * r, 0, Math.sin(a) * r]; });
    circle(64, 6.4, function (a, r) { return [0, Math.cos(a) * r, Math.sin(a) * r]; });
    cage.push(0, -6.4, 0, 0, 6.4, 0);
    for (var gi = 0; gi < 7; gi++) {
      var gz = -6.6 + gi * 2.2;
      (function (zz) {
        circle(48, 6.4, function (a, r) { return [Math.cos(a) * r, Math.sin(a) * r, zz]; });
      })(gz);
    }
    var cageGeo = new T.BufferGeometry();
    cageGeo.setAttribute("position", new T.Float32BufferAttribute(cage, 3));
    var cageMesh = new T.LineSegments(cageGeo,
      new T.LineBasicMaterial({ color: 0x2E353D, transparent: true, opacity: 0.5 }));
    rig.add(cageMesh); S.cage = cageMesh;

    var struts = new T.InstancedMesh(new T.BoxGeometry(0.035, 0.035, 13.2),
      new T.MeshBasicMaterial({ color: 0x252B32 }), 8);
    for (var si = 0; si < 8; si++) {
      var sa = (si / 8) * TAU;
      v.set(Math.cos(sa) * 6.4, Math.sin(sa) * 6.4, 0);
      m4.compose(v, q.setFromEuler(e.set(0, 0, 0)), s);
      struts.setMatrixAt(si, m4);
    }
    struts.instanceMatrix.needsUpdate = true;
    rig.add(struts);

    /* eighteen sight plates on the polar axis: a card index that seats one plate at a
       time as you scroll, and snaps parallel at the lock */
    var plates = new T.InstancedMesh(new T.PlaneGeometry(0.9, 0.05),
      new T.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.9, side: T.DoubleSide }), 18);
    for (var pi = 0; pi < 18; pi++) plates.setColorAt(pi, col.setHex(0x3A424A));
    if (plates.instanceColor) plates.instanceColor.needsUpdate = true;
    rig.add(plates); S.plates = plates;
    S.pm = new T.Matrix4(); S.pq = new T.Quaternion(); S.pe = new T.Euler();
    S.pv = new T.Vector3(); S.ps = new T.Vector3();

    /* three tier collars under the spindle: absolute, hard, off */
    var collars = new T.InstancedMesh(new T.BoxGeometry(0.06, 0.06, 1),
      new T.MeshBasicMaterial({ color: 0xffffff }), 96);
    var ci = 0;
    [1.15, 1.55, 1.95].forEach(function (rad) {
      for (var n = 0; n < 32; n++) {
        var a = (n / 32) * TAU;
        v.set(Math.cos(a) * rad, -2.1, Math.sin(a) * rad);
        e.set(0, -a, 0);
        m4.compose(v, q.setFromEuler(e), s);
        collars.setMatrixAt(ci, m4);
        collars.setColorAt(ci, col.setHex(0x9AA6B2));
        ci++;
      }
    });
    collars.instanceMatrix.needsUpdate = true;
    if (collars.instanceColor) collars.instanceColor.needsUpdate = true;
    rig.add(collars); S.collars = collars;

    /* refusal marks, tethered, and they cool once the instrument takes over */
    var cubes = new T.InstancedMesh(new T.BoxGeometry(0.16, 0.16, 0.16),
      new T.MeshBasicMaterial({ color: 0xffffff }), 6);
    for (var qi = 0; qi < 6; qi++) cubes.setColorAt(qi, col.setHex(0xFF3B21));
    if (cubes.instanceColor) cubes.instanceColor.needsUpdate = true;
    rings[2].add(cubes); S.cubes = cubes;
    S.cm = new T.Matrix4(); S.cq = new T.Quaternion(); S.ce = new T.Euler();
    S.cv = new T.Vector3(); S.cs = new T.Vector3(1, 1, 1);

    var spokes = [];
    for (var ki = 0; ki < 6; ki++) {
      var ka = (ki / 6) * TAU;
      spokes.push(Math.cos(ka) * 2.4, Math.sin(ka) * 2.4, 0,
                  Math.cos(ka) * 2.95, Math.sin(ka) * 2.95, 0);
    }
    var spGeo = new T.BufferGeometry();
    spGeo.setAttribute("position", new T.Float32BufferAttribute(spokes, 3));
    rings[2].add(new T.LineSegments(spGeo,
      new T.LineBasicMaterial({ color: 0xFF3B21, transparent: true, opacity: 0.35 })));

    /* phosphor persistence, so the outer ring smears behind itself while it turns */
    var trail = new Float32Array(240 * 3), rnd = mulberry32(23);
    for (var ti = 0; ti < 240; ti++) {
      var ta = (ti / 240) * TAU;
      trail[ti * 3] = Math.cos(ta) * (5.02 + (rnd() - 0.5) * 0.12);
      trail[ti * 3 + 1] = Math.sin(ta) * (5.02 + (rnd() - 0.5) * 0.12);
      trail[ti * 3 + 2] = -0.05;
    }
    var trGeo = new T.BufferGeometry();
    trGeo.setAttribute("position", new T.BufferAttribute(trail, 3));
    var trailPts = new T.Points(trGeo, new T.PointsMaterial({
      size: 0.045, sizeAttenuation: true, color: GREEN, transparent: true,
      opacity: 0.1, blending: T.AdditiveBlending, depthWrite: false
    }));
    rings[0].add(trailPts); S.trail = trailPts;

    /* the index needle: the only thing still moving after the lock */
    var needle = new T.Line(
      new T.BufferGeometry().setFromPoints([new T.Vector3(0, 0, 0), new T.Vector3(5.4, 0, 0)]),
      new T.LineBasicMaterial({ color: GREEN, transparent: true, opacity: 0.7 }));
    rig.add(needle); S.needle = needle;

    /* the chord that snaps across the assembled dial at the lock */
    var chord = new T.Line(
      new T.BufferGeometry().setFromPoints([new T.Vector3(-5.4, 0, 0), new T.Vector3(5.4, 0, 0)]),
      new T.LineBasicMaterial({ color: GREEN, transparent: true, opacity: 0 }));
    rig.add(chord); S.chord = chord;

    root.add(new T.AmbientLight(0xffffff, 1));
  },

  camera: function (ctx) {
    var c = ctx.camera, t = ctx.t;
    /* never moves. not once, on any axis, for the whole act. only the lens is scored,
       and after the lock even that stops. a stopped machine under a still lens. */
    c.position.set(3.6, 0, 20);
    c.rotation.set(0, 0, 0);
    var fov = t < 0.18 ? lerp(34, 31, ease(t / 0.18))
            : t < 0.42 ? lerp(31, 29.5, ease((t - 0.18) / 0.24))
            : t < 0.66 ? 29.5
            : t < 0.86 ? lerp(29.5, 46, ease((t - 0.66) / 0.20))
            : lerp(46, 42, ease((t - 0.86) / 0.14));
    if (Math.abs(c.fov - fov) > 0.001) { c.fov = fov; c.updateProjectionMatrix(); }
  },

  frame: function (ctx) {
    var S = ctx.actState, t = ctx.t, T = ctx.THREE;
    var col = S.__c || (S.__c = new T.Color());

    /* the instrument comes to you, passes, and settles at the mouth of its own housing */
    var rz = t < 0.18 ? lerp(-10.5, -4.2, easeOut(t / 0.18))
           : t < 0.42 ? lerp(-4.2, -2.8, ease((t - 0.18) / 0.24))
           : t < 0.66 ? lerp(-2.8, -2.6, (t - 0.42) / 0.24)
           : t < 0.86 ? lerp(-2.6, 12.6, ease((t - 0.66) / 0.20))
           : lerp(12.6, 14.8, ease((t - 0.86) / 0.14));
    S.rig.position.set(lerp(0, 0.4, clamp01(t / 0.9)), 0, rz);
    S.cage.material.opacity = lerp(0.5, 0.92, ease(clamp01((t - 0.62) / 0.28)));

    /* THE LOCK. three rings that have spent the act on three axes flatten into one plane,
       their spins converge, the rows reprint in phosphor and the machine stops. */
    var flat = ease(clamp01((t - 0.66) / 0.10));
    var locked = t >= 0.76;
    var spin = locked ? 0.76 : t;

    var active = t < 0.33 ? 0 : t < 0.66 ? 1 : 2;
    for (var i = 0; i < 3; i++) {
      var g = S.rings[i], ud = g.userData;
      g.rotation.x = lerp(ud.tiltX, 0, flat);
      g.rotation.y = lerp(ud.tiltY, 0, flat);
      var own = [2.1, -2.8, 3.6][i];
      g.rotation.z = lerp(spin * own, spin * 2.1, flat);

      var on = locked || i === active;
      ud.bezel.material.opacity = on ? 0.55 : 0.12;
      for (var b = 0; b < ud.batches.length; b++) {
        var im = ud.batches[b], m = im.material;
        var wantLit = on;
        if (m.map !== (wantLit ? im.userData.lit : im.userData.dim)) {
          m.map = wantLit ? im.userData.lit : im.userData.dim;
          m.needsUpdate = true;
        }
        m.opacity = locked ? 1 : (on ? 0.95 : 0.15);
      }
    }

    /* eighteen plates seat one at a time, then snap parallel at the lock */
    var snap = ease(clamp01((t - 0.76) / 0.05));
    for (var k = 0; k < 18; k++) {
      var seatAt = 0.10 + ((k + 1) / 18) * 0.46;
      var seat = clamp01((t - (seatAt - 0.03)) / 0.03);
      var sx = lerp(0.06, 1, ease(seat));
      S.pv.set(0, -1.7 + (k / 17) * 3.4, 0);
      S.pe.set(0, lerp(k * 8 * Math.PI / 180, 0, snap), 0);
      S.ps.set(sx, 1, 1);
      S.pm.compose(S.pv, S.pq.setFromEuler(S.pe), S.ps);
      S.plates.setMatrixAt(k, S.pm);
      var lit = seat > 0.99;
      S.plates.setColorAt(k, col.setHex(lit ? 0x7BE38A : 0x3A424A));
    }
    S.plates.instanceMatrix.needsUpdate = true;
    if (S.plates.instanceColor) S.plates.instanceColor.needsUpdate = true;

    /* the three tiers light one after another beneath the stack */
    for (var c2 = 0; c2 < 96; c2++) {
      var tier = Math.floor(c2 / 32);
      S.collars.setColorAt(c2, col.setHex(tier <= active ? 0x7BE38A : 0x9AA6B2));
    }
    if (S.collars.instanceColor) S.collars.instanceColor.needsUpdate = true;

    /* refusal cools once the instrument takes over */
    for (var q2 = 0; q2 < 6; q2++) {
      var qa = (q2 / 6) * TAU;
      S.cv.set(Math.cos(qa) * 2.4, Math.sin(qa) * 2.4, 0);
      S.ce.set(t * 4.2, t * 4.2, 0);
      S.cm.compose(S.cv, S.cq.setFromEuler(S.ce), S.cs);
      S.cubes.setMatrixAt(q2, S.cm);
      S.cubes.setColorAt(q2, col.setHex(active === 2 ? 0xFF3B21 : 0x5A1A10));
    }
    S.cubes.instanceMatrix.needsUpdate = true;
    if (S.cubes.instanceColor) S.cubes.instanceColor.needsUpdate = true;

    S.trail.material.opacity = locked ? 0.05 : (active === 0 ? 0.42 : 0.1);
    S.needle.rotation.z = -t * TAU * 1.5;
    S.chord.material.opacity = Math.pow(clamp01(1 - Math.abs(t - 0.76) / 0.045), 2);
    S.chord.rotation.z = spin * 2.1;
  }
};

/* ============================================================================
 * 06 — THE KILN
 * One slab bisected by a rising bar of light. Cold blueprint below, warm solid above.
 * Camera: the only vertical crane on the page. Scale: a 16m hall. Accent: ember + ice.
 * ========================================================================== */
/* the seam height, needed by both the camera and the frame so they never disagree */
function kilnBarY(t, drag) {
  var p = t < 0.10 ? 0
        : t < 0.72 ? ease((t - 0.10) / 0.62)
        : 1;
  var y = lerp(0.75, 5.3, p) + (drag || 0) * 2.4;
  return y < 0.30 ? 0.30 : y > 5.60 ? 5.60 : y;   /* the seam never leaves the slab */
}
/* the visitor's own offset, taken from the engine's shared handle rather than from a
   listener this act would have to guard. zero until somebody actually takes hold of it. */
function kilnDrag(ctx) { return ctx.grab ? ctx.grab.dy : 0; }

export const actKiln = {
  id: "kiln", accent: "#FF7A18", bg: 0x0F0B07, fov: 46, restT: 0.7, grab: true,
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
    /* The only vertical crane on the page, now staged: stand back in the dark end, close
       in as the seam starts to bite, ride it up at eye level, then pull back to see the
       whole finished slab against the roof frame. No forward-and-back wandering: the
       dominant motion is always Y. */
    var t = ctx.t, barY = kilnBarY(t, kilnDrag(ctx));
    var dist = t < 0.14 ? lerp(13.4, 10.2, ease(t / 0.14))
             : t < 0.62 ? lerp(10.2, 8.4, ease((t - 0.14) / 0.48))
             : t < 0.86 ? lerp(8.4, 9.2, ease((t - 0.62) / 0.24))
             : lerp(9.2, 11.6, ease((t - 0.86) / 0.14));
    var c = ctx.camera;
    c.position.set(-2.4 + ctx.pointer.x * 0.5, barY + 0.7, dist);
    c.lookAt(-2.4, barY - 0.15, 0);
  },

  frame: function (ctx) {
    var S = ctx.actState;
    var barY = kilnBarY(ctx.t, kilnDrag(ctx));
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
  id: "ledger", accent: "#B82A14", bg: 0xDDE0E4, ortho: true, restT: 0.72,
  fog: function (T) { return new T.Fog(0xDDE0E4, 90, 340); },

  build: function (ctx) {
    var T = ctx.THREE, root = ctx.root, S = ctx.actState, small = ctx.small;
    var m4 = new T.Matrix4(), q = new T.Quaternion(), e = new T.Euler();
    var v = new T.Vector3(), s = new T.Vector3(1, 1, 1), col = new T.Color();
    var FLAT = new T.Quaternion().setFromEuler(new T.Euler(-Math.PI / 2, 0, 0));

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
      g.beginPath(); g.moveTo(w - 160, h - 200); g.lineTo(w - 130, h - 120);
      g.lineTo(w - 190, h - 120); g.closePath(); g.fill();
      g.fillRect(80, h - 130, 300, 8);
      for (var k = 0; k <= 6; k++) g.fillRect(80 + k * 50, h - 148, 3, 26);
      g.font = '16px "Martian Mono", ui-monospace, monospace';
      for (var b = 0; b < 40; b += 4) g.fillText(String(1000 + b), 60 + (b / 4) * 190, 190);
    });
    var ground = new T.Mesh(new T.PlaneGeometry(420, 420),
      new T.MeshBasicMaterial({ map: sheet }));
    ground.rotation.x = -Math.PI / 2;
    root.add(ground);

    /* plot outlines, one merged buffer */
    var N = small ? 520 : 1400;
    var pts = [], rnd = mulberry32(19);
    var cols = 50, rows = Math.ceil(N / 50);
    var cxs = new Float32Array(N), czs = new Float32Array(N);
    for (var i2 = 0; i2 < N; i2++) {
      var cx = (i2 % cols - cols / 2) * 7.4 + (rnd() - 0.5) * 1.2;
      var cz = (Math.floor(i2 / cols) - rows / 2) * 7.4 + (rnd() - 0.5) * 1.2;
      cxs[i2] = cx; czs[i2] = cz;
      var w2 = 2.3, d2 = 1.6;
      pts.push(cx - w2, 0.02, cz - d2, cx + w2, 0.02, cz - d2);
      pts.push(cx + w2, 0.02, cz - d2, cx + w2, 0.02, cz + d2);
      pts.push(cx + w2, 0.02, cz + d2, cx - w2, 0.02, cz + d2);
      pts.push(cx - w2, 0.02, cz + d2, cx - w2, 0.02, cz - d2);
    }
    var plotGeo = new T.BufferGeometry();
    plotGeo.setAttribute("position", new T.Float32BufferAttribute(pts, 3));
    root.add(new T.LineSegments(plotGeo,
      new T.LineBasicMaterial({ color: 0x5A6068, transparent: true, opacity: 0.5 })));

    /* SPENT GROUND. every plot carries a hatch tile. behind the survey head the field is
       visibly used up; ahead of it the ground is still clean. this is the act's argument:
       a look that has been taken is not available any more. */
    var hatchTex = makeTexture(T, ctx.renderer, 64, 64, function (g, w, h) {
      g.clearRect(0, 0, w, h);
      g.strokeStyle = "#8A9099"; g.lineWidth = 3;
      for (var i = -8; i < 8; i++) {
        g.beginPath(); g.moveTo(i * 8, 0); g.lineTo(i * 8 + h, h); g.stroke();
      }
    });
    var hatch = new T.InstancedMesh(new T.PlaneGeometry(4.6, 3.2),
      new T.MeshBasicMaterial({ map: hatchTex, transparent: true, opacity: 0 }), N);
    for (var i3 = 0; i3 < N; i3++) {
      v.set(cxs[i3], 0.03, czs[i3]);
      m4.compose(v, FLAT, s);
      hatch.setMatrixAt(i3, m4);
      hatch.setColorAt(i3, col.setHex(0xB9BEC6));
    }
    hatch.instanceMatrix.needsUpdate = true;
    if (hatch.instanceColor) hatch.instanceColor.needsUpdate = true;
    root.add(hatch);
    S.hatch = hatch; S.cxs = cxs; S.N = N; S.lastCol = -99;

    /* survey crosshairs, deliberately flat: only one object here is allowed height */
    var crossTex = makeTexture(T, ctx.renderer, 64, 64, function (g, w, h) {
      g.clearRect(0, 0, w, h);
      g.fillStyle = "#7A828C";
      g.fillRect(30, 8, 4, 48); g.fillRect(8, 30, 48, 4);
      g.strokeStyle = "#7A828C"; g.lineWidth = 2;
      g.beginPath(); g.arc(32, 32, 14, 0, 7); g.stroke();
    });
    var CN = small ? 120 : 288;
    var cross = new T.InstancedMesh(new T.PlaneGeometry(1.4, 1.4),
      new T.MeshBasicMaterial({ map: crossTex, transparent: true, opacity: 0.5 }), CN);
    for (var c2 = 0; c2 < CN; c2++) {
      var gx = (c2 % 24 - 12) * 14.8, gz = (Math.floor(c2 / 24) - 6) * 14.8;
      v.set(gx, 0.025, gz);
      m4.compose(v, FLAT, s);
      cross.setMatrixAt(c2, m4);
    }
    cross.instanceMatrix.needsUpdate = true;
    root.add(cross);

    /* THE CLAIMED PLOT. eighteen plates lie flat and closed at the start, so beat one is
       literally true: nothing on this sheet has height. they extrude into the tower while
       the camera closes on them, so the one built thing is built in front of you. */
    var plates = new T.InstancedMesh(new T.BoxGeometry(7.7, 0.14, 5.5),
      new T.MeshLambertMaterial({ color: 0x2A2E35 }), 18);
    root.add(plates);
    S.plates = plates;
    S.pm = new T.Matrix4(); S.pv = new T.Vector3(); S.pq = new T.Quaternion();
    S.ps = new T.Vector3(1, 1, 1);

    var tower = new T.Mesh(new T.BoxGeometry(7.4, 17, 5.2),
      new T.MeshLambertMaterial({ color: 0x14171C }));
    tower.position.set(0, 0, 0); tower.scale.y = 0.004;
    root.add(tower); S.tower = tower;

    var cap = new T.Mesh(new T.PlaneGeometry(7.4, 5.2),
      new T.MeshBasicMaterial({ map: directedPageTexture(T, ctx.renderer, "#B82A14") }));
    cap.rotation.x = -Math.PI / 2; cap.position.set(0, 0.06, 0);
    root.add(cap); S.cap = cap;

    var mark = new T.Mesh(new T.PlaneGeometry(8.4, 0.9),
      new T.MeshBasicMaterial({ color: 0xB82A14 }));
    mark.rotation.x = -Math.PI / 2; mark.position.set(0, 0.06, 4.2);
    root.add(mark);

    /* registration acquired on arrival, released once the claim lands */
    var regTex = makeTexture(T, ctx.renderer, 512, 384, function (g, w, h) {
      g.clearRect(0, 0, w, h);
      g.strokeStyle = "#B82A14"; g.lineWidth = 6;
      var L = 74;
      [[18, 18, 1, 1], [w - 18, 18, -1, 1], [18, h - 18, 1, -1], [w - 18, h - 18, -1, -1]]
        .forEach(function (P) {
          g.beginPath();
          g.moveTo(P[0] + P[2] * L, P[1]); g.lineTo(P[0], P[1]);
          g.lineTo(P[0], P[1] + P[3] * L); g.stroke();
        });
      g.lineWidth = 3;
      g.beginPath(); g.arc(w / 2, h / 2, 54, 0, 7); g.stroke();
      g.font = '500 22px "Martian Mono", ui-monospace, monospace';
      g.fillStyle = "#B82A14";
      g.fillText("PLOT CLAIMED", w / 2 - 82, h - 44);
    });
    var reg = new T.Mesh(new T.PlaneGeometry(13, 9.5),
      new T.MeshBasicMaterial({ map: regTex, transparent: true, opacity: 0 }));
    reg.rotation.x = -Math.PI / 2; reg.position.set(0, 0.07, 0);
    root.add(reg); S.reg = reg;

    root.add(new T.HemisphereLight(0xFFFFFF, 0xBFC5CC, 2.2));
    var dl = new T.DirectionalLight(0xFFFFFF, 0.9); dl.position.set(-30, 40, 20); root.add(dl);
  },

  camera: function (ctx) {
    /* orthographic. no perspective, no vanishing point, so the only cues are lateral
       travel and zoom. it ends looking at unclaimed ground, which is the point. */
    var KEYS = [
      { t: 0.00, x: -180, zoom: 0.32 },
      { t: 0.24, x: -86, zoom: 0.50 },
      { t: 0.48, x: -4, zoom: 0.88 },
      { t: 0.70, x: 34, zoom: 1.30 },
      { t: 0.88, x: 86, zoom: 0.90 },
      { t: 1.00, x: 168, zoom: 0.55 }
    ];
    var t = ctx.t, i = 0;
    while (i < KEYS.length - 2 && t > KEYS[i + 1].t) i++;
    var a = KEYS[i], b = KEYS[i + 1];
    var k = ease(clamp01((t - a.t) / Math.max(1e-6, b.t - a.t)));
    var x = lerp(a.x, b.x, k), zoom = lerp(a.zoom, b.zoom, k);
    var c = ctx.camera;
    c.position.set(x, 90, 120);
    c.lookAt(x, 0, 0);
    if (Math.abs(c.zoom - zoom) > 0.0005) { c.zoom = zoom; c.updateProjectionMatrix(); }
    ctx.actState.headX = x;
  },

  frame: function (ctx) {
    var S = ctx.actState, t = ctx.t, col = S.__c || (S.__c = new ctx.THREE.Color());
    var head = S.headX != null ? S.headX : -190;

    /* the ground the survey has already passed is spent, and cannot be built on again */
    S.hatch.material.opacity = 0.55;
    var colIdx = Math.floor(((head + 190) / 380) * 50);
    if (colIdx !== S.lastCol) {
      S.lastCol = colIdx;
      for (var i = 0; i < S.N; i++) {
        /* clean ground sits near paper value so it reads as blank and available;
           spent ground is unmistakably hatched out. the band between them is the act. */
        var spent = S.cxs[i] < head - 4;
        S.hatch.setColorAt(i, col.setHex(spent ? 0x7D7365 : 0xDCDFE3));
      }
      if (S.hatch.instanceColor) S.hatch.instanceColor.needsUpdate = true;
    }

    /* the one claimed plot builds itself: eighteen plates rise out of a closed stack */
    var k = ease(clamp01((t - 0.42) / 0.26));
    for (var p = 0; p < 18; p++) {
      S.pv.set(0, lerp(0.18 + p * 0.02, 0.55 + p * 0.93, k), 0);
      S.pm.compose(S.pv, S.pq, S.ps);
      S.plates.setMatrixAt(p, S.pm);
    }
    S.plates.instanceMatrix.needsUpdate = true;

    S.tower.scale.y = Math.max(0.004, k);
    S.tower.position.y = 8.5 * k;
    S.cap.position.y = 17 * k + 0.06;
    S.reg.material.opacity = clamp01((t - 0.38) / 0.14) * (1 - clamp01((t - 0.92) / 0.08));
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
    /* Approach, close, arrive, then STOP DEAD at t 0.60 and never write position, rotation
       or fov again. It is the only camera on the page that comes to a complete square rest,
       and that stillness is the entire reason the price beat lands. */
    var t = ctx.t;
    var z = t < 0.18 ? lerp(26, 21, ease(t / 0.18))
          : t < 0.40 ? lerp(21, 17.2, ease((t - 0.18) / 0.22))
          : t < 0.60 ? lerp(17.2, 14.5, ease((t - 0.40) / 0.20))
          : 14.5;
    c.position.set(3.4, 1.1, z);
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
