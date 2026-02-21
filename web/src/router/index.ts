import { createRouter, createWebHistory } from 'vue-router'
import { getAuthState } from '../api/auth'

const isMobile = () => window.innerWidth < 768

const PUBLIC_ROUTES = ['/login', '/setup', '/recovery']

let authStateCache: { setupRequired: boolean; ts: number } | null = null
async function checkSetupRequired(): Promise<boolean> {
  if (authStateCache && Date.now() - authStateCache.ts < 30_000) return authStateCache.setupRequired
  try {
    const state = await getAuthState()
    authStateCache = { setupRequired: state.setupRequired, ts: Date.now() }
    return state.setupRequired
  } catch {
    return false
  }
}

const router = createRouter({
  history: createWebHistory(),
  routes: [
    // Auth routes
    {
      path: '/login',
      component: () => import('../views/Login.vue'),
      meta: { title: '登录', public: true },
    },
    {
      path: '/setup',
      component: () => import('../views/Setup.vue'),
      meta: { title: '初始设置', public: true },
    },
    {
      path: '/recovery',
      component: () => import('../views/Recovery.vue'),
      meta: { title: 'PIN 恢复', public: true },
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
      path: '/m/history',
      component: () => import('../views/mobile/MobileHistory.vue'),
      meta: { title: '历史记录', mobile: true },
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

router.beforeEach(async (to) => {
  const token = localStorage.getItem('auth_token')
  const isPublic = PUBLIC_ROUTES.includes(to.path)

  // Mobile redirect
  if (to.path === '/' && isMobile()) return '/m'

  // Check if setup is needed
  const setupRequired = await checkSetupRequired()

  if (setupRequired) {
    // First-time use: redirect to setup
    if (to.path !== '/setup') return '/setup'
    return
  }

  // No token + protected route → login
  if (!token && !isPublic) return '/login'

  // Has token + public route → home
  if (token && isPublic) return isMobile() ? '/m' : '/'
})

export default router
