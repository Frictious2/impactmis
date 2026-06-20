const http = require("http");
const https = require("https");
const { URL } = require("url");
const fs = require("fs");
const path = require("path");

const STATIC_ROUTE_EXPECTATIONS = [
  ["app.js", 'app.get("/health"'],
  ["src/routes/auth.routes.js", '"/login"'],
  ["src/routes/developer.routes.js", '"/dashboard"'],
  ["src/routes/tenant.routes.js", '"/dashboard"'],
  ["src/routes/tenant.routes.js", '"/staff"'],
  ["src/routes/tenant.routes.js", '"/branches"'],
  ["src/routes/tenant.routes.js", '"/attendance"'],
  ["src/routes/tenant.routes.js", '"/projects"'],
  ["src/routes/tenant.routes.js", '"/activity-reports"'],
  ["src/routes/tenant.routes.js", '"/surveys"'],
  ["src/routes/tenant.routes.js", '"/payroll/runs"'],
  ["src/routes/tenant.routes.js", '"/finance/categories"'],
  ["src/routes/tenant.routes.js", '"/expenses"'],
  ["src/routes/tenant.routes.js", '"/accounting/accounts"'],
  ["src/routes/tenant.routes.js", '"/reports/center"'],
  ["src/routes/tenant.routes.js", '"/notifications"'],
  ["src/routes/tenant.routes.js", '"/messages"'],
  ["src/routes/donor.routes.js", '"/dashboard"']
];

const HTTP_CHECKS = [
  ["/health", [200]],
  ["/login", [200, 302]],
  ["/developer/dashboard", [200, 302, 403]],
  ["/dashboard", [200, 302, 403]],
  ["/staff", [200, 302, 403]],
  ["/branches", [200, 302, 403]],
  ["/attendance", [200, 302, 403]],
  ["/projects", [200, 302, 403]],
  ["/activity-reports", [200, 302, 403]],
  ["/surveys", [200, 302, 403]],
  ["/payroll/runs", [200, 302, 403]],
  ["/finance/categories", [200, 302, 403]],
  ["/expenses", [200, 302, 403]],
  ["/accounting/accounts", [200, 302, 403]],
  ["/reports/center", [200, 302, 403]],
  ["/notifications", [200, 302, 403]],
  ["/messages", [200, 302, 403]],
  ["/donor/dashboard", [200, 302, 403]]
];

function pass(message) {
  console.log(`PASS ${message}`);
}

function fail(message) {
  console.error(`FAIL ${message}`);
  process.exitCode = 1;
}

function checkStaticRoutes() {
  STATIC_ROUTE_EXPECTATIONS.forEach(([file, needle]) => {
    const source = fs.readFileSync(path.join(process.cwd(), file), "utf8");
    if (source.includes(needle)) {
      pass(`${file} contains ${needle}`);
    } else {
      fail(`${file} missing ${needle}`);
    }
  });
}

function request(baseUrl, route) {
  return new Promise((resolve) => {
    const url = new URL(route, baseUrl);
    const client = url.protocol === "https:" ? https : http;
    const req = client.request(
      url,
      {
        method: "GET",
        timeout: 7000,
        headers: { "User-Agent": "ImpactMIS route smoke check" }
      },
      (res) => {
        res.resume();
        res.on("end", () => resolve(res.statusCode));
      }
    );
    req.on("timeout", () => {
      req.destroy();
      resolve("timeout");
    });
    req.on("error", (error) => resolve(error.code || error.message));
    req.end();
  });
}

async function checkHttpRoutes() {
  const baseUrl = process.env.BASE_URL;
  if (!baseUrl) {
    pass("BASE_URL not set; skipped live HTTP checks");
    return;
  }

  for (const [route, allowed] of HTTP_CHECKS) {
    const status = await request(baseUrl, route);
    if (allowed.includes(status)) {
      pass(`${route} returned ${status}`);
    } else {
      fail(`${route} returned ${status}; expected one of ${allowed.join(", ")}`);
    }
  }
}

async function main() {
  ["../src/routes/auth.routes", "../src/routes/developer.routes", "../src/routes/tenant.routes", "../src/routes/donor.routes"].forEach(
    (routeModule) => {
      try {
        require(routeModule);
        pass(`route module loads: ${routeModule}`);
      } catch (error) {
        fail(`route module failed: ${routeModule} (${error.message})`);
      }
    }
  );
  checkStaticRoutes();
  await checkHttpRoutes();
}

main().catch((error) => {
  fail(error.stack || error.message);
});
