const test = require("node:test")
const assert = require("node:assert/strict")
const fs = require("node:fs")
const os = require("node:os")
const path = require("node:path")
const { spawn, spawnSync } = require("node:child_process")

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
function stopRacer(child) {
  if (child.exitCode !== null) return Promise.resolve()
  return new Promise(resolve => { child.once("close", resolve); child.kill() })
}
async function waitFor(file, timeout = 3000) {
  const deadline = Date.now() + timeout
  while (!fs.existsSync(file)) {
    if (Date.now() >= deadline) assert.fail(`timed out waiting for ${file}`)
    await new Promise(resolve => setTimeout(resolve, 10))
  }
}
function repairDirectory(directory, parked) {
  try { if (fs.lstatSync(directory).isSymbolicLink()) fs.unlinkSync(directory) } catch {}
  if (!fs.existsSync(directory) && fs.existsSync(parked)) fs.renameSync(parked, directory)
  else if (fs.existsSync(parked)) fs.rmSync(parked, { recursive: true, force: true })
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

test("scanner budgets every directory entry, including nonmatching files", () => {
  const root = temp(); const shots = path.join(root, "shots"); fs.mkdirSync(shots)
  for (let i = 0; i < 600; i++) fs.writeFileSync(path.join(shots, `decoy-${String(i).padStart(4, "0")}.txt`), "x")
  write(shots, "screenshot-after-decoys.png", 1700000000)
  const started = Date.now()
  const result = scan({ HOME: root, OMARCHY_SCREENSHOT_DIR: shots, XDG_PICTURES_DIR: "" })
  assert.equal(result.truncated, true)
  assert.ok(result.captures.length <= 24)
  assert.ok(Date.now() - started < 1500, "full directory enumeration must stay bounded")
  fs.rmSync(root, { recursive: true, force: true })
})

test("scanner rejects a final config symlink without reading its victim", () => {
  const root = temp(); const config = path.join(root, "config"); const victim = path.join(root, "victim")
  const pictures = path.join(root, "Victim Pictures")
  fs.mkdirSync(config); fs.mkdirSync(victim); fs.mkdirSync(pictures)
  fs.writeFileSync(path.join(victim, "user-dirs.dirs"), 'XDG_PICTURES_DIR="$HOME/Victim Pictures"\n')
  fs.symlinkSync(path.join(victim, "user-dirs.dirs"), path.join(config, "user-dirs.dirs"))
  write(pictures, "screenshot-secret.png", 1700000000)
  const result = scan({ HOME: root, XDG_CONFIG_HOME: config, OMARCHY_SCREENSHOT_DIR: "", XDG_PICTURES_DIR: "" })
  assert.equal(result.directory, path.join(root, "Pictures"))
  assert.deepEqual(result.captures, [])
  fs.rmSync(root, { recursive: true, force: true })
})

test("scanner pins the final config descriptor during a same-UID symlink swap race", async () => {
  const root = temp(); const config = path.join(root, "config"); const safePictures = path.join(root, "Safe Pictures")
  const victimPictures = path.join(root, "Victim Pictures"); const victim = path.join(root, "victim.dirs")
  const final = path.join(config, "user-dirs.dirs"); const safe = path.join(config, "safe.dirs")
  fs.mkdirSync(config); fs.mkdirSync(safePictures); fs.mkdirSync(victimPictures)
  fs.writeFileSync(safe, 'XDG_PICTURES_DIR="$HOME/Safe Pictures"\n')
  fs.copyFileSync(safe, final)
  fs.writeFileSync(victim, 'XDG_PICTURES_DIR="$HOME/Victim Pictures"\n')
  write(safePictures, "screenshot-safe.png", 1700000000)
  write(victimPictures, "screenshot-secret.png", 1700000001)
  const marker = path.join(root, "config-final-ready")
  const racer = spawn(process.execPath, [path.join(__dirname, "fixtures", "config-final-racer.js"), final, safe, victim, marker], { stdio: "ignore" })
  try {
    await waitFor(marker)
    for (let i = 0; i < 40; i++) {
      const result = scan({ HOME: root, XDG_CONFIG_HOME: config, OMARCHY_SCREENSHOT_DIR: "", XDG_PICTURES_DIR: "" })
      assert.notEqual(result.directory, victimPictures)
      assert.equal(result.captures.some(x => x.path.includes("screenshot-secret.png")), false)
    }
    await waitFor(`${marker}.attacked`)
  } finally {
    await stopRacer(racer)
    fs.rmSync(root, { recursive: true, force: true })
  }
})

test("scanner rejects a symlinked config parent directory", () => {
  const root = temp(); const victim = path.join(root, "victim"); const pictures = path.join(root, "Victim Pictures")
  fs.mkdirSync(victim); fs.mkdirSync(pictures)
  fs.writeFileSync(path.join(victim, "user-dirs.dirs"), 'XDG_PICTURES_DIR="$HOME/Victim Pictures"\n')
  fs.symlinkSync(victim, path.join(root, "config-link"), "dir")
  write(pictures, "screenshot-secret.png", 1700000000)
  const result = scan({ HOME: root, XDG_CONFIG_HOME: path.join(root, "config-link"), OMARCHY_SCREENSHOT_DIR: "", XDG_PICTURES_DIR: "" })
  assert.equal(result.directory, path.join(root, "Pictures"))
  assert.deepEqual(result.captures, [])
  fs.rmSync(root, { recursive: true, force: true })
})

test("scanner rejects a symlink in an intermediate config-path component", () => {
  const root = temp(); const real = path.join(root, "real"); const config = path.join(real, "config")
  const pictures = path.join(root, "Victim Pictures"); fs.mkdirSync(config, { recursive: true }); fs.mkdirSync(pictures)
  fs.writeFileSync(path.join(config, "user-dirs.dirs"), 'XDG_PICTURES_DIR="$HOME/Victim Pictures"\n')
  fs.symlinkSync(real, path.join(root, "linked"), "dir")
  write(pictures, "screenshot-secret.png", 1700000000)
  const result = scan({ HOME: root, XDG_CONFIG_HOME: path.join(root, "linked", "config"), OMARCHY_SCREENSHOT_DIR: "", XDG_PICTURES_DIR: "" })
  assert.equal(result.directory, path.join(root, "Pictures")); assert.deepEqual(result.captures, [])
  fs.rmSync(root, { recursive: true, force: true })
})

test("scanner pins the config parent during a same-UID directory swap race", async () => {
  const root = temp(); const config = path.join(root, "config"); const parked = path.join(root, "config-parked")
  const safePictures = path.join(root, "Safe Pictures"); const victimDir = path.join(root, "victim-config")
  const victimPictures = path.join(root, "Victim Pictures")
  fs.mkdirSync(config); fs.mkdirSync(victimDir); fs.mkdirSync(safePictures); fs.mkdirSync(victimPictures)
  fs.writeFileSync(path.join(config, "user-dirs.dirs"), 'XDG_PICTURES_DIR="$HOME/Safe Pictures"\n')
  fs.writeFileSync(path.join(victimDir, "user-dirs.dirs"), 'XDG_PICTURES_DIR="$HOME/Victim Pictures"\n')
  write(safePictures, "screenshot-safe.png", 1700000000)
  write(victimPictures, "screenshot-secret.png", 1700000001)
  const marker = path.join(root, "config-parent-ready")
  const racer = spawn(process.execPath, [path.join(__dirname, "fixtures", "directory-swap-racer.js"), config, parked, victimDir, marker], { stdio: "ignore" })
  try {
    await waitFor(marker)
    for (let i = 0; i < 40; i++) {
      const result = scan({ HOME: root, XDG_CONFIG_HOME: config, OMARCHY_SCREENSHOT_DIR: "", XDG_PICTURES_DIR: "" })
      assert.notEqual(result.directory, victimPictures)
      assert.equal(result.captures.some(x => x.path.includes("screenshot-secret.png")), false)
    }
    await waitFor(`${marker}.attacked`)
  } finally {
    await stopRacer(racer)
    repairDirectory(config, parked)
    fs.rmSync(root, { recursive: true, force: true })
  }
})

test("scanner cannot be redirected by a same-UID capture-directory swap", async () => {
  const root = temp(); const shots = path.join(root, "shots"); const parked = path.join(root, "shots-parked")
  const victim = path.join(root, "victim-shots"); fs.mkdirSync(shots); fs.mkdirSync(victim)
  write(shots, "screenshot-safe.png", 1700000000); write(victim, "screenshot-secret.png", 1700000001)
  const marker = path.join(root, "capture-parent-ready")
  const racer = spawn(process.execPath, [path.join(__dirname, "fixtures", "directory-swap-racer.js"), shots, parked, victim, marker], { stdio: "ignore" })
  try {
    await waitFor(marker)
    for (let i = 0; i < 40; i++) {
      const result = scan({ HOME: root, OMARCHY_SCREENSHOT_DIR: shots, XDG_PICTURES_DIR: "" })
      assert.equal(result.captures.some(x => x.path.includes("screenshot-secret.png")), false)
    }
    await waitFor(`${marker}.attacked`)
  } finally {
    await stopRacer(racer); repairDirectory(shots, parked)
    fs.rmSync(root, { recursive: true, force: true })
  }
})

test("scanner does not block on a config FIFO", () => {
  const root = temp(); const config = path.join(root, "config"); fs.mkdirSync(config)
  const fifo = path.join(config, "user-dirs.dirs")
  assert.equal(spawnSync("mkfifo", [fifo]).status, 0)
  const started = Date.now()
  const result = scan({ HOME: root, XDG_CONFIG_HOME: config, OMARCHY_SCREENSHOT_DIR: "", XDG_PICTURES_DIR: "" })
  assert.ok(Date.now() - started < 1500, "FIFO handling must fail closed without blocking")
  assert.equal(result.directory, path.join(root, "Pictures"))
  fs.rmSync(root, { recursive: true, force: true })
})

test("scanner rejects oversized config input", () => {
  const root = temp(); const config = path.join(root, "config"); fs.mkdirSync(config)
  fs.writeFileSync(path.join(config, "user-dirs.dirs"), 'XDG_PICTURES_DIR="$HOME/Victim Pictures"\n' + "x".repeat(9000))
  const result = scan({ HOME: root, XDG_CONFIG_HOME: config, OMARCHY_SCREENSHOT_DIR: "", XDG_PICTURES_DIR: "" })
  assert.equal(result.directory, path.join(root, "Pictures"))
  assert.deepEqual(result.captures, [])
  fs.rmSync(root, { recursive: true, force: true })
})

test("scanner keeps bounded records in memory and needs no replaceable temp file", () => {
  const root = temp(); const shots = path.join(root, "shots"); const scratch = path.join(root, "scratch")
  fs.mkdirSync(shots); fs.mkdirSync(scratch)
  const capture = write(shots, "screenshot-one.png", 1700000000)
  const before = fs.readdirSync(scratch)
  const result = scan({ HOME: root, TMPDIR: scratch, OMARCHY_SCREENSHOT_DIR: shots, XDG_PICTURES_DIR: "" })
  assert.deepEqual(result.captures.map(x => x.path), [capture])
  assert.deepEqual(fs.readdirSync(scratch), before)
  fs.rmSync(root, { recursive: true, force: true })
})
