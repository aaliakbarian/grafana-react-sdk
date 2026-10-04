#!/bin/sh

set -eu

test "$(node --version)" = "v22.23.3"
test "$(yarn --version)" = "4.17.1"
test "$(id -u)" != "0"
test "$(id -u)" = "$(stat -c %u /workspace)"
test "$(id -g)" = "$(stat -c %g /workspace)"

yarn install --immutable
yarn typecheck
yarn test:unit
yarn test:integration
yarn test:e2e
yarn build:poc
yarn inspect:bundle

node -e '
  const fs = require("node:fs");
  const path = require("node:path");

  for (const name of ["react", "react-dom"]) {
    const installations = [];
    const visit = (directory) => {
      for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
        const candidate = path.join(directory, entry.name);
        if (entry.isDirectory()) {
          if (candidate === "/workspace/.git") {
            continue;
          }
          if (
            path.basename(directory) === "node_modules" &&
            entry.name === name &&
            fs.existsSync(path.join(candidate, "package.json"))
          ) {
            installations.push(fs.realpathSync(candidate));
          }
          visit(candidate);
        }
      }
    };

    visit("/workspace");
    const physicalInstallations = new Set(installations);
    if (physicalInstallations.size !== 1) {
      throw new Error(`${name} has ${physicalInstallations.size} physical installations: ${[...physicalInstallations].join(", ")}`);
    }
    const installation = [...physicalInstallations][0];
    const version = JSON.parse(fs.readFileSync(path.join(installation, "package.json"), "utf8")).version;
    if (version !== "19.2.8") {
      throw new Error(`${name} resolved to ${version}, expected 19.2.8`);
    }
    console.log(`${name}=single:${installation}@${version}`);
  }
'
