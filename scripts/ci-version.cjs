// CI helper: set app.version.name in app.json (tag for releases, commit sha for main builds).
// Usage: node scripts/ci-version.js <version>
const fs = require('fs')
const version = process.argv[2]
if (!version) {
  console.error('usage: ci-version.js <version>')
  process.exit(1)
}
const file = 'app.json'
const json = JSON.parse(fs.readFileSync(file, 'utf8'))
json.app.version.name = version
fs.writeFileSync(file, JSON.stringify(json, null, 2) + '\n')
console.log('app.json version.name ->', version)
