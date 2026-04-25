/**
 * meteor-component-library의 CSS 파일이 존재하지 않는 main.css.map을 참조하는 버그 수정.
 * pnpm install 후 자동 실행되어 빈 sourcemap 파일을 생성한다.
 *
 * @see https://github.com/shopware/meteor/issues/XXX
 */
const fs = require('node:fs')
const path = require('node:path')
const { execSync } = require('node:child_process')

const DUMMY_MAP = '{"version":3,"sources":[],"mappings":""}'

try {
  // pnpm의 실제 패키지 위치를 찾는다
  const meteorDir = path.dirname(
    require.resolve('@shopware-ag/meteor-component-library/package.json'),
  )
  const mapPath = path.join(meteorDir, 'dist', 'main.css.map')

  if (!fs.existsSync(mapPath)) {
    fs.writeFileSync(mapPath, DUMMY_MAP, 'utf-8')
    console.log('[fix-meteor-sourcemaps] Created dummy main.css.map')
  }
} catch {
  // meteor-component-library가 설치되지 않은 경우 무시
}
