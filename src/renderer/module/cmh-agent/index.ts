/**
 * cmh-agent 모듈 등록
 *
 * 멀티에이전트 관리 — 오케스트레이터/매니저/워커 계층 구조.
 * Agent Core Component로 레고블록 방식 LangChain 기능 조합.
 */
import ModuleFactory from '../../app/factory/module.factory'

ModuleFactory.register({
  name: 'cmh-agent',
  title: 'cmh-agent.general.pageTitle',
  color: '#6C5CE7',
  icon: 'ph:robot',

  navigation: [
    {
      id: 'cmh-agent-list',
      label: 'cmh-agent.navigation.label',
      icon: 'ph:robot',
      path: 'cmh.agent.list',
      parent: 'cmh-ai',
      position: 40,
    },
  ],

  routes: [
    {
      name: 'cmh.agent.list',
      path: '/agents',
      component: () => import('./page/cmh-agent-list'),
      meta: {
        title: 'cmh-agent.list.pageTitle',
        titleKey: 'cmh-agent.list.pageTitle',
      },
    },
    {
      name: 'cmh.agent.detail',
      path: '/agents/:id',
      component: () => import('./page/cmh-agent-detail'),
      meta: {
        title: 'cmh-agent.detail.pageTitle',
        titleKey: 'cmh-agent.detail.pageTitle',
      },
    },
  ],
})
