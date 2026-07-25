

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

/* ---------------------------------------------------------------------------
 * 03 helpers. Unique names, module scope, allocation-free at frame time.
 * ------------------------------------------------------------------------- */

/* The floor's fixed geography. The route is one loop: intake gate, belt, press,
   then either the bin (refused) or the transfer throat (handed on). */
var FL_X_IN = -9.4, FL_X_PRESS = 3.4, FL_X_TURN = 8.4;
var FL_Y_BELT = 0.66, FL_Y_AXIS = 1.35;
var FL_Z_MOUTH = -7.4, FL_Z_OUT = -21.5;
var FL_BIN = [6.2, 0.58, 3.5];
var FL_REST = 0.75;                 /* must match this act's restT */

/* the six feed stations. All of them sit upstream of the press, because the press crown
   occupies x 2.1 to 4.7 above y 4.24 and a hopper standing in that band would end inside it.
   The etched services, the hopper solids and the spouts all read this one list. */
var FL_HOP_X = [-7.9, -6.3, -4.7, -3.1, -1.5, 0.1];

/* press dip: 1 at the middle of a slot, 0 at both ends, so it is continuous across
   the wrap and a unit is always registered under the arm when the arm is down. */
function FL_dip(u) {
  var d = 1 - clamp01(Math.abs(u - 0.5) / 0.30);
  return ease(d);
}

/* one LineSegments for every drawn outline on the floor: box edges are baked into a
   single position buffer with their translation folded in, so nine draw calls become one. */
function FL_mergeEdges(T, boxes) {
  var parts = [], total = 0, i, j;
  for (i = 0; i < boxes.length; i++) {
    var B = boxes[i];
    var eg = new T.EdgesGeometry(new T.BoxGeometry(B[0], B[1], B[2]));
    var arr = eg.getAttribute("position").array;
    parts.push([arr, B[3], B[4], B[5]]);
    total += arr.length;
    eg.dispose();
  }
  var out = new Float32Array(total), o = 0;
  for (i = 0; i < parts.length; i++) {
    var p = parts[i], a = p[0];
    for (j = 0; j < a.length; j += 3) {
      out[o++] = a[j] + p[1];
      out[o++] = a[j + 1] + p[2];
      out[o++] = a[j + 2] + p[3];
    }
  }
  var g = new T.BufferGeometry();
  g.setAttribute("position", new T.BufferAttribute(out, 3));
  return g;
}

/* the plant services etched into the slab: right angled dog legs from the feed column
   to every hopper foot, on to the press, and out to the transfer. */
function FL_serviceGeo(T) {
  var pts = [];
  function seg(x1, z1, x2, z2) { pts.push(x1, 0.03, z1, x2, 0.03, z2); }
  function dogleg(x1, z1, x2, z2) { seg(x1, z1, x2, z1); seg(x2, z1, x2, z2); }
  var i, hx;
  seg(-6.5, -6.4, -6.5, 6.4);                 /* the spine, under the column */
  for (i = 0; i < 6; i++) {
    hx = FL_HOP_X[i];
    dogleg(-6.5, (i % 2) ? 2.9 : -2.9, hx, (i % 2) ? 1.5 : -1.5);
    seg(hx - 0.34, (i % 2) ? 1.5 : -1.5, hx + 0.34, (i % 2) ? 1.5 : -1.5);
  }
  dogleg(-6.5, 4.6, 3.4, 4.6);                 /* power to the press */
  seg(3.4, 4.6, 3.4, 2.2);
  dogleg(3.4, -4.9, FL_X_TURN, -4.9);          /* and on to the transfer head */
  seg(FL_X_TURN, -4.9, FL_X_TURN, -6.6);
  dogleg(-6.5, -5.9, -9.0, -5.9);              /* and back to the intake gate */
  seg(-9.0, -5.9, -9.0, -2.4);
  for (i = 0; i < 5; i++) {                    /* branch taps, so it reads as plant */
    seg(-8.0 + i * 3.2, 6.1, -8.0 + i * 3.2, 5.2);
    seg(-8.4 + i * 3.2, 5.2, -7.6 + i * 3.2, 5.2);
  }
  var g = new T.BufferGeometry();
  g.setAttribute("position", new T.Float32BufferAttribute(pts, 3));
  return g;
}

/* the transfer throat: hoops plus longitudinals, drawn rather than lit, so the tube the
   output leaves down is the same kind of object as the machine that made it. */
function FL_throatGeo(T, rings) {
  var pts = [], i, k, SEG = 26;
  var zs = [], rs = [];
  for (i = 0; i < rings; i++) {
    var u = i / (rings - 1);
    zs.push(lerp(FL_Z_MOUTH, FL_Z_OUT, u * u * 0.86 + u * 0.14));
    rs.push(lerp(2.45, 0.72, easeOut(u)));
  }
  for (i = 0; i < rings; i++) {
    for (k = 0; k < SEG; k++) {
      var a = (k / SEG) * TAU, b = ((k + 1) / SEG) * TAU;
      pts.push(Math.cos(a) * rs[i], Math.sin(a) * rs[i], zs[i],
               Math.cos(b) * rs[i], Math.sin(b) * rs[i], zs[i]);
    }
  }
  for (k = 0; k < 6; k++) {
    var a2 = (k / 6) * TAU + 0.26;
    for (i = 0; i < rings - 1; i++) {
      pts.push(Math.cos(a2) * rs[i], Math.sin(a2) * rs[i], zs[i],
               Math.cos(a2) * rs[i + 1], Math.sin(a2) * rs[i + 1], zs[i + 1]);
    }
  }
  var g = new T.BufferGeometry();
  g.setAttribute("position", new T.Float32BufferAttribute(pts, 3));
  return g;
}

/* ============================================================================
 * 03 — THE ASSEMBLY FLOOR
 * How the sameness is manufactured: a machine the size of a shoebox, from above.
 * Camera: the only orbit on the page, long lens. Scale: tabletop. Accent: ice.
 * The act does not end by stopping. It ends by handing the output on.
 * ========================================================================== */
export const actFloor = {
  id: "floor", accent: "#6FD3FF", bg: 0x08090B, fov: 28, restT: 0.75,
  fog: function () { return null; },

  build: function (ctx) {
    var T = ctx.THREE, root = ctx.root, S = ctx.actState, small = ctx.small;
    var ICE = 0x6FD3FF;
    var m4 = new T.Matrix4(), q = new T.Quaternion(), e = new T.Euler();
    var v = new T.Vector3(), s = new T.Vector3(1, 1, 1), col = new T.Color();
    var i, j, k;

    /* ---------------- the plan, drawn once, carrying most of the incident -------- */
    var plan = makeTexture(T, ctx.renderer, 1024, 1024, function (g, w, h) {
      var u;
      g.fillStyle = "#0D1116"; g.fillRect(0, 0, w, h);
      g.strokeStyle = "rgba(111,211,255,.18)"; g.lineWidth = 2;
      for (var a = 0; a <= 32; a++) {
        u = (a / 32) * w;
        g.beginPath(); g.moveTo(u, 0); g.lineTo(u, h); g.stroke();
        g.beginPath(); g.moveTo(0, u); g.lineTo(w, u); g.stroke();
      }
      g.fillStyle = "rgba(111,211,255,.10)";
      g.fillRect(90, 120, 380, 240); g.fillRect(560, 150, 330, 300); g.fillRect(180, 640, 620, 220);

      /* two hatch fields, rotated, so the sheet has grain that is not the grid */
      g.save();
      g.strokeStyle = "rgba(111,211,255,.30)"; g.lineWidth = 2; g.setLineDash([3, 7]);
      g.translate(214, 742); g.rotate(-0.42);
      for (var q2 = 0; q2 < 16; q2++) {
        g.beginPath(); g.moveTo(0, q2 * 11); g.lineTo(300, q2 * 11); g.stroke();
      }
      g.restore();
      g.save();
      g.strokeStyle = "rgba(111,211,255,.24)"; g.lineWidth = 2; g.setLineDash([3, 7]);
      g.translate(690, 96); g.rotate(0.38);
      for (var q3 = 0; q3 < 12; q3++) {
        g.beginPath(); g.moveTo(0, q3 * 11); g.lineTo(210, q3 * 11); g.stroke();
      }
      g.restore();
      g.setLineDash([]);

      /* the conveyor centre lines, dashed, running the length of the sheet */
      g.strokeStyle = "rgba(111,211,255,.55)"; g.setLineDash([4, 6]); g.lineWidth = 3;
      for (var d = 0; d < 14; d++) {
        g.beginPath(); g.moveTo(560 + d * 26, 640); g.lineTo(560 + d * 26 + 90, 900); g.stroke();
      }
      g.setLineDash([]);

      /* dimension lines with arrowheads, no figures on them */
      function dim(x1, y1, x2, y2) {
        g.strokeStyle = "rgba(150,225,255,.45)"; g.lineWidth = 2;
        g.beginPath(); g.moveTo(x1, y1); g.lineTo(x2, y2); g.stroke();
        var ang = Math.atan2(y2 - y1, x2 - x1);
        [[x1, y1, ang], [x2, y2, ang + Math.PI]].forEach(function (A) {
          g.beginPath();
          g.moveTo(A[0], A[1]);
          g.lineTo(A[0] + Math.cos(A[2] + 0.34) * 15, A[1] + Math.sin(A[2] + 0.34) * 15);
          g.moveTo(A[0], A[1]);
          g.lineTo(A[0] + Math.cos(A[2] - 0.34) * 15, A[1] + Math.sin(A[2] - 0.34) * 15);
          g.stroke();
        });
      }
      dim(90, 96, 470, 96); dim(560, 126, 890, 126); dim(58, 640, 58, 860);
      dim(180, 604, 800, 604);

      /* bay callouts on leaders */
      g.strokeStyle = "rgba(150,225,255,.40)"; g.lineWidth = 2;
      [[318, 208], [742, 268], [318, 742], [742, 742]].forEach(function (C) {
        g.beginPath(); g.arc(C[0], C[1], 34, 0, TAU); g.stroke();
        g.beginPath(); g.moveTo(C[0] + 24, C[1] - 24); g.lineTo(C[0] + 76, C[1] - 62); g.stroke();
      });

      /* a north arrow, because a plan has one */
      g.save();
      g.translate(944, 118); g.rotate(-0.22);
      g.strokeStyle = "rgba(150,225,255,.7)"; g.lineWidth = 3;
      g.beginPath(); g.moveTo(0, 34); g.lineTo(0, -34); g.stroke();
      g.beginPath(); g.moveTo(0, -34); g.lineTo(-11, -12); g.lineTo(11, -12); g.closePath();
      g.fillStyle = "rgba(150,225,255,.7)"; g.fill();
      g.beginPath(); g.arc(0, 0, 44, 0, TAU); g.stroke();
      g.restore();

      /* a ghost stencil where the bin lands, and a transfer arrow leaving the sheet */
      g.strokeStyle = "rgba(255,59,33,.35)"; g.lineWidth = 3;
      g.setLineDash([9, 7]);
      g.strokeRect(742, 594, 124, 124);
      g.setLineDash([]);
      g.strokeStyle = "rgba(150,225,255,.75)"; g.lineWidth = 4;
      g.beginPath(); g.moveTo(856, 470); g.lineTo(856, 300); g.stroke();
      g.beginPath(); g.moveTo(856, 286); g.lineTo(842, 320); g.lineTo(870, 320); g.closePath();
      g.fillStyle = "rgba(150,225,255,.75)"; g.fill();

      /* title block, generic plant fields, values blocked so nothing legible leaks */
      g.strokeStyle = "rgba(150,225,255,.45)"; g.lineWidth = 2;
      g.strokeRect(624, 872, 372, 132);
      g.font = '600 16px "Martian Mono", ui-monospace, monospace';
      ["SHEET", "REV", "SCALE", "ISSUED", "PLANT"].forEach(function (lab, r) {
        var y = 894 + r * 24;
        g.fillStyle = "rgba(150,225,255,.72)"; g.fillText(lab, 636, y);
        g.fillStyle = "rgba(150,225,255,.34)"; g.fillText("████", 890, y);
        g.strokeStyle = "rgba(111,211,255,.18)";
        g.beginPath(); g.moveTo(628, y + 7); g.lineTo(992, y + 7); g.stroke();
      });

      /* Bay callouts derived from the same FL_HOP_X the hoppers and the etched services
         read, so the drawn plan cannot disagree with the plant standing on it. They were
         eight labels on a fixed spread, left behind when the stations moved upstream.
         The slab is 20 wide and the texture's u runs with world x, so x maps straight in. */
      g.font = '600 18px "Martian Mono", ui-monospace, monospace';
      g.fillStyle = "rgba(150,225,255,.85)";
      FL_HOP_X.forEach(function (hx, b) {
        g.fillText("BAY " + (b + 1), (hx + 10) / 20 * w - 26, 80);
      });
    });

    var slab = new T.Mesh(new T.BoxGeometry(20, 0.7, 14),
      new T.MeshLambertMaterial({ color: 0x232932 }));
    slab.position.y = -0.35;
    root.add(slab);
    var top = new T.Mesh(new T.PlaneGeometry(20, 14), new T.MeshBasicMaterial({ map: plan }));
    top.rotation.x = -Math.PI / 2; top.position.y = 0.011;
    root.add(top);
    S.top = top;

    /* ---------------- lips, folded into one instanced mesh ----------------------- */
    var lip = new T.InstancedMesh(new T.BoxGeometry(1, 1, 1),
      new T.MeshLambertMaterial({ color: 0x232830 }), 4);
    [[0, 0.35, 7.1, 20.4, 0.7, 0.4], [0, 0.35, -7.1, 20.4, 0.7, 0.4],
     [10.1, 0.35, 0, 0.4, 0.7, 14.6], [-10.1, 0.35, 0, 0.4, 0.7, 14.6]].forEach(function (L, n) {
      v.set(L[0], L[1], L[2]); s.set(L[3], L[4], L[5]);
      m4.compose(v, q, s); lip.setMatrixAt(n, m4);
    });
    lip.instanceMatrix.needsUpdate = true; root.add(lip);

    /* ---------------- rails: two carrying, two outer guides ---------------------- */
    var rail = new T.InstancedMesh(new T.BoxGeometry(1, 1, 1),
      new T.MeshLambertMaterial({ color: 0x2E3641 }), 4);
    /* the outer guides stop at x 5.4, short of the transfer head: they belong to the belt run,
       and a guide carried past it would stand in the corridor the output leaves down. */
    [[-1.5, 0.5, 18.4, 0.22, 0.5, -0.6], [1.5, 0.5, 18.4, 0.22, 0.5, -0.6],
     [-2.35, 0.62, 15.0, 0.10, 0.10, -2.1], [2.35, 0.62, 15.0, 0.10, 0.10, -2.1]]
      .forEach(function (R, n) {
      v.set(R[5], R[1], R[0]); s.set(R[2], R[3], R[4]);
      m4.compose(v, q, s); rail.setMatrixAt(n, m4);
    });
    rail.instanceMatrix.needsUpdate = true; root.add(rail);

    /* ---------------- stanchion legs and cross bracing --------------------------- */
    var legs = new T.InstancedMesh(new T.BoxGeometry(1, 1, 1),
      new T.MeshLambertMaterial({ color: 0x1E242C }), 14);
    var n2 = 0;
    [-9.2, -3.1, 3.1, 9.2].forEach(function (x) {
      [-6.2, 6.2].forEach(function (z) {
        v.set(x, -2.05, z); s.set(0.34, 3.4, 0.34);
        m4.compose(v, q, s); legs.setMatrixAt(n2++, m4);
      });
    });
    [[0, -3.4, -6.2, 18.6, 0.16, 0.16, 0], [0, -3.4, 6.2, 18.6, 0.16, 0.16, 0],
     [-9.2, -3.4, 0, 0.16, 0.16, 12.8, 0], [9.2, -3.4, 0, 0.16, 0.16, 12.8, 0],
     [-6.15, -3.4, -6.2, 13.0, 0.14, 0.14, 0.27], [6.15, -3.4, 6.2, 13.0, 0.14, 0.14, -0.27]]
      .forEach(function (B) {
        v.set(B[0], B[1], B[2]); s.set(B[3], B[4], B[5]);
        e.set(0, B[6], 0);
        m4.compose(v, q.setFromEuler(e), s); legs.setMatrixAt(n2++, m4);
      });
    legs.instanceMatrix.needsUpdate = true; root.add(legs);
    q.identity(); e.set(0, 0, 0);

    /* ---------------- the intake gate, with its registration bar ----------------- */
    var gate = new T.InstancedMesh(new T.BoxGeometry(1, 1, 1),
      new T.MeshLambertMaterial({ color: 0x3A4552 }), 4);
    /* the posts stand outboard of the sheet (its far edge reaches z 2.125), so a blank is
       admitted BETWEEN them rather than through one of them */
    [[-9.0, 1.8, -2.45, 0.28, 3.6, 0.28], [-9.0, 1.8, 2.45, 0.28, 3.6, 0.28],
     [-9.0, 3.55, 0, 0.28, 0.28, 5.4]].forEach(function (G, n) {
      v.set(G[0], G[1], G[2]); s.set(G[3], G[4], G[5]);
      m4.compose(v, q, s); gate.setMatrixAt(n, m4);
    });
    gate.instanceMatrix.needsUpdate = true; root.add(gate);
    S.gate = gate;
    S.gateBar = { v: new T.Vector3(), s: new T.Vector3(0.10, 0.07, 4.9), m4: new T.Matrix4() };

    /* ---------------- six feed hoppers over the rails ---------------------------- */
    var hop = new T.InstancedMesh(new T.CylinderGeometry(0.62, 0.26, 1.15, 10, 1, true),
      new T.MeshLambertMaterial({ color: 0x2E3641, side: T.DoubleSide }), 6);
    for (i = 0; i < 6; i++) {
      v.set(FL_HOP_X[i], 5.05, (i % 2) ? 1.5 : -1.5); s.set(1, 1, 1);
      m4.compose(v, q, s); hop.setMatrixAt(i, m4);
    }
    hop.instanceMatrix.needsUpdate = true; root.add(hop);

    /* feed spouts, the thin drop between hopper and rail: one more instanced mesh */
    var spout = new T.InstancedMesh(new T.CylinderGeometry(0.07, 0.07, 3.5, 6),
      new T.MeshBasicMaterial({ color: 0x9FD8F2, transparent: true, opacity: 0.34 }), 6);
    for (i = 0; i < 6; i++) {
      v.set(FL_HOP_X[i], 2.7, (i % 2) ? 1.5 : -1.5);
      m4.compose(v, q, s); spout.setMatrixAt(i, m4);
    }
    spout.instanceMatrix.needsUpdate = true; root.add(spout);
    S.spout = spout;

    /* ---------------- blank stock in the plan bays, and it drains ---------------- */
    var LV = 12, STK = small ? 4 : 8;
    var stock = new T.InstancedMesh(new T.BoxGeometry(1.9, 0.062, 1.2),
      new T.MeshLambertMaterial({ color: 0x8FB8CE }), LV * STK);
    /* no bay may land inside the reject bin's footprint (x 5.0..7.4, z 2.3..4.7) — blue blank
       stock growing out through the wall of the red bin inverts the one thing the bin says —
       and none may sit in the departure corridor off the transfer head (x 7.4..9.4, z < -1.5). */
    var CEN = small ? [[-8.2, -4.6], [-4.6, 4.6], [4.8, -4.6], [8.8, 4.6]]
                    : [[-8.2, -4.6], [-8.2, 4.6], [-4.6, -4.6], [-4.6, 4.6],
                       [4.8, -4.6], [3.2, 4.6], [-1.2, -4.6], [8.8, 4.6]];
    var rnd = mulberry32(19);
    for (var lv = 0; lv < LV; lv++) {
      for (k = 0; k < STK; k++) {
        v.set(CEN[k][0] + (rnd() - 0.5) * 0.10, 0.05 + lv * 0.064, CEN[k][1] + (rnd() - 0.5) * 0.10);
        e.set(0, (rnd() - 0.5) * 0.05, 0);
        m4.compose(v, q.setFromEuler(e), s);
        stock.setMatrixAt(lv * STK + k, m4);      /* top sheet = highest index */
      }
    }
    stock.instanceMatrix.needsUpdate = true; root.add(stock);
    S.stock = stock; S.stockN = LV * STK;
    q.identity(); e.set(0, 0, 0);

    /* ---------------- the units on the line -------------------------------------- */
    var NP = small ? 12 : 16;
    var KP = Math.floor(NP * 0.64);
    S.NP = NP; S.SP = (KP + 0.5) / NP;
    var panels = new T.InstancedMesh(
      new T.PlaneGeometry(2.0, 1.25),
      new T.MeshBasicMaterial({
        map: averagePageTexture(T, ctx.renderer, "#B6E4FA"), alphaTest: 0.4, side: T.DoubleSide
      }), NP);
    root.add(panels);
    S.panels = panels;

    /* the refused ones leave the press already marked, as their own mesh, so nothing
       has to be recoloured per frame to tell you which units failed */
    var rejIdx = [];
    for (i = 0; i < NP; i++) if (i % 5 === 2) rejIdx.push(i);
    S.rejIdx = rejIdx;
    var flung = new T.InstancedMesh(
      new T.PlaneGeometry(2.0, 1.25),
      new T.MeshBasicMaterial({
        map: averagePageTexture(T, ctx.renderer, "#FF6A50"), alphaTest: 0.4, side: T.DoubleSide
      }), rejIdx.length);
    root.add(flung);
    S.flung = flung;

    /* ---------------- the reject bin, and the pile inside it --------------------- */
    var bin = new T.Mesh(new T.BoxGeometry(2.4, 0.95, 2.4),
      new T.MeshLambertMaterial({ color: 0x232932 }));
    bin.position.set(FL_BIN[0], 0.13, FL_BIN[2]);
    root.add(bin);

    var RJ = small ? 14 : 26;
    var pile = new T.InstancedMesh(new T.PlaneGeometry(1.6, 1.0),
      new T.MeshBasicMaterial({ alphaTest: 0.4, side: T.DoubleSide,
        map: averagePageTexture(T, ctx.renderer, "#FF3B21") }), RJ);
    var rnd2 = mulberry32(11);
    for (i = 0; i < RJ; i++) {
      v.set(FL_BIN[0] + (rnd2() - 0.5) * 1.7, 0.20 + i * 0.019, FL_BIN[2] + (rnd2() - 0.5) * 1.7);
      e.set(-Math.PI / 2 + (rnd2() - 0.5) * 0.5, (rnd2() - 0.5) * 1.2, 0);
      m4.compose(v, q.setFromEuler(e), s);
      pile.setMatrixAt(i, m4);
    }
    pile.instanceMatrix.needsUpdate = true; root.add(pile);
    S.pile = pile; S.RJ = RJ;
    q.identity(); e.set(0, 0, 0);

    /* ---------------- the press ------------------------------------------------- */
    /* press frame and transfer head share a material, so they share a draw call */
    var press = new T.InstancedMesh(new T.BoxGeometry(1, 1, 1),
      new T.MeshLambertMaterial({ color: 0x3A4552 }), 7);
    /* the two lanes sweep z -2.125..-0.875 and 0.875..2.125 at belt height, and the ejection
       arc throws a tumbling unit out to z 3.10 while it is still in the uprights' x band. So
       every solid here either straddles both of those or ducks under the run. Nothing stands
       in it: the deck's top face is at 0.61, the same 0.05 the carrying rails leave. */
    [[FL_X_PRESS, 2.6, -3.45, 0.62, 4.4, 0.62], [FL_X_PRESS, 2.6, 3.45, 0.62, 4.4, 0.62],
     [FL_X_PRESS, 4.55, 0, 2.6, 0.62, 7.7], [FL_X_PRESS, 0.18, 0, 2.8, 0.30, 3.6],
     [FL_X_TURN, 0.30, 0, 2.9, 0.62, 3.4], [FL_X_TURN - 1.7, 1.25, 0, 0.3, 2.5, 1.5],
     [FL_X_TURN, 2.5, 0, 2.9, 0.34, 3.6]]
      .forEach(function (B, n) {
        v.set(B[0], B[1], B[2]); s.set(B[3], B[4], B[5]);
        m4.compose(v, q, s); press.setMatrixAt(n, m4);
      });
    press.instanceMatrix.needsUpdate = true; root.add(press);
    s.set(1, 1, 1);   /* the press wrote a scale into the shared scratch. Everything built
                         after this composes with s, so it has to go back to unity here. */

    var arm = new T.Mesh(new T.BoxGeometry(2.2, 1.0, 2.8),
      new T.MeshLambertMaterial({ color: 0x55636F }));
    arm.position.set(FL_X_PRESS, 2.35, 0);
    root.add(arm);
    S.arm = arm;
    /* the arm carries its own outline as a child, so the one drawn edge on the floor that
       has to move with its solid is not baked into the merged static buffer */
    arm.add(new T.LineSegments(
      new T.EdgesGeometry(new T.BoxGeometry(2.2, 1.0, 2.8)),
      new T.LineBasicMaterial({ color: ICE, transparent: true, opacity: 0.6 })));

    /* the die flashes on the strike, so the punch registers even at this lens */
    var die = new T.Mesh(new T.PlaneGeometry(2.6, 3.2),
      new T.MeshBasicMaterial({ color: 0xE6F7FF, transparent: true, opacity: 0 }));
    die.rotation.x = -Math.PI / 2; die.position.set(FL_X_PRESS, 0.36, 0);
    root.add(die);
    S.die = die;

    /* ---------------- the feed column ------------------------------------------- */
    var colShell = new T.Mesh(new T.CylinderGeometry(0.6, 0.75, 7, 18, 1, true),
      new T.MeshBasicMaterial({ color: ICE, transparent: true, opacity: 0.4, side: T.DoubleSide }));
    colShell.position.set(-6.5, 3.5, 0); root.add(colShell);
    var colCore = new T.Mesh(new T.CylinderGeometry(0.22, 0.22, 7.2, 12),
      new T.MeshBasicMaterial({ color: 0xE6F7FF }));
    colCore.position.copy(colShell.position); root.add(colCore);
    S.col = colShell;

    /* ---------------- overhead trusses, bolts, and the travelling crane ---------- */
    var truss = new T.InstancedMesh(new T.BoxGeometry(0.14, 0.14, 14),
      new T.MeshLambertMaterial({ color: 0x2A323C }), 12);
    for (i = 0; i < 12; i++) {
      v.set(-8.6 + i * 1.6, 6.4, 0);
      m4.compose(v, q, s); truss.setMatrixAt(i, m4);
    }
    truss.instanceMatrix.needsUpdate = true; root.add(truss);

    var bolt = new T.InstancedMesh(new T.CylinderGeometry(0.09, 0.09, 0.16, 8),
      new T.MeshLambertMaterial({ color: 0x424B57 }), 40);
    for (i = 0; i < 40; i++) {
      v.set(-9.3 + (i % 10) * 2.07, 0.08, [-5.4, -2.6, 2.6, 5.4][Math.floor(i / 10)]);
      m4.compose(v, q, s); bolt.setMatrixAt(i, m4);
    }
    bolt.instanceMatrix.needsUpdate = true; root.add(bolt);

    var crane = new T.InstancedMesh(new T.BoxGeometry(1, 1, 1),
      new T.MeshLambertMaterial({ color: 0x55636F }), 3);
    root.add(crane);
    S.crane = { mesh: crane, v: new T.Vector3(), s: new T.Vector3(), m4: new T.Matrix4() };

    /* ---------------- status lamps set into the lip ------------------------------ */
    var LAMP = 24;
    var lamps = new T.InstancedMesh(new T.SphereGeometry(0.095, 8, 6),
      new T.MeshBasicMaterial({ color: 0xffffff }), LAMP);
    S.lampX = new Float32Array(LAMP); S.lampZ = new Float32Array(LAMP);
    for (i = 0; i < LAMP; i++) {
      var lx = -9.5 + (i % 12) * 1.73, lz = (i < 12) ? 7.1 : -7.1;
      S.lampX[i] = lx; S.lampZ[i] = lz;
      v.set(lx, 0.78, lz);
      m4.compose(v, q, s); lamps.setMatrixAt(i, m4);
      lamps.setColorAt(i, col.setHex(0x1E4C61));
    }
    lamps.instanceMatrix.needsUpdate = true;
    if (lamps.instanceColor) lamps.instanceColor.needsUpdate = true;
    root.add(lamps);
    S.lamps = lamps; S.LAMP = LAMP;
    /* rank each lamp by how far along the line it sits, so they come on left to right */
    var order = [];
    for (i = 0; i < LAMP; i++) order.push(i);
    order.sort(function (a, b) { return S.lampX[a] - S.lampX[b]; });
    S.lampRank = new Int8Array(LAMP);
    for (i = 0; i < LAMP; i++) S.lampRank[order[i]] = i;
    S.lampState = new Int8Array(LAMP);
    S.lampGuard = -1;
    S.cLampOff = new T.Color(0x1E4C61);
    S.cLampOn = new T.Color(0x6FD3FF);
    S.cLampRed = new T.Color(0xFF3B21);
    S.cLampHot = new T.Color(0xDFF4FF);

    /* ---------------- services etched on the slab -------------------------------- */
    var svc = new T.LineSegments(FL_serviceGeo(T),
      new T.LineBasicMaterial({ color: ICE, transparent: true, opacity: 0.16 }));
    root.add(svc);
    S.svc = svc;

    /* ---------------- the transfer throat, and its mouth ------------------------- */
    var throat = new T.LineSegments(FL_throatGeo(T, small ? 6 : 9),
      new T.LineBasicMaterial({ color: ICE, transparent: true, opacity: 0.14 }));
    throat.position.set(FL_X_TURN, FL_Y_AXIS, 0);
    root.add(throat);
    S.throat = throat;

    /* A rim, not a bloom. Wide and soft, this read as a big white halo: the single most
       generic effect available, and it landed exactly where this act's copy column sits.
       The stops are tight so it describes the lit edge of an opening and stops there. */
    var mouthTex = makeTexture(T, ctx.renderer, 256, 256, function (g, w, h) {
      var r = g.createRadialGradient(w / 2, h / 2, w * 0.30, w / 2, h / 2, w / 2);
      r.addColorStop(0, "rgba(111,211,255,0)");
      r.addColorStop(0.74, "rgba(111,211,255,0)");
      r.addColorStop(0.86, "rgba(198,236,255,.50)");
      r.addColorStop(0.93, "rgba(111,211,255,.22)");
      r.addColorStop(1, "rgba(111,211,255,0)");
      g.fillStyle = r; g.fillRect(0, 0, w, h);
    });
    var mouth = new T.Mesh(new T.PlaneGeometry(4.3, 4.3),
      new T.MeshBasicMaterial({ map: mouthTex, transparent: true, opacity: 0, depthWrite: false }));
    mouth.position.set(FL_X_TURN, FL_Y_AXIS, FL_Z_MOUTH + 0.1);
    root.add(mouth);
    S.mouth = mouth;

    /* ---------------- press exhaust, desktop only -------------------------------- */
    if (!small) {
      /* centred on the object's own origin, so the ambient spin is one matrix and the
         cloud turns on itself rather than orbiting the world origin */
      var pts = new Float32Array(120 * 3), rnd3 = mulberry32(23);
      for (i = 0; i < 120; i++) {
        pts[i * 3] = (rnd3() - 0.5) * 3.2;
        pts[i * 3 + 1] = (rnd3() - 0.5) * 3.0;
        pts[i * 3 + 2] = (rnd3() - 0.5) * 3.2;
      }
      var pg = new T.BufferGeometry();
      pg.setAttribute("position", new T.BufferAttribute(pts, 3));
      var motes = new T.Points(pg, new T.PointsMaterial({
        size: 0.07, color: 0xBFE6FA, transparent: true, opacity: 0,
        sizeAttenuation: true, depthWrite: false
      }));
      motes.position.set(FL_X_PRESS, 3.4, 0);
      root.add(motes);
      S.motes = motes;
    }

    /* ---------------- one LineSegments for every outline on the floor ------------ */
    var edges = new T.LineSegments(FL_mergeEdges(T, [
      [20, 0.7, 14, 0, -0.35, 0],
      [2.4, 0.95, 2.4, FL_BIN[0], 0.13, FL_BIN[2]],
      [2.9, 0.62, 3.4, FL_X_TURN, 0.30, 0],
      [2.6, 0.62, 7.7, FL_X_PRESS, 4.55, 0]
    ]), new T.LineBasicMaterial({ color: ICE, transparent: true, opacity: 0.5 }));
    root.add(edges);

    /* ---------------- light ------------------------------------------------------ */
    root.add(new T.HemisphereLight(0x6E93B0, 0x0B1016, 1.1));
    var pl = new T.PointLight(ICE, 300, 34, 2); pl.position.set(-6.5, 3.5, 0); root.add(pl);
    var key = new T.DirectionalLight(0xE6F4FF, 2.6); key.position.set(11, 18, 9); root.add(key);
    S.key = key;
    var fill = new T.DirectionalLight(0x6E93B0, 0.5); fill.position.set(-12, 8, -6); root.add(fill);
    /* the transfer's own lamp, dark until the hand-off */
    var out = new T.PointLight(0xCFEEFF, 0, 26, 2);
    out.position.set(FL_X_TURN, FL_Y_AXIS + 0.6, FL_Z_MOUTH + 1.2);
    root.add(out);
    S.out = out;

    /* ---------------- scratch, allocated once ------------------------------------ */
    S.m4 = new T.Matrix4(); S.q = new T.Quaternion(); S.e = new T.Euler(0, 0, 0);
    S.v = new T.Vector3(); S.s = new T.Vector3(1, 1, 1);
    S.stockGuard = -1; S.pileGuard = -1;
    S.cWhite = new T.Color(0xFFFFFF); S.cCold = new T.Color(0x7C8B96);
    S.__refused = false;

    /* the belt's phase offset is chosen so the resting frame (prefers-reduced-motion pins
       t to restT) catches the press at the bottom of a stroke with a unit under it */
    var rb = NP * (1.05 * FL_REST + 2.35 * FL_REST * FL_REST);
    S.ph0 = 0.5 - (rb - Math.floor(rb));
  },

  camera: function (ctx) {
    /* The only orbit on the page, and it holds a 40 degree elevation for four fifths of
       the act. The last two legs drop to eleven degrees and close the radius, which is not
       a new grammar but the same orbit coming down onto the transfer axis: the camera
       stops looking AT the floor and starts looking along what leaves it. */
    var KEYS = [
      { t: 0.00, az: -0.76, rad: 52.0, el: 40, look: [-3.0, 2.60, 0.0], fov: 28 },
      { t: 0.20, az: -0.48, rad: 44.0, el: 40, look: [-5.2, 2.00, 0.0], fov: 28 },
      { t: 0.44, az: -0.12, rad: 36.0, el: 40, look: [-0.6, 1.40, 0.0], fov: 28 },
      { t: 0.66, az: 0.16, rad: 30.0, el: 40, look: [3.2, 1.60, 0.0], fov: 28 },
      { t: 0.80, az: 0.30, rad: 25.0, el: 38, look: [5.0, 1.60, -0.6], fov: 28 },
      { t: 0.90, az: 0.30, rad: 19.0, el: 26, look: [7.6, 1.50, -3.4], fov: 29 },
      { t: 1.00, az: 0.22, rad: 13.5, el: 11, look: [8.4, 1.35, -10.5], fov: 33 }
    ];
    var t = ctx.t, i = 0;
    while (i < KEYS.length - 2 && t > KEYS[i + 1].t) i++;
    var a = KEYS[i], b = KEYS[i + 1];
    var k = ease(clamp01((t - a.t) / Math.max(1e-6, b.t - a.t)));
    var az = lerp(a.az, b.az, k), rad = lerp(a.rad, b.rad, k);
    var el = lerp(a.el, b.el, k) * Math.PI / 180;
    var lx = lerp(a.look[0], b.look[0], k);
    var ly = lerp(a.look[1], b.look[1], k);
    var lz = lerp(a.look[2], b.look[2], k);
    var fov = lerp(a.fov, b.fov, k);
    var c = ctx.camera, ce = Math.cos(el);
    c.position.set(
      lx + Math.sin(az) * rad * ce + ctx.pointer.x * 0.55,
      ly + Math.sin(el) * rad + ctx.pointer.y * -0.35,
      lz + Math.cos(az) * rad * ce
    );
    c.rotation.set(0, 0, 0);
    c.lookAt(lx, ly, lz);
    if (Math.abs(c.fov - fov) > 0.001) { c.fov = fov; c.updateProjectionMatrix(); }
  },

  frame: function (ctx) {
    /* no ctx.clock is read anywhere in this act: every visible state below is a pure
       function of ctx.t, so a backward scrub restores the world exactly and the
       reduced-motion still frame at restT is the same picture on every load. */
    var S = ctx.actState, t = ctx.t;
    var NP = S.NP, SP = S.SP, m4 = S.m4, v = S.v, s = S.s, q = S.q, e = S.e;
    var i, x, y, z, sc, p, lane;

    /* THE LINE. One slot per unit, and the slot number is a pure function of t: the belt
       does not run on the clock, so a given unit is always in the same place at the same
       scroll position, the press always lands on a unit, and scrubbing back is exact.
       The rate rises through the act, so the floor speeds up as it warms. */
    var slot = S.ph0 + NP * (1.05 * t + 2.35 * t * t);
    var u = slot - Math.floor(slot);
    /* the line fills as the act opens. The gate is FRACTIONAL, not a count: a unit two units
       wide is about eight per cent of the frame even at fifty units out, so a slot appearing
       at full size would be a visible pop. Instead each new index scales up from nothing, and
       a backward scrub scales it away again. */
    var liveF = lerp(6, NP, easeOut(clamp01((t - 0.01) / 0.13)));
    S.panels.count = NP;
    /* the press marks a unit and it leaves on the other mesh. One value drives BOTH sides of
       that swap, so the blue unit fades out exactly as the vermilion one appears and no unit
       is ever deleted with nothing standing in for it. It starts when the press starts. */
    var flungOn = clamp01((t - 0.20) / 0.12);

    for (i = 0; i < NP; i++) {
      var si = (i + slot) / NP;
      var sv = si - Math.floor(si);
      lane = (i % 2) ? 1.5 : -1.5;
      var rx = -Math.PI / 2, ry = 0, rz = 0;
      if (sv < SP) {
        /* intake to press: the unit is formed at the gate and carried down the rails */
        x = lerp(FL_X_IN, FL_X_PRESS, sv / SP); y = FL_Y_BELT; z = lane;
        sc = clamp01(sv / 0.045);
      } else {
        p = (sv - SP) / (1 - SP);
        if (p < 0.30) {
          x = lerp(FL_X_PRESS, FL_X_TURN, p / 0.30); y = FL_Y_BELT; z = lane; sc = 1;
        } else {
          /* THE HAND-OFF. Past the transfer head the unit turns ninety degrees, stands up
             and leaves the floor down the throat, still travelling, never arriving.
             Three curves, and each one is answering a solid:
             cv  the stand-up. It waits until the unit has carried clear of the transfer deck
                 in z, because a sheet pivoting on its own centre drops its lower edge 0.38
                 below the belt plane and would swing through the deck it just left.
             cn  the convergence. The throat closes from r 2.45 to r 0.72, so a lane offset
                 held down the tube puts the unit OUTSIDE the hoops that are meant to swallow
                 it. Both lanes close onto the tube's own axis: two streams become one.
             rz  the roll. Rotation about the tube axis costs nothing in radius, so it is
                 where the per-unit variety goes now that the lanes have merged. */
          var qd = (p - 0.30) / 0.70;
          var qz = qd * qd * 0.86 + qd * 0.14;
          var cv = ease(clamp01((qd - 0.30) / 0.28));
          var cn = 1 - ease(clamp01((qd - 0.40) / 0.24));
          x = FL_X_TURN + lane * 0.55 * cv * cn;
          y = lerp(FL_Y_BELT, FL_Y_AXIS, cv);
          z = lerp(lane, FL_Z_OUT, qz);
          rx = lerp(-Math.PI / 2, 0, cv);
          rz = ((i % 3) - 1) * 0.26 * cv;
          sc = 1 - clamp01((qd - 0.50) / 0.50);
        }
      }
      sc *= clamp01(liveF - i);                 /* the fill, fractional so nothing pops in */
      if (i % 5 === 2) sc *= 1 - flungOn;       /* refused: handed over to the other mesh */
      v.set(x, y, z); s.set(sc, sc, 1); e.set(rx, ry, rz);
      m4.compose(v, q.setFromEuler(e), s);
      S.panels.setMatrixAt(i, m4);
    }
    S.panels.instanceMatrix.needsUpdate = true;

    /* the units the press marks come out already vermilion and go over the side. The gate is
       the exact complement of the one applied to the blue mesh above, so the two are always
       one unit between them and the crossing reverses under a backward scrub. */
    var rej = S.rejIdx;
    for (i = 0; i < rej.length; i++) {
      var ri = rej[i];
      var sr = (ri + slot) / NP; sr -= Math.floor(sr);
      var gf = clamp01(liveF - ri) * flungOn;
      lane = (ri % 2) ? 1.5 : -1.5;
      if (gf <= 0 || sr < SP) {
        sc = 0; x = FL_X_PRESS; y = FL_Y_BELT; z = lane; e.set(-Math.PI / 2, 0, 0);
      } else {
        p = (sr - SP) / (1 - SP);
        var pb = clamp01(p / 0.32);
        x = lerp(FL_X_PRESS, FL_BIN[0], pb);
        z = lerp(lane, FL_BIN[2], pb);
        y = lerp(FL_Y_BELT, 0.62, pb) + Math.sin(Math.PI * pb) * 1.5;
        e.set(-Math.PI / 2 + pb * 2.4, pb * 1.3, pb * 0.6);
        sc = p < 0.32 ? gf : 0;
      }
      v.set(x, y, z); s.set(sc, sc, 1);
      m4.compose(v, q.setFromEuler(e), s);
      S.flung.setMatrixAt(i, m4);
    }
    S.flung.instanceMatrix.needsUpdate = true;

    /* THE PRESS. The stroke is derived from the same slot number as the belt, so the arm
       is at the bottom exactly when a unit is registered under it. */
    var amp = clamp01((t - 0.20) / 0.14);
    var d = FL_dip(u) * amp;
    S.arm.position.y = 2.35 - d * 1.15;
    S.die.material.opacity = 0.55 * d * d;

    /* the intake bar drops on the opposite half of the slot, as each blank is admitted */
    var ug = slot + 0.5; ug -= Math.floor(ug);
    var G = S.gateBar;
    G.v.set(-9.0, 3.30 - 1.9 * FL_dip(ug) * clamp01((t - 0.02) / 0.12), 0);
    G.m4.compose(G.v, q.identity(), G.s);
    S.gate.setMatrixAt(3, G.m4);
    S.gate.instanceMatrix.needsUpdate = true;

    /* The gantry works the downstream half of the floor and then parks over the TRANSFER HEAD,
       not the press: it ends on the side the output leaves from, so it moves with the act
       instead of pulling the eye back upstream at the close. Its rail stops short of the feed
       column, and the hook rests above the press crown (top y 4.86) rather than inside it. The
       cable pays out as the hook drops, so its length is the drop rather than a fixed stick. */
    var C = S.crane;
    var tri = 1 - Math.abs(1 - ((t * 2.6) % 2));
    var cx = lerp(lerp(-4.6, 6.2, tri), FL_X_TURN, ease(clamp01((t - 0.82) / 0.10)));
    var hookD = ease(clamp01((t - 0.84) / 0.10)) * (1 - ease(clamp01((t - 0.96) / 0.04)));
    var hookY = 5.30 - hookD * 0.95;
    C.v.set(cx, 6.05, 0); C.s.set(0.95, 0.5, 1.7);
    C.m4.compose(C.v, q, C.s); C.mesh.setMatrixAt(0, C.m4);
    C.v.set(cx, (6.05 + hookY) * 0.5, 0); C.s.set(0.07, 6.05 - hookY, 0.07);
    C.m4.compose(C.v, q, C.s); C.mesh.setMatrixAt(1, C.m4);
    C.v.set(cx, hookY, 0); C.s.set(0.52, 0.22, 0.52);
    C.m4.compose(C.v, q, C.s); C.mesh.setMatrixAt(2, C.m4);
    C.mesh.instanceMatrix.needsUpdate = true;

    /* raw stock drains from the top down, and the bin fills. both are count moves, so
       neither costs a matrix write and both reverse exactly under a backward scrub. */
    var stockN = Math.round(lerp(S.stockN, S.stockN * 0.14, easeOut(clamp01((t - 0.08) / 0.72))));
    if (stockN !== S.stockGuard) { S.stock.count = stockN; S.stockGuard = stockN; }
    var pileN = Math.round(clamp01((t - 0.50) / 0.34) * S.RJ);
    if (pileN !== S.pileGuard) { S.pile.count = pileN; S.pileGuard = pileN; }

    /* the lip lamps come on left to right as the line warms, go vermilion around the bin
       once the press is throwing units out, and go hot at the transfer end for the pass.
       One integer decides whether any of that changed, so the colour buffer is uploaded
       on a crossing and never on a held frame. */
    var litN = Math.floor((t - 0.10) / 0.017) + 1;
    if (litN < 0) litN = 0; if (litN > S.LAMP) litN = S.LAMP;
    var gKey = litN * 4 + (t > 0.52 ? 2 : 0) + (t > 0.84 ? 1 : 0);
    if (gKey !== S.lampGuard) {
      S.lampGuard = gKey;
      for (i = 0; i < S.LAMP; i++) {
        var lit = S.lampRank[i] < litN;
        var c2 = S.cLampOff;
        if (lit) {
          c2 = S.cLampOn;
          if (t > 0.52 && S.lampZ[i] > 0 && Math.abs(S.lampX[i] - FL_BIN[0]) < 3.2) c2 = S.cLampRed;
          else if (t > 0.84 && S.lampX[i] > 6.4) c2 = S.cLampHot;
        }
        S.lamps.setColorAt(i, c2);
      }
      if (S.lamps.instanceColor) S.lamps.instanceColor.needsUpdate = true;
    }

    /* the floor powers up, then hands its brightness downstream */
    S.svc.material.opacity = lerp(0.14, 0.52, ease(clamp01((t - 0.10) / 0.45)))
      + 0.20 * clamp01((t - 0.78) / 0.16);
    S.spout.material.opacity = 0.34 * clamp01((t - 0.06) / 0.14);
    /* the column breathes on SCROLL, not on the clock: six cycles across the act. A clock sine
       here would give a different brightness every time you came back to the same scroll
       position, and would leave the reduced-motion still frame at whatever phase it loaded in. */
    S.col.material.opacity = (0.30 + Math.sin(t * TAU * 6) * 0.09) * clamp01((t - 0.02) / 0.12);

    var hand = ease(clamp01((t - 0.62) / 0.30));
    S.throat.material.opacity = lerp(0.10, 0.95, hand);
    S.mouth.material.opacity = 0.62 * ease(clamp01((t - 0.66) / 0.26));
    S.out.intensity = 190 * ease(clamp01((t - 0.70) / 0.24));
    S.key.intensity = lerp(2.6, 1.15, ease(clamp01((t - 0.80) / 0.20)));
    S.top.material.color.lerpColors(S.cWhite, S.cCold, ease(clamp01((t - 0.78) / 0.22)));

    if (S.motes) {
      S.motes.material.opacity = 0.30 * clamp01((t - 0.24) / 0.12) * (1 - 0.45 * hand);
      S.motes.rotation.y = t * 2.4;           /* one matrix, and scored off scroll like the rest */
    }

    /* the tally is a global counter, so the hook is latched. Everything it refers to is
       drawn from t above, and reverses on the way back up. */
    if (t > 0.52 && !S.__refused) {
      S.__refused = true;
      if (ctx.hooks && ctx.hooks.onRefuse) ctx.hooks.onRefuse(S.rejIdx.length);
    }
  }
};

/* ============================================================================
 * 04 — THE OUTPUT RUN   (module scope helpers)
 * ========================================================================== */

/* The run is a fixed 136 units on every device. Density steps down on a phone,
   LENGTH never does, so every z driven event (flaps, gantries, the bulkhead, the
   aperture the camera flies through) lands at the same scroll position everywhere. */
var RUN_LEN = 136;
var RUN_END_Z = -139;          /* the bulkhead, and the hole in it */

/* the strike plate that lands over a refused page: a border, two rules and a corner
   tab. no words, no glyphs, no count. */
function runStrikeTexture(T, renderer) {
  return makeTexture(T, renderer, 256, 160, function (g, w, h) {
    g.strokeStyle = "#FF3B21";
    g.lineWidth = 10;
    g.strokeRect(6, 6, w - 12, h - 12);
    g.lineWidth = 7;
    g.beginPath(); g.moveTo(16, 16); g.lineTo(w - 16, h - 16); g.stroke();
    g.beginPath(); g.moveTo(w - 16, 16); g.lineTo(16, h - 16); g.stroke();
    g.fillStyle = "#FF3B21";
    g.fillRect(6, 6, 58, 26);
    g.fillRect(w - 64, h - 32, 58, 26);
  });
}

/* the plate bolted to every gantry. the word is the whole argument of the act:
   everything in this tube was signed off by somebody. It is drawn centred and square
   because the plate now hangs off the top rib facing the lens; bolted flat to the side
   rib it was 57 degrees off normal, three pixels tall, and behind an opaque page wall. */
function runApprovedTexture(T, renderer) {
  return makeTexture(T, renderer, 512, 96, function (g, w, h) {
    g.font = '600 52px "Martian Mono", ui-monospace, monospace';
    g.textBaseline = "middle";
    g.textAlign = "center";
    g.fillStyle = "#939EAC";
    g.fillText("APPROVED", w / 2, 40);
    g.fillRect(w / 2 - 150, 76, 300, 3);
    g.textAlign = "left";
  });
}

/* the belt under the run. rungs and two rails, nothing else. */
function runBeltTexture(T, renderer) {
  return makeTexture(T, renderer, 128, 512, function (g, w, h) {
    g.fillStyle = "#0E1015"; g.fillRect(0, 0, w, h);
    g.fillStyle = "#1C212A";
    for (var i = 0; i < 16; i++) g.fillRect(0, i * 32, w, 4);
    g.fillStyle = "#252B35";
    g.fillRect(12, 0, 4, h);
    g.fillRect(w - 16, 0, 4, h);
  });
}

/* what is on the other side of the hole: cleared ground. a survey grid and nothing
   standing on it, which is the point of the last beat. */
function runFieldTexture(T, renderer) {
  return makeTexture(T, renderer, 512, 512, function (g, w, h) {
    g.fillStyle = "#0A0C10"; g.fillRect(0, 0, w, h);
    g.strokeStyle = "rgba(154,164,178,.13)"; g.lineWidth = 2;
    for (var i = 1; i < 4; i++) {
      var u = (i / 4) * w;
      g.beginPath(); g.moveTo(u, 0); g.lineTo(u, h); g.stroke();
      g.beginPath(); g.moveTo(0, u); g.lineTo(w, u); g.stroke();
    }
    g.strokeStyle = "rgba(154,164,178,.30)"; g.lineWidth = 3;
    g.setLineDash([10, 22]);
    g.strokeRect(72, 72, w - 144, h - 144);
    g.setLineDash([]);
  }, { repeat: [4, 9] });
}

/* the terminal bulkhead: hundreds more of the same page, tiled flat. the punch list
   bans title bars, dots and address strips here, so this is frame, headline bar and
   three cards only, drawn as the villain and nothing else. */
function runBulkheadTexture(T, renderer) {
  return makeTexture(T, renderer, 1024, 640, function (g, w, h) {
    g.fillStyle = "#0B0D11"; g.fillRect(0, 0, w, h);
    var rnd = mulberry32(7);
    var cw = w / 16, ch = h / 10;
    for (var cx = 0; cx < 16; cx++) {
      for (var cy = 0; cy < 10; cy++) {
        var x = cx * cw + 4, y = cy * ch + 6;
        var a = 0.18 + rnd() * 0.50;
        g.strokeStyle = "rgba(150,161,176," + a.toFixed(3) + ")";
        g.fillStyle = "rgba(150,161,176," + (a * 0.9).toFixed(3) + ")";
        g.lineWidth = 1.5;
        g.strokeRect(x, y, cw - 12, ch - 16);
        g.fillRect(x + 7, y + 9, (cw - 12) * 0.52, 4);
        for (var k = 0; k < 3; k++) {
          g.strokeRect(x + 7 + k * ((cw - 26) / 3), y + 22, (cw - 34) / 3, ch - 44);
        }
      }
    }
  });
}

/* the flare that fires where a page was struck */
function runFlareTexture(T, renderer) {
  return makeTexture(T, renderer, 256, 256, function (g, w, h) {
    var r = g.createRadialGradient(w / 2, h / 2, 2, w / 2, h / 2, w / 2);
    r.addColorStop(0, "rgba(255,59,33,.95)");
    r.addColorStop(0.42, "rgba(255,59,33,.34)");
    r.addColorStop(1, "rgba(255,59,33,0)");
    g.fillStyle = r; g.fillRect(0, 0, w, h);
  });
}

/* ---- the refusal itself, shared by the click handler and the r key ---- */

/* A refused page does four things at once, so the strike reads at flight speed and
   from any distance: it recolours, it SWINGS OUT of the wall on its inner edge, it
   takes a struck plate over its face, and it puts a bar in the ledger rack that is
   pacing alongside you. */
function runStrike(ctx, mi, id) {
  var S = ctx.actState;
  if (id == null || mi == null) return false;
  var W = S.walls[mi];
  if (!W || id >= W.mesh.count || W.gone[id]) return false;
  W.gone[id] = 1;

  var b = id * 3;
  var px = W.pos[b], py = W.pos[b + 1], pz = W.pos[b + 2];
  var ex = W.rot[b], ey = W.rot[b + 1], ez = W.rot[b + 2];
  var side = px < 0 ? 1 : -1;

  /* pulled out of the line: it turns square into the channel and drops back toward you */
  S.e.set(ex * 0.4, ey + side * 0.92, ez * 0.6);
  S.q.setFromEuler(S.e);
  S.v.set(px + side * -0.30, py, pz + 0.42);
  S.s.set(1, 1, 1);
  S.m4.compose(S.v, S.q, S.s);
  W.mesh.setMatrixAt(id, S.m4);
  W.mesh.instanceMatrix.needsUpdate = true;
  W.mesh.setColorAt(id, S.stamp);
  if (W.mesh.instanceColor) W.mesh.instanceColor.needsUpdate = true;

  /* the struck plate, floated just clear of the page along its own normal */
  if (S.struck.count < S.struckMax) {
    S.n.set(0, 0, 1).applyQuaternion(S.q).multiplyScalar(0.075);
    S.v.add(S.n);
    S.s.set(1, 1, 1);
    S.m4.compose(S.v, S.q, S.s);
    S.struck.setMatrixAt(S.struck.count, S.m4);
    S.struck.count += 1;
    S.struck.instanceMatrix.needsUpdate = true;
  }

  /* the ledger rack. it started empty and nothing ever takes a bar back out. */
  if (S.filled < S.slots) {
    var i = S.filled;
    S.v.set(S.slotX[i], S.slotY[i], 0);
    S.q.identity();
    S.s.set(1, 1, 1);
    S.m4.compose(S.v, S.q, S.s);
    S.bars.setMatrixAt(i, S.m4);
    S.bars.instanceMatrix.needsUpdate = true;
    S.filled = i + 1;
  }

  /* the flare, in world space: only x and y ride the wall squeeze */
  var sc = S.tube.scale.x;
  S.flare.position.set(px * sc, py * sc, pz + 0.5);
  S.flareAt = ctx.clock;

  if (ctx.hooks && ctx.hooks.onRefuse) ctx.hooks.onRefuse(1);
  return true;
}

/* the r key: strike the nearest page ahead of the lens that is still standing */
function runStrikeNearest(ctx) {
  var S = ctx.actState;
  if (!S || !S.walls) return false;
  var camZ = S.camZ != null ? S.camZ : 14;
  var bestM = -1, bestI = -1, bestD = 1e9;
  for (var mi = 0; mi < S.walls.length; mi++) {
    var W = S.walls[mi];
    for (var i = 0; i < W.mesh.count; i++) {
      if (W.gone[i]) continue;
      var z = W.pos[i * 3 + 2];
      if (z > camZ - 4) continue;              /* behind you, or already level */
      var d = camZ - z;
      if (d > bestD) continue;
      bestD = d; bestM = mi; bestI = i;
    }
  }
  if (bestM >= 0) return runStrike(ctx, bestM, bestI);
  return false;
}

export const actRun = {
  id: "run", accent: "#FF3B21", bg: 0x111318, fov: 62, restT: 0.5,
  fog: function (T) { return new T.FogExp2(0x111318, 0.034); },

  build: function (ctx) {
    var T = ctx.THREE, root = ctx.root, S = ctx.actState, small = ctx.small;
    var R = ctx.renderer;

    var LAYERS = small ? 21 : 41;
    var GAP = RUN_LEN / (LAYERS - 1);        /* 3.40 desktop, 6.80 on a phone */
    var CX = 2.7, CY = 1.95, PUSH = 0.6;     /* PUSH holds the inner ring off frame centre */
    var HC = 3, HR = 2;

    var m4 = new T.Matrix4(), q = new T.Quaternion(), e = new T.Euler();
    var v = new T.Vector3(), s = new T.Vector3(1, 1, 1), col = new T.Color();
    var rnd = mulberry32(11);

    /* ---------------- the tube: every panel is a page that shipped ---------------- */
    var tube = new T.Group();
    root.add(tube);
    S.tube = tube;

    var cells = [];
    for (var L = 0; L < LAYERS; L++) {
      for (var cx = -HC; cx <= HC; cx++) {
        for (var cy = -HR; cy <= HR; cy++) {
          if (cx === 0 && Math.abs(cy) <= 1) continue;   /* the channel you fly down */
          cells.push(cx, cy, L);
        }
      }
    }
    var NC = cells.length / 3;
    var half = [Math.ceil(NC / 2), NC - Math.ceil(NC / 2)];

    /* two page variants, not four: at 74 to 80 degrees the other two were unreadable
       and only cost fill. Both are OPAQUE (drawn on a ground) so the wall depth-culls
       itself instead of running an alpha-test shader over every fragment. */
    var maps = [
      averagePageTexture(T, R, "#DCE3EC", "#171A20"),
      averagePageTexture(T, R, "#AEB6C0", "#1C1F26")
    ];
    var geo = new T.PlaneGeometry(1.94, 1.21);
    S.walls = [];
    for (var w2 = 0; w2 < 2; w2++) {
      var mesh = new T.InstancedMesh(geo,
        new T.MeshBasicMaterial({ map: maps[w2], side: T.DoubleSide }), half[w2]);
      mesh.count = half[w2];
      tube.add(mesh);
      ctx.pickable.push(mesh);
      S.walls.push({
        mesh: mesh,
        pos: new Float32Array(half[w2] * 3),
        rot: new Float32Array(half[w2] * 3),
        gone: new Uint8Array(half[w2])      /* the refusal set, one byte per page */
      });
    }

    var fill = [0, 0];
    for (var i = 0; i < NC; i++) {
      var ccx = cells[i * 3], ccy = cells[i * 3 + 1], cL = cells[i * 3 + 2];
      var ang = cL * 0.017;                         /* the run is a slow helix */
      var ox = ccx * CX + (ccx > 0 ? PUSH : ccx < 0 ? -PUSH : 0);
      var oy = ccy * CY;
      var ca = Math.cos(ang), sa = Math.sin(ang);
      var px = ox * ca - oy * sa + (rnd() - 0.5) * 0.22;
      var py = ox * sa + oy * ca + (rnd() - 0.5) * 0.16;
      var pz = -cL * GAP + (rnd() - 0.5) * 0.5;
      var ex = (rnd() - 0.5) * 0.05;
      var ey = -ccx * 0.13 + cL * 0.004;
      var ez = (rnd() - 0.5) * 0.06 + ang;
      var mi = i % 2, W = S.walls[mi], id = fill[mi]++;
      var b = id * 3;
      W.pos[b] = px; W.pos[b + 1] = py; W.pos[b + 2] = pz;
      W.rot[b] = ex; W.rot[b + 1] = ey; W.rot[b + 2] = ez;
      v.set(px, py, pz); e.set(ex, ey, ez);
      m4.compose(v, q.setFromEuler(e), s);
      W.mesh.setMatrixAt(id, m4);
      var g = 0.56 + rnd() * 0.34;
      W.mesh.setColorAt(id, col.setRGB(g, g * 1.02, g * 1.09));
    }
    for (var w3 = 0; w3 < 2; w3++) {
      S.walls[w3].mesh.instanceMatrix.needsUpdate = true;
      if (S.walls[w3].mesh.instanceColor) S.walls[w3].mesh.instanceColor.needsUpdate = true;
    }

    /* struck plates ride inside the tube group, so a refused page keeps its plate
       when the walls close in at the end */
    S.struckMax = 44;
    S.struck = new T.InstancedMesh(new T.PlaneGeometry(2.16, 1.36),
      new T.MeshBasicMaterial({
        map: runStrikeTexture(T, R), transparent: true, alphaTest: 0.30,
        side: T.DoubleSide, depthWrite: false
      }), S.struckMax);
    S.struck.count = 0;
    /* InstancedMesh caches a bounding sphere the first time it is frustum tested, and
       computing one over zero instances yields an empty sphere that culls the mesh for
       good. The plates also move, so they opt out of culling entirely. */
    S.struck.frustumCulled = false;
    tube.add(S.struck);

    /* the four hairlines of the free channel: the only thing in here that converges */
    var cpts = [], CHX = 2.36, CHY = 3.34;
    for (var s1 = 0; s1 < 4; s1++) {
      var sx = (s1 & 1) ? CHX : -CHX, sy = (s1 & 2) ? CHY : -CHY;
      cpts.push(sx, sy, 6, sx, sy, -RUN_LEN - 2);
    }
    var cgeo = new T.BufferGeometry();
    cgeo.setAttribute("position", new T.Float32BufferAttribute(cpts, 3));
    tube.add(new T.LineSegments(cgeo,
      new T.LineBasicMaterial({ color: 0x4E5661, transparent: true, opacity: 0.55 })));

    /* ---------------- the apparatus: this is a run being inspected ---------------- */

    /* gantries, lit only by a lamp the camera carries, so ribs bloom out of the fog as
       you reach them and are dead again behind you */
    var NG = small ? 12 : 24;
    var GW = 10.2, GH = 5.6, GS = RUN_LEN / (NG - 1);
    var ribs = new T.InstancedMesh(new T.BoxGeometry(0.09, 0.09, 1),
      new T.MeshLambertMaterial({ color: 0x555D69 }), NG * 4);
    var plates = new T.InstancedMesh(new T.PlaneGeometry(3.0, 0.56),
      new T.MeshBasicMaterial({
        map: runApprovedTexture(T, R), transparent: true, opacity: 0.88,
        alphaTest: 0.18, side: T.DoubleSide
      }), NG);
    var ri = 0;
    for (var gi = 0; gi < NG; gi++) {
      var gz = -gi * GS;
      v.set(0, GH, gz); s.set(1, 1, GW * 2); e.set(0, Math.PI / 2, 0);
      m4.compose(v, q.setFromEuler(e), s); ribs.setMatrixAt(ri++, m4);
      v.set(0, -GH, gz);
      m4.compose(v, q.setFromEuler(e), s); ribs.setMatrixAt(ri++, m4);
      v.set(-GW, 0, gz); s.set(1, 1, GH * 2); e.set(Math.PI / 2, 0, 0);
      m4.compose(v, q.setFromEuler(e), s); ribs.setMatrixAt(ri++, m4);
      v.set(GW, 0, gz);
      m4.compose(v, q.setFromEuler(e), s); ribs.setMatrixAt(ri++, m4);
      /* the sign off hangs off the TOP rib, on axis and square to the lens, in the clear
         air above the page wall. Bolted flat to the side rib it lived outside the wall
         envelope, so the opaque pages ate it, and it was edge on besides. */
      v.set(0, GH - 0.88, gz); s.set(1, 1, 1); e.set(0, 0, 0);
      m4.compose(v, q.setFromEuler(e), s); plates.setMatrixAt(gi, m4);
    }
    ribs.instanceMatrix.needsUpdate = true;
    plates.instanceMatrix.needsUpdate = true;
    root.add(ribs); root.add(plates);
    s.set(1, 1, 1); e.set(0, 0, 0);

    /* the belt the run is standing on, and the cleared ground on the far side of it */
    var beltTex = runBeltTexture(T, R);
    beltTex.wrapS = beltTex.wrapT = T.RepeatWrapping;
    beltTex.repeat.set(3, 80);
    var belt = new T.Mesh(new T.PlaneGeometry(22, 153),
      new T.MeshBasicMaterial({ map: beltTex }));
    belt.rotation.x = -Math.PI / 2;
    belt.position.set(0, -6.6, -62.5);
    root.add(belt);
    S.beltTex = beltTex;

    var field = new T.Mesh(new T.PlaneGeometry(70, 150),
      new T.MeshBasicMaterial({ map: runFieldTexture(T, R) }));
    field.rotation.x = -Math.PI / 2;
    field.position.set(0, -6.62, RUN_END_Z - 74);
    root.add(field);

    /* the far boundary of the cleared site, framed by the aperture on the approach and then
       standing open in the last frame. It is an outline, so the ground under it stays plainly
       empty; it exists so the act ends on a horizon it arrived at rather than on flat grey.
       Nothing is standing on the ground here — this is the edge of the site, not content. */
    var BX = 26, BY0 = -6.5, BY1 = 12, BZ = RUN_END_Z - 61;
    var fpts = [
      -BX, BY0, BZ, -BX, BY1, BZ,
       BX, BY0, BZ,  BX, BY1, BZ,
      -BX, BY1, BZ,  BX, BY1, BZ,
      -BX, 2.5, BZ,  BX, 2.5, BZ,
      -BX - 9, BY0, BZ, BX + 9, BY0, BZ
    ];
    var fgeo = new T.BufferGeometry();
    fgeo.setAttribute("position", new T.Float32BufferAttribute(fpts, 3));
    root.add(new T.LineSegments(fgeo,
      new T.LineBasicMaterial({ color: 0x5A6472, transparent: true, opacity: 0.5 })));

    /* ceiling strip lights, on a mains flicker */
    var NL = small ? 18 : 34;
    var stripMat = new T.MeshBasicMaterial({ color: 0xCBD5E1, transparent: true, opacity: 0.8 });
    var strips = new T.InstancedMesh(new T.BoxGeometry(0.55, 0.07, 2.8), stripMat, NL);
    for (var li = 0; li < NL; li++) {
      v.set(0, 5.2, -li * (RUN_LEN / (NL - 1)));
      m4.compose(v, q.setFromEuler(e), s);
      strips.setMatrixAt(li, m4);
    }
    strips.instanceMatrix.needsUpdate = true;
    root.add(strips);
    S.strips = strips;

    /* ---------------- speed streaks ---------------- */
    var STR = small ? 90 : 200;
    var streaks = new T.Group();
    var streak = new T.InstancedMesh(new T.BoxGeometry(0.015, 0.015, 3),
      new T.MeshBasicMaterial({ color: 0x9AA4B2, transparent: true, opacity: 0.35 }), STR);
    for (var k = 0; k < STR; k++) {
      var a = rnd() * TAU, r2 = 2.2 + rnd() * 3.8;
      v.set(Math.cos(a) * r2, Math.sin(a) * r2 * 0.62, 10 - rnd() * 100);
      m4.compose(v, q.setFromEuler(e), s);
      streak.setMatrixAt(k, m4);
    }
    streak.instanceMatrix.needsUpdate = true;
    streaks.add(streak);
    root.add(streaks);
    S.streaks = streaks;
    S.streakMat = streak.material;

    /* ---------------- the ledger rack, pacing you on its own rail ---------------- */
    S.slots = 36;
    var rack = new T.Group();
    root.add(rack);
    S.rack = rack;
    S.slotX = new Float32Array(S.slots);
    S.slotY = new Float32Array(S.slots);
    var bars = new T.InstancedMesh(new T.BoxGeometry(0.26, 0.075, 0.075),
      new T.MeshBasicMaterial({ color: 0xFF3B21 }), S.slots);
    var zero = new T.Vector3(0, 0, 0);
    for (var bi = 0; bi < S.slots; bi++) {
      var cc = bi % 3, rr = Math.floor(bi / 3);
      S.slotX[bi] = -1.20 - cc * 0.30;
      S.slotY[bi] = -2.86 + rr * 0.185;
      v.set(S.slotX[bi], S.slotY[bi], 0);
      m4.compose(v, q, zero);            /* every slot starts at zero scale: EMPTY */
      bars.setMatrixAt(bi, m4);
    }
    bars.instanceMatrix.needsUpdate = true;
    rack.add(bars);
    S.bars = bars;
    S.filled = 0;

    /* Two open rails and nothing else. The closed rectangle and the twelve graduation ticks
       that used to be here drew a CAPACITY, and a capacity is a quantity about the ledger
       that is not true. The rack has to read as open ended: bars accumulate on a rail that
       runs off the top of itself, so the only thing it ever asserts is that it started empty. */
    var rpts = [];
    var rx0 = -1.02, rx1 = -1.98, ry0 = -3.06, ry1 = 0.62;
    rpts.push(rx0, ry0, 0, rx0, ry1, 0, rx1, ry0, 0, rx1, ry1, 0);
    var rgeo = new T.BufferGeometry();
    rgeo.setAttribute("position", new T.Float32BufferAttribute(rpts, 3));
    rack.add(new T.LineSegments(rgeo,
      new T.LineBasicMaterial({ color: 0x6E7885, transparent: true, opacity: 0.65 })));

    /* the rail it runs on, so the rack reads as a carriage being towed beside you rather
       than a panel glued to the lens. It terminates at the bulkhead, and the carriage parks
       where it ends: the run is what the ledger is a record of, and neither goes through
       the wall. */
    var gpts = [];
    [[-1.02, -3.06], [-1.98, -3.06]].forEach(function (P) {
      gpts.push(P[0], P[1], 8, P[0], P[1], RUN_END_Z + 1.4);
    });
    var ggeo = new T.BufferGeometry();
    ggeo.setAttribute("position", new T.Float32BufferAttribute(gpts, 3));
    root.add(new T.LineSegments(ggeo,
      new T.LineBasicMaterial({ color: 0x3E4650, transparent: true, opacity: 0.7 })));

    /* ---------------- inspection flaps ---------------- */
    var NF = small ? 12 : 24;
    S.nFlaps = NF;
    S.flapZ = new Float32Array(NF);
    S.flapX = new Float32Array(NF);
    var flaps = new T.InstancedMesh(new T.PlaneGeometry(1.94, 1.21),
      new T.MeshBasicMaterial({ map: maps[1], side: T.DoubleSide }), NF);
    for (var fi = 0; fi < NF; fi++) {
      S.flapZ[fi] = -10 - fi * ((RUN_LEN - 26) / (NF - 1));
      S.flapX[fi] = (fi % 2) ? 1.6 : -1.6;
    }
    /* the flaps travel the whole 136 units, so the cached instance sphere would be wrong
       within a screen of scroll */
    flaps.frustumCulled = false;
    root.add(flaps);
    S.flaps = flaps;
    S.lastFlapZ = 1e9;

    /* ---------------- the overtake ---------------- */
    var NS = small ? 44 : 96;
    var SSTEP = small ? 2.5 : 1.15;
    var shoal = new T.Group();
    /* transparent, because the overtake has to FADE. These are the lightest things in the
       act and they sit dead centre frame; switching them off with a boolean popped 96 planes
       out of existence in one frame at the climax. */
    var shoalMesh = new T.InstancedMesh(new T.PlaneGeometry(1.94, 1.21),
      new T.MeshBasicMaterial({
        map: averagePageTexture(T, R, "#F0F4F8", "#181C24"), side: T.DoubleSide,
        transparent: true, opacity: 1
      }), NS);
    var srnd = mulberry32(23);
    for (var si = 0; si < NS; si++) {
      var sa2 = si * 2.399 + (srnd() - 0.5) * 0.3;
      var sr = 1.72 + srnd() * 0.56;
      var sx2 = Math.cos(sa2) * sr, sy2 = Math.sin(sa2) * sr * 0.74;
      v.set(sx2, sy2, si * SSTEP);
      e.set((srnd() - 0.5) * 0.2, -Math.atan2(sx2, 6), sa2 * 0.4);
      m4.compose(v, q.setFromEuler(e), s);
      shoalMesh.setMatrixAt(si, m4);
    }
    shoalMesh.instanceMatrix.needsUpdate = true;
    shoal.add(shoalMesh);
    shoal.visible = false;
    root.add(shoal);
    S.shoal = shoal;
    S.shoalMat = shoalMesh.material;
    e.set(0, 0, 0);

    /* ---------------- the bulkhead, and the hole you leave through ---------------- */
    var AW = 3.6, AH = 2.2, BW = 15, BH = 8.5;
    var bp = [], bu = [];
    function quad(x0, y0, x1, y1) {
      var P = [[x0, y0], [x1, y0], [x1, y1], [x0, y0], [x1, y1], [x0, y1]];
      for (var n2 = 0; n2 < 6; n2++) {
        bp.push(P[n2][0], P[n2][1], 0);
        bu.push((P[n2][0] + BW) / (BW * 2), (P[n2][1] + BH) / (BH * 2));
      }
    }
    quad(-BW, -BH, -AW, BH);
    quad(AW, -BH, BW, BH);
    quad(-AW, AH, AW, BH);
    quad(-AW, -BH, AW, -AH);
    var bgeo = new T.BufferGeometry();
    bgeo.setAttribute("position", new T.Float32BufferAttribute(bp, 3));
    bgeo.setAttribute("uv", new T.Float32BufferAttribute(bu, 2));
    bgeo.computeVertexNormals();
    var bulk = new T.Mesh(bgeo, new T.MeshBasicMaterial({
      map: runBulkheadTexture(T, R), side: T.DoubleSide
    }));
    bulk.position.z = RUN_END_Z;
    root.add(bulk);

    q.identity();          /* the shoal loop left a yaw in it */
    var frame4 = new T.InstancedMesh(new T.BoxGeometry(1, 1, 1),
      new T.MeshBasicMaterial({ color: 0xFF3B21 }), 4);
    [[0, AH + 0.09, AW * 2 + 0.4, 0.18], [0, -AH - 0.09, AW * 2 + 0.4, 0.18]]
      .forEach(function (P, idx) {
        v.set(P[0], P[1], RUN_END_Z + 0.06); s.set(P[2], P[3], 0.5);
        m4.compose(v, q, s); frame4.setMatrixAt(idx, m4);
      });
    [[-AW - 0.09, 0], [AW + 0.09, 0]].forEach(function (P, idx) {
      v.set(P[0], P[1], RUN_END_Z + 0.06); s.set(0.18, AH * 2 + 0.4, 0.5);
      m4.compose(v, q, s); frame4.setMatrixAt(2 + idx, m4);
    });
    frame4.instanceMatrix.needsUpdate = true;
    root.add(frame4);
    s.set(1, 1, 1);

    /* ---------------- flare, lights, reusable scratch ---------------- */
    var flare = new T.Mesh(new T.PlaneGeometry(3.2, 3.2),
      new T.MeshBasicMaterial({
        map: runFlareTexture(T, R), transparent: true, opacity: 0,
        depthWrite: false, blending: T.AdditiveBlending
      }));
    flare.visible = false;
    root.add(flare);
    S.flare = flare; S.flareAt = -99; S.flareO = -1;

    S.lamp = new T.PointLight(0xBFC8D4, 95, 34, 2);
    root.add(S.lamp);
    root.add(new T.AmbientLight(0x2A3038, 1.2));

    S.stamp = new T.Color(0xFF3B21);
    S.m4 = new T.Matrix4(); S.q = new T.Quaternion(); S.e = new T.Euler();
    S.v = new T.Vector3(); S.s = new T.Vector3(1, 1, 1); S.n = new T.Vector3();
    S.fm = new T.Matrix4(); S.fq = new T.Quaternion(); S.fe = new T.Euler();
    S.fv = new T.Vector3(); S.fs = new T.Vector3(1, 1, 1);
    S.camZ = 14;

    /* the camera score, consumed in warped p space. keyframe x values are rewritten
       every frame from these bases as the lateral envelope shuts.
       The last leg OPENS. Everything else at the exit is constricting at once — the lateral
       envelope shuts to 0.42 and the tube squeezes to 0.86 — so a narrowing fov on top of
       that made the moment the visitor breaks through the hole the moment they can see the
       least, which is a full stop. 62 -> 68 makes it an emergence. */
    S.keys = [
      { t: 0.00, pos: [0, 0.20, 14], look: [0, 0.15, -12], fov: 58 },
      { t: 0.14, pos: [0, 0.10, -10], look: [0.10, 0.00, -34], fov: 74 },
      { t: 0.40, pos: [0.90, -0.45, -60], look: [0.35, -0.20, -86], fov: 80 },
      { t: 0.62, pos: [-0.85, 0.55, -97], look: [-0.25, 0.30, -122], fov: 70 },
      { t: 0.84, pos: [0.15, 0.10, -128], look: [0.05, 0.05, -152], fov: 62 },
      { t: 1.00, pos: [0, 0, -150], look: [0, 0, -182], fov: 68 }
    ];
    S.keyBaseX = new Float32Array(S.keys.length * 2);
    for (var ki = 0; ki < S.keys.length; ki++) {
      S.keyBaseX[ki * 2] = S.keys[ki].pos[0];
      S.keyBaseX[ki * 2 + 1] = S.keys[ki].look[0];
    }

    /* allocated once. camera() runs every rendered frame and must not build an options
       object per frame; ctx.pointer is a stable object the engine mutates in place. */
    S.flyOpts = { linear: true, drift: 0.80, pointer: ctx.pointer };
  },

  pick: function (ctx, hit) {
    var S = ctx.actState;
    if (!S || !S.walls || hit.instanceId == null) return;
    for (var mi = 0; mi < S.walls.length; mi++) {
      if (S.walls[mi].mesh === hit.object) { runStrike(ctx, mi, hit.instanceId); return; }
    }
  },

  /* The keyboard path for the one interaction on the page, and it has to live HERE, on the
     act object, not on actState. world.js reads s.act.refuseNearest in both refuseNearest()
     and affords(), and site.js reads act.refuseNearest in labelCanvas() to decide whether
     the canvas is focusable and what it announces. Hung off actState instead, the r key still
     physically worked but the canvas lost its tabindex and role and went aria-hidden, so the
     only interaction on the page was invisible to a screen reader and unreachable by tab.
     The engine also gates this on the act being the live one, which is why there is no
     private key listener here: two paths would strike two pages per keypress. */
  refuseNearest: function (ctx) { return runStrikeNearest(ctx); },

  camera: function (ctx) {
    var c = ctx.camera, S = ctx.actState, t = ctx.t;

    /* the corridor tightens across the back half and takes the visitor's steering with it */
    var n = ease(clamp01((t - 0.55) / 0.40));
    var LAT = lerp(1, 0.42, n);
    var K = S.keys, B = S.keyBaseX;
    for (var i = 0; i < K.length; i++) {
      K[i].pos[0] = B[i * 2] * LAT;
      K[i].look[0] = B[i * 2 + 1] * LAT;
    }

    /* front loaded warp: dp/dt falls 1.84 to 0.30, so this is still the fastest camera
       on the page and still decelerates into the exit, but over four screens not half of one */
    var p = 0.30 * t + 0.70 * (1 - Math.pow(1 - t, 2.2));
    S.flyOpts.drift = 0.80 * LAT;
    flyPath(K, p, c, S.flyOpts);

    /* flyPath ends on lookAt, which clears roll, so the bank goes on afterwards.
       Both terms are functions of t only: no wall clock anywhere in the camera. */
    var bank = Math.sin(clamp01((t - 0.28) / 0.40) * Math.PI) * 0.16
             + Math.sin(t * Math.PI * 2.6) * 0.014;
    c.rotateZ(bank);
    S.camZ = c.position.z;
  },

  frame: function (ctx) {
    var S = ctx.actState, t = ctx.t, camZ = S.camZ;

    /* the walls close in */
    var n = ease(clamp01((t - 0.55) / 0.40));
    var sc = lerp(1, 0.86, n);
    S.tube.scale.x = sc; S.tube.scale.y = sc;

    /* fog opens across the aperture crossing. The camera passes RUN_END_Z at t ~ 0.80, so
       the ramp is centred there instead of running on a smooth slope that knows nothing
       about the bulkhead: the world visibly widens at the instant you clear the hole. */
    var fog = ctx.scene && ctx.scene.fog;
    if (fog && fog.density !== undefined) {
      fog.density = lerp(0.034, 0.011, ease(clamp01((t - 0.66) / 0.22)));
    }

    /* the lamp is carried, so gantries bloom as you reach them and die behind you */
    S.lamp.position.copy(ctx.camera.position);

    /* streaks stretch with the analytic speed of the warp and collapse as it decays. They
       also fade out before the lens reaches the bulkhead: their instances reach 100 units
       past the group station, so left running they filled the far side of the aperture with
       more tunnel, both before the visitor got there and after they arrived. */
    var speed = clamp01((0.30 + 1.54 * Math.pow(1 - t, 1.2)) / 1.84);
    var out = ease(clamp01((t - 0.62) / 0.16));
    S.streaks.position.z = camZ - 10;
    S.streaks.scale.z = lerp(0.6, 4.2, speed);
    S.streakMat.opacity = 0.35 * (1 - out);
    S.streaks.visible = out < 0.999;

    /* the ledger rack keeps station beside you, and parks where its rail ends rather than
       towing its bottom rail and its lowest bars through the solid lower panel of the
       bulkhead 7.5 units in front of the lens */
    var rz = camZ - 7.5;
    S.rack.position.z = rz > RUN_END_Z + 1.4 ? rz : RUN_END_Z + 1.4;

    /* the belt runs off the camera, which is already a pure function of t. On wall clock it
       was the one thing in the act that did not reverse: the floor kept sliding forward under
       a stationary lens, and kept sliding forward while everything else ran backwards. */
    var bo = (-camZ * 0.10) % 1;
    S.beltTex.offset.y = bo < 0 ? bo + 1 : bo;

    /* the overtake. It fades rather than switching: these are the lightest planes in the act
       and they sit centre frame, so a boolean blinked 96 of them out in a single frame at the
       climax. It is fully gone before the lens reaches the aperture, because nothing built out
       of average pages may ever be visible on the far side of the hole. */
    var so = clamp01((t - 0.42) / 0.03) * (1 - ease(clamp01((t - 0.68) / 0.10)));
    S.shoalMat.opacity = so;
    S.shoal.visible = so > 0.004;
    if (S.shoal.visible) {
      S.shoal.position.z = lerp(-40, -430, ease(clamp01((t - 0.44) / 0.48)));
    }

    /* strip lights: mains flicker, plus the whole tube brightening as the braid goes by.
       The resting level is a CONSTANT, not a clock sample: reduced motion renders one frame
       at whatever wall clock instant the visitor arrives, and sin(clock * 8.7) cycles every
       0.36s, so the still landed on a different brightness every load and then froze there. */
    var lit = 0.72;
    if (!ctx.reduce) {
      lit = 0.55 + 0.28 * Math.abs(Math.sin(ctx.clock * 8.7));
      if (Math.sin(ctx.clock * 0.73) > 0.986) lit *= 0.18;
    }
    lit *= 1 + 0.35 * so;
    S.strips.material.opacity = lit > 1 ? 1 : lit;

    /* inspection flaps swing open exactly as you overtake them, and shut again on the
       way back up because k is a function of camera z, which is a function of t */
    if (S.lastFlapZ !== camZ) {
      S.lastFlapZ = camZ;
      for (var i = 0; i < S.nFlaps; i++) {
        var fz = S.flapZ[i];
        var k = clamp01((12 - camZ + fz) / 14);
        S.fe.set(lerp(-1.42, 0, ease(k)), 0, 0);
        S.fq.setFromEuler(S.fe);
        S.fv.set(0, -0.605, 0).applyQuaternion(S.fq);
        S.fv.x += S.flapX[i];
        S.fv.y += 2.9;
        S.fv.z += fz;
        S.fm.compose(S.fv, S.fq, S.fs);
        S.flaps.setMatrixAt(i, S.fm);
      }
      S.flaps.instanceMatrix.needsUpdate = true;
    }

    /* the stamp flare decays on wall clock over 0.55s and then stops costing anything */
    var age = ctx.clock - S.flareAt;
    var o = age < 0 ? 0 : (age > 0.55 ? 0 : 1 - age / 0.55);
    if (o !== S.flareO) {
      S.flareO = o;
      S.flare.material.opacity = o;
      S.flare.visible = o > 0.002;
    }
    if (S.flare.visible) S.flare.quaternion.copy(ctx.camera.quaternion);
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
 * 06 — THE KILN  (module scope timing law)
 *
 * The slab spans y 0.30 to 4.70 and stands in a firebox. ONE function gives the height
 * of the seam, and the camera and the frame both read it, so they can never disagree
 * about where the line of heat is. The climb is not a lerp: it holds twice and lurches
 * once, because a default does not slide in evenly, it arrives one unnamed property at
 * a time. The recovery is a single event: 4.74 down to 0.30 across five and a half
 * hundredths of the act, roughly a quarter of a screen against three screens of loss.
 * ========================================================================== */
var KILN_TOP = 4.74;            /* the seam has cleared the slab: total loss */
var KILN_SUNK = -0.64;          /* below the floorboards: never seen again */
var KILN_CHAIN_X = 1.30;
var KILN_CHAIN_TOP = 8.16;

function kilnBarY(t) {
  if (t < 0.08) return 0.34;                                            /* whole */
  if (t < 0.26) return lerp(0.34, 1.52, ease((t - 0.08) / 0.18));
  if (t < 0.33) return 1.52;                                            /* hold */
  if (t < 0.54) return lerp(1.52, 3.38, ease((t - 0.33) / 0.21));
  if (t < 0.58) return lerp(3.38, 3.66, easeOut((t - 0.54) / 0.04));    /* lurch */
  if (t < 0.66) return lerp(3.66, KILN_TOP, ease((t - 0.58) / 0.08));
  if (t < 0.70) return KILN_TOP;                                        /* the dwell */
  if (t < 0.755) {                                                      /* THE FIRING */
    /* one move, 24vh of scroll against three screens of loss. the cube, not the fifth
       power the spec asked for: at the fifth power four fifths of the sweep lands inside
       five vh and a normal scroll skips straight past the only event in the act. */
    var u = (t - 0.70) / 0.055;
    return lerp(KILN_TOP, 0.30, 1 - Math.pow(1 - u, 3));
  }
  if (t < 0.81) return lerp(0.30, KILN_SUNK, ease((t - 0.755) / 0.055));
  return KILN_SUNK;
}

/* the hoist takes the fired slab off the firebox. lift first, then travel: a trolley,
   not a magic float. both are pure functions of t. */
function kilnLift(t) {
  if (t < 0.82) return 0;
  if (t < 0.88) return lerp(0, 0.95, ease((t - 0.82) / 0.06));
  return 0.95;
}

/* THE HAND-OFF. the object leaves down the hall and out through the lit opening, and it
   is still accelerating when the act cuts. nothing here comes to rest. */
function kilnTravel(t) {
  if (t < 0.86) return 0;
  var u = (t - 0.86) / 0.14;
  return -12.6 * (0.62 * u + 0.38 * u * u);
}

/* the room genuinely goes dark before the firing, so the dwell reads as intended silence */
function kilnLamp(t) {
  if (t < 0.60) return 1;
  if (t < 0.68) return lerp(1, 0.26, ease((t - 0.60) / 0.08));
  if (t < 0.70) return 0.26;
  if (t < 0.735) return lerp(0.26, 1.9, easeOut((t - 0.70) / 0.035));
  if (t < 0.83) return lerp(1.9, 1.05, ease((t - 0.735) / 0.095));
  return lerp(1.05, 0.92, ease((t - 0.83) / 0.17));
}

/* the ember bed under the grate: the heat has a visible source and its own curve */
function kilnEmber(t) {
  if (t < 0.66) return lerp(0.35, 1, ease(t / 0.66));
  if (t < 0.70) return lerp(1, 0.12, ease((t - 0.66) / 0.04));
  if (t < 0.735) return lerp(0.12, 3, easeOut((t - 0.70) / 0.035));
  if (t < 0.83) return lerp(3, 1.4, ease((t - 0.735) / 0.095));
  return lerp(1.4, 0.85, ease((t - 0.83) / 0.17));   /* the fire is done with it */
}

/* the sparks run faster while the fire is up. a rate that is itself a function of t may
   NEVER be multiplied into t: `t * rate(t)` under a falling rate runs the emitter backwards,
   and across the hand-off the fire decays, so the trail sucked itself back into the seam at
   twenty-odd times speed. this is the integral of that rate instead, so the phase only ever
   increases, at exactly the rate the fire asks for. */
function kilnSparkRun(t) {
  var f;                              /* the area under the fire curve up to t */
  if (t < 0.70) f = 0;
  else if (t < 0.74) f = (t - 0.70) * (t - 0.70) / 0.08;
  else if (t < 0.83) f = 0.02 + (t - 0.74);
  else if (t < 0.93) f = 0.11 + (t - 0.83) - (t - 0.83) * (t - 0.83) / 0.2;
  else f = 0.16;
  return t + 3 * f;
}

/* the chain, laid from a fixed head in the roof down to the slab. rewritten only while
   the hoist is actually working, guarded on a quantised key. */
function kilnLayChain(S, headY, z) {
  var n = S.chainN, span = Math.max(0.6, KILN_CHAIN_TOP - headY), step = span / n;
  for (var c = 0; c < 2; c++) {
    for (var i = 0; i < n; i++) {
      S.v3.set(c ? KILN_CHAIN_X : -KILN_CHAIN_X, KILN_CHAIN_TOP - (i + 0.5) * step, z);
      S.m4.compose(S.v3, (i % 2) ? S.qA : S.qB, S.one);
      S.chains.setMatrixAt(c * n + i, S.m4);
    }
  }
  S.chains.instanceMatrix.needsUpdate = true;
}

export const actKiln = {
  id: "kiln", accent: "#FF7A18", bg: 0x0F0B07, fov: 46, restT: 0.88, grab: true,
  fog: function (T) { return new T.FogExp2(0x0F0B07, 0.026); },

  build: function (ctx) {
    var T = ctx.THREE, root = ctx.root, S = ctx.actState, small = ctx.small;
    var rnd = mulberry32(3);

    /* scratch, allocated once. nothing in frame() or camera() ever calls new. */
    var m4 = new T.Matrix4(), q = new T.Quaternion(), e = new T.Euler();
    var v = new T.Vector3(), s = new T.Vector3(1, 1, 1), col = new T.Color();
    S.m4 = new T.Matrix4(); S.v3 = new T.Vector3(); S.one = new T.Vector3(1, 1, 1);
    S.col = new T.Color(); S.ndc = new T.Vector3();
    S.qA = new T.Quaternion().setFromEuler(new T.Euler(0, Math.PI / 2, 0));
    S.qB = new T.Quaternion();

    /* ---------------------------------------------------------------- timber hall */
    var wood = makeTexture(T, ctx.renderer, 512, 512, function (g, w, h) {
      g.fillStyle = "#4A3A2A"; g.fillRect(0, 0, w, h);
      for (var i = 0; i < 380; i++) {
        var x = rnd() * w, jit = (rnd() - 0.5) * 0.16;
        g.fillStyle = "rgb(" + Math.round(74 * (1 + jit)) + "," +
          Math.round(58 * (1 + jit)) + "," + Math.round(42 * (1 + jit)) + ")";
        g.fillRect(x, 0, 1 + rnd() * 2, h);
      }
      /* scorch across the boards nearest the firebox */
      g.fillStyle = "rgba(24,14,8,.55)";
      for (var k = 0; k < 40; k++) g.fillRect(rnd() * w, rnd() * h, 6 + rnd() * 26, 2 + rnd() * 5);
    }, { repeat: [3, 4.4] });
    var woodMat = new T.MeshLambertMaterial({ map: wood, color: 0xC9A987 });

    /* the boards run from behind the back wall to well behind the furthest the camera ever
       stands. a phone stands 1.7x further back, so a 26-deep floor ended in mid air a third
       of the way up the screen and the bottom quarter of the frame was clear colour. */
    var floor = new T.Mesh(new T.PlaneGeometry(20, 52), woodMat);
    floor.rotation.x = -Math.PI / 2; floor.position.z = 0;
    floor.receiveShadow = !small;
    root.add(floor);

    var postMat = new T.MeshLambertMaterial({ color: 0x3A2C1F });

    /* two bays of posts, so the hall has a far end for the delivery to leave through. the
       phone drops a bay out of the MIDDLE and keeps the one at z -13: the mobile gate thins
       the hall, it never shortens it, because the delivery exits past the far pair. */
    var postZ = small ? [7, -3, -13] : [7, -1, -7, -13];
    var posts = new T.InstancedMesh(new T.BoxGeometry(0.42, 9, 0.42), postMat, postZ.length * 2);
    for (var p = 0; p < postZ.length * 2; p++) {
      v.set(p % 2 ? 7 : -7, 4.5, postZ[Math.floor(p / 2)]);
      m4.compose(v, q, s); posts.setMatrixAt(p, m4);
    }
    posts.instanceMatrix.needsUpdate = true;
    posts.instanceMatrix.setUsage(T.StaticDrawUsage);
    root.add(posts);

    /* same span on both, wider pitch on the phone: the roof has to reach the back wall at
       z -13, because the object is carried out under it all the way to z -12.6 */
    var BEAMS = small ? 12 : 20, BEAM_PITCH = 19.95 / (BEAMS - 1);
    var beams = new T.InstancedMesh(new T.BoxGeometry(15, 0.3, 0.3), postMat, BEAMS);
    for (var b = 0; b < BEAMS; b++) {
      v.set(0, 9 + (b % 3) * 0.9, 7 - b * BEAM_PITCH);
      e.set(0, 0, (b % 3) * 0.16 * (b % 2 ? 1 : -1));
      m4.compose(v, q.setFromEuler(e), s); beams.setMatrixAt(b, m4);
    }
    beams.instanceMatrix.needsUpdate = true;
    beams.instanceMatrix.setUsage(T.StaticDrawUsage);
    root.add(beams);

    /* stacked timber down both edges */
    var stack = new T.InstancedMesh(new T.BoxGeometry(0.4, 0.4, 5), woodMat, small ? 40 : 90);
    for (var i = 0; i < stack.count; i++) {
      var side = i % 2 ? 1 : -1;
      v.set(side * (8.2 + (i % 3) * 0.45), 0.25 + Math.floor(i / 6) * 0.42, -9 + (i % 13) * 1.5);
      m4.compose(v, q.setFromEuler(e.set(0, 0, 0)), s); stack.setMatrixAt(i, m4);
    }
    stack.instanceMatrix.needsUpdate = true;
    stack.instanceMatrix.setUsage(T.StaticDrawUsage);
    root.add(stack);

    /* the back wall, with the opening the finished work goes out through. the boards are
       lit by the hall; the opening is its own light, drawn once as an emissive map. */
    var wallTex = makeTexture(T, ctx.renderer, 512, 256, function (g, w, h) {
      g.fillStyle = "#000000"; g.fillRect(0, 0, w, h);
      var ox = 202, oy = 107, ow = 108, oh = 134;
      var spill = g.createRadialGradient(ox + ow / 2, oy + oh * 0.7, 6, ox + ow / 2, oy + oh * 0.7, 190);
      spill.addColorStop(0, "rgba(255,150,60,.55)");
      spill.addColorStop(0.35, "rgba(190,96,34,.18)");
      spill.addColorStop(1, "rgba(0,0,0,0)");
      g.fillStyle = spill; g.fillRect(0, 0, w, h);
      var lg = g.createLinearGradient(0, oy, 0, oy + oh);
      lg.addColorStop(0, "#8A4A16");
      lg.addColorStop(0.45, "#D98A38");
      lg.addColorStop(1, "#FFC98A");
      g.fillStyle = lg; g.fillRect(ox, oy, ow, oh);
      g.fillStyle = "rgba(0,0,0,.55)";
      for (var y = 0; y < h; y += 11) g.fillRect(0, y, w, 1.5);
      g.fillStyle = "rgba(0,0,0,.35)";
      g.fillRect(ox - 7, oy - 6, 7, oh + 6); g.fillRect(ox + ow, oy - 6, 7, oh + 6);
    });
    var wall = new T.Mesh(new T.PlaneGeometry(20, 10), new T.MeshLambertMaterial({
      color: 0x1A130C, emissive: 0x000000, emissiveMap: wallTex
    }));
    wall.position.set(0, 5, -13);
    root.add(wall);
    S.wall = wall;

    /* firebrick store, so the wide reveal at the firing has something to reveal */
    var BRICKS = small ? 32 : 96, brnd = mulberry32(23);
    var bricks = new T.InstancedMesh(new T.BoxGeometry(0.55, 0.26, 0.30),
      new T.MeshLambertMaterial({ color: 0x6B4234 }), BRICKS);
    for (var k2 = 0; k2 < BRICKS; k2++) {
      var half = BRICKS / 2, sideB = k2 < half ? -1 : 1, n2 = k2 % half;
      var cw = n2 % 6, ch = Math.floor(n2 / 6);
      v.set(sideB * 6.2 + (cw - 2.5) * 0.58 + (ch % 2 ? 0.29 : 0),
            0.13 + ch * 0.27 + (brnd() - 0.5) * 0.02, -9.5 + (brnd() - 0.5) * 0.06);
      m4.compose(v, q, s); bricks.setMatrixAt(k2, m4);
    }
    bricks.instanceMatrix.needsUpdate = true;
    bricks.instanceMatrix.setUsage(T.StaticDrawUsage);
    root.add(bricks);

    /* ------------------------------------------------------------------ the firebox */
    /* two cheeks rather than a solid plinth, so the fire under the slab is visible */
    var cheeks = new T.InstancedMesh(new T.BoxGeometry(0.9, 0.9, 2.2),
      new T.MeshLambertMaterial({ color: 0x2A2118 }), 2);
    /* x 2.15 puts the inner faces at 1.70, clear of the slab's own 1.65: at 1.9 the slab's
       lower corners stood 0.20 inside solid firebrick and sheared up through it at the lift */
    for (var c3 = 0; c3 < 2; c3++) {
      v.set(c3 ? 2.15 : -2.15, 0.45, 0);
      m4.compose(v, q, s); cheeks.setMatrixAt(c3, m4);
    }
    cheeks.instanceMatrix.needsUpdate = true;
    cheeks.instanceMatrix.setUsage(T.StaticDrawUsage);
    if (!small) cheeks.receiveShadow = true;
    root.add(cheeks);

    var grate = new T.InstancedMesh(new T.BoxGeometry(0.07, 0.07, 2.4),
      new T.MeshBasicMaterial({ color: 0x1A0F08 }), 15);
    for (var g2 = 0; g2 < 15; g2++) {
      v.set(-1.5 + g2 * 0.214, 0.30, 0);
      m4.compose(v, q, s); grate.setMatrixAt(g2, m4);
    }
    grate.instanceMatrix.needsUpdate = true;
    grate.instanceMatrix.setUsage(T.StaticDrawUsage);
    root.add(grate);

    var bedRnd = mulberry32(17);
    var bedTex = makeTexture(T, ctx.renderer, 256, 256, function (g, w, h) {
      g.fillStyle = "#000000"; g.fillRect(0, 0, w, h);
      for (var i3 = 0; i3 < 260; i3++) {
        g.fillStyle = "rgba(255," + (90 + (bedRnd() * 110 | 0)) + ",30," +
          (0.15 + bedRnd() * 0.7).toFixed(3) + ")";
        g.beginPath(); g.arc(bedRnd() * w, bedRnd() * h, 1 + bedRnd() * 4, 0, TAU); g.fill();
      }
      var fade = g.createRadialGradient(w / 2, h / 2, w * 0.16, w / 2, h / 2, w * 0.5);
      fade.addColorStop(0, "rgba(0,0,0,1)");
      fade.addColorStop(1, "rgba(0,0,0,0)");
      g.globalCompositeOperation = "destination-in";
      g.fillStyle = fade; g.fillRect(0, 0, w, h);
      g.globalCompositeOperation = "source-over";
    });
    var bed = new T.Mesh(new T.PlaneGeometry(3.2, 2.6), new T.MeshBasicMaterial({
      map: bedTex, transparent: true, depthWrite: false, blending: T.AdditiveBlending
    }));
    bed.rotation.x = -Math.PI / 2; bed.position.y = 0.14;
    root.add(bed);
    S.bed = bed;

    var cs = new T.Mesh(new T.PlaneGeometry(6.4, 4.2),
      new T.MeshBasicMaterial({ map: radialShadow(T, ctx.renderer), transparent: true, depthWrite: false }));
    cs.rotation.x = -Math.PI / 2; cs.position.y = 0.015;
    root.add(cs);
    S.contact = cs;

    /* ------------------------------------------------------- the load: one object, twice */
    /* everything the hoist carries away lives in one group: the slab, the drawing of the
       slab, and the plate that names what was decided about it. the record ships with it. */
    var load = new T.Group();
    root.add(load);
    S.load = load;

    var slabGeo = new T.BoxGeometry(3.3, 4.4, 0.11);
    var below = new T.Plane(new T.Vector3(0, -1, 0), 3);
    var above = new T.Plane(new T.Vector3(0, 1, 0), -3);
    S.below = below; S.above = above;

    var cold = new T.Mesh(slabGeo, new T.MeshBasicMaterial({
      color: 0x7FB2FF, wireframe: true, clippingPlanes: [below]
    }));
    cold.position.set(0, 2.5, 0); load.add(cold);
    S.cold = cold;

    /* ice hairlines: the default is not a bare box, it is a technical drawing of one */
    var hair = [], HN = small ? 14 : 24;
    for (var hI = 0; hI < HN; hI++) {
      var hy = 0.35 + hI * (4.3 / HN);
      hair.push(-1.65, hy, 0.062, 1.65, hy, 0.062);
    }
    for (var tI = 0; tI < 4; tI++) {
      var ty = 0.5 + tI * 1.3;
      hair.push(-1.65, ty, 0.062, -1.84, ty, 0.062);
      hair.push(1.65, ty, 0.062, 1.84, ty, 0.062);
    }
    var hairGeo = new T.BufferGeometry();
    hairGeo.setAttribute("position", new T.Float32BufferAttribute(hair, 3));
    var hairs = new T.LineSegments(hairGeo, new T.LineBasicMaterial({
      color: 0x7FB2FF, transparent: true, opacity: 0.5, clippingPlanes: [below]
    }));
    load.add(hairs);
    S.hairs = hairs;

    var warmTex = directedPageTexture(T, ctx.renderer, "#FF7A18");
    var warmMat = new T.MeshLambertMaterial({
      map: warmTex, emissive: 0xFFFFFF, emissiveMap: warmTex, clippingPlanes: [above]
    });
    var warm = new T.Mesh(slabGeo, warmMat);
    warm.position.set(0, 2.5, 0); warm.castShadow = !small;
    load.add(warm);
    S.warm = warm; S.warmMat = warmMat;

    /* the naming plate. the four properties this act's argument turns on, announced by
       name and withheld by value: above the seam each one has a written entry, below it
       the entry is an empty field with a border round it. */
    var NAMES = ["STRUCTURE", "RHYTHM", "WEIGHT", "TEMPERATURE"];
    function plateTex(decided) {
      return makeTexture(T, ctx.renderer, 256, 768, function (g, w, h) {
        g.fillStyle = "#0C0E12"; g.fillRect(0, 0, w, h);
        g.strokeStyle = "rgba(233,235,239,.18)"; g.lineWidth = 3;
        g.strokeRect(6, 6, w - 12, h - 12);
        for (var r = 0; r < 4; r++) {
          var y = 102 + r * 179.5;
          if (decided) { g.fillStyle = "#E9EBEF"; g.fillRect(24, y - 46, 11, 11); }
          else {
            g.strokeStyle = "rgba(233,235,239,.6)"; g.lineWidth = 2;
            g.strokeRect(24.5, y - 45.5, 10, 10);
          }
          g.font = '500 24px "Martian Mono", ui-monospace, monospace';
          g.textBaseline = "alphabetic";
          g.fillStyle = decided ? "#E9EBEF" : "rgba(233,235,239,.62)";
          g.fillText(NAMES[r], 52, y - 34);
          if (decided) {
            g.globalAlpha = 0.72;
            g.font = '500 22px "Martian Mono", ui-monospace, monospace';
            g.fillText("█████", 52, y + 6);
            g.globalAlpha = 1;
          } else {
            g.strokeStyle = "rgba(233,235,239,.34)"; g.lineWidth = 2;
            g.strokeRect(52.5, y - 13.5, 118, 22);
          }
          g.strokeStyle = decided ? "rgba(233,235,239,.35)" : "rgba(233,235,239,.16)";
          g.lineWidth = 2;
          g.beginPath(); g.moveTo(24, y + 34); g.lineTo(w - 24, y + 34); g.stroke();
        }
      });
    }
    /* the phone composes the load LEFT of centre (see camera()), because the plate is the
       payoff of the whole middle beat and at 2.40 its outer edge fell off the right of a tall
       screen for the entire dwell. narrower and closer in, against a camera shifted the other
       way, it clears the frame edge by about a degree at the tightest lens the act uses. */
    var PW = small ? 0.90 : 1.2, PX = small ? 2.12 : 2.50;
    var plateGeo = new T.PlaneGeometry(PW, PW * 3);
    var plateCold = new T.Mesh(plateGeo, new T.MeshBasicMaterial({
      map: plateTex(false), color: 0x4A6E9E, clippingPlanes: [below]
    }));
    /* mounted clear of the firebox cheeks and on the same plane as the slab: z 0.05 keeps
       the seam bar in front of it, and because the clip is in world Y the line of heat
       reads as ONE line across the object and its naming, not two lines at two depths */
    plateCold.position.set(PX, 1.05 + PW * 1.5, 0.05);
    load.add(plateCold);
    S.plateCold = plateCold;

    var plateWarmTex = plateTex(true);
    var plateWarm = new T.Mesh(plateGeo, new T.MeshLambertMaterial({
      map: plateWarmTex, emissive: 0xFFFFFF, emissiveMap: plateWarmTex,
      color: 0xFFB067, clippingPlanes: [above]
    }));
    plateWarm.position.copy(plateCold.position);
    load.add(plateWarm);
    S.plateWarm = plateWarm;

    /* --------------------------------------------------------------------- the hoist */
    var rail = new T.Mesh(new T.BoxGeometry(0.22, 0.26, 21), postMat);
    rail.position.set(0, 8.55, -3.6);
    root.add(rail);

    var trolley = new T.Mesh(new T.BoxGeometry(3.2, 0.16, 0.34), postMat);
    trolley.position.set(0, 8.3, 0);
    root.add(trolley);
    S.trolley = trolley;

    S.chainN = small ? 22 : 44;
    var chains = new T.InstancedMesh(new T.TorusGeometry(0.05, 0.016, 4, 6), postMat, S.chainN * 2);
    chains.instanceMatrix.setUsage(T.DynamicDrawUsage);
    root.add(chains);
    S.chains = chains;
    S.chainKey = -1;
    kilnLayChain(S, 4.70, 0);

    /* ---------------------------------------------------------------------- the rack */
    /* eleven unfired slabs on a rail at the back of the first bay: everything not yet
       decided, standing either side of the aisle the finished one is carried out along. */
    var RACK = small ? 6 : 11, rrnd = mulberry32(11);
    var rack = new T.InstancedMesh(new T.BoxGeometry(1.15, 1.60, 0.07),
      new T.MeshLambertMaterial({ color: 0x223243 }), RACK);
    S.rackX = new Float32Array(RACK);
    for (var r2 = 0; r2 < RACK; r2++) {
      /* the aisle is 5.2 wide, because the finished one is carried out down the middle
         of them and a 3.3 slab has to pass without touching a single one. both arms are
         built OUTWARD from a fixed inner edge at 2.6, so the aisle is the same width and
         the same centre at every count: growing them from a fixed outer edge instead left
         the phone's six slabs with an 8.2 aisle offset a metre and a half to the left,
         which put the whole left arm off the side of the screen. */
      var leftN = (RACK >> 1) + (RACK & 1);
      var rx = r2 < leftN ? -2.6 - (leftN - 1 - r2) * 1.0 : 2.6 + (r2 - leftN) * 1.0;
      S.rackX[r2] = rx;
      v.set(rx, 0.82, -6.50 + (rrnd() - 0.5) * 0.10);
      e.set(-0.17, 0, (rrnd() - 0.5) * 0.06);
      m4.compose(v, q.setFromEuler(e), s);
      rack.setMatrixAt(r2, m4);
      rack.setColorAt(r2, col.setRGB(1, 1, 1));
    }
    rack.instanceMatrix.needsUpdate = true;
    rack.instanceMatrix.setUsage(T.StaticDrawUsage);
    if (rack.instanceColor) rack.instanceColor.needsUpdate = true;
    root.add(rack);
    S.rack = rack; S.RACK = RACK; S.rackHot = false; S.rackKey = -1;

    var rackRail = new T.InstancedMesh(new T.CylinderGeometry(0.06, 0.06, 5.6, 6), postMat, 2);
    for (var rr = 0; rr < 2; rr++) {
      v.set(rr ? 5.1 : -5.1, 1.50, -6.62);
      e.set(0, 0, Math.PI / 2);
      m4.compose(v, q.setFromEuler(e), s);
      rackRail.setMatrixAt(rr, m4);
    }
    rackRail.instanceMatrix.needsUpdate = true;
    rackRail.instanceMatrix.setUsage(T.StaticDrawUsage);
    root.add(rackRail);
    e.set(0, 0, 0);

    /* ------------------------------------------------------------------- the seam itself */
    var bar = new T.Mesh(new T.PlaneGeometry(6.8, 0.1),
      new T.MeshBasicMaterial({ color: 0xFFC98A, transparent: true, depthWrite: false }));
    bar.position.set(0, 3, 0.14);
    root.add(bar);
    S.bar = bar;

    var barLight = new T.PointLight(0xFF7A18, 60, 12, 2);
    barLight.position.set(0, 3, 1.2);
    root.add(barLight);
    S.barLight = barLight;
    S.lightCol = new T.Color(0xFF7A18);
    S.hotCol = new T.Color(0xFFD9A6);

    /* ember sparks off the seam. something is always moving at the exact height you are
       looking at, through both holds and while the page is parked, and they leave with the
       object at the end. */
    var SPARKS = small ? 110 : 260, srnd = mulberry32(7);
    S.SPARKS = SPARKS;
    S.sang = new Float32Array(SPARKS); S.srad = new Float32Array(SPARKS);
    S.sspd = new Float32Array(SPARKS); S.sph = new Float32Array(SPARKS);
    var spos = new Float32Array(SPARKS * 3);
    for (var sI = 0; sI < SPARKS; sI++) {
      S.sang[sI] = srnd() * TAU;
      S.srad[sI] = 0.2 + srnd() * 1.9;
      S.sspd[sI] = 0.6 + srnd() * 1.3;
      S.sph[sI] = srnd();
    }
    var dotTex = makeTexture(T, ctx.renderer, 64, 64, function (g, w, h) {
      var rg = g.createRadialGradient(32, 32, 0, 32, 32, 32);
      rg.addColorStop(0, "rgba(255,220,170,1)");
      rg.addColorStop(0.4, "rgba(255,160,64,.75)");
      rg.addColorStop(1, "rgba(255,120,30,0)");
      g.fillStyle = rg; g.fillRect(0, 0, w, h);
    });
    var sparkGeo = new T.BufferGeometry();
    var sparkAttr = new T.BufferAttribute(spos, 3);
    sparkAttr.setUsage(T.DynamicDrawUsage);
    sparkGeo.setAttribute("position", sparkAttr);
    var sparks = new T.Points(sparkGeo, new T.PointsMaterial({
      size: 0.075, map: dotTex, transparent: true, depthWrite: false,
      color: 0xFFA340, sizeAttenuation: true, blending: T.AdditiveBlending
    }));
    root.add(sparks);
    S.sparks = sparks; S.spos = spos; S.sparkAttr = sparkAttr;

    /* soot in the air: the one genuinely ambient thing in the act */
    var MOTES = small ? 60 : 140, mrnd = mulberry32(29);
    var mpos = new Float32Array(MOTES * 3);
    for (var mI = 0; mI < MOTES; mI++) {
      mpos[mI * 3] = (mrnd() - 0.5) * 16;
      mpos[mI * 3 + 1] = (mrnd() - 0.5) * 9;
      mpos[mI * 3 + 2] = (mrnd() - 0.5) * 14;
    }
    var moteGeo = new T.BufferGeometry();
    moteGeo.setAttribute("position", new T.BufferAttribute(mpos, 3));
    var motes = new T.Points(moteGeo, new T.PointsMaterial({
      size: 0.05, color: 0x7A5B3C, transparent: true, opacity: 0.45, depthWrite: false
    }));
    motes.position.set(0, 4.5, -3);
    root.add(motes);
    S.motes = motes;

    /* ------------------------------------------------------------------------- light */
    var bulbMat = new T.MeshBasicMaterial({ color: 0xFFD8A0 });
    var spots = [[-5, 5.4, -4], [5, 5.4, -4], [-5, 5.4, 3], [5, 5.4, 3], [-5, 5.6, -10], [5, 5.6, -10]];
    var bulbs = new T.InstancedMesh(new T.SphereGeometry(0.075, 8, 8), bulbMat, 6);
    for (var bI = 0; bI < 6; bI++) {
      v.set(spots[bI][0], spots[bI][1], spots[bI][2]);
      m4.compose(v, q, s); bulbs.setMatrixAt(bI, m4);
    }
    bulbs.instanceMatrix.needsUpdate = true;
    bulbs.instanceMatrix.setUsage(T.StaticDrawUsage);
    root.add(bulbs);
    S.bulbMat = bulbMat;

    S.lan = [];
    for (var lI = 0; lI < 2; lI++) {
      var pl = new T.PointLight(0xFFB265, 40, 16, 2);
      pl.position.set(spots[lI][0], spots[lI][1], spots[lI][2]);
      root.add(pl); S.lan.push(pl);
    }

    S.amb = new T.AmbientLight(0x6B4520, 2.4);
    root.add(S.amb);

    var key = new T.DirectionalLight(0xFFD3A0, 2.0);
    key.position.set(5, 12, 6);
    if (!small) {
      key.castShadow = true;
      key.shadow.mapSize.set(1024, 1024);
      key.shadow.camera.left = -8; key.shadow.camera.right = 8;
      key.shadow.camera.top = 9; key.shadow.camera.bottom = -2;
      key.shadow.camera.near = 1; key.shadow.camera.far = 30;
      key.shadow.bias = -0.0012;
    }
    root.add(key);
    S.key = key;

    /* ---------------------------------------------------- take hold of the line of heat */
    /* The cue in the copy promises this, so it has to be real, and it has to be real for a
       thumb and for a keyboard as well as for a mouse. THE ENGINE OWNS THE HANDLE: `grab: true`
       on this act is the whole interaction. It gives a mouse a drag, a phone a TAP rather than
       a drag (a vertical drag on a phone is the page scrolling, and an interaction must never
       fight the scroll for the same gesture), the arrow keys a nudge, and the canvas a role and
       a label so the one interactive act on the page is not the one act a screen reader is told
       to ignore. It also drops the handle the instant the page cuts away, and zeroes it, so no
       pull survives a cut through black. grab.dy is bounded to plus or minus one and is
       absolute, never accumulated, so scrubbing stays exact.
       All this act adds is the cursor that says the line can be taken hold of, which is a mouse
       idea and is built for a mouse only. You can pull the line. You cannot decide with it: the
       crane deliberately does NOT follow the pull, so what you see while you drag is the gap
       between where the line is and where the record put it. */
    S.seamY = 0.34; S.camStamp = -1e9; S.cursorOn = false; S.fired = false;
    if (!ctx.reduce && !ctx.coarse) {
      var dom = ctx.renderer.domElement;
      window.addEventListener("pointermove", function (ev) {
        if (ev.pointerType === "touch") return;
        /* only while this act is the live one: camera() stamps the clock every render */
        if ((performance.now() - S.camStamp) >= 400) {
          if (S.cursorOn) { dom.style.cursor = ""; S.cursorOn = false; }
          return;
        }
        S.ndc.set(0, S.seamY, 0.2).project(ctx.camera);
        var nx = (ev.clientX / window.innerWidth) * 2 - 1;
        var ny = -(ev.clientY / window.innerHeight) * 2 + 1;
        var over = Math.abs(ny - S.ndc.y) < 0.13 && Math.abs(nx - S.ndc.x) < 0.42;
        if (over !== S.cursorOn) { dom.style.cursor = over ? "ns-resize" : ""; S.cursorOn = over; }
      }, { passive: true });
    }
  },

  /* the act is re-entered clean: no pull survives a cut through black */
  enter: function (ctx) {
    var S = ctx.actState;
    /* Under reduced motion the engine runs frame() once per act state and then latches on
       __staticDone, but it re-creates this act's fog from scratch on EVERY entry. Fog density
       is the one piece of the picture the engine owns and frame() authors, so without dropping
       the latch a second visit would render the still frame under the default 0.026 instead of
       the 0.01618 it was graded for. Everything else in the act lives on the act's own root and
       is only hidden, so it survives the cut by itself. */
    delete S.__staticDone;
    S.rackKey = -1;
    if (ctx.grab) ctx.grab.dy = 0;
    if (S.cursorOn) { ctx.renderer.domElement.style.cursor = ""; S.cursorOn = false; }
  },

  camera: function (ctx) {
    /* THE ONLY VERTICAL CRANE ON THE PAGE. It dollies in once at the start and then the
       height is the whole move: camera Y is the seam plus a fixed offset, so the line of
       heat is motionless in frame while the floor, the firebox and the naming plate slide
       down out of shot. At the firing it refuses to follow the seam back down: the height
       holds, the lens whips open and the hall turns out to have been that big all along.
       Then it comes down and lets the finished object go. */
    var t = ctx.t, c = ctx.camera, S = ctx.actState;
    var seam = kilnBarY(t);
    var small = ctx.small;
    /* a phone is a tall keyhole: at 46 degrees vertical the hall is only three metres wide on
       a phone, so it stands further back. It composes to the OTHER side from desktop: the
       naming plate is on the object's right, and standing a third of a metre right of it and
       looking further right again is what keeps the plate inside a nine-degree half-frame at
       the tightest lens in the act. Centring it there cut the plate off for the whole dwell. */
    var DS = small ? 1.7 : 1;
    var CX = small ? 0.32 : -2.10;         /* camera x */
    var LX = small ? 0.50 : -1.55;         /* look x: holds the object clear of the copy */

    var dist = t < 0.12 ? lerp(13.6, 10.0, ease(t / 0.12))
             : t < 0.58 ? lerp(10.0, 9.2, ease((t - 0.12) / 0.46))
             : t < 0.70 ? lerp(9.2, 8.6, ease((t - 0.58) / 0.12))
             : t < 0.755 ? lerp(8.6, 12.8, ease((t - 0.70) / 0.055))
             : lerp(12.8, 11.2, ease((t - 0.755) / 0.245));

    var fov = t < 0.12 ? lerp(44, 46, ease(t / 0.12))
            : t < 0.58 ? 46
            : t < 0.70 ? lerp(46, 39, ease((t - 0.58) / 0.12))
            : t < 0.755 ? lerp(39, 58, ease((t - 0.70) / 0.055))
            : lerp(58, 50, ease((t - 0.755) / 0.245));

    var camY = t < 0.68 ? seam + 0.72
             : t < 0.80 ? 5.46
             : lerp(5.46, 2.55, ease((t - 0.80) / 0.20));
    var lookY = t < 0.68 ? seam - 0.05
              : t < 0.755 ? lerp(4.69, 4.10, ease((t - 0.68) / 0.075))
              : lerp(4.10, 1.75, ease((t - 0.755) / 0.245));
    /* the look drifts a little down the hall at the end, so the departure is IN the frame
       rather than something the camera chases */
    var lookZ = t < 0.755 ? 0 : lerp(0, -3.4, ease((t - 0.755) / 0.245));

    c.position.set(CX + ctx.pointer.x * 0.5, camY + ctx.pointer.y * -0.18, dist * DS);
    c.lookAt(LX, lookY, lookZ);
    if (Math.abs(c.fov - fov) > 0.001) { c.fov = fov; c.updateProjectionMatrix(); }

    S.camStamp = performance.now();       /* the cursor only listens while this act is live */
  },

  frame: function (ctx) {
    var S = ctx.actState, t = ctx.t, clock = ctx.clock;

    /* ---- the seam. scripted height from the shared law, plus whatever the visitor is
       holding on the engine's handle, scaled out of normalised viewport units into this
       act's own world: plus or minus one turns into plus or minus 0.9 of a metre. */
    var drag = ctx.grab ? ctx.grab.dy * 0.9 : 0;
    /* The pull is live for exactly as long as the line of heat is ON SCREEN: it comes up over
       the first twentieth and it goes out on the bar's own fade at 0.78 to 0.81. The cue in the
       copy runs from 0.67 to the end of the act, so killing the pull at 0.695 left the page
       advertising a handle for the last three screens of a four-and-a-half screen act with
       nothing behind it. It cannot stop the firing either way: the pull is bounded and the
       firing moves the seam more than four metres. You can hold the line. You cannot hold the
       event, and once the line has sunk under the floor there is nothing left to take hold of. */
    var win = clamp01((t - 0.05) / 0.05) * (1 - clamp01((t - 0.78) / 0.03));
    var base = kilnBarY(t), seam = base;
    if (drag !== 0 && win > 0) {
      seam += drag * win;
      /* clamped against the slab, but never past where the script has already taken the seam,
         so a pull can never drag the line back UP out of the sink it is in the middle of */
      var lo = base < 0.30 ? base : 0.30, hi = base > KILN_TOP ? base : KILN_TOP;
      if (seam < lo) seam = lo;
      if (seam > hi) seam = hi;
    }
    S.seamY = seam;

    S.below.constant = seam;
    S.above.constant = -seam;

    /* ---- the fired object comes off the firebox and goes out down the hall */
    var lift = kilnLift(t), travel = kilnTravel(t);
    S.load.position.set(0, lift, travel);
    S.trolley.position.z = travel;

    var headY = 4.70 + lift;
    var ck = Math.round(headY * 300) * 100000 + Math.round(travel * 300);
    if (ck !== S.chainKey) { S.chainKey = ck; kilnLayChain(S, headY, travel); }

    /* the drawing of the object is gone once the object is fired: drop three draw calls.
       keyed off the seam itself, so it can never pop a surviving sliver away */
    var frozen = seam > 0.325;
    if (S.cold.visible !== frozen) {
      S.cold.visible = frozen; S.hairs.visible = frozen; S.plateCold.visible = frozen;
    }

    /* ---- the bar, and the light it carries. after the firing the same light becomes the
       object's own heat and travels with it, so the hall is lit by the thing leaving it. */
    var barVis = t < 0.81;
    if (S.bar.visible !== barVis) S.bar.visible = barVis;
    S.bar.position.y = seam;
    S.bar.material.opacity = 1 - clamp01((t - 0.78) / 0.03);

    var dep = clamp01((t - 0.755) / 0.075);
    var lightY = lerp(seam, 2.35 + lift, dep);
    var lightZ = lerp(1.2, travel + 0.5, dep);
    S.barLight.position.set(0, lightY, lightZ);
    S.barLight.distance = lerp(12, 26, dep);

    var flash = clamp01((t - 0.70) / 0.02);
    var fade = clamp01((t - 0.72) / 0.09);
    var flick = 1 + Math.sin(clock * 3.1) * 0.06 + Math.sin(clock * 1.3) * 0.03;
    var barI = t < 0.70 ? 44 * flick
             : t < 0.72 ? lerp(44, 420, easeOut(flash))
             : lerp(420, 130, ease(fade));
    S.barLight.intensity = barI;
    S.barLight.color.copy(S.lightCol).lerp(S.hotCol, clamp01((t - 0.70) / 0.04) * (1 - clamp01((t - 0.80) / 0.12)));

    /* ---- sparks. emitter is the seam for three screens, then the departing object. */
    var fire = clamp01((t - 0.70) / 0.04) * (1 - clamp01((t - 0.83) / 0.10));
    var rr = 1 + fire * 0.8;
    /* the phase is the INTEGRAL of the rate (see kilnSparkRun) plus a slow clock term, so the
       emitter cannot run backwards when the fire decays and cannot stop dead when the visitor
       stops scrolling to read. an act about heat whose embers freeze the moment the page is
       parked is the tell. the clock touches nothing but these dots, which carry no state a
       visitor could check by scrubbing, and the reduced-motion still is one frame either way. */
    var run = kilnSparkRun(t) * 3, drift = clock * 0.30;
    var pos = S.spos, n = S.SPARKS;
    for (var i = 0; i < n; i++) {
      var u = (run * S.sspd[i] + drift + S.sph[i]) % 1;
      var rad = S.srad[i] * rr;
      pos[i * 3] = Math.cos(S.sang[i] + u * 0.9) * rad;
      pos[i * 3 + 1] = u * 2.8 * (1 - u * 0.25);
      pos[i * 3 + 2] = Math.sin(S.sang[i]) * rad * 0.5;
    }
    S.sparkAttr.needsUpdate = true;
    S.sparks.position.set(0, lerp(seam, 1.9 + lift, dep), lerp(0, travel, dep));
    S.sparks.material.opacity = lerp(1, 0.8, clamp01((t - 0.88) / 0.12));

    /* ---- the fire, the lanterns, the air */
    var em = kilnEmber(t);
    S.bed.material.color.setRGB(Math.min(em, 3), Math.min(em * 0.86, 3), Math.min(em * 0.7, 3));
    S.key.intensity = 0.6 + 1.4 * Math.min(em, 1.6);

    var gain = kilnLamp(t) * (1 + Math.sin(clock * 7.3) * 0.03 + Math.sin(clock * 2.1) * 0.02);
    S.lan[0].intensity = 40 * gain;
    S.lan[1].intensity = 40 * gain;
    S.amb.intensity = 2.4 * gain;
    var bg = Math.min(gain, 1.6);
    S.bulbMat.color.setRGB(bg, bg * 0.85, bg * 0.63);

    /* the hall deepens at the exact frame the firing lands, and the way out lights up */
    if (ctx.scene && ctx.scene.fog && ctx.scene.fog.density != null) {
      ctx.scene.fog.density = t < 0.70 ? 0.026
        : t < 0.755 ? lerp(0.026, 0.013, ease((t - 0.70) / 0.055))
        : lerp(0.013, 0.019, ease((t - 0.755) / 0.245));
    }
    var wk = t < 0.66 ? 0.30
           : t < 0.70 ? lerp(0.30, 0.16, ease((t - 0.66) / 0.04))
           : t < 0.755 ? lerp(0.16, 0.9, easeOut((t - 0.70) / 0.055))
           : lerp(0.9, 1.25, ease((t - 0.755) / 0.245));
    S.wall.material.emissive.setRGB(wk, wk * 0.72, wk * 0.44);

    /* the warm half cools a little on its way out. it is finished, not still burning. */
    var wm = t < 0.70 ? 1
           : t < 0.735 ? lerp(1, 1.6, easeOut((t - 0.70) / 0.035))
           : lerp(1.6, 0.74, ease(clamp01((t - 0.735) / 0.265)));
    S.warmMat.emissive.setRGB(wm, wm * 0.94, wm * 0.88);

    /* ---- the rack catches the firing, then watches the finished one go past. the colour is a
       function of exactly two things, so it is keyed on both of them quantised: parked anywhere
       in the last third of the act this uploads nothing, and over 0.68 to 0.70 and 0.83 to 0.86
       the eleven colours are provably identical frame to frame. */
    var hot = t > 0.68;
    if (hot) {
      var rk = Math.round(fire * 200) * 100000 + Math.round(travel * 200);
      if (rk !== S.rackKey) {
        S.rackKey = rk;
        var col = S.col;
        for (var r = 0; r < S.RACK; r++) {
          var near = clamp01(1 - Math.abs(S.rackX[r]) / 8);      /* nearest the aisle */
          var pass = clamp01(1 - Math.abs(travel + 6.5) / 5.5) * near;
          var lick = clamp01(Math.max(fire * (0.35 + 0.65 * near), pass));
          col.setRGB(1 + lick * 0.45, 1 - lick * 0.16, 1 - lick * 0.34);
          S.rack.setColorAt(r, col);
        }
        if (S.rack.instanceColor) S.rack.instanceColor.needsUpdate = true;
      }
      S.rackHot = true;
    } else if (S.rackHot) {
      for (var r2 = 0; r2 < S.RACK; r2++) S.rack.setColorAt(r2, S.col.setRGB(1, 1, 1));
      if (S.rack.instanceColor) S.rack.instanceColor.needsUpdate = true;
      S.rackHot = false; S.rackKey = -1;
    }

    /* the contact shadow leaves with the object it belonged to */
    S.contact.material.opacity = 1 - clamp01((t - 0.82) / 0.06);

    /* soot: clock-driven like the sparks and the flicker, and it never touches state */
    S.motes.rotation.y = clock * 0.018;
    S.motes.position.y = 4.5 + Math.sin(clock * 0.4) * 0.12;

    /* the one latch on the page: the firing is a refusal, counted once, ever. the visible
       change is driven by t above, so scrubbing back still reverses everything you see. */
    if (!S.fired && t >= 0.70) {
      S.fired = true;
      if (ctx.hooks && ctx.hooks.onRefuse) ctx.hooks.onRefuse(1);
    }
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
 * 09 — THE COMMISSION : module-scope furniture
 *
 * The face of the slab is described ONCE, here, as a table of rectangles in
 * slab-local coordinates (origin at the slab centre, which sits at world y 1.1).
 * The same table drives three things, which is the whole point of the act:
 *   - the instanced relief, cut in two depth tiers,
 *   - the letterpress impression drawn into the proof sheet's texture,
 *   - the two shadow lengths the rake throws ACROSS the face, tier A onto the
 *     slab body and tier B onto tier A. (It was written here that the relief
 *     also throws an echo onto the back wall. It cannot: every rect in the
 *     table sits strictly inside the slab's own silhouette and the key is in
 *     front, so the wall can only ever catch the slab's outline. The wall is
 *     kept as a silhouette catcher, which is worth its one draw, and the claim
 *     it did more than that is gone.)
 * If the layout is a set of decisions, then every representation of it has to
 * come from the same set of decisions.
 * ========================================================================== */

/* TIER A — the primary cut. z centre 0.17, depth 0.13, so it stands 0.125 proud
   of the slab face at z 0.11. Four of these are the lips around the masthead
   groove, which is a recess rather than a bump. */
var CMSN_A = [
  [ 0.00,  2.82, 3.64, 0.14],   /* masthead lip, top                 */
  [ 0.00,  2.08, 3.64, 0.14],   /* masthead lip, bottom              */
  [-1.79,  2.45, 0.16, 0.88],   /* masthead lip, left                */
  [ 1.79,  2.45, 0.16, 0.88],   /* masthead lip, right               */
  [-0.60,  1.76, 2.30, 0.20],   /* deck                              */
  [-0.90,  1.42, 1.70, 0.13],   /* sub deck                          */
  [-0.60,  1.04, 2.40, 0.035],  /* hairline rule                     */
  [-0.60,  0.84, 2.40, 0.035],
  [-0.60,  0.64, 2.40, 0.035],
  [-0.75,  0.44, 1.70, 0.035],
  [ 0.68, -0.48, 2.20, 1.66],   /* the one huge field                */
  [-1.12, -0.82, 1.30, 0.98],   /* the second field                  */
  [-1.12, -1.52, 1.10, 0.42],   /* caption block                     */
  [ 0.00, -2.42, 3.60, 0.26],   /* footer bar                        */
  [ 1.70, -2.05, 0.22, 0.22],   /* folio marker                      */
  [-1.86,  0.00, 0.05, 2.60]    /* margin tick column                */
];

/* TIER B — the shallow second cut, nested inside the two largest tier A fields.
   z centre 0.245, depth 0.055. Two depths means the raking light throws two
   different shadow lengths off one face, which is what separates machined from
   embossed. The first four are the ones a phone keeps. */
var CMSN_B = [
  [ 0.68,  0.14, 1.84, 0.16],
  [ 1.32, -0.80, 0.66, 0.66],
  [-1.12, -0.48, 1.10, 0.12],
  [-1.12, -1.12, 1.10, 0.07],
  [ 0.26, -0.14, 1.00, 0.09],
  [ 0.26, -0.30, 0.82, 0.09],
  [ 0.26, -1.00, 1.00, 0.09],
  [ 0.26, -1.16, 0.74, 0.09],
  [-1.30, -0.74, 0.72, 0.07],
  [-1.30, -0.88, 0.54, 0.07]
];

/* the masthead groove itself: a hole in the face, not a plate on it */
var CMSN_MAST = [0.00, 2.45, 3.36, 0.58];
/* the one hard colour field, kept off the relief so it never warms with the rake */
var CMSN_STRIP = [1.86, -0.48, 0.12, 2.20];

var CMSN_SLAB_Y = 1.1;          /* world y of the slab centre                 */
var CMSN_FACE_Z = 0.11;         /* world z of the slab face                   */
var CMSN_SHEET_Z = 0.30;        /* where the proof sheet lies before the pull */
var CMSN_PEEL_H = 1.55;         /* how far the peeled sheet stands off        */
var CMSN_PHI = 1.9;             /* how far the free edge rolls over, radians  */
/* Radius chosen so the crest of the roll stands off by exactly CMSN_PEEL_H,
   which is what the flat pull stands off by: the two shapes the peel blends
   between then agree at the crest instead of disagreeing and kinking. */
var CMSN_R = CMSN_PEEL_H / (1 - Math.cos(CMSN_PHI));
var CMSN_ROLL = CMSN_R * CMSN_PHI;   /* arc length that is actually rolled     */
var CMSN_SPREAD = 0.55;         /* how much of the flat pull is staggered     */
var CMSN_SHEET_H = 5.9;         /* sheet height, so the hinge can sweep it    */

/* The floor is drawn, not merely lit: without a rule to travel over you cannot
   see how fast the lamp is moving, and the whole act is about a light crossing
   a surface at a measurable rate. Costs nothing, it is a map on a plane. */
function cmsnFloorTexture(T, renderer) {
  return makeTexture(T, renderer, 512, 512, function (g, w, h) {
    g.fillStyle = "#14161B"; g.fillRect(0, 0, w, h);
    /* Half a cell of offset, so no rule lands ON the tile edge. Drawing them at
       i/8 for i = 1..7 left the tile with seven rules and a doubled gap across
       every seam, and the seams land at world x = -40 + 8k, which puts a two
       unit dead band directly under the slab. A ruler you cannot read the
       lamp's rate off is just a texture. */
    for (var i = 0; i < 8; i++) {
      var u = ((i + 0.5) / 8) * w;
      var major = (i % 4 === 0);
      g.strokeStyle = major ? "rgba(232,199,122,.10)" : "rgba(232,199,122,.055)";
      g.lineWidth = major ? 4 : 2;
      g.beginPath(); g.moveTo(u, 0); g.lineTo(u, h); g.stroke();
      g.beginPath(); g.moveTo(0, u); g.lineTo(w, u); g.stroke();
    }
  }, { repeat: [10, 10] });
}

/* A struck maker's mark. Three radial slots and two arcs: a device, not a
   monogram, so there are no letters to read at any zoom. */
function cmsnMarkTexture(T, renderer) {
  return makeTexture(T, renderer, 256, 256, function (g) {
    g.fillStyle = "#191C22"; g.fillRect(0, 0, 256, 256);
    g.beginPath(); g.arc(128, 128, 86, 0, TAU);
    g.fillStyle = "#3C4450"; g.fill();
    for (var i = 0; i < 3; i++) {
      g.save(); g.translate(128, 128); g.rotate(i * 2.094);
      g.fillStyle = "#12141A"; g.fillRect(-7, -86, 14, 58);
      g.restore();
    }
    g.beginPath(); g.arc(128, 128, 100, 0, TAU);
    g.strokeStyle = "rgba(232,199,122,.5)"; g.lineWidth = 5; g.stroke();
  });
}

/* THE IMPRESSION. The proof sheet carries a letterpress bite of the same
   rectangle table the relief is cut from: a dark bottom edge, a lit inner edge,
   paper in the middle. Blocks only, no glyphs, so nothing leaks. */
function cmsnImpressionTexture(T, renderer) {
  return makeTexture(T, renderer, 768, 1024, function (g, W, H) {
    var SX = W / 4.2, SY = H / 5.9;
    function px(r) {
      return [(r[0] - r[2] / 2 + 2.1) * SX, (2.95 - (r[1] + r[3] / 2)) * SY, r[2] * SX, r[3] * SY];
    }
    function deboss(r, depth) {
      var p = px(r), b = depth;
      g.fillStyle = "rgba(20,22,26,.30)";
      g.fillRect(p[0], p[1], p[2], p[3]);
      g.fillStyle = "rgba(255,255,255,.60)";
      g.fillRect(p[0] + b, p[1] + b, Math.max(0, p[2] - b), Math.max(0, p[3] - b));
      g.fillStyle = "#E8E2D4";
      g.fillRect(p[0] + b, p[1] + b, Math.max(0, p[2] - b * 2), Math.max(0, p[3] - b * 2));
    }

    g.fillStyle = "#E8E2D4"; g.fillRect(0, 0, W, H);

    /* the masthead is a hole in the plate, so on paper it stays untouched:
       an island of clean stock with a bruised keyline where the lips bit */
    var m = px(CMSN_MAST);
    g.strokeStyle = "rgba(20,22,26,.22)"; g.lineWidth = 2;
    g.strokeRect(m[0], m[1], m[2], m[3]);

    var i;
    for (i = 0; i < CMSN_A.length; i++) deboss(CMSN_A[i], 5);
    for (i = 0; i < CMSN_B.length; i++) deboss(CMSN_B[i], 3);

    /* the one hard colour field, inked */
    var s = px(CMSN_STRIP);
    g.fillStyle = "#FF3B21"; g.fillRect(s[0], s[1], s[2], s[3]);

    /* trim edge */
    g.strokeStyle = "rgba(20,22,26,.18)"; g.lineWidth = 3;
    g.strokeRect(8, 8, W - 16, H - 16);
  });
}

export const actCommission = {
  /* restT moved 0.75 -> 0.98: the reduced-motion still frame is rendered ONCE, and at
     0.75 it caught the proof sheet lying flat on the face with nothing having happened
     to it yet. At 0.98 the one frame a reduced-motion visitor gets is the act's payoff:
     dead camera, cold counter-light up, the struck page down, the pull settled in front. */
  id: "commission", accent: "#E8C77A", bg: 0x08090B, fov: 40, restT: 0.98,
  fog: function (T) { return new T.FogExp2(0x08090B, 0.014); },

  build: function (ctx) {
    var T = ctx.THREE, root = ctx.root, S = ctx.actState, small = ctx.small;
    var i, r;

    /* ---- scratch, allocated once. frame() and camera() never call new. ---- */
    S.m4 = new T.Matrix4();
    S.q = new T.Quaternion();
    S.v = new T.Vector3();
    S.s = new T.Vector3(1, 1, 1);
    S.col = new T.Color();
    S.cool = new T.Color(0x3C4450);
    S.warmC = new T.Color(0x8A7A56);
    S.lensHot = new T.Color(0xFFE6B4);
    S.lensCold = new T.Color(0x3A3B3E);
    S.leanGrey = new T.Color(0xFFFFFF);
    S.leanRed = new T.Color(0xFF3B21);
    S.emOff = new T.Color(0x000000);
    S.emOn = new T.Color(0x2A0800);
    S.small = small;
    /* Portrait loses about four fifths of the horizontal field, and the act's
       only refusal lives out on the left. The camera dollies back for some of
       that (see camera()), but past a point backing off just makes the object
       small, so the composition itself closes up on a phone. */
    var xk = small ? 0.62 : 1;
    S.xk = xk;

    /* ---------------------------------------------------------------- floor */
    var floor = new T.Mesh(new T.PlaneGeometry(80, 80),
      new T.MeshPhongMaterial({ map: cmsnFloorTexture(T, ctx.renderer), shininess: 6 }));
    floor.rotation.x = -Math.PI / 2; floor.position.y = -3.2;
    floor.receiveShadow = !small;
    root.add(floor);

    /* A back wall. It catches the slab's own silhouette and nothing finer than
       that, which is the cheapest way to make a flat lit object read as an
       object standing in a room. It is not an echo of the layout: the layout
       never reaches it. */
    var wall = new T.Mesh(new T.PlaneGeometry(34, 20),
      new T.MeshPhongMaterial({ color: 0x101216, shininess: 2 }));
    wall.position.set(0, 4, -6);
    wall.receiveShadow = !small;
    root.add(wall);

    /* --------------------------------------------------------------- plinth */
    var plinth = new T.Mesh(new T.BoxGeometry(5.4, 1.2, 2.4),
      new T.MeshPhongMaterial({ color: 0x1B1E24, shininess: 8 }));
    plinth.position.y = -2.6; plinth.receiveShadow = !small; root.add(plinth);

    /* the plate that names the object, in the same mono voice as the chrome */
    var plate = new T.Mesh(new T.PlaneGeometry(1.6, 0.22),
      new T.MeshPhongMaterial({
        map: rowTexture(T, ctx.renderer, "no two alike", "#E8C77A", "#15181D"), shininess: 6
      }));
    plate.position.set(0, -2.66, 1.21); root.add(plate);

    /* ----------------------------------------------------------- the object */
    var body = new T.Mesh(new T.BoxGeometry(4.4, 6.2, 0.22),
      new T.MeshPhongMaterial({ color: 0x191C22, shininess: 10 }));
    body.position.y = CMSN_SLAB_Y;
    body.castShadow = !small;
    body.receiveShadow = !small;   /* so the proof sheet shadows the face it left */
    root.add(body);

    /* the masthead groove: a dark unlit plate sunk behind the four proud lips,
       so the top of the page goes black and then blazes as the lamp crosses */
    var mast = new T.Mesh(new T.PlaneGeometry(CMSN_MAST[2], CMSN_MAST[3]),
      new T.MeshBasicMaterial({ color: 0x0B0D11 }));
    mast.position.set(CMSN_MAST[0], CMSN_SLAB_Y + CMSN_MAST[1], CMSN_FACE_Z + 0.018);
    root.add(mast);

    /* THE RELIEF, one instanced field on two depth tiers. Material colour is
       white and every instance carries its own colour, so the rake can warm the
       face left to right without a second draw call. */
    var nB = small ? 4 : CMSN_B.length;
    var nTotal = CMSN_A.length + nB;
    var relief = new T.InstancedMesh(
      new T.BoxGeometry(1, 1, 1),
      new T.MeshPhongMaterial({ color: 0xFFFFFF, shininess: 16 }), nTotal);
    relief.castShadow = !small;
    /* Tier B is nested INSIDE tier A and stands only 0.0375 proud of it, so
       every tier B shadow lands on tier A geometry. Without this the second
       depth cut throws nothing anyone can see and the two shadow lengths the
       act is built on collapse into one. */
    relief.receiveShadow = !small;
    S.instX = new Float32Array(nTotal);
    for (i = 0; i < nTotal; i++) {
      var tierA = i < CMSN_A.length;
      r = tierA ? CMSN_A[i] : CMSN_B[i - CMSN_A.length];
      S.v.set(r[0], CMSN_SLAB_Y + r[1], tierA ? 0.17 : 0.245);
      S.s.set(r[2], r[3], tierA ? 0.13 : 0.055);
      S.m4.compose(S.v, S.q, S.s);
      relief.setMatrixAt(i, S.m4);
      relief.setColorAt(i, S.cool);
      S.instX[i] = r[0];
    }
    S.s.set(1, 1, 1);
    relief.instanceMatrix.needsUpdate = true;
    if (relief.instanceColor) relief.instanceColor.needsUpdate = true;
    root.add(relief);
    S.relief = relief; S.nRelief = nTotal; S.crossed = -1;

    /* the single hard colour field. deliberately NOT part of the relief: it is
       the one thing on the face that does not change when the light does. */
    var strip = new T.Mesh(new T.BoxGeometry(CMSN_STRIP[2], CMSN_STRIP[3], 0.02),
      new T.MeshBasicMaterial({ color: 0xFF3B21 }));
    strip.position.set(CMSN_STRIP[0], CMSN_SLAB_Y + CMSN_STRIP[1], 0.20);
    root.add(strip);

    var mark = new T.Mesh(new T.PlaneGeometry(0.46, 0.46),
      new T.MeshPhongMaterial({ map: cmsnMarkTexture(T, ctx.renderer), shininess: 24 }));
    mark.position.set(1.55, CMSN_SLAB_Y - 2.80, 0.19);
    root.add(mark);

    /* A drawn silhouette for the slab and the plinth, merged into ONE
       LineSegments so the black room cannot swallow the object's edge. */
    var e1 = new T.EdgesGeometry(new T.BoxGeometry(4.4, 6.2, 0.22));
    var e2 = new T.EdgesGeometry(new T.BoxGeometry(5.4, 1.2, 2.4));
    var a1 = e1.attributes.position.array, a2 = e2.attributes.position.array;
    var merged = new Float32Array(a1.length + a2.length);
    for (i = 0; i < a1.length; i += 3) {
      merged[i] = a1[i]; merged[i + 1] = a1[i + 1] + CMSN_SLAB_Y; merged[i + 2] = a1[i + 2];
    }
    for (i = 0; i < a2.length; i += 3) {
      var o = a1.length + i;
      merged[o] = a2[i]; merged[o + 1] = a2[i + 1] - 2.6; merged[o + 2] = a2[i + 2];
    }
    e1.dispose(); e2.dispose();
    var outlineGeo = new T.BufferGeometry();
    outlineGeo.setAttribute("position", new T.BufferAttribute(merged, 3));
    var outline = new T.LineSegments(outlineGeo,
      new T.LineBasicMaterial({ color: 0xE8C77A, transparent: true, opacity: 0.14 }));
    root.add(outline);
    S.outline = outline;

    /* ------------------------------------------------------- what was refused */
    /* The salvage pile stays grey for the whole act. The one leaning page is the
       act's only refusal, and doubling it in vermilion would dilute the strike. */
    var salvTex = averagePageTexture(T, ctx.renderer, "#6E757F", "#1A1D22");
    var nSalv = small ? 6 : 10;
    var salv = new T.InstancedMesh(new T.PlaneGeometry(1.9, 1.2),
      new T.MeshPhongMaterial({ map: salvTex, shininess: 4, side: T.DoubleSide }), nSalv);
    var srnd = mulberry32(77);
    var se = new T.Euler();
    for (i = 0; i < nSalv; i++) {
      S.v.set((-2.35 + (srnd() - 0.5) * 0.80) * xk, -3.16 + i * 0.012, 1.50 + (srnd() - 0.5) * 0.90);
      se.set(-Math.PI / 2, 0, (srnd() - 0.5) * 0.44);
      S.m4.compose(S.v, S.q.setFromEuler(se), S.s);
      salv.setMatrixAt(i, S.m4);
    }
    S.q.identity();
    salv.instanceMatrix.needsUpdate = true;
    root.add(salv);

    /* the one that is struck while you watch */
    var leaner = new T.Mesh(new T.PlaneGeometry(1.9, 1.2),
      new T.MeshPhongMaterial({ map: salvTex, shininess: 4, side: T.DoubleSide }));
    leaner.position.set(-2.55 * xk, -2.55, 1.35);
    leaner.rotation.set(-0.34, 0.22, 0.06);
    root.add(leaner);
    S.leaner = leaner; S.leanIsRed = false; S.refused = false;

    /* ------------------------------------------------------ the rake hardware */
    /* The light is a device on a rail, not a mood. The carriage runs the full
       length and slams into the right end stop on exactly the frame the camera
       dies, so the act's two full stops land together. */
    var railMat = new T.MeshPhongMaterial({ color: 0x2A2E36, shininess: 20 });
    var rail = new T.Mesh(new T.CylinderGeometry(0.05, 0.05, 16.2, 6), railMat);
    rail.rotation.z = Math.PI / 2;
    rail.position.set(-3.70, 3.90, 5.50);
    root.add(rail);

    var stops = new T.InstancedMesh(new T.BoxGeometry(0.16, 0.44, 0.44), railMat, 2);
    S.v.set(-11.40, 3.90, 5.50); S.m4.compose(S.v, S.q, S.s); stops.setMatrixAt(0, S.m4);
    S.v.set(3.95, 3.90, 5.50); S.m4.compose(S.v, S.q, S.s); stops.setMatrixAt(1, S.m4);
    stops.instanceMatrix.needsUpdate = true;
    root.add(stops);

    var carriage = new T.Group();
    carriage.position.set(-11, 3.90, 5.50);
    var box = new T.Mesh(new T.BoxGeometry(0.50, 0.34, 0.50), railMat);
    carriage.add(box);
    var lensMat = new T.MeshBasicMaterial({ color: 0xFFE6B4 });
    var lens = new T.Mesh(new T.CylinderGeometry(0.30, 0.17, 0.40, 10), lensMat);
    /* Explicit, never lookAt a fresh child. The sign was inverted here: the cone
       pointed forward and UP while the light it stands for runs from y 3.85 down
       onto a target at y 1.0, i.e. 28 degrees DOWN. -atan2(2.90, 5.50) is that
       angle, taken straight off the carriage-to-target offset. */
    lens.rotation.set(-Math.PI / 2 - Math.atan2(2.90, 5.50), 0, 0);
    lens.position.set(0, -0.16, -0.20);
    carriage.add(lens);
    carriage.castShadow = false;
    root.add(carriage);
    S.carriage = carriage; S.lensMat = lensMat;

    /* dust inside the beam, travelling with the beam. one draw, zero per-frame
       vertex work: the whole column is parented and the parent tracks the lamp. */
    var beam = new T.Group();
    var NP = small ? 140 : 400;
    var pos = new Float32Array(NP * 3), prnd = mulberry32(2609);
    for (i = 0; i < NP; i++) {
      pos[i * 3] = (prnd() - 0.5) * 2.8;
      pos[i * 3 + 1] = -2.5 + prnd() * 8.0;
      pos[i * 3 + 2] = -1 + prnd() * 6;
    }
    var pgeo = new T.BufferGeometry();
    pgeo.setAttribute("position", new T.BufferAttribute(pos, 3));
    var motes = new T.Points(pgeo, new T.PointsMaterial({
      color: 0xE8C77A, size: 0.035, sizeAttenuation: true,
      transparent: true, opacity: 0, depthWrite: false
    }));
    beam.add(motes);
    root.add(beam);
    S.beam = beam; S.motes = motes;

    /* ---------------------------------------------------------- the proof pull */
    /* A sheet lying on the face of the slab, carrying the impression of the
       layout. It comes away from the top down, curls as it goes, and settles
       square to a camera that has already stopped and has nothing else to give. */
    var sheetGeo = new T.PlaneGeometry(4.2, CMSN_SHEET_H, 1, 24);
    var sheet = new T.Mesh(sheetGeo, new T.MeshPhongMaterial({
      map: cmsnImpressionTexture(T, ctx.renderer), shininess: 8,
      side: T.DoubleSide, transparent: true, opacity: 0
    }));
    sheet.position.set(0, CMSN_SLAB_Y, CMSN_SHEET_Z);
    sheet.castShadow = false;   /* turned on in frame(), once it is opaque enough to explain */
    sheet.visible = false;
    /* The peel takes the free edge out past the geometry's build-time bounding
       sphere, and this mesh is dead centre of frame anyway, so culling it is
       only a chance to cull it wrongly. */
    sheet.frustumCulled = false;
    root.add(sheet);
    S.sheet = sheet;
    S.sheetPos = sheetGeo.attributes.position;
    S.sheetNorm = sheetGeo.attributes.normal;
    /* The bend is purely about the x axis and the plane is one quad wide, so the
       whole peel is a function of the ROW. Cache it per row: 25 rows instead of
       50 vertices, and the row's two vertices get the same y, z and normal.
       Row count is read off the buffer rather than written down, so the segment
       count above can change without silently desynchronising the peel. */
    var parr = S.sheetPos.array;
    var rows = S.sheetPos.count / 2;     /* widthSegments 1 -> two vertices a row */
    S.sheetRows = rows;
    S.rowBaseY = new Float32Array(rows);
    S.rowVY = new Float32Array(rows);
    S.rowY = new Float32Array(rows);
    S.rowZ = new Float32Array(rows);
    for (i = 0; i < rows; i++) {
      var y = parr[i * 6 + 1];                       /* first vertex of row i */
      S.rowBaseY[i] = y;
      S.rowVY[i] = (y + 2.95) / CMSN_SHEET_H;        /* 0 at foot, 1 at head */
    }
    S.lastP = -1;

    /* ---------------------------------------------------------------- lighting */
    /* One raking key on the rail. Its cone is aimed at the object for the whole
       act, so what travels is the ANGLE of incidence, not the pool of light:
       that is the difference between a rake and a searchlight.
       Two things had to change for that to be true rather than merely stated.
       The angle: 0.50 rad put a cone of radius 3.2 on a slab 3.1 half-tall by
       the time the lamp was close, so the pool visibly shrank onto the object
       and fell off its corners. 0.66 clears the whole proof sheet (half
       diagonal 3.62) even at the closest throw of 5.97.
       The intensity: this rig was inherited at 5200 from a lamp that stood off
       15.8 units. On this rail the throw drops to 5.97 at mid sweep, and with
       decay 2 that is irradiance 33 -> 146 -> 107 across the sweep against the
       20 the object was lit at before. The face would have blown to flat white
       through the middle of its own crossing. frame() now holds irradiance
       constant by multiplying by d squared, so the only thing that travels is
       the angle. */
    var key = new T.SpotLight(0xFFE6B4, 20 * 156.65, 52, 0.66, 0.85, 2);
    key.position.set(-11, 3.85, 5.30);
    key.target.position.set(0, 1, 0);
    if (!small) {
      key.castShadow = true;
      /* 2048 because tier B stands only 0.0375 proud of tier A: at 1024 with the
         wider cone a texel is 0.015 world units and normalBias 0.03 was two
         whole texels, which erased exactly the shadow the second cut exists to
         throw. At 2048 a texel is 0.0076, so 0.018 of bias still leaves the
         tier B shadow several texels long and is LESS bias, in texels, than the
         0.03 this shipped with. */
      key.shadow.mapSize.set(2048, 2048);
      key.shadow.camera.near = 1.6;
      key.shadow.camera.far = 30;
      key.shadow.bias = -0.0009;
      key.shadow.normalBias = 0.018;
      key.shadow.focus = 1;
    }
    root.add(key); root.add(key.target);
    S.key = key;

    var rim = new T.SpotLight(0xFF5A38, 700, 40, 0.75, 0.95, 2);
    rim.position.set(9, 4, -3.2); rim.target.position.set(0, 1, 0);
    root.add(rim); root.add(rim.target);

    /* The counter-light. Zero for nine tenths of the act, then it comes up as the
       gold dies: the face cools and flattens while the object is handed over. */
    var cold = new T.SpotLight(0x6E7A8C, 0, 34, 0.70, 0.90, 2);
    cold.position.set(6, 2.2, 9); cold.target.position.set(0, 1, 0);
    root.add(cold); root.add(cold.target);
    S.cold = cold;

    /* very little fill, so the rake does the modelling and the relief reads */
    var lift = new T.DirectionalLight(0x8894A6, 0.22);
    lift.position.set(2, 6, 10); root.add(lift);
    root.add(new T.AmbientLight(0x232A34, 0.55));
  },

  camera: function (ctx) {
    var c = ctx.camera, t = ctx.t;
    /* Approach, close, arrive, then STOP DEAD at t 0.60 and never write position,
       rotation or fov again. It is the only camera on the page that comes to a
       complete square rest, and that stillness is why the price beat lands.
       Zero roll on every axis for the whole act: a copy stand, not a drone.
       The lens is never scored here: a fov ramp on a forward dolly is act 01's
       signature and act 05's, and this act does not borrow either.

       The offset and the dolly-back used to be gated on ctx.small, which is a
       WIDTH test, and what decides whether this act fits is ASPECT. A 768 wide
       portrait tablet is not small, so it took the desktop branch: cx 3.4 with
       a half-width of only 3.96 put the left edge of frame at -0.56 and threw
       away the left third of the slab, the margin tick column, the salvage pile
       and the struck page - the act's only refusal - for the whole payoff.
       So solve it instead. The leftmost thing that must be in frame is the
       struck page at about x -3.6 (-2.85 once the phone composition closes up),
       at z 1.6. Push cx right only as far as the field actually allows, and
       only dolly back when even cx 0 will not hold it. At 16:9 this returns
       cx 3.4 and k 1, which is the framing this act was composed at. */
    var a = c.aspect || 1.7778;
    var need = ctx.small ? 2.85 : 3.60;
    var hw = 12.9 * 0.36397 * a;       /* half-width at the struck page, k = 1, fov 40 */
    var k = hw >= need ? 1 : need / hw;
    var cx = Math.min(3.4, Math.max(0, hw * k - need));
    var z = t < 0.18 ? lerp(26, 21, ease(t / 0.18))
          : t < 0.40 ? lerp(21, 17.2, ease((t - 0.18) / 0.22))
          : t < 0.60 ? lerp(17.2, 14.5, ease((t - 0.40) / 0.20))
          : 14.5;
    c.position.set(cx, 1.1, z * k);
    c.rotation.set(0, 0, 0);
    c.lookAt(cx, 1.1, 0);
  },

  frame: function (ctx) {
    var S = ctx.actState, t = ctx.t, i;

    /* -------------------------------------------------- the rake, linear in t */
    /* Linear on purpose: the floor is ruled so the travel is measurable, and a
       machine on a rail does not ease. It arrives at the stop at t 0.60 exactly,
       the same frame the camera dies. */
    var sweep = clamp01(t / 0.60);
    var lampX = lerp(-11, 3.6, sweep);
    S.key.position.x = lampX;
    S.carriage.position.x = lampX;
    S.beam.position.x = lampX * 0.5;
    /* The motes turn as the lamp travels. This was ctx.clock * 0.05, which is an
       unbounded wall-clock accumulator, and the mote cloud runs z -1..5 about
       its own origin, so the turn is not a re-phase: it swings the whole column
       sideways by up to five units and turns a deep narrow column into a wide
       shallow one. Leave the page sitting and scrub back and the dust is
       somewhere else at the same t. Driven from t it is still a slow turn and
       it comes back exactly. */
    S.beam.rotation.y = t * 0.9;

    /* the outline exists only when the light is near enough to draw it */
    S.outline.material.opacity = lerp(0.06, 0.30, 1 - clamp01(Math.abs(lampX) / 8));

    /* THE FACE WARMS BEHIND THE LIGHT. The test is on sweep position, which is a
       pure function of t, and the whole buffer is rewritten from that test, so
       scrubbing back cools the face again exactly. Upload only on a crossing. */
    var crossed = 0;
    for (i = 0; i < S.nRelief; i++) if (lampX > S.instX[i] + 0.4) crossed++;
    if (crossed !== S.crossed) {
      S.crossed = crossed;
      for (i = 0; i < S.nRelief; i++) {
        S.col.copy(lampX > S.instX[i] + 0.4 ? S.warmC : S.cool);
        S.relief.setColorAt(i, S.col);
      }
      if (S.relief.instanceColor) S.relief.instanceColor.needsUpdate = true;
    }

    /* ------------------------------------------------------------ the strike */
    /* Pure t in both directions. The old build advanced rotation and position by
       a fixed step behind a latch, so scrubbing up left the page lying down. */
    var fall = ease(clamp01((t - 0.62) / 0.10));
    var L = S.leaner;
    /* It topples forward off the plinth lip and comes to rest propped on the pile
       rather than lying dead flat: flat on the floor at this camera height puts it
       in the last three percent of the frame, where the only refusal in the act
       would be half cropped. Propped at 72 degrees it stays fully on screen. */
    L.rotation.x = lerp(-0.34, -1.25, fall);
    L.rotation.z = lerp(0.06, 0.38, fall);
    L.position.y = lerp(-2.55, -2.99, fall);
    L.position.z = lerp(1.35, 1.85, fall);
    var wantRed = t >= 0.62;
    if (wantRed !== S.leanIsRed) {
      S.leanIsRed = wantRed;
      L.material.color.copy(wantRed ? S.leanRed : S.leanGrey);
      if (L.material.emissive) L.material.emissive.copy(wantRed ? S.emOn : S.emOff);
    }
    /* the ONLY latch in the act, and it drives a counter, never a pixel */
    if (wantRed && !S.refused) {
      S.refused = true;
      if (ctx.hooks.onRefuse) ctx.hooks.onRefuse(1);
    }

    /* -------------------------------------------------------- the proof pull */
    var p = ease(clamp01((t - 0.72) / 0.18));
    var appear = clamp01((t - 0.655) / 0.045);
    S.sheet.visible = appear > 0;
    S.sheet.material.opacity = appear;
    /* A shadow caster does not consult material.opacity: the depth material copies
       map, alphaMap, alphaTest and side and nothing else. So castShadow left on in
       build() meant that the instant `visible` flipped true, a fully opaque 4.2 by
       5.9 shadow dropped across the whole face while the sheet itself was still at
       nothing per cent - the object went dark with nothing standing there to have
       done it. Gate the caster on full opacity, and finish the fade at 0.700 so
       the sheet is solid before the peel starts at 0.720. Still pure t. */
    S.sheet.castShadow = !S.small && appear >= 1;
    /* The peel is written whenever p moves, NOT only while the sheet is on screen:
       gating the vertex write on visibility left the buffer holding a stale shape
       after a scrub back through the start of the pull. Because p is clamped, this
       still costs nothing outside t 0.72 to 0.90: it settles to one write on each
       side of the window and then stops. The test is exact equality rather than an
       epsilon: an epsilon lets the buffer settle on a different shape depending on
       which direction t arrived from, which is exactly the class of bug this act
       exists in order not to have. ease() returns 0 and 1 exactly at the clamps, so
       outside the window p is stable and no write happens. */
    /* THE CURL IS A HINGE, NOT AN OFFSET. This added an arc term to the row's own
       base y, so no material was ever consumed by the roll: over a sheet 5.9 tall
       the whole arc moved the head 1.1 down and 1.8 forward, which is a 17 degree
       lean, and `curl` went to zero at p = 1 so even that was gone by the end. The
       sheet slid down a slope and was never once seen to curl.
       Now a peel line sweeps from head to foot as p runs, everything below it is
       still stuck to the face, and everything above it is wrapped onto a cylinder
       of radius CMSN_R: arc length s above the line becomes angle s / R, so the
       free edge genuinely turns over past ninety degrees. Past CMSN_PHI the roll
       stops tightening and the rest of the freed sheet runs straight off on the
       tangent, which is what stops it spiralling into itself at large p.
       That shape is still blended against the flat pull by `curl`, so the sheet
       comes off curled and lies flat again by p = 1, ready for the settle. */
    if (p !== S.lastP) {
      S.lastP = p;
      var arr = S.sheetPos.array, nrm = S.sheetNorm.array;
      var rows = S.sheetRows, j, b;
      var curl = 4 * p * (1 - p);
      var hinge = 2.95 - p * CMSN_SHEET_H;      /* the peel line, head to foot */
      for (j = 0; j < rows; j++) {
        var by = S.rowBaseY[j];
        var lift = clamp01(p * (1 + CMSN_SPREAD) - (1 - S.rowVY[j]) * CMSN_SPREAD);
        var yy = by - lift * 0.10;              /* the flat pull */
        var zz = lift * CMSN_PEEL_H;
        var s = by - hinge;                     /* arc length above the peel line */
        if (s > 0) {
          var th = s / CMSN_R, tail = 0;
          if (th > CMSN_PHI) { th = CMSN_PHI; tail = s - CMSN_ROLL; }
          var ct = Math.cos(th), st = Math.sin(th);
          yy = lerp(yy, hinge + CMSN_R * st + tail * ct, curl);
          zz = lerp(zz, CMSN_R * (1 - ct) + tail * st, curl);
        } else {
          yy = lerp(yy, by, curl);
          zz = lerp(zz, 0, curl);
        }
        S.rowY[j] = yy; S.rowZ[j] = zz;
        b = j * 6;
        arr[b + 1] = yy; arr[b + 2] = zz;
        arr[b + 4] = yy; arr[b + 5] = zz;
      }
      /* NORMALS FOLLOW THE POSITIONS. They did not: every vertex still held the
         PlaneGeometry (0, 0, 1) for the whole act, so the one surface in this act
         whose entire job is to answer a raking light was shaded as if it were
         still lying flat on the slab. Taken by difference of the two rows just
         written, which is exact for whatever the blend above produced and costs
         25 square roots on frames that were writing anyway. computeVertexNormals
         would allocate, so it is not an option here. */
      for (j = 0; j < rows; j++) {
        var jn = j < rows - 1 ? j + 1 : j - 1;
        var dy = S.rowY[jn] - S.rowY[j], dz = S.rowZ[jn] - S.rowZ[j];
        if (j === rows - 1) { dy = -dy; dz = -dz; }   /* last row borrows the one above */
        var len = Math.sqrt(dy * dy + dz * dz) || 1;
        var ny = dz / len, nz = -dy / len;
        b = j * 6;
        nrm[b] = 0; nrm[b + 1] = ny; nrm[b + 2] = nz;
        nrm[b + 3] = 0; nrm[b + 4] = ny; nrm[b + 5] = nz;
      }
      S.sheetPos.needsUpdate = true;
      S.sheetNorm.needsUpdate = true;
    }
    /* then the whole sheet steps forward and settles, square to a dead camera */
    var settle = ease(clamp01((t - 0.90) / 0.10));
    S.sheet.position.z = lerp(CMSN_SHEET_Z, CMSN_SHEET_Z + 1.25, settle);
    S.sheet.position.y = lerp(CMSN_SLAB_Y, CMSN_SLAB_Y + 0.25, settle);

    /* ---------------------------------------------------- the light goes cold */
    var hand = clamp01((t - 0.90) / 0.10);
    /* Hold the EXPOSURE, travel the ANGLE. decay 2 on a lamp whose throw goes from
       12.5 units down to 6.0 and back to 7.0 was multiplying the object's light by
       four and a half through the middle of the sweep; the face blew to clipped
       white and the pool visibly shrank, which is the searchlight this act says it
       is not. Cancelling d squared leaves a constant irradiance of 20 at the slab
       centre - the value this rig was composed at when the lamp stood still - and
       every change on the face is then genuinely the incidence angle moving.
       Pure t: lampX is pure t. At the hand-over it falls to 4.2, under the cold
       counter-light's 7.6 at its own distance, so the face really does go cold
       rather than merely going slightly less gold. */
    var d2 = lampX * lampX + 35.65;    /* (3.85 - 1.1)^2 + 5.30^2 */
    S.key.intensity = lerp(20, 4.2, hand) * d2;
    S.cold.intensity = lerp(0, 900, hand);
    S.lensMat.color.lerpColors(S.lensHot, S.lensCold, hand);

    /* dust rises with the beam, thins once the lamp parks, and all but goes out
       when the gold does, so the last frame is cold air and one page */
    var dust = 0.50 * clamp01((t - 0.10) / 0.24);
    dust = lerp(dust, 0.16, clamp01((t - 0.60) / 0.12));
    S.motes.material.opacity = dust * lerp(1, 0.22, hand);
  }
};

export const ACTS = [
  actRoom, actRegistry, actFloor, actRun, actInstrument,
  actKiln, actRecord, actLedger, actCommission
];
