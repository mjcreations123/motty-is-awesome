# motty is awesome

A one-page showpiece by MJ's Studio, and a demonstration of design dna: a skill built for
Claude whose job is to stop it producing the website it produces for everybody else.

Nine acts, nine separate worlds. Each act owns its own scene graph, camera grammar,
projection, fog, ground and accent, and only one is ever live; they hand over through a
black shutter, which is a cut rather than a scroll position. One act has no perspective,
one has no 3D at all, and two invert the whole page to a light ground.

Static site, no build step: hand-written HTML, CSS and vanilla JavaScript, with three.js
pulled from a CDN through an import map.

**Zero image assets by design.** Every texture on the page is drawn in canvas 2D at runtime.
The only file in `img/` is the favicon.

**The canvas is strictly an enhancement.** With no WebGL, no three.js, or no JavaScript at
all, every act is still a real section with real copy that reads top to bottom. The two
interactions (click or press R to refuse a page on act 04; drag, tap or arrow the line of
heat on act 06) each have a keyboard path, and their cues are hidden when the world they
describe is not running.

## Local preview
```
node serve.js
```
then open http://localhost:4980

`?probe=1` exposes the world on `window.__world` for the verification harness. It is off
otherwise.
