import ModuleFactory from '../../app/factory/module.factory'

ModuleFactory.register({
  name: 'cmh-workflow',
  title: 'cmh-workflow.module.title',
  color: '#FF9800',
  icon: 'ph:flow-arrow',

  navigation: [
    {
      id: 'cmh-workflow-list',
      label: 'cmh-workflow.navigation.label',
      icon: 'ph:flow-arrow',
      path: 'cmh.workflow.list',
      parent: 'cmh-ai',
      position: 30,
    },
  ],

  routes: [
    {
      name: 'cmh.workflow.list',
      path: '/workflow',
      component: () => import('./page/cmh-workflow-list'),
      meta: { titleKey: 'cmh-workflow.list.pageTitle' },
    },
    {
      name: 'cmh.workflow.detail',
      path: '/workflow/:id',
      component: () => import('./page/cmh-workflow-detail'),
      meta: { titleKey: 'cmh-workflow.detail.pageTitle' },
    },
  ],
})
