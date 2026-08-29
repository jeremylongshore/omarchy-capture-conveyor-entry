const test = require("node:test")
// RTM: REQ-CC-006
const assert = require("node:assert/strict")
const fs = require("node:fs")
const path = require("node:path")

const panel = fs.readFileSync(path.join(__dirname, "..", "Panel.qml"), "utf8")

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

test("keyboard users can select rows and activate all four actions", () => {
  for (const key of ["Qt.Key_Up", "Qt.Key_Down", "Qt.Key_N", "Qt.Key_O", "Qt.Key_C", "Qt.Key_R"]) {
    assert.match(panel, new RegExp(key.replace(".", "\\.")))
  }
})

test("dynamic capture fields are bounded plain text", () => {
  assert.match(panel, /text: modelData\.name; textFormat: Text\.PlainText; width:[^;]+; elide: Text\.ElideRight/)
  assert.match(panel, /text: modelData\.age; textFormat: Text\.PlainText; width:[^;]+;[^}]+elide: Text\.ElideRight/)
})
