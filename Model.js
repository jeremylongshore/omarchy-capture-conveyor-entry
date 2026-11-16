// Pure, bounded data functions shared by Quickshell and node tests.
// Scanner output is local filesystem metadata, but it is still treated as
// untrusted: a filename can contain control characters or markup-like text.

var MAX_ITEMS = 24
// The scanner's own output is far smaller than this; the bound exists so a
// misbehaving or replaced scanner cannot make JSON.parse chew on megabytes.
var MAX_ENVELOPE_CHARS = 524288

// Strips angle brackets, ASCII controls, bidi overrides and isolates (U+202A to
// U+202E, U+2066 to U+2069, U+200E, U+200F, U+061C) and Unicode tag characters
// (U+E0000 to U+E007F, which are the surrogate pair DB40 DC00 to DB40 DC7F),
// then caps the length without leaving half a surrogate pair behind.
function clean(value, max) {
  var s = String(value === undefined || value === null ? "" : value)
  s = s.replace(/[<>]/g, "").replace(/[\x00-\x1f\x7f]/g, "")
  s = s.replace(/[\u061c\u200e\u200f\u202a-\u202e\u2066-\u2069]/g, "")
  s = s.replace(/\udb40[\udc00-\udc7f]/g, "")
  var cap = max || 64
  if (s.length > cap) {
    s = s.slice(0, cap)
    if (/[\ud800-\udbff]$/.test(s)) s = s.slice(0, -1)
  }
  return s
}

function isImagePath(path, directory) {
  if (typeof path !== "string" || typeof directory !== "string") return false
  if (!directory || path.indexOf(directory + "/") !== 0) return false
  if (/[\x00-\x1f\x7f]/.test(path)) return false
  var suffix = path.slice(directory.length + 1)
  return /^screenshot-[^/]+\.png$/i.test(suffix)
}

function basename(path) {
  var parts = String(path || "").split("/")
  return clean(parts[parts.length - 1], 56)
}

function timeLabel(epochSeconds, nowMs) {
  var value = Number(epochSeconds)
  if (!isFinite(value) || value <= 0) return "UNKNOWN"
  var delta = Math.max(0, Math.floor((Number(nowMs) - value * 1000) / 1000))
  if (delta < 60) return "NOW"
  if (delta < 3600) return Math.floor(delta / 60) + "M AGO"
  if (delta < 86400) return Math.floor(delta / 3600) + "H AGO"
  return Math.floor(delta / 86400) + "D AGO"
}

// Reasons the scanner gives for an empty list. "unreadable", and anything the
// scanner sends that is not listed here, becomes "unreadable", so the panel never
// prints text it did not choose.
function knownReason(value) {
  if (typeof value !== "string" || value === "") return ""
  switch (value) {
    case "missing":
    case "symlink":
    case "invalid":
    case "encoding":
    case "changed":
    case "malformed":
      return value
    default:
      return "unreadable"
  }
}

function failedScan() {
  return { directory: "", truncated: false, budgetHit: false, reason: "malformed", captures: [] }
}

// Scanner emits a bounded JSON envelope. Reject malformed records rather than
// guessing at a potentially unsafe action. truncated means the list is not the
// whole folder; budgetHit means the scanner stopped reading the folder early, so
// the list may be missing recent captures and must not be called the newest.
function parseCaptures(raw, nowMs) {
  var text = String(raw || "")
  if (text.length > MAX_ENVELOPE_CHARS) return failedScan()
  var envelope
  try { envelope = JSON.parse(text) } catch (e) { return failedScan() }
  if (!envelope || typeof envelope.directory !== "string" || !Array.isArray(envelope.captures)) {
    return failedScan()
  }
  var directory = envelope.directory
  var records = envelope.captures
  var out = []
  var seen = {}
  for (var i = 0; i < records.length && out.length < MAX_ITEMS; i++) {
    var stamp = Number(records[i] && records[i].modified)
    var path = records[i] && records[i].path
    if (!isFinite(stamp) || !isImagePath(path, directory) || seen[path]) continue
    seen[path] = true
    out.push({
      path: path,
      name: basename(path),
      age: timeLabel(stamp, nowMs)
    })
  }
  return {
    directory: directory,
    truncated: envelope.truncated === true,
    budgetHit: envelope.budget_hit === true,
    reason: knownReason(envelope.reason),
    captures: out
  }
}

// Long folder paths keep their tail, which is the part that tells folders apart.
function shortPath(directory) {
  var s = clean(directory, 400)
  return s.length > 72 ? "..." + s.slice(s.length - 69) : s
}

// One plain sentence for whatever the list does not show on its own: why the
// folder could not be listed, that the scan stopped early, or that only the
// newest captures are shown. Empty when the list needs no explanation.
function scanNotice(directory, reason, budgetHit, truncated, count) {
  var where = shortPath(directory)
  switch (reason) {
    case "missing":
      return "No screenshot folder yet. Omasnap creates " + where + " when it saves your first capture."
    case "symlink":
      return "A symlink sits in the screenshot path " + where + ". Capture Conveyor does not follow symlinks. Set OMASNAP_SCREENSHOT_DIR to the real folder."
    case "unreadable":
      return "Cannot read " + where + ". Check that it exists and that you can open it."
    case "invalid":
      return "The screenshot folder setting is not an absolute path. Set OMASNAP_SCREENSHOT_DIR to one."
    case "encoding":
      return "The screenshot folder path is not valid UTF-8, so it cannot be listed."
    case "changed":
      return "The folder changed while it was being read. The next refresh will list it."
    case "malformed":
      return "The scanner returned data this panel could not read."
  }
  if (budgetHit) {
    return "Scan limit reached. Only part of " + where + " was read, so recent captures may be missing. Move older screenshots out of it."
  }
  if (count === 0) {
    return "No screenshot-*.png files in " + where + " yet. Omasnap saves new captures there."
  }
  if (truncated) return "Showing the newest " + count + " saved Omarchy screenshots."
  return ""
}

// "Recent" is only claimed when the whole folder was read. After the scan limit
// the list is whatever the scanner reached first, so it is called what it is.
function heroTitle(loaded, count, reason, budgetHit) {
  if (!loaded) return "READING CAPTURES"
  if (count > 0) return count + (budgetHit ? " CAPTURES FOUND" : " RECENT CAPTURES")
  return reason !== "" && reason !== "missing" ? "CAPTURES UNAVAILABLE" : "NO SAVED CAPTURES"
}

function pillText(rows) {
  if (!rows || !rows.length) return "CAPTURE"
  return "CAPTURE " + rows.length
}

function tooltipText(rows) {
  return rows && rows.length ? rows.length + " recent captures" : "No saved captures"
}

function nextSelection(rows, current) {
  if (!rows || !rows.length) return ""
  for (var i = 0; i < rows.length; i++) {
    if (rows[i] && rows[i].path === current) return current
  }
  return rows[0] && typeof rows[0].path === "string" ? rows[0].path : ""
}

function captureHue(path) {
  var s = String(path || "")
  var hash = 0
  for (var i = 0; i < s.length; i++) hash = (hash + s.charCodeAt(i) * (i + 1)) % 360
  return (0.48 + (hash % 17) / 100) % 1
}

if (typeof module !== "undefined") {
  module.exports = {
    MAX_ITEMS: MAX_ITEMS,
    clean: clean,
    isImagePath: isImagePath,
    basename: basename,
    timeLabel: timeLabel,
    MAX_ENVELOPE_CHARS: MAX_ENVELOPE_CHARS,
    parseCaptures: parseCaptures,
    shortPath: shortPath,
    scanNotice: scanNotice,
    heroTitle: heroTitle,
    pillText: pillText,
    tooltipText: tooltipText,
    nextSelection: nextSelection,
    captureHue: captureHue
  }
}
