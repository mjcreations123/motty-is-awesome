/* Minimal static server for the design-dna specimen site. Demo only. */
const http = require("http");
const fs = require("fs");
const path = require("path");

const ROOT = __dirname;
const PORT = process.env.PORT || 4980;
const TYPES = {
  ".html": "text/html; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".svg": "image/svg+xml",
  ".ico": "image/x-icon",
  ".woff2": "font/woff2",
};

http
  .createServer((req, res) => {
    let url = decodeURIComponent(req.url.split("?")[0]);
    if (url === "/") url = "/index.html";
    const file = path.join(ROOT, path.normalize(url).replace(/^(\.\.[/\\])+/, ""));
    if (!file.startsWith(ROOT)) {
      res.writeHead(403);
      return res.end("forbidden");
    }
    const serve = (f, allowHtml) => {
      fs.readFile(f, (err, buf) => {
        if (err) {
          if (allowHtml && !path.extname(f)) return serve(f + ".html", false);
          res.writeHead(404, { "content-type": "text/plain" });
          return res.end("not found");
        }
        res.writeHead(200, { "content-type": TYPES[path.extname(f)] || "application/octet-stream" });
        res.end(buf);
      });
    };
    serve(file, true);
  })
  .listen(PORT, () => console.log("design-dna specimen on http://localhost:" + PORT));
