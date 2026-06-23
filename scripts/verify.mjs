import fs from "node:fs";
import http from "node:http";
import path from "node:path";

const distDir = path.join(process.cwd(), "dist");

if (!fs.existsSync(path.join(distDir, "index.html"))) {
  throw new Error("dist/ is missing. Run npm run build first.");
}

function serveFile(filePath, res) {
  const ext = path.extname(filePath).toLowerCase();
  const contentTypes = {
    ".html": "text/html; charset=utf-8",
    ".css": "text/css; charset=utf-8",
    ".js": "text/javascript; charset=utf-8"
  };

  res.statusCode = 200;
  res.setHeader("Content-Type", contentTypes[ext] || "application/octet-stream");
  fs.createReadStream(filePath).pipe(res);
}

function request(port, pathname) {
  return new Promise((resolve, reject) => {
    const req = http.request(
      {
        hostname: "127.0.0.1",
        port,
        path: pathname,
        method: "GET"
      },
      (res) => {
        const chunks = [];
        res.on("data", (chunk) => chunks.push(chunk));
        res.on("end", () => {
          resolve({
            statusCode: res.statusCode || 0,
            body: Buffer.concat(chunks).toString("utf8")
          });
        });
      }
    );

    req.on("error", reject);
    req.end();
  });
}

const checks = [
  ["/", 200, "Leos Universe Explorer", "index.html"],
  ["/index.html", 200, "MISSION CONTROL", "index.html"],
  ["/app.js", 200, "window.__universeDebug", "app.js"],
  ["/styles.css", 200, "--tool-color", "styles.css"],
  ["/universe-sim.js", 200, "createUniverse", "universe-sim.js"],
  ["/universe-render.js", 200, "renderScene", "universe-render.js"]
];

function offlineVerify() {
  for (const [pathname, expectedStatus, expectedBody, fileName] of checks) {
    const filePath = path.join(distDir, fileName);
    if (!fs.existsSync(filePath)) {
      throw new Error(`Missing ${fileName} for ${pathname}`);
    }
    const body = fs.readFileSync(filePath, "utf8");
    if (expectedStatus !== 200) {
      throw new Error(`Unexpected status expectation for ${pathname}`);
    }
    if (!body.includes(expectedBody)) {
      throw new Error(`Expected ${pathname} to include ${expectedBody}`);
    }
  }
  console.log("Verification passed offline; localhost bind blocked in this environment.");
}

const server = http.createServer((req, res) => {
  const urlPath = new URL(req.url || "/", "http://localhost").pathname;
  const filePath = urlPath === "/" ? path.join(distDir, "index.html") : path.join(distDir, urlPath);

  if (!filePath.startsWith(distDir) || !fs.existsSync(filePath) || !fs.statSync(filePath).isFile()) {
    res.statusCode = 404;
    res.setHeader("Content-Type", "text/plain; charset=utf-8");
    res.end("Not found");
    return;
  }

  serveFile(filePath, res);
});

try {
  const port = await new Promise((resolve, reject) => {
    const onError = (error) => reject(error);
    server.once("error", onError);
    server.listen(0, "127.0.0.1", () => {
      server.off("error", onError);
      const address = server.address();
      resolve(typeof address === "object" && address ? address.port : 0);
    });
  });

  for (const [pathname, expectedStatus, expectedBody] of checks) {
    const result = await request(port, pathname);
    if (result.statusCode !== expectedStatus) {
      throw new Error(`Expected ${pathname} to return ${expectedStatus}, got ${result.statusCode}`);
    }
    if (!result.body.includes(expectedBody)) {
      throw new Error(`Expected ${pathname} to include ${expectedBody}`);
    }
  }

  console.log(`Verification passed on http://127.0.0.1:${port}`);
} catch (error) {
  if (error?.code === "EPERM") {
    offlineVerify();
  } else {
    throw error;
  }
} finally {
  server.close?.();
}
