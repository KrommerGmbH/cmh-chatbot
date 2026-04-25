import ModuleFactory from '../../app/factory/module.factory'

ModuleFactory.register({
  name: 'cmh-log',
  title: 'cmh-log.module.title',
  color: '#546E7A',
  icon: 'ph:list-bullets',
  navigation: [
    {
      id: 'cmh-log-list',
      label: 'cmh-log.navigation.label',
      icon: 'ph:list-bullets',
      path: 'cmh.log.list',
      parent: 'cmh-settings',
      position: 50,
    },
  ],
  routes: [
    {
      name: 'cmh.log.list',
      path: '/log',
      component: () => import('./page/cmh-log-list'),
      meta: { titleKey: 'cmh-log.list.pageTitle' },
    },
    {
      name: 'cmh.log.detail',
      path: '/log/:id',
      component: () => import('./page/cmh-log-detail'),
      meta: { titleKey: 'cmh-log.detail.pageTitle' },
    },
  ],
})
