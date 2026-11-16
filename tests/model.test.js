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
  assert.equal(Model.clean(null), "")
  assert.equal(Model.basename(""), "")
  assert.equal(Model.basename("/one/two.png"), "two.png")
})

test("clean strips bidi overrides, isolates and Unicode tag characters", () => {
  // U+202A to U+202E, U+2066 to U+2069, U+200E, U+200F, U+061C.
  const bidi = ["\u202a", "\u202b", "\u202c", "\u202d", "\u202e", "\u2066", "\u2067", "\u2068", "\u2069", "\u200e", "\u200f", "\u061c"]
  for (const mark of bidi) assert.equal(Model.clean("a" + mark + "b"), "ab", "U+" + mark.charCodeAt(0).toString(16))
  // The characters next to each range stay: U+2029 and U+206A are not in it.
  assert.equal(Model.clean("a\u2029b\u206ac"), "a\u2029b\u206ac")
  // Tag characters U+E0000 to U+E007F are the surrogate pairs DB40 DC00 to DB40 DC7F.
  assert.equal(Model.clean("a\u{e0000}b\u{e0041}c\u{e007f}d"), "abcd")
  // U+E0080 is just outside the range, and an astral character elsewhere is untouched.
  assert.equal(Model.clean("a\u{e0080}b"), "a\u{e0080}b")
  assert.equal(Model.clean("a\u{1f642}b"), "a\u{1f642}b")
  assert.equal(Model.clean("screenshot-\u202etxt.png"), "screenshot-txt.png")
})

test("clean never leaves half a surrogate pair at the length cap", () => {
  // Only a pair cut in half by the cap is repaired: a string already within the cap, or a
  // high surrogate that is not the last unit left by the cut, is returned as it came.
  assert.equal(Model.clean("a\ud83d", 5), "a\ud83d")
  assert.equal(Model.clean("ab\ud83d", 3), "ab\ud83d")
  assert.equal(Model.clean("\ud83dabcd", 3), "\ud83dab")
  assert.equal(Model.clean("ab\u{1f642}", 3), "ab")
  assert.equal(Model.clean("ab\u{1f642}", 4), "ab\u{1f642}")
  assert.equal(Model.clean("abc\u{1f642}", 3), "abc")
})

test("image path validation rejects every non-actionable shape", () => {
  assert.equal(Model.isImagePath(null, dir), false)
  assert.equal(Model.isImagePath(dir + "/screenshot-a.png", null), false)
  assert.equal(Model.isImagePath("7/screenshot-a.png", 7), false)
  assert.equal(Model.isImagePath("7/screenshot-a.png", { length: 1, toString: () => "7" }), false)
  assert.equal(Model.isImagePath(dir + "/screenshot-a.png", ""), false)
  assert.equal(Model.isImagePath("/tmp/screenshot-a.png", dir), false)
  assert.equal(Model.isImagePath("X".repeat(dir.length + 1) + "screenshot-a.png", dir), false)
  assert.equal(Model.isImagePath("/screenshot-a.png", ""), false)
  assert.equal(Model.isImagePath(dir + "Xscreenshot-a.png", dir), false)
  assert.equal(Model.isImagePath(dir + "/screenshot-a\t.png", dir), false)
  assert.equal(Model.isImagePath(dir + "/photo.png", dir), false)
  assert.equal(Model.isImagePath(dir + "/nested/screenshot-a.png", dir), false)
  assert.equal(Model.isImagePath(dir + "/screenshot-a.png.extra", dir), false)
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
  assert.equal(parsed.truncated, false)
  assert.deepEqual(parsed.captures[0], { path: dir + "/screenshot-new.png", name: "screenshot-new.png", age: "1M AGO" })
})

test("parseCaptures fails closed on malformed envelopes", () => {
  const failed = { directory: "", truncated: false, budgetHit: false, reason: "malformed", captures: [] }
  assert.deepEqual(Model.parseCaptures("not json", now), failed)
  assert.deepEqual(Model.parseCaptures(JSON.stringify([]), now), failed)
  assert.deepEqual(Model.parseCaptures(null, now), failed)
  assert.deepEqual(Model.parseCaptures(JSON.stringify({ directory: 5, captures: [] }), now), failed)
  assert.deepEqual(Model.parseCaptures(JSON.stringify({ directory: dir, captures: "no" }), now), failed)
})

test("parseCaptures refuses an envelope over the length bound before it parses it", () => {
  const record = { path: dir + "/screenshot-a.png", modified: 1_699_999_940 }
  const within = body([record]) + " ".repeat(Model.MAX_ENVELOPE_CHARS - body([record]).length)
  assert.equal(within.length, Model.MAX_ENVELOPE_CHARS)
  assert.equal(Model.parseCaptures(within, now).captures.length, 1)
  const over = within + " "
  assert.equal(Model.parseCaptures(over, now).reason, "malformed")
  assert.equal(Model.parseCaptures(over, now).captures.length, 0)
})

test("parseCaptures carries the scan limit and the reason through, and only known reasons", () => {
  const record = { path: dir + "/screenshot-a.png", modified: 1_699_999_940 }
  const ok = Model.parseCaptures(body([record], { truncated: true, budget_hit: true }), now)
  assert.equal(ok.truncated, true)
  assert.equal(ok.budgetHit, true)
  assert.equal(ok.reason, "")
  const quiet = Model.parseCaptures(body([record]), now)
  assert.equal(quiet.budgetHit, false)
  assert.equal(Model.parseCaptures(body([record], { budget_hit: "yes" }), now).budgetHit, false)
  for (const reason of ["missing", "symlink", "unreadable", "invalid", "encoding", "changed", "malformed"]) {
    assert.equal(Model.parseCaptures(body([], { reason }), now).reason, reason)
  }
  assert.equal(Model.parseCaptures(body([], { reason: "<img src=x>" }), now).reason, "unreadable")
  assert.equal(Model.parseCaptures(body([], { reason: "constructor" }), now).reason, "unreadable")
  assert.equal(Model.parseCaptures(body([], { reason: 7 }), now).reason, "")
  assert.equal(Model.parseCaptures(body([], { reason: "" }), now).reason, "")
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
  assert.equal(Model.timeLabel(1_699_996_400, now), "1H AGO")
  assert.equal(Model.timeLabel(1_699_913_600, now), "1D AGO")
  assert.equal(Model.timeLabel(1_699_700_000, now), "3D AGO")
  assert.equal(Model.timeLabel("bad", now), "UNKNOWN")
  assert.equal(Model.timeLabel(-1, now), "UNKNOWN")
  assert.equal(Model.timeLabel(0, now), "UNKNOWN")
  assert.equal(Model.timeLabel(1_700_000_100, now), "NOW")
  assert.equal(Model.pillText([]), "CAPTURE")
  assert.equal(Model.pillText([{}]), "CAPTURE 1")
  assert.equal(Model.tooltipText([]), "No saved captures")
  assert.equal(Model.tooltipText(null), "No saved captures")
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

test("capture rows receive stable theme-derived hues", () => {
  assert.equal(Model.captureHue(""), 0.48)
  assert.equal(Model.captureHue("/a/screenshot-one.png"), 0.51)
  assert.equal(Model.captureHue("/a/screenshot-two.png"), 0.63)
})

test("folder paths in notices are cleaned and keep their tail when long", () => {
  assert.equal(Model.shortPath("/home/me/Pictures/Screenshots"), "/home/me/Pictures/Screenshots")
  assert.equal(Model.shortPath("<b>/x\u202e</b>"), "b/x/b")
  const exactly72 = "/" + "a".repeat(71)
  assert.equal(Model.shortPath(exactly72), exactly72)
  const long = "/" + "a".repeat(100) + "/Screenshots"
  const shorter = Model.shortPath(long)
  assert.equal(shorter.length, 72)
  assert.equal(shorter.slice(0, 3), "...")
  assert.equal(shorter.slice(-12), "/Screenshots")
  assert.equal(Model.shortPath(null), "")
})

test("scanNotice explains each way the list can be incomplete or empty, and stays quiet otherwise", () => {
  const d = "/home/me/Pictures/Screenshots"
  assert.equal(Model.scanNotice(d, "missing", false, false, 0),
    "No screenshot folder yet. Omasnap creates " + d + " when it saves your first capture.")
  assert.equal(Model.scanNotice(d, "symlink", false, false, 0),
    "A symlink sits in the screenshot path " + d + ". Capture Conveyor does not follow symlinks. Set OMASNAP_SCREENSHOT_DIR to the real folder.")
  assert.equal(Model.scanNotice(d, "unreadable", false, false, 0),
    "Cannot read " + d + ". Check that it exists and that you can open it.")
  assert.equal(Model.scanNotice("", "invalid", false, false, 0),
    "The screenshot folder setting is not an absolute path. Set OMASNAP_SCREENSHOT_DIR to one.")
  assert.equal(Model.scanNotice("", "encoding", false, false, 0),
    "The screenshot folder path is not valid UTF-8, so it cannot be listed.")
  assert.equal(Model.scanNotice(d, "changed", false, false, 0),
    "The folder changed while it was being read. The next refresh will list it.")
  assert.equal(Model.scanNotice("", "malformed", false, false, 0),
    "The scanner returned data this panel could not read.")
  assert.equal(Model.scanNotice(d, "", true, true, 24),
    "Scan limit reached. Only part of " + d + " was read, so recent captures may be missing. Move older screenshots out of it.")
  assert.equal(Model.scanNotice(d, "", false, false, 0),
    "No screenshot-*.png files in " + d + " yet. Omasnap saves new captures there.")
  assert.equal(Model.scanNotice(d, "", false, true, 24), "Showing the newest 24 saved Omarchy screenshots.")
  assert.equal(Model.scanNotice(d, "", false, false, 3), "")
  // The scan limit is reported even when the list is empty, and a reason wins over everything.
  assert.match(Model.scanNotice(d, "", true, true, 0), /^Scan limit reached/)
  assert.match(Model.scanNotice(d, "symlink", true, true, 24), /^A symlink sits/)
})

test("hero title only says recent when the whole folder was read", () => {
  assert.equal(Model.heroTitle(false, 0, "", false), "READING CAPTURES")
  assert.equal(Model.heroTitle(false, 5, "symlink", true), "READING CAPTURES")
  assert.equal(Model.heroTitle(true, 4, "", false), "4 RECENT CAPTURES")
  assert.equal(Model.heroTitle(true, 24, "", true), "24 CAPTURES FOUND")
  assert.equal(Model.heroTitle(true, 0, "", false), "NO SAVED CAPTURES")
  assert.equal(Model.heroTitle(true, 0, "missing", false), "NO SAVED CAPTURES")
  assert.equal(Model.heroTitle(true, 0, "symlink", false), "CAPTURES UNAVAILABLE")
  assert.equal(Model.heroTitle(true, 0, "malformed", false), "CAPTURES UNAVAILABLE")
})
