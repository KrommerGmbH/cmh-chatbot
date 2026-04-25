import ModuleFactory from '../../app/factory/module.factory'

ModuleFactory.register({
  name: 'cmh-provider',
  title: 'cmh-provider.module.title',
  color: '#4CAF50',
  icon: 'ph:hard-drives',

  navigation: [
    {
      id: 'cmh-provider-list',
      label: 'cmh-provider.navigation.label',
      icon: 'ph:hard-drives',
      path: 'cmh.provider.list',
      parent: 'cmh-ai',
      position: 10,
    },
  ],

  routes: [
    {
      name: 'cmh.provider.list',
      path: '/provider',
      component: () => import('./page/cmh-provider-list'),
      meta: { titleKey: 'cmh-provider.list.pageTitle' },
    },
    {
      name: 'cmh.provider.detail',
      path: '/provider/:id',
      component: () => import('./page/cmh-provider-detail'),
      meta: { titleKey: 'cmh-provider.detail.pageTitle' },
    },
  ],
})
