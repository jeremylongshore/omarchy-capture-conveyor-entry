const test = require("node:test")
const assert = require("node:assert/strict")
const fs = require("node:fs")
const os = require("node:os")
const path = require("node:path")
const { spawnSync } = require("node:child_process")

const scanner = path.join(__dirname, "..", "bin", "capture-conveyor-scan")

function temp() { return fs.mkdtempSync(path.join(os.tmpdir(), "capture-conveyor-")) }
function write(dir, name, seconds) {
  const file = path.join(dir, name)
  fs.writeFileSync(file, "not-a-real-png")
  fs.utimesSync(file, seconds, seconds)
  return file
}
function scan(env) {
  const result = spawnSync(scanner, [], { encoding: "utf8", env: { ...process.env, ...env } })
  assert.equal(result.status, 0, result.stderr)
  return JSON.parse(result.stdout)
}

test("scanner follows explicit Omarchy directory and excludes non-contract files", () => {
  const root = temp(); const shots = path.join(root, "shots"); fs.mkdirSync(shots)
  const newest = write(shots, "screenshot-new.png", 1700000200)
  write(shots, "photo.png", 1700000300)
  write(shots, "screenshot-old.jpg", 1700000100)
  fs.mkdirSync(path.join(shots, "screenshot-dir.png"))
  fs.symlinkSync(newest, path.join(shots, "screenshot-link.png"))
  const result = scan({ HOME: root, OMARCHY_SCREENSHOT_DIR: shots, XDG_PICTURES_DIR: "", XDG_CONFIG_HOME: path.join(root, "config") })
  assert.equal(result.directory, shots)
  assert.deepEqual(result.captures.map(x => x.path), [newest])
  fs.rmSync(root, { recursive: true, force: true })
})

test("scanner honors user-dirs Pictures setting and returns an empty inbox when absent", () => {
  const root = temp(); const config = path.join(root, "config"); const pictures = path.join(root, "Custom Pictures")
  fs.mkdirSync(config, { recursive: true }); fs.mkdirSync(pictures)
  fs.writeFileSync(path.join(config, "user-dirs.dirs"), 'XDG_PICTURES_DIR="$HOME/Custom Pictures"\n')
  const capture = write(pictures, "screenshot-one.png", 1700000000)
  const result = scan({ HOME: root, XDG_CONFIG_HOME: config, OMARCHY_SCREENSHOT_DIR: "", XDG_PICTURES_DIR: "" })
  assert.deepEqual(result.captures.map(x => x.path), [capture])
  const absent = scan({ HOME: root, OMARCHY_SCREENSHOT_DIR: path.join(root, "missing"), XDG_PICTURES_DIR: "" })
  assert.deepEqual(absent.captures, [])
  fs.rmSync(root, { recursive: true, force: true })
})

test("scanner bounds output and marks a partial inventory", () => {
  const root = temp(); const shots = path.join(root, "shots"); fs.mkdirSync(shots)
  for (let i = 0; i < 30; i++) write(shots, "screenshot-" + i + ".png", 1700000000 + i)
  const result = scan({ HOME: root, OMARCHY_SCREENSHOT_DIR: shots, XDG_PICTURES_DIR: "" })
  assert.equal(result.captures.length, 24)
  assert.equal(result.truncated, true)
  assert.match(result.captures[0].path, /screenshot-29\.png$/)
  fs.rmSync(root, { recursive: true, force: true })
})
