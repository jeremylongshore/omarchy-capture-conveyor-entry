const test = require("node:test")
const assert = require("node:assert/strict")
const Model = require("../Model.js")

const now = 1_700_000_000_000
const dir = "/home/test/Pictures"
const body = (captures, extra = {}) => JSON.stringify({ directory: dir, truncated: false, captures, ...extra })

test("clean strips markup triggers and control characters", () => {
  assert.equal(Model.clean('<img src="http://x">a\x00b'), 'img src="http://x"ab')
  assert.equal(Model.clean("x".repeat(100), 12).length, 12)
  assert.equal(Model.clean(42, 0), "42")
  assert.equal(Model.clean(undefined), "")
  assert.equal(Model.basename(""), "")
  assert.equal(Model.basename("/one/two.png"), "two.png")
})

test("image path validation rejects every non-actionable shape", () => {
  assert.equal(Model.isImagePath(null, dir), false)
  assert.equal(Model.isImagePath(dir + "/screenshot-a.png", null), false)
  assert.equal(Model.isImagePath(dir + "/screenshot-a.png", ""), false)
  assert.equal(Model.isImagePath("/tmp/screenshot-a.png", dir), false)
  assert.equal(Model.isImagePath(dir + "/screenshot-a\t.png", dir), false)
  assert.equal(Model.isImagePath(dir + "/photo.png", dir), false)
  assert.equal(Model.isImagePath(dir + "/screenshot-a.PNG", dir), true)
})

test("parseCaptures preserves only validated in-directory screenshot records", () => {
  const parsed = Model.parseCaptures(body([
    { path: dir + "/screenshot-new.png", modified: 1_699_999_940, bytes: 3 },
    { path: "/tmp/screenshot-escape.png", modified: 1_699_999_900 },
    { path: dir + "/photo.jpg", modified: 1_699_999_800 },
    { path: dir + "/screenshot-new.png", modified: 1_699_999_700 },
    { path: dir + "/screenshot-bad\nname.png", modified: 1_699_999_600 }
  ]), now)
  assert.equal(parsed.captures.length, 1)
  assert.deepEqual(parsed.captures[0], { path: dir + "/screenshot-new.png", name: "screenshot-new.png", age: "1M AGO" })
})

test("parseCaptures fails closed on malformed envelopes", () => {
  assert.deepEqual(Model.parseCaptures("not json", now), { directory: "", truncated: false, captures: [] })
  assert.deepEqual(Model.parseCaptures(JSON.stringify([]), now), { directory: "", truncated: false, captures: [] })
  assert.deepEqual(Model.parseCaptures(null, now), { directory: "", truncated: false, captures: [] })
  assert.deepEqual(Model.parseCaptures(JSON.stringify({ directory: 5, captures: [] }), now), { directory: "", truncated: false, captures: [] })
  assert.deepEqual(Model.parseCaptures(JSON.stringify({ directory: dir, captures: "no" }), now), { directory: "", truncated: false, captures: [] })
})

test("parseCaptures caps even a hostile over-cap scanner response", () => {
  const captures = Array.from({ length: 200 }, (_, i) => ({
    path: dir + "/screenshot-" + i + ".png", modified: 1_699_999_000 - i
  }))
  const parsed = Model.parseCaptures(body(captures, { truncated: true }), now)
  assert.equal(parsed.captures.length, Model.MAX_ITEMS)
  assert.equal(parsed.truncated, true)
})

test("time and pill labels remain bounded and truthful", () => {
  assert.equal(Model.timeLabel(1_699_999_990, now), "NOW")
  assert.equal(Model.timeLabel(1_699_992_800, now), "2H AGO")
  assert.equal(Model.timeLabel(1_699_700_000, now), "3D AGO")
  assert.equal(Model.timeLabel("bad", now), "UNKNOWN")
  assert.equal(Model.timeLabel(-1, now), "UNKNOWN")
  assert.equal(Model.timeLabel(1_700_000_100, now), "NOW")
  assert.equal(Model.pillText([]), "CAPTURE")
  assert.equal(Model.pillText([{}]), "CAPTURE 1")
  assert.equal(Model.tooltipText([]), "No captures in Screenshots")
  assert.equal(Model.tooltipText(null), "No captures in Screenshots")
  assert.equal(Model.tooltipText([{}]), "1 recent captures")
})

test("selection follows only paths still present after a refresh", () => {
  const first = { path: dir + "/screenshot-first.png" }
  const second = { path: dir + "/screenshot-second.png" }
  assert.equal(Model.nextSelection([first, second], second.path), second.path)
  assert.equal(Model.nextSelection([first], second.path), first.path)
  assert.equal(Model.nextSelection([], second.path), "")
  assert.equal(Model.nextSelection(null, second.path), "")
  assert.equal(Model.nextSelection([{}], second.path), "")
})
