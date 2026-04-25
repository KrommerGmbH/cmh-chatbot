import ModuleFactory from '../../app/factory/module.factory'

ModuleFactory.register({
  name: 'cmh-chat',
  title: 'cmh-chat.module.title',
  color: '#189EFF',
  icon: 'ph:chats-thin',

  navigation: [
    {
      id: 'cmh-chat-list',
      label: 'cmh-chat.navigation.label',
      icon: 'ph:chats-thin',
      path: 'cmh.chat.list',
      parent: 'cmh-chat',
      position: 10,
    },
  ],

  routes: [
    {
      name: 'cmh.chat.list',
      path: '/chat',
      component: () => import('./page/cmh-chat-list'),
      meta: {
        title: 'cmh-chat.list.pageTitle',
        titleKey: 'cmh-chat.list.pageTitle',
      },
    },
    {
      name: 'cmh.chat.detail',
      path: '/chat/:id',
      component: () => import('./page/cmh-chat-detail'),
      meta: {
        title: 'cmh-chat.detail.pageTitle',
        titleKey: 'cmh-chat.detail.pageTitle',
      },
    },
  ],
})
