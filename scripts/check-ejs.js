const fs = require("fs");
const path = require("path");
const ejs = require("ejs");

const viewsRoot = path.join(process.cwd(), "views");

function walk(dir) {
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const fullPath = path.join(dir, entry.name);
    return entry.isDirectory() ? walk(fullPath) : [fullPath];
  });
}

function main() {
  const files = walk(viewsRoot).filter((file) => file.endsWith(".ejs"));
  let failed = 0;

  files.forEach((file) => {
    try {
      ejs.compile(fs.readFileSync(file, "utf8"), { filename: file });
      console.log(`PASS ${path.relative(process.cwd(), file)}`);
    } catch (error) {
      failed += 1;
      console.error(`FAIL ${path.relative(process.cwd(), file)}: ${error.message}`);
    }
  });

  console.log(`Checked ${files.length} EJS template(s).`);
  if (failed) {
    process.exitCode = 1;
  }
}

main();
