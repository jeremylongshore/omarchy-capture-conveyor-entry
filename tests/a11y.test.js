const test = require("node:test")
// RTM: REQ-CC-006
const assert = require("node:assert/strict")
const fs = require("node:fs")
const path = require("node:path")

const panel = fs.readFileSync(path.join(__dirname, "..", "Panel.qml"), "utf8")
// The panel without its comment lines, for tests about what the code does.
const code = panel.split("\n").filter(line => !/^\s*\/\//.test(line)).join("\n")

// The body of every `Text { ... }` element, by brace matching.
function textBlocks(source) {
  const blocks = []
  const open = /\bText\s*\{/g
  let match
  while ((match = open.exec(source))) {
    let depth = 1; let i = open.lastIndex
    while (i < source.length && depth > 0) { if (source[i] === "{") depth++; else if (source[i] === "}") depth--; i++ }
    blocks.push(source.slice(open.lastIndex, i - 1))
  }
  return blocks
}

test("capture rows and every action expose button semantics and names", () => {
  assert.match(panel, /Accessible\.name:\s*"Select capture " \+ modelData\.name/)
  for (const name of [
    "Start a new Omarchy screenshot",
    "Extract text from a new screen selection",
    "Copy selected screenshot path",
    "Reveal screenshot folder"
  ]) assert.match(panel, new RegExp(`name: "${name}"`))
  assert.ok((panel.match(/Accessible\.role:\s*Accessible\.Button/g) || []).length >= 3)
})

test("keyboard users can select rows and activate all four actions through the key catcher's signals", () => {
  assert.match(panel, /onMoveRequested:\s*function\(dx, dy\)\s*\{\s*if \(dy !== 0\) root\.moveSelection\(dy\)/)
  assert.match(panel, /onActivateRequested:\s*function\(modifiers\)\s*\{\s*root\.copyPath\(\)/)
  assert.match(panel, /onTextKey:\s*function\(typed, modifiers\)/)
  for (const [key, action] of [["n", "capture"], ["o", "selectText"], ["c", "copyPath"], ["r", "reveal"]]) {
    assert.match(panel, new RegExp(`key === "${key}"\\) root\\.${action}\\(\\)`))
  }
  assert.match(panel, /ENTER or C copy path/)
})

test("the panel wires the key catcher's signals and does not override its own key handler", () => {
  // PanelKeyCatcher owns Keys.onPressed (Esc, Tab, arrows, j/k, Return, Space). Replacing it on the
  // instance could drop Esc and Tab, so the panel listens to the signals the first-party panels use.
  assert.doesNotMatch(code, /Keys\.onPressed/)
  assert.match(panel, /onCloseRequested:\s*root\.close\(\)/)
  assert.match(panel, /onTabRequested:\s*function\(direction\)/)
  // Enter fires returnRequested and then activateRequested; wiring both would copy twice.
  assert.doesNotMatch(code, /onReturnRequested/)
  // Ctrl, Alt and Meta chords are not letter shortcuts.
  assert.match(panel, /modifiers & \(Qt\.ControlModifier \| Qt\.AltModifier \| Qt\.MetaModifier\)\) return/)
  // The catcher consumes x for delete before textKey, so the panel must not rely on it.
  assert.doesNotMatch(code, /key === "x"/)
})

test("the scan notice is bounded, wrapped plain text in a theme colour", () => {
  assert.match(panel, /text: root\.scanNotice; textFormat: Text\.PlainText/)
  assert.match(panel, /wrapMode: Text\.WordWrap; maximumLineCount: 3; elide: Text\.ElideRight/)
  assert.match(panel, /Commons\.Color\.urgent/)
})

test("no text colour is a fixed-lightness hsla that fails on a light theme", () => {
  // The row and button fills are translucent tints; every Text colour comes from the theme palette.
  const blocks = textBlocks(code)
  assert.ok(blocks.length >= 7, "found " + blocks.length + " Text elements")
  for (const block of blocks) {
    assert.match(block, /textFormat: Text\.PlainText/)
    assert.doesNotMatch(block, /color:[^;\n]*hsla\(/)
    assert.doesNotMatch(block, /color:\s*"#/)
  }
})

test("dynamic capture fields are bounded plain text", () => {
  assert.match(panel, /text: modelData\.name; textFormat: Text\.PlainText; width:[^;]+; elide: Text\.ElideRight/)
  assert.match(panel, /text: modelData\.age; textFormat: Text\.PlainText; width:[^;]+;[^}]+elide: Text\.ElideRight/)
})
