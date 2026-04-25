import ModuleFactory from '../../app/factory/module.factory'

ModuleFactory.register({
  name: 'cmh-settings',
  title: 'cmh-settings.module.title',
  color: '#607D8B',
  icon: 'ph:gear',

  navigation: [
    {
      id: 'cmh-settings-general',
      label: 'cmh-settings.navigation.general',
      icon: 'ph:gear',
      path: 'cmh.settings.list',
      parent: 'cmh-settings',
      position: 10,
    },
  ],

  routes: [
    {
      name: 'cmh.settings.list',
      path: '/settings',
      component: () => import('./page/cmh-settings-list'),
      meta: { titleKey: 'cmh-settings.list.pageTitle' },
    },
    {
      name: 'cmh.settings.detail',
      path: '/settings/:section',
      component: () => import('./page/cmh-settings-detail'),
      meta: { titleKey: 'cmh-settings.detail.pageTitle' },
    },
  ],
})
