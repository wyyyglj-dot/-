import { createRouter, createWebHistory } from 'vue-router'

const isMobile = () => window.innerWidth < 768

const router = createRouter({
  history: createWebHistory(),
  routes: [
    {
      path: '/login',
      component: () => import('../views/Login.vue'),
      meta: { title: '登录', public: true },
    },
    // PC routes
    {
      path: '/',
      component: () => import('../views/TableMap.vue'),
      meta: { title: '桌位总览' },
    },
    {
      path: '/order/:tableId',
      component: () => import('../views/Ordering.vue'),
      meta: { title: '点餐' },
    },
    {
      path: '/serving',
      component: () => import('../views/Serving.vue'),
      meta: { title: '上菜队列' },
    },
    {
      path: '/checkout/:sessionId',
      component: () => import('../views/Checkout.vue'),
      meta: { title: '结账' },
    },
    {
      path: '/stats',
      component: () => import('../views/Stats.vue'),
      meta: { title: '营业统计' },
    },
    {
      path: '/menu-config',
      component: () => import('../views/MenuConfig.vue'),
      meta: { title: '菜品管理' },
    },
    {
      path: '/history',
      component: () => import('../views/History.vue'),
      meta: { title: '历史记录' },
    },
    {
      path: '/settings',
      component: () => import('../views/Settings.vue'),
      meta: { title: '系统设置' },
    },
    // Mobile routes
    {
      path: '/m',
      component: () => import('../views/mobile/MobileHome.vue'),
      meta: { title: '餐桌总览', mobile: true },
    },
    {
      path: '/m/serving',
      component: () => import('../views/mobile/MobileServing.vue'),
      meta: { title: '上菜顺序', mobile: true },
    },
    {
      path: '/m/stats',
      component: () => import('../views/mobile/MobileStats.vue'),
      meta: { title: '营业统计', mobile: true },
    },
    {
      path: '/m/order/:tableId',
      component: () => import('../views/mobile/MobileOrdering.vue'),
      meta: { title: '点餐', mobile: true },
    },
  ],
})

router.beforeEach((to) => {
  const token = localStorage.getItem('token')
  if (!to.meta.public && !token) {
    return '/login'
  }
  if (to.path === '/' && isMobile()) {
    return '/m'
  }
})

export default router
