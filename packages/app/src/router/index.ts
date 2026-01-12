/**
 * 路由配置
 */

import { createRouter, createWebHashHistory } from 'vue-router';
import type { RouteRecordRaw } from 'vue-router';

const routes: RouteRecordRaw[] = [
  {
    path: '/home',
    name: 'Dashboard',
    component: () => import('@/views/DashboardView.vue'),
  },
  {
    path: '/components',
    name: 'ComponentShowcase',
    component: () => import('@/views/ComponentShowcase.vue'),
  },
  {
    path: '/',
    redirect: '/home',
  },
  {
    path: '/:pathMatch(.*)*',
    name: 'NotFound',
    component: () => import('@/views/NotFound.vue'),
  },
];

const router = createRouter({
  history: createWebHashHistory(),
  routes,
});

export default router;
