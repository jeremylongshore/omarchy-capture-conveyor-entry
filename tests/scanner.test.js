const test = require("node:test")
const assert = require("node:assert/strict")
const fs = require("node:fs")
const os = require("node:os")
const path = require("node:path")
const { spawn, spawnSync } = require("node:child_process")

// CAPTURE_CONVEYOR_SCANNER lets the red proof run these tests against an older
// scanner; nothing else reads it.
const scanner = process.env.CAPTURE_CONVEYOR_SCANNER || path.join(__dirname, "..", "bin", "capture-conveyor-scan")

// The scanner's budgets. tests/scanner.test.js pins them: the numbers in the
// README and PR text come from here.
const SCAN_BUDGET = 2048
const NAME_BYTE_BUDGET = 262144

const AMBIENT = ["OMASNAP_SCREENSHOT_DIR", "OMARCHY_SCREENSHOT_DIR", "XDG_PICTURES_DIR", "XDG_CONFIG_HOME"]

function temp() { return fs.mkdtempSync(path.join(fs.realpathSync(os.tmpdir()), "capture-conveyor-")) }
function write(dir, name, seconds) {
  const file = path.join(dir, name)
  fs.writeFileSync(file, "not-a-real-png")
  fs.utimesSync(file, seconds, seconds)
  return file
}
// A folder that holds one capture, in the Omasnap layout: <pictures>/Screenshots.
function screenshotsIn(pictures, name = "screenshot-2026-11-15_09-41-12-firefox.png", seconds = 1700000000) {
  const shots = path.join(pictures, "Screenshots")
  fs.mkdirSync(shots, { recursive: true })
  return { shots, capture: write(shots, name, seconds) }
}
// Environment for a scan. The variables that pick the folder are cleared first so
// a developer's own Omarchy session cannot leak into a test.
function scanEnv(env) {
  const base = { ...process.env }
  for (const name of AMBIENT) delete base[name]
  return { ...base, ...env }
}
function scan(env) {
  const result = spawnSync(scanner, [], { encoding: "utf8", env: scanEnv(env) })
  assert.equal(result.status, 0, result.stderr)
  assert.equal(result.stderr, "", "the scanner must not print Perl warnings")
  return JSON.parse(result.stdout)
}
function writeConf(root, text) {
  const dir = path.join(root, "config", "omasnap")
  fs.mkdirSync(dir, { recursive: true })
  fs.writeFileSync(path.join(dir, "omasnap.conf"), text)
  return path.join(root, "config")
}
function writeUserDirs(root, text) {
  const config = path.join(root, "config")
  fs.mkdirSync(config, { recursive: true })
  fs.writeFileSync(path.join(config, "user-dirs.dirs"), text)
  return config
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
function fill(dir, count, make) {
  for (let i = 0; i < count; i++) fs.writeFileSync(path.join(dir, make(i)), "x")
}

// ---------------------------------------------------------------------------
// Where the folder is. Omasnap saves to ~/Pictures/Screenshots by default; these
// tests fail on a scanner that still lists ~/Pictures and ignores OMASNAP_*.
// ---------------------------------------------------------------------------

test("with nothing configured the scanner lists ~/Pictures/Screenshots, where Omasnap saves", () => {
  const root = temp(); const pictures = path.join(root, "Pictures")
  const { shots, capture } = screenshotsIn(pictures)
  write(pictures, "screenshot-old-layout-decoy.png", 1700000500)
  const result = scan({ HOME: root })
  assert.equal(result.directory, shots)
  assert.deepEqual(result.captures.map(x => x.path), [capture])
  assert.equal(result.reason, "")
  fs.rmSync(root, { recursive: true, force: true })
})

test("OMASNAP_SCREENSHOT_DIR wins over OMARCHY_SCREENSHOT_DIR", () => {
  const root = temp()
  const omasnap = path.join(root, "omasnap-shots"); const legacy = path.join(root, "legacy-shots")
  fs.mkdirSync(omasnap); fs.mkdirSync(legacy)
  const chosen = write(omasnap, "screenshot-chosen.png", 1700000000)
  write(legacy, "screenshot-legacy.png", 1700000100)
  const result = scan({ HOME: root, OMASNAP_SCREENSHOT_DIR: omasnap, OMARCHY_SCREENSHOT_DIR: legacy })
  assert.equal(result.directory, omasnap)
  assert.deepEqual(result.captures.map(x => x.path), [chosen])
  fs.rmSync(root, { recursive: true, force: true })
})

test("OMARCHY_SCREENSHOT_DIR still applies when OMASNAP_SCREENSHOT_DIR is unset or empty", () => {
  const root = temp(); const legacy = path.join(root, "legacy-shots"); fs.mkdirSync(legacy)
  const capture = write(legacy, "screenshot-legacy.png", 1700000000)
  assert.deepEqual(scan({ HOME: root, OMARCHY_SCREENSHOT_DIR: legacy }).captures.map(x => x.path), [capture])
  assert.deepEqual(scan({ HOME: root, OMASNAP_SCREENSHOT_DIR: "", OMARCHY_SCREENSHOT_DIR: legacy }).captures.map(x => x.path), [capture])
  fs.rmSync(root, { recursive: true, force: true })
})

test("scanner follows explicit Omarchy directory and excludes non-contract files", () => {
  const root = temp(); const shots = path.join(root, "shots"); fs.mkdirSync(shots)
  const newest = write(shots, "screenshot-new.png", 1700000200)
  write(shots, "photo.png", 1700000300)
  write(shots, "screenshot-old.jpg", 1700000100)
  write(shots, "screenshot-.png", 1700000400)
  fs.mkdirSync(path.join(shots, "screenshot-dir.png"))
  fs.symlinkSync(newest, path.join(shots, "screenshot-link.png"))
  const result = scan({ HOME: root, OMARCHY_SCREENSHOT_DIR: shots, XDG_CONFIG_HOME: path.join(root, "config") })
  assert.equal(result.directory, shots)
  assert.deepEqual(result.captures.map(x => x.path), [newest])
  assert.equal(result.truncated, false)
  assert.equal(result.budget_hit, false)
  assert.equal(result.reason, "")
  fs.rmSync(root, { recursive: true, force: true })
})

test("omasnap.conf [output] directory is used when no environment variable is set", () => {
  const root = temp()
  const { shots, capture } = screenshotsIn(path.join(root, "Pictures"), "screenshot-captures.png")
  const custom = path.join(root, "Captures"); fs.mkdirSync(custom)
  const configured = write(custom, "screenshot-configured.png", 1700000000)
  const config = writeConf(root, "[editor]\ndirectory = /nowhere\n\n[output]\n# Where saved screenshots go.\nautosave = true\ndirectory = ~/Captures\n")
  const result = scan({ HOME: root, XDG_CONFIG_HOME: config })
  assert.equal(result.directory, custom)
  assert.deepEqual(result.captures.map(x => x.path), [configured])
  assert.notEqual(result.directory, shots)
  assert.ok(capture)
  fs.rmSync(root, { recursive: true, force: true })
})

test("omasnap.conf values: quotes, a bare ~, the last assignment, and entries Omasnap itself would not use", () => {
  const root = temp()
  const spaced = path.join(root, "My Shots"); fs.mkdirSync(spaced)
  const spacedCapture = write(spaced, "screenshot-spaced.png", 1700000000)
  const fallback = screenshotsIn(path.join(root, "Pictures"))
  const run = text => scan({ HOME: root, XDG_CONFIG_HOME: writeConf(root, text) })

  assert.deepEqual(run('[output]\ndirectory = "~/My Shots"\n').captures.map(x => x.path), [spacedCapture])
  assert.deepEqual(run("[output]\ndirectory = /nowhere\ndirectory = ~/My Shots\n").captures.map(x => x.path), [spacedCapture])
  assert.equal(run("[output]\ndirectory = ~\n").directory, root)
  // Omasnap reads an unquoted value with a comma as an empty string and uses its default.
  assert.equal(run("[output]\ndirectory = ~/My Shots, 2026\n").directory, fallback.shots)
  // A relative path, an escape, a comment and a key in the wrong section are all ignored.
  assert.equal(run("[output]\ndirectory = Captures\n").directory, fallback.shots)
  assert.equal(run("[output]\ndirectory = ~/My\\x20Shots\n").directory, fallback.shots)
  assert.equal(run("[output]\n# directory = ~/My Shots\n; directory = ~/My Shots\n").directory, fallback.shots)
  assert.equal(run("directory = ~/My Shots\n[Output]\ndirectory = ~/My Shots\n").directory, fallback.shots)
  assert.equal(run("[output]\nautosave = false\n").directory, fallback.shots)
  fs.rmSync(root, { recursive: true, force: true })
})

test("an environment variable beats omasnap.conf, and omasnap.conf beats user-dirs.dirs", () => {
  const root = temp()
  const env = path.join(root, "env-shots"); const conf = path.join(root, "conf-shots"); const ud = path.join(root, "UD")
  fs.mkdirSync(env); fs.mkdirSync(conf); fs.mkdirSync(ud)
  const envCapture = write(env, "screenshot-env.png", 1700000000)
  const confCapture = write(conf, "screenshot-conf.png", 1700000000)
  const config = writeConf(root, `[output]\ndirectory = ${conf}\n`)
  fs.writeFileSync(path.join(config, "user-dirs.dirs"), 'XDG_PICTURES_DIR="$HOME/UD"\n')
  screenshotsIn(ud)
  assert.deepEqual(scan({ HOME: root, XDG_CONFIG_HOME: config, OMASNAP_SCREENSHOT_DIR: env }).captures.map(x => x.path), [envCapture])
  assert.deepEqual(scan({ HOME: root, XDG_CONFIG_HOME: config, OMARCHY_SCREENSHOT_DIR: env }).captures.map(x => x.path), [envCapture])
  assert.deepEqual(scan({ HOME: root, XDG_CONFIG_HOME: config }).captures.map(x => x.path), [confCapture])
  fs.rmSync(root, { recursive: true, force: true })
})

test("scanner honors the user-dirs Pictures setting plus /Screenshots, in every form Qt reads", () => {
  const root = temp(); const pictures = path.join(root, "Custom Pictures")
  const { shots, capture } = screenshotsIn(pictures, "screenshot-one.png")
  const run = text => scan({ HOME: root, XDG_CONFIG_HOME: writeUserDirs(root, text) })
  assert.deepEqual(run('XDG_PICTURES_DIR="$HOME/Custom Pictures"\n').captures.map(x => x.path), [capture])
  assert.equal(run("XDG_PICTURES_DIR=$HOME/Custom Pictures\n").directory, shots)
  assert.equal(run('XDG_PICTURES_DIR="$HOME/Custom Pictures/"\n').directory, shots)
  assert.equal(run(`XDG_PICTURES_DIR="${pictures}"\n`).directory, shots)
  assert.equal(run('XDG_PICTURES_DIR="$HOME/Elsewhere"\nXDG_PICTURES_DIR="$HOME/Custom Pictures"\r\n').directory, shots)
  assert.equal(run('XDG_DOWNLOAD_DIR="$HOME/Custom Pictures"\n').directory, path.join(root, "Pictures", "Screenshots"))
  assert.equal(run('XDG_PICTURES_DIR="Custom Pictures"\n').directory, path.join(root, "Pictures", "Screenshots"))
  assert.equal(run('XDG_PICTURES_DIR="$HOME"\n').directory, path.join(root, "Screenshots"))
  const absent = scan({ HOME: root, OMARCHY_SCREENSHOT_DIR: path.join(root, "missing") })
  assert.deepEqual(absent.captures, [])
  fs.rmSync(root, { recursive: true, force: true })
})

test("XDG_PICTURES_DIR in the environment is ignored, as Qt and Omasnap ignore it", () => {
  const root = temp(); const decoy = path.join(root, "Decoy"); fs.mkdirSync(decoy)
  write(decoy, "screenshot-decoy.png", 1700000000)
  const result = scan({ HOME: root, XDG_PICTURES_DIR: decoy })
  assert.equal(result.directory, path.join(root, "Pictures", "Screenshots"))
  assert.deepEqual(result.captures, [])
  fs.rmSync(root, { recursive: true, force: true })
})

test("a relative XDG_CONFIG_HOME is ignored and ~/.config is used, as Qt does", () => {
  const root = temp(); const custom = path.join(root, "Captures"); fs.mkdirSync(custom)
  const capture = write(custom, "screenshot-custom.png", 1700000000)
  const dir = path.join(root, ".config", "omasnap"); fs.mkdirSync(dir, { recursive: true })
  fs.writeFileSync(path.join(dir, "omasnap.conf"), `[output]\ndirectory = ${custom}\n`)
  assert.deepEqual(scan({ HOME: root, XDG_CONFIG_HOME: "relative/config" }).captures.map(x => x.path), [capture])
  fs.rmSync(root, { recursive: true, force: true })
})

test("scanner names the problem when the folder cannot be listed", () => {
  const root = temp()
  const missing = scan({ HOME: root })
  assert.equal(missing.reason, "missing")
  assert.equal(missing.directory, path.join(root, "Pictures", "Screenshots"))
  assert.deepEqual(missing.captures, [])

  fs.writeFileSync(path.join(root, "blocker"), "x")
  assert.equal(scan({ HOME: root, OMASNAP_SCREENSHOT_DIR: path.join(root, "blocker", "Screenshots") }).reason, "unreadable")

  assert.equal(scan({ HOME: root, OMASNAP_SCREENSHOT_DIR: "relative/shots" }).reason, "invalid")
  assert.equal(scan({ HOME: root, OMASNAP_SCREENSHOT_DIR: root + "/a/../b" }).reason, "invalid")

  const env = scanEnv({}); delete env.HOME
  const noHome = spawnSync(scanner, [], { encoding: "utf8", env })
  assert.equal(noHome.status, 0, noHome.stderr)
  assert.equal(JSON.parse(noHome.stdout).reason, "invalid")
  fs.rmSync(root, { recursive: true, force: true })
})

test("a symlinked Pictures or Screenshots folder is refused and reported, never followed", () => {
  const root = temp()
  const real = path.join(root, "real-pictures")
  screenshotsIn(real, "screenshot-behind-symlink.png")
  fs.symlinkSync(real, path.join(root, "Pictures"), "dir")
  const viaPictures = scan({ HOME: root })
  assert.equal(viaPictures.reason, "symlink")
  assert.equal(viaPictures.directory, path.join(root, "Pictures", "Screenshots"))
  assert.deepEqual(viaPictures.captures, [])

  const other = temp()
  const shots = path.join(other, "elsewhere"); fs.mkdirSync(shots)
  write(shots, "screenshot-behind-symlink.png", 1700000000)
  fs.mkdirSync(path.join(other, "Pictures"))
  fs.symlinkSync(shots, path.join(other, "Pictures", "Screenshots"), "dir")
  const viaScreenshots = scan({ HOME: other })
  assert.equal(viaScreenshots.reason, "symlink")
  assert.deepEqual(viaScreenshots.captures, [])

  // The real path works, which is what the panel tells the user to set.
  const direct = scan({ HOME: other, OMASNAP_SCREENSHOT_DIR: shots })
  assert.equal(direct.reason, "")
  assert.equal(direct.captures.length, 1)
  fs.rmSync(root, { recursive: true, force: true })
  fs.rmSync(other, { recursive: true, force: true })
})

// ---------------------------------------------------------------------------
// Encoding. The JSON must carry the real path, whatever the folder is called.
// ---------------------------------------------------------------------------

test("non-ASCII folder and file names reach the panel as the real path", () => {
  const root = temp()
  const shots = path.join(root, "Изображения", "Screenshots")
  fs.mkdirSync(shots, { recursive: true })
  const name = "screenshot-2026-11-15_09-41-12-café-🙂.png"
  const capture = write(shots, name, 1700000000)
  const result = scan({ HOME: root, OMASNAP_SCREENSHOT_DIR: shots })
  assert.equal(result.directory, shots)
  assert.deepEqual(result.captures.map(x => x.path), [capture])
  assert.ok(fs.existsSync(result.captures[0].path), "copy path and reveal need a path that exists")
  fs.rmSync(root, { recursive: true, force: true })
})

test("a file name that is not valid UTF-8 is left out and a folder path that is not valid UTF-8 is reported", () => {
  const root = temp(); const shots = path.join(root, "shots"); fs.mkdirSync(shots)
  const good = write(shots, "screenshot-good.png", 1700000000)
  const badName = Buffer.concat([Buffer.from(shots + "/screenshot-"), Buffer.from([0xff]), Buffer.from(".png")])
  fs.writeFileSync(badName, "x")
  assert.equal(fs.readdirSync(shots).length, 2)
  const result = scan({ HOME: root, OMASNAP_SCREENSHOT_DIR: shots })
  assert.deepEqual(result.captures.map(x => x.path), [good])

  // An environment variable cannot carry a byte that is not UTF-8 from node, so the shell sets it.
  const odd = spawnSync("bash", ["-c", 'dir="$1/odd-$(printf "\\377")"; mkdir "$dir" && OMASNAP_SCREENSHOT_DIR="$dir" exec "$2"', "bash", root, scanner],
    { encoding: "utf8", env: scanEnv({ HOME: root }) })
  assert.equal(odd.status, 0, odd.stderr)
  const parsed = JSON.parse(odd.stdout)
  assert.equal(parsed.reason, "encoding")
  assert.equal(parsed.directory, "")
  assert.deepEqual(parsed.captures, [])
  fs.rmSync(root, { recursive: true, force: true })
})

test("a file name with a control character is left out", () => {
  const root = temp(); const shots = path.join(root, "shots"); fs.mkdirSync(shots)
  const good = write(shots, "screenshot-good.png", 1700000000)
  write(shots, "screenshot-line\nbreak.png", 1700000100)
  write(shots, "screenshot-tab\there.png", 1700000200)
  assert.deepEqual(scan({ HOME: root, OMASNAP_SCREENSHOT_DIR: shots }).captures.map(x => x.path), [good])
  fs.rmSync(root, { recursive: true, force: true })
})

// ---------------------------------------------------------------------------
// Bounds. Every entry is counted before anything is sorted, and a partial scan
// says so, so the panel never calls a partial list the newest captures.
// ---------------------------------------------------------------------------

test("scanner bounds output and marks a partial inventory", () => {
  const root = temp(); const shots = path.join(root, "shots"); fs.mkdirSync(shots)
  for (let i = 0; i < 30; i++) write(shots, "screenshot-" + i + ".png", 1700000000 + i)
  const result = scan({ HOME: root, OMASNAP_SCREENSHOT_DIR: shots })
  assert.equal(result.captures.length, 24)
  assert.equal(result.truncated, true)
  assert.equal(result.budget_hit, false, "all 30 entries were read, so these really are the newest 24")
  assert.match(result.captures[0].path, /screenshot-29\.png$/)
  assert.match(result.captures[23].path, /screenshot-6\.png$/)
  fs.rmSync(root, { recursive: true, force: true })
})

test("scanner budgets every directory entry, including nonmatching files", () => {
  const root = temp(); const shots = path.join(root, "shots"); fs.mkdirSync(shots)
  fill(shots, SCAN_BUDGET + 100, i => `decoy-${String(i).padStart(5, "0")}.txt`)
  write(shots, "screenshot-after-decoys.png", 1700000000)
  const started = Date.now()
  const result = scan({ HOME: root, OMASNAP_SCREENSHOT_DIR: shots })
  assert.equal(result.truncated, true)
  assert.equal(result.budget_hit, true)
  assert.ok(result.captures.length <= 24)
  assert.ok(Date.now() - started < 1500, "full directory enumeration must stay bounded")
  fs.rmSync(root, { recursive: true, force: true })
})

test("the entry budget is exact: a full folder is complete and one more entry is not", () => {
  const root = temp(); const shots = path.join(root, "shots"); fs.mkdirSync(shots)
  fill(shots, SCAN_BUDGET, i => `screenshot-${String(i).padStart(5, "0")}.png`)
  const full = scan({ HOME: root, OMASNAP_SCREENSHOT_DIR: shots })
  assert.equal(full.budget_hit, false)
  assert.equal(full.truncated, true)
  assert.equal(full.captures.length, 24)
  fs.writeFileSync(path.join(shots, "screenshot-one-more.png"), "x")
  const over = scan({ HOME: root, OMASNAP_SCREENSHOT_DIR: shots })
  assert.equal(over.budget_hit, true)
  assert.equal(over.truncated, true)
  fs.rmSync(root, { recursive: true, force: true })
})

test("the name-byte budget stops a folder of very long names before the entry budget does", () => {
  const root = temp(); const shots = path.join(root, "shots"); fs.mkdirSync(shots)
  const stem = "screenshot-" + "a".repeat(230)
  const count = Math.ceil(NAME_BYTE_BUDGET / (stem.length + 10)) + 20
  assert.ok(count < SCAN_BUDGET)
  fill(shots, count, i => `${stem}${String(i).padStart(6, "0")}.png`)
  const result = scan({ HOME: root, OMASNAP_SCREENSHOT_DIR: shots })
  assert.equal(result.budget_hit, true)
  assert.equal(result.truncated, true)
  fs.rmSync(root, { recursive: true, force: true })
})

// ---------------------------------------------------------------------------
// Hostile input: configuration files and path replacement.
// ---------------------------------------------------------------------------

test("scanner rejects a final config symlink without reading its victim", () => {
  const root = temp(); const config = path.join(root, "config"); const victim = path.join(root, "victim")
  const pictures = path.join(root, "Victim Pictures")
  fs.mkdirSync(config); fs.mkdirSync(victim)
  screenshotsIn(pictures, "screenshot-secret.png")
  fs.writeFileSync(path.join(victim, "user-dirs.dirs"), 'XDG_PICTURES_DIR="$HOME/Victim Pictures"\n')
  fs.symlinkSync(path.join(victim, "user-dirs.dirs"), path.join(config, "user-dirs.dirs"))
  const result = scan({ HOME: root, XDG_CONFIG_HOME: config })
  assert.equal(result.directory, path.join(root, "Pictures", "Screenshots"))
  assert.deepEqual(result.captures, [])
  fs.rmSync(root, { recursive: true, force: true })
})

test("scanner pins the final config descriptor during a same-UID symlink swap race", async () => {
  const root = temp(); const config = path.join(root, "config"); const safePictures = path.join(root, "Safe Pictures")
  const victimPictures = path.join(root, "Victim Pictures"); const victim = path.join(root, "victim.dirs")
  const final = path.join(config, "user-dirs.dirs"); const safe = path.join(config, "safe.dirs")
  fs.mkdirSync(config)
  fs.writeFileSync(safe, 'XDG_PICTURES_DIR="$HOME/Safe Pictures"\n')
  fs.copyFileSync(safe, final)
  fs.writeFileSync(victim, 'XDG_PICTURES_DIR="$HOME/Victim Pictures"\n')
  screenshotsIn(safePictures, "screenshot-safe.png")
  const victimShots = screenshotsIn(victimPictures, "screenshot-secret.png", 1700000001).shots
  const marker = path.join(root, "config-final-ready")
  const racer = spawn(process.execPath, [path.join(__dirname, "fixtures", "config-final-racer.js"), final, safe, victim, marker], { stdio: "ignore" })
  try {
    await waitFor(marker)
    for (let i = 0; i < 40; i++) {
      const result = scan({ HOME: root, XDG_CONFIG_HOME: config })
      assert.notEqual(result.directory, victimShots)
      assert.equal(result.captures.some(x => x.path.includes("screenshot-secret.png")), false)
    }
    await waitFor(`${marker}.attacked`)
  } finally {
    await stopRacer(racer)
    fs.rmSync(root, { recursive: true, force: true })
  }
})

test("scanner pins the final omasnap.conf descriptor during a same-UID symlink swap race", async () => {
  const root = temp(); const config = path.join(root, "config"); const dir = path.join(config, "omasnap")
  const safeShots = path.join(root, "safe-shots"); const victimShots = path.join(root, "victim-shots")
  const final = path.join(dir, "omasnap.conf"); const safe = path.join(dir, "safe.conf"); const victim = path.join(root, "victim.conf")
  fs.mkdirSync(dir, { recursive: true }); fs.mkdirSync(safeShots); fs.mkdirSync(victimShots)
  fs.writeFileSync(safe, `[output]\ndirectory = ${safeShots}\n`)
  fs.copyFileSync(safe, final)
  fs.writeFileSync(victim, `[output]\ndirectory = ${victimShots}\n`)
  write(safeShots, "screenshot-safe.png", 1700000000)
  write(victimShots, "screenshot-secret.png", 1700000001)
  const marker = path.join(root, "conf-final-ready")
  const racer = spawn(process.execPath, [path.join(__dirname, "fixtures", "config-final-racer.js"), final, safe, victim, marker], { stdio: "ignore" })
  try {
    await waitFor(marker)
    for (let i = 0; i < 40; i++) {
      const result = scan({ HOME: root, XDG_CONFIG_HOME: config })
      assert.notEqual(result.directory, victimShots)
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
  fs.mkdirSync(victim)
  screenshotsIn(pictures, "screenshot-secret.png")
  fs.writeFileSync(path.join(victim, "user-dirs.dirs"), 'XDG_PICTURES_DIR="$HOME/Victim Pictures"\n')
  fs.symlinkSync(victim, path.join(root, "config-link"), "dir")
  const result = scan({ HOME: root, XDG_CONFIG_HOME: path.join(root, "config-link") })
  assert.equal(result.directory, path.join(root, "Pictures", "Screenshots"))
  assert.deepEqual(result.captures, [])
  fs.rmSync(root, { recursive: true, force: true })
})

test("scanner rejects a symlink in an intermediate config-path component", () => {
  const root = temp(); const real = path.join(root, "real"); const config = path.join(real, "config")
  const pictures = path.join(root, "Victim Pictures"); fs.mkdirSync(config, { recursive: true })
  screenshotsIn(pictures, "screenshot-secret.png")
  fs.writeFileSync(path.join(config, "user-dirs.dirs"), 'XDG_PICTURES_DIR="$HOME/Victim Pictures"\n')
  fs.symlinkSync(real, path.join(root, "linked"), "dir")
  const result = scan({ HOME: root, XDG_CONFIG_HOME: path.join(root, "linked", "config") })
  assert.equal(result.directory, path.join(root, "Pictures", "Screenshots")); assert.deepEqual(result.captures, [])
  fs.rmSync(root, { recursive: true, force: true })
})

test("scanner pins the config parent during a same-UID directory swap race", async () => {
  const root = temp(); const config = path.join(root, "config"); const parked = path.join(root, "config-parked")
  const safePictures = path.join(root, "Safe Pictures"); const victimDir = path.join(root, "victim-config")
  const victimPictures = path.join(root, "Victim Pictures")
  fs.mkdirSync(config); fs.mkdirSync(victimDir)
  fs.writeFileSync(path.join(config, "user-dirs.dirs"), 'XDG_PICTURES_DIR="$HOME/Safe Pictures"\n')
  fs.writeFileSync(path.join(victimDir, "user-dirs.dirs"), 'XDG_PICTURES_DIR="$HOME/Victim Pictures"\n')
  screenshotsIn(safePictures, "screenshot-safe.png")
  const victimShots = screenshotsIn(victimPictures, "screenshot-secret.png", 1700000001).shots
  const marker = path.join(root, "config-parent-ready")
  const racer = spawn(process.execPath, [path.join(__dirname, "fixtures", "directory-swap-racer.js"), config, parked, victimDir, marker], { stdio: "ignore" })
  try {
    await waitFor(marker)
    for (let i = 0; i < 40; i++) {
      const result = scan({ HOME: root, XDG_CONFIG_HOME: config })
      assert.notEqual(result.directory, victimShots)
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
      const result = scan({ HOME: root, OMASNAP_SCREENSHOT_DIR: shots })
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
  const result = scan({ HOME: root, XDG_CONFIG_HOME: config })
  assert.ok(Date.now() - started < 1500, "FIFO handling must fail closed without blocking")
  assert.equal(result.directory, path.join(root, "Pictures", "Screenshots"))
  fs.rmSync(root, { recursive: true, force: true })
})

test("scanner does not block on an omasnap.conf FIFO", () => {
  const root = temp(); const dir = path.join(root, "config", "omasnap"); fs.mkdirSync(dir, { recursive: true })
  assert.equal(spawnSync("mkfifo", [path.join(dir, "omasnap.conf")]).status, 0)
  const started = Date.now()
  const result = scan({ HOME: root, XDG_CONFIG_HOME: path.join(root, "config") })
  assert.ok(Date.now() - started < 1500, "FIFO handling must fail closed without blocking")
  assert.equal(result.directory, path.join(root, "Pictures", "Screenshots"))
  fs.rmSync(root, { recursive: true, force: true })
})

test("scanner rejects oversized config input", () => {
  const root = temp(); const config = path.join(root, "config"); fs.mkdirSync(config)
  const pictures = path.join(root, "Victim Pictures"); screenshotsIn(pictures, "screenshot-secret.png")
  fs.writeFileSync(path.join(config, "user-dirs.dirs"), 'XDG_PICTURES_DIR="$HOME/Victim Pictures"\n' + "x".repeat(9000))
  const result = scan({ HOME: root, XDG_CONFIG_HOME: config })
  assert.equal(result.directory, path.join(root, "Pictures", "Screenshots"))
  assert.deepEqual(result.captures, [])
  fs.rmSync(root, { recursive: true, force: true })
})

test("scanner rejects an oversized or symlinked omasnap.conf and a symlinked omasnap config directory", () => {
  const root = temp(); const custom = path.join(root, "Captures"); fs.mkdirSync(custom)
  write(custom, "screenshot-secret.png", 1700000000)
  const conf = `[output]\ndirectory = ${custom}\n`
  const expected = path.join(root, "Pictures", "Screenshots")

  const big = path.join(root, "big-config"); fs.mkdirSync(path.join(big, "omasnap"), { recursive: true })
  fs.writeFileSync(path.join(big, "omasnap", "omasnap.conf"), conf + "#".repeat(9000))
  assert.equal(scan({ HOME: root, XDG_CONFIG_HOME: big }).directory, expected)

  const linked = path.join(root, "linked-config"); fs.mkdirSync(path.join(linked, "omasnap"), { recursive: true })
  fs.writeFileSync(path.join(root, "target.conf"), conf)
  fs.symlinkSync(path.join(root, "target.conf"), path.join(linked, "omasnap", "omasnap.conf"))
  assert.equal(scan({ HOME: root, XDG_CONFIG_HOME: linked }).directory, expected)

  const dirLink = path.join(root, "dirlink-config"); fs.mkdirSync(dirLink)
  const realDir = path.join(root, "real-omasnap"); fs.mkdirSync(realDir)
  fs.writeFileSync(path.join(realDir, "omasnap.conf"), conf)
  fs.symlinkSync(realDir, path.join(dirLink, "omasnap"), "dir")
  assert.equal(scan({ HOME: root, XDG_CONFIG_HOME: dirLink }).directory, expected)

  // And the same file, left alone, is honoured: the three refusals above are the symlink and size rules, not a typo.
  const good = path.join(root, "good-config"); fs.mkdirSync(path.join(good, "omasnap"), { recursive: true })
  fs.writeFileSync(path.join(good, "omasnap", "omasnap.conf"), conf)
  assert.equal(scan({ HOME: root, XDG_CONFIG_HOME: good }).directory, custom)
  fs.rmSync(root, { recursive: true, force: true })
})

test("scanner keeps bounded records in memory and needs no replaceable temp file", () => {
  const root = temp(); const shots = path.join(root, "shots"); const scratch = path.join(root, "scratch")
  fs.mkdirSync(shots); fs.mkdirSync(scratch)
  const capture = write(shots, "screenshot-one.png", 1700000000)
  const before = fs.readdirSync(scratch)
  const result = scan({ HOME: root, TMPDIR: scratch, OMASNAP_SCREENSHOT_DIR: shots })
  assert.deepEqual(result.captures.map(x => x.path), [capture])
  assert.deepEqual(fs.readdirSync(scratch), before)
  fs.rmSync(root, { recursive: true, force: true })
})
