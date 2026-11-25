// CI helper: build a PREVIEW package (no .ip-package, installable via developer-mode QR)
// and upload it to the Zepp preview service, then print the zpkd1:// install URL.
// This is exactly what `zeus preview` does in cloud mode, done non-interactively.
// Env: ZEUS_APPTOKEN, ZEUS_USER_ID, ZEUS_CNAME (values from ~/.zepp/.zeus after `zeus login`).
const fs = require('fs')
const path = require('path')

const token = process.env.ZEUS_APPTOKEN
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
// what zeus-cli expects at runtime (see utils/pre-check.js initVariable)
process.env._loginAppToken = token
process.env._loginUserId = process.env.ZEUS_USER_ID || ''
process.env._loginCname = cname
process.env._subRegionalHost = host

const pkgJson = require.resolve('@zeppos/zeus-cli/package.json')
const utils = require(path.join(
  path.dirname(pkgJson),
  'private-modules',
  'zeppos-app-utils',
  'dist'
))
const modules = utils.modules

const root = process.cwd()
const appJson = JSON.parse(fs.readFileSync('app.json', 'utf8'))
const appId = appJson.app.appId
// '2' = app, '1' = watch-face (see zeus-cli modules/build.js)
const appType = String(appJson.app.appType).toUpperCase() === 'WATCH-FACE' ? '1' : '2'

;(async () => {
  // package with BuildMode.PREVIEW: same pipeline as `zeus build`, but ip=false
  const buildInfo = await modules.buildSupportV3Config(root, modules.BuildMode.PREVIEW, {
    _: ['preview'],
    renameWithAppId: appId,
  })
  if (!buildInfo) {
    console.error('preview packaging produced no result')
    process.exit(1)
  }
  console.log('preview package: ./dist/' + buildInfo)
  const res = await modules.previewBuild(root, { _: ['preview'] }, './dist/' + buildInfo, appType, 'preview')
  if (!res || !res.url) {
    console.error('previewBuild returned no url:', JSON.stringify(res))
    process.exit(1)
  }
  console.log(res.url)
})().catch((e) => {
  console.error('preview build/upload failed:', (e && (e.stack || e.message)) || e)
  process.exit(1)
})
