/**
 * cmh-media 모듈 등록
 *
 * aideworks aw-media에서 마이그레이션 — 챗봇 전용 로컬 미디어 라이브러리.
 * Shopware alphabet subfolder sharding 제거.
 * RAG 문서 파이프라인과 연동.
 */
import ModuleFactory from '../../app/factory/module.factory'
import './content'

ModuleFactory.register({
  name: 'cmh-media',
  title: 'cmh-media.general.pageTitle',
  color: '#ff68b4',
  icon: 'ph:folder-open',

  navigation: [
    {
      id: 'cmh-media-list',
      label: 'cmh-media.navigation.label',
      icon: 'ph:folder-open',
      path: 'cmh.media.index',
      position: 30,
    },
  ],

  routes: [
    {
      name: 'cmh.media.index',
      path: '/media/:folderId?',
      component: () => import('./page/cmh-media-index'),
      meta: { title: 'cmh-media.general.pageTitle', titleKey: 'cmh-media.general.pageTitle' },
    },
  ],
})
