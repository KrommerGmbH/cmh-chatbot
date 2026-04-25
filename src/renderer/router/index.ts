/**
 * CMH Chatbot Router
 *
 * ModuleFactory에 등록된 라우트를 수집하여 Vue Router를 생성.
 * AideWorks 라우터 패턴 포팅 — 모듈 등록 완료 후 동적 생성.
 */
import { createRouter, createWebHashHistory, type RouteRecordRaw } from 'vue-router'
import ModuleFactory from '../app/factory/module.factory'

function buildRoutes(): RouteRecordRaw[] {
  const moduleRoutes = ModuleFactory.getAllRoutes()

  const routes: RouteRecordRaw[] = moduleRoutes.map((route) => {
    const record: RouteRecordRaw = {
      name: route.name,
      path: route.path,
      component: route.component as never,
      meta: route.meta,
    }
    if (route.children) {
      ;(record as unknown as { children: RouteRecordRaw[] }).children = route.children.map((child) => ({
        name: child.name,
        path: child.path,
        component: child.component as never,
        meta: child.meta,
      }))
    }
    if (route.redirect) {
      ;(record as unknown as { redirect: { name: string } }).redirect = { name: route.redirect.name }
    }
    return record
  })

  // Fallback: 404 → chat list
  routes.push({
    path: '/:pathMatch(.*)*',
    redirect: { name: 'cmh.chat.list' },
  })

  return routes
}

export const router = createRouter({
  history: createWebHashHistory(),
  routes: buildRoutes(),
})

export default router
