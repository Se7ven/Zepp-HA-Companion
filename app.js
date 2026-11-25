import { log } from '@zos/utils'
import { BaseApp } from '@zeppos/zml/base-app'

// BaseApp is REQUIRED: zml's BasePage plugins read state that BaseApp bootstraps
// (`_$mgr$_` scoped globals + globalData.messaging). Without it every page module
// crashes at load with "Mini Program Error / TypeError" -> black screen.
App(
  BaseApp({
    globalData: {},
    onCreate() {
      log.log('app on create invoke')
    },
    onDestroy() {
      log.log('app on destroy invoke')
    },
  })
)
