import { createRouter, createWebHistory } from 'vue-router'

const router = createRouter({
  history: createWebHistory(),
  routes: [
    {
      path: '/',
      name: 'dashboard',
      component: () => import('../views/DashboardView.vue')
    },
    {
      path: '/hook-example',
      name: 'hook-example',
      component: () => import('../views/HookExampleView.vue')
    }
  ]
})

export default router
