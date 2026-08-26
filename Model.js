// Pure, bounded data functions shared by Quickshell and node tests.
// Scanner output is local filesystem metadata, but it is still treated as
// untrusted: a filename can contain control characters or markup-like text.

var MAX_ITEMS = 24

function clean(value, max) {
  var s = String(value === undefined || value === null ? "" : value)
  s = s.replace(/[<>]/g, "").replace(/[\x00-\x1f\x7f]/g, "")
  var cap = max || 64
  return s.length > cap ? s.slice(0, cap) : s
}

function isImagePath(path, directory) {
  if (typeof path !== "string" || typeof directory !== "string") return false
  if (!directory || path.indexOf(directory + "/") !== 0) return false
  if (/[\x00-\x1f\x7f]/.test(path)) return false
  return /\/screenshot-[^/]+\.png$/i.test(path)
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

// Scanner emits a bounded JSON envelope. Reject malformed records rather than
// guessing at a potentially unsafe action.
function parseCaptures(raw, nowMs) {
  var envelope
  try { envelope = JSON.parse(String(raw || "")) } catch (e) { return { directory: "", truncated: false, captures: [] } }
  if (!envelope || typeof envelope.directory !== "string" || !Array.isArray(envelope.captures)) {
    return { directory: "", truncated: false, captures: [] }
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
  return { directory: directory, truncated: envelope.truncated === true, captures: out }
}

function pillText(rows) {
  if (!rows || !rows.length) return "CAPTURE"
  return "CAPTURE " + rows.length
}

function tooltipText(rows) {
  return rows && rows.length ? rows.length + " recent captures" : "No captures in Screenshots"
}

if (typeof module !== "undefined") {
  module.exports = {
    MAX_ITEMS: MAX_ITEMS,
    clean: clean,
    isImagePath: isImagePath,
    basename: basename,
    timeLabel: timeLabel,
    parseCaptures: parseCaptures,
    pillText: pillText,
    tooltipText: tooltipText
  }
}
