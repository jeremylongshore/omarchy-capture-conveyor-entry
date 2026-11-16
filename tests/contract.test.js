const test = require("node:test")
const assert = require("node:assert/strict")
const fs = require("node:fs")
const path = require("node:path")

const root = path.join(__dirname, "..")
const read = name => fs.readFileSync(path.join(root, name), "utf8")

test("marketplace copy uses the full contract and tells one truthful story", () => {
  const manifest = JSON.parse(read("manifest.json"))
  assert.equal(manifest.description.length, 500)
  assert.equal(manifest.barWidget.description.length, 500)
  assert.equal(manifest.barWidget.description, manifest.description)
  assert.match(manifest.description, /The bar counts captures/)
  assert.match(manifest.description, /open the panel for the newest 24/)
  assert.match(manifest.description, /refreshes every 20 seconds/)
  assert.match(manifest.description, /never reads image pixels/)
  assert.match(manifest.description, /uses the network/)
})

test("banner names and visually explains Capture Conveyor without invented actions", () => {
  const banner = read("assets/banner.svg")
  assert.match(banner, /<title id="title">Capture Conveyor<\/title>/)
  assert.match(banner, /4 RECENT CAPTURES/)
  assert.match(banner, /NEW CAPTURE/)
  assert.match(banner, /OCR SELECT/)
  assert.match(banner, /COPY PATH/)
  assert.match(banner, /REVEAL/)
  assert.doesNotMatch(banner, /ANNOTATE/)
})

test("real-shell preview is deterministic, full-frame, and seeded before startup", () => {
  const panel = read("Panel.qml")
  const render = read("scripts/rig-render.sh")
  const hook = read("e2e/rig-before-shell.sh")
  assert.match(panel, /contentWidth:\s*panel\.fittedContentWidth\(Style\.space\(560\)\)/)
  assert.match(panel, /Saved by Omarchy\. Select one to copy its path or reveal its folder\./)
  assert.match(render, /OMARCHY_RIG_RESOLUTION:-1280x720/)
  assert.match(render, /-path '\.\/e2e\/\*'/)
  assert.match(render, /--exclude=preview\.png/)
  assert.doesNotMatch(render, /manifest\.json bin preview\.png README/)
  assert.match(render, /PRE_HOOK=.*rig-before-shell\.sh/)
  assert.match(render, /grim "\\\$SHOT"/)
  assert.doesNotMatch(render, /grim -g/)
  assert.match(hook, /seed '2 minutes ago' firefox/)
  assert.match(hook, /seed '8 minutes ago' ghostty/)
  assert.match(hook, /screenshot-\$\(date -d "\$ago" \+%Y-%m-%d_%H-%M-%S\)/)
  assert.match(hook, /\.captures \| length == 6/)
  assert.match(hook, /fixtures, not captures from a live Omasnap/)
  assert.doesNotMatch(hook, /curl|wget|Authorization|Bearer/)
  assert.equal(fs.statSync(path.join(root, "e2e/rig-before-shell.sh")).mode & 0o111, 0o111)
})

test("the rig fixture seeds the folder Omasnap saves to and scans it with no override", () => {
  const hook = read("e2e/rig-before-shell.sh")
  assert.match(hook, /SHOT_DIR="\$HOME\/Pictures\/Screenshots"/)
  assert.match(hook, /endswith\("\/Pictures\/Screenshots"\)/)
  // The scan in the hook, like the one in the shell, must resolve the folder itself.
  assert.match(hook, /env -u OMASNAP_SCREENSHOT_DIR -u OMARCHY_SCREENSHOT_DIR -u XDG_CONFIG_HOME/)
  assert.doesNotMatch(hook, /export (OMASNAP|OMARCHY)_SCREENSHOT_DIR/)
})

test("README states the folder precedence the scanner implements, in order", () => {
  const readme = read("README.md")
  assert.match(readme, /OMASNAP_SCREENSHOT_DIR[\s\S]*OMARCHY_SCREENSHOT_DIR[\s\S]*omasnap\.conf[\s\S]*user-dirs\.dirs[\s\S]*~\/Pictures\/Screenshots/)
  const scanner = read("bin/capture-conveyor-scan")
  assert.match(scanner, /1\. OMASNAP_SCREENSHOT_DIR\n#\s+2\. OMARCHY_SCREENSHOT_DIR[^\n]*\n#\s+3\. \[output\] directory[^\n]*\n#\s+4\. XDG_PICTURES_DIR[^\n]*\n#\s+5\. \$HOME\/Pictures\/Screenshots/)
  assert.doesNotMatch(readme, /then `XDG_PICTURES_DIR`/)
})

test("self-assessment docs make no claim the repository does not meet", () => {
  const testing = read("tests/TESTING.md")
  // crap-score scores zero functions for root-level Model.js (intent-audit-harness#248), so CRAP is not enforced here.
  const l3 = testing.match(/^L3:.*$/m)[0]
  if (/CRAP/.test(l3)) assert.match(l3, /CRAP is not enforced/)
  assert.match(testing, /intent-audit-harness#248/)
  const security = read("SECURITY.md")
  assert.doesNotMatch(security, /descriptor-bound lifecycle/)
})

test("QML qualifies Omarchy's palette as Commons.Color, never bare Color", () => {
  // Qt 6.12 introduces its own Color type; omarchy docs/omarchy-shell.md
  // (Theme tokens) requires plugins to import qs.Commons with an alias.
  const files = fs.readdirSync(root).filter(name => name.endsWith(".qml"))
  assert.ok(files.length > 0)
  for (const file of files) {
    const source = fs.readFileSync(path.join(root, file), "utf8")
    assert.doesNotMatch(source, /(^|[^\w.])Color\./m, file + " uses bare Color")
    if (/Commons\.Color\./.test(source)) assert.match(source, /^import qs\.Commons as Commons$/m, file)
  }
})
