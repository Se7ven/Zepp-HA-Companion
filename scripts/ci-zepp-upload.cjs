// CI helper: upload the built .zab to the Zepp preview service (same flow as `zeus preview`)
// and print the cloud download URL that the Zepp App scans in developer mode.
// Env: ZEUS_APPTOKEN, ZEUS_USER_ID, ZEUS_CNAME (values from ~/.zepp/.zeus after `zeus login`).
// Usage: node scripts/ci-zepp-upload.js dist/xxx.zab
const fs = require('fs')
const path = require('path')

const pkgJson = require.resolve('@zeppos/zeus-cli/package.json')
const utilsDir = path.join(path.dirname(pkgJson), 'private-modules', 'zeppos-app-utils', 'dist')
const zeppApi = require(path.join(utilsDir, 'api'))
const FormData = require('form-data')

const token = process.env.ZEUS_APPTOKEN
const userId = process.env.ZEUS_USER_ID
const cname = process.env.ZEUS_CNAME
if (!token || !cname) {
  console.error('ZEUS_APPTOKEN / ZEUS_CNAME are required (see ~/.zepp/.zeus after `zeus login`)')
  process.exit(2)
}
const host = cname
  .split(',')
  .map((h) => h.trim())
  .filter((h) => h.indexOf('api-mifit') > -1)[0]
if (!host) {
  console.error('no api-mifit* host found in ZEUS_CNAME:', cname)
  process.exit(2)
}
process.env._loginAppToken = token
process.env._loginUserId = userId || ''
process.env._subRegionalHost = host

const pkg = process.argv[2]
if (!pkg || !fs.existsSync(pkg)) {
  console.error('package not found:', pkg)
  process.exit(1)
}

const form = new FormData()
form.append('file', fs.createReadStream(pkg))
form.append('app_type', '2') // 2 = app (1 = watchface)
form
  .getLength((err, length) => {
    if (err) {
      console.error('form length failed', err)
      process.exit(1)
    }
    return zeppApi
      .uploadPackage(form, length)
      .then((res) => {
        const url = `${res.protocol}://${host}/custom/tools/app-dial/download/${res.code}`
        console.log(url)
      })
      .catch((e) => {
        console.error('uploadPackage failed:', e && (e.message || e))
        process.exit(1)
      })
  })
