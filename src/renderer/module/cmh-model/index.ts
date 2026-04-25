import ModuleFactory from '../../app/factory/module.factory'

ModuleFactory.register({
  name: 'cmh-model',
  title: 'cmh-model.module.title',
  color: '#9C27B0',
  icon: 'ph:brain',

  navigation: [
    {
      id: 'cmh-model-list',
      label: 'cmh-model.navigation.label',
      icon: 'ph:brain',
      path: 'cmh.model.list',
      parent: 'cmh-ai',
      position: 20,
    },
  ],

  routes: [
    {
      name: 'cmh.model.list',
      path: '/model',
      component: () => import('./page/cmh-model-list'),
      meta: { titleKey: 'cmh-model.list.pageTitle' },
    },
    {
      name: 'cmh.model.detail',
      path: '/model/:id',
      component: () => import('./page/cmh-model-detail'),
      meta: { titleKey: 'cmh-model.detail.pageTitle' },
    },
  ],
})
