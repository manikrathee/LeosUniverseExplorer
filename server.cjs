const http = require("http");
const fs = require("fs");
const path = require("path");

const root = __dirname;
const port = process.env.PORT ? Number(process.env.PORT) : 3000;

const mimeTypes = {
  ".html": "text/html; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".svg": "image/svg+xml",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".webp": "image/webp",
  ".ico": "image/x-icon"
};

function resolveFile(urlPath) {
  const cleanPath = decodeURIComponent(urlPath.split("?")[0]);
  const filePath = cleanPath === "/" ? "/index.html" : cleanPath;
  return path.join(root, filePath);
}

const server = http.createServer((req, res) => {
  const file = resolveFile(req.url || "/");

  fs.stat(file, (statErr, stat) => {
    if (statErr || !stat.isFile()) {
      res.statusCode = 404;
      res.setHeader("Content-Type", "text/plain; charset=utf-8");
      res.end("Not found");
      return;
    }

    const ext = path.extname(file).toLowerCase();
    res.statusCode = 200;
    res.setHeader("Content-Type", mimeTypes[ext] || "application/octet-stream");
    fs.createReadStream(file).pipe(res);
  });
});

server.listen(port, () => {
  console.log(`Leos Universe Explorer running at http://localhost:${port}`);
});
