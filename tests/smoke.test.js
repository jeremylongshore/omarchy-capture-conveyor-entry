const test = require("node:test")
// RTM: REQ-CC-005, REQ-CC-007
const assert = require("node:assert/strict")
const fs = require("node:fs")
const os = require("node:os")
const path = require("node:path")
const { spawnSync } = require("node:child_process")
const Model = require("../Model.js")

const root = path.join(__dirname, "..")

test("QML calls only Model.js functions exported by the stock QML contract", () => {
  const qml = fs.readFileSync(path.join(root, "Panel.qml"), "utf8")
  const calls = [...qml.matchAll(/Model\.([A-Za-z][A-Za-z0-9_]*)\(/g)].map(match => match[1])
  assert.ok(calls.length > 0)
  for (const name of new Set(calls)) assert.equal(typeof Model[name], "function", name)
  assert.match(qml, /manageIpc:\s*false/)
  assert.match(qml, /KeyboardPanel\s*\{/)
  assert.match(qml, /anchorItem:\s*root\.anchorItem/)
})

test("stock Perl scanner inventories an explicit local screenshot directory", () => {
  const temp = fs.mkdtempSync(path.join(os.tmpdir(), "capture-conveyor-smoke-"))
  try {
    const shots = path.join(temp, "shots"); fs.mkdirSync(shots)
    fs.writeFileSync(path.join(shots, "screenshot-smoke.png"), "fixture")
    const result = spawnSync(path.join(root, "bin", "capture-conveyor-scan"), [], {
      encoding: "utf8",
      env: { ...process.env, HOME: temp, OMARCHY_SCREENSHOT_DIR: shots, XDG_PICTURES_DIR: "" },
      timeout: 2000
    })
    assert.equal(result.status, 0, result.stderr)
    const parsed = JSON.parse(result.stdout)
    assert.equal(parsed.captures.length, 1); assert.match(parsed.captures[0].path, /screenshot-smoke\.png$/)
  } finally {
    fs.rmSync(temp, { recursive: true, force: true })
  }
})

test("the scanner needs no node, python or ruby on PATH, only the perl a stock Omarchy install has", () => {
  const temp = fs.mkdtempSync(path.join(os.tmpdir(), "capture-conveyor-nointerp-"))
  try {
    const stubs = path.join(temp, "stubs"); fs.mkdirSync(stubs)
    for (const name of ["node", "nodejs", "python", "python3", "ruby"]) {
      fs.writeFileSync(path.join(stubs, name), "#!/bin/sh\nexit 127\n", { mode: 0o755 })
    }
    const shots = path.join(temp, "Pictures", "Screenshots"); fs.mkdirSync(shots, { recursive: true })
    fs.writeFileSync(path.join(shots, "screenshot-2026-11-15_09-41-12-firefox.png"), "fixture")
    const env = { PATH: stubs + ":/usr/bin:/bin", HOME: temp, LANG: "C.UTF-8" }
    const result = spawnSync(path.join(root, "bin", "capture-conveyor-scan"), [], { encoding: "utf8", env, timeout: 2000 })
    assert.equal(result.status, 0, result.stderr)
    const parsed = JSON.parse(result.stdout)
    assert.equal(parsed.directory, shots)
    assert.equal(parsed.captures.length, 1)
    // The shebang names perl by absolute path, so PATH cannot swap the interpreter either.
    assert.equal(fs.readFileSync(path.join(root, "bin", "capture-conveyor-scan"), "utf8").split("\n")[0], "#!/usr/bin/perl")
  } finally {
    fs.rmSync(temp, { recursive: true, force: true })
  }
})

test("runtime actions stay fixed-argv, stock-shaped, and report failures", () => {
  const qml = fs.readFileSync(path.join(root, "Panel.qml"), "utf8")
  assert.doesNotMatch(qml, /tensaku|bash|sh -c|execDetached/)
  assert.match(qml, /\["omarchy", "capture", "screenshot", "smart"\]/)
  assert.match(qml, /\["omarchy", "capture", "text"\]/)
  assert.match(qml, /\["wl-copy", "--type", "text\/plain", root\.selectedPath\]/)
  assert.match(qml, /\["xdg-open", root\.captureDirectory\]/)
  assert.match(qml, /actionStatus = code === 0 \? "" : "ACTION FAILED/)
})
