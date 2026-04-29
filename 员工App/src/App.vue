<script setup lang="ts">
import { onLaunch, onShow, onHide } from '@dcloudio/uni-app'
import { useAuthStore } from '@/stores/auth'
import { useSyncStore } from '@/stores/sync'
import { initDb } from '@/db'
import { onNetworkChange } from '@/utils/network'

// 前台轮询 timer（30s）；onShow 启动，onHide 暂停
let foregroundPollTimer: any = null

onLaunch(() => {
  console.log('[App] onLaunch')
  // 路由守卫：未登录跳登录页（不能 await，UniApp 钩子是同步的）
  const auth = useAuthStore()
  auth.bootstrap()

  // 异步初始化离线 DB（不 await，启动后置；H5 内部直接 return）
  initDb().catch((e) => console.warn('[App] initDb failed', e))

  // 全局网络状态监听 → 在线时 kick 同步
  onNetworkChange((online) => {
    if (online) {
      try {
        useSyncStore().kick('network_online')
      } catch (e) {
        // pinia 未就绪时静默
      }
    }
  })

  // 注册全局导航拦截器
  ;['navigateTo', 'redirectTo', 'reLaunch', 'switchTab'].forEach((method) => {
    uni.addInterceptor(method, {
      invoke(args: any) {
        const url = args.url || ''
        const isLoginPage = /^\/?pages\/login\//.test(url)
        if (!auth.token && !isLoginPage) {
          uni.reLaunch({ url: '/pages/login/login' })
          return false
        }
        return true
      }
    })
  })
})

onShow(() => {
  console.log('[App] onShow')
  // 前台 30s 轮询：调 kick(poll)；后台不跑
  if (!foregroundPollTimer) {
    foregroundPollTimer = setInterval(() => {
      try {
        useSyncStore().kick('poll')
      } catch (e) {
        // 静默
      }
    }, 30 * 1000)
  }
})

onHide(() => {
  console.log('[App] onHide')
  if (foregroundPollTimer) {
    clearInterval(foregroundPollTimer)
    foregroundPollTimer = null
  }
})
</script>

<style lang="scss">
@import '@/styles/tokens.scss';

/* 全局样式：基础重置 + 设计令牌 */
page {
  background-color: #F5F7FA;
  color: #1F2329;
  font-size: 28rpx;
  line-height: 1.5;
}

.flex {
  display: flex;
}
.flex-col {
  display: flex;
  flex-direction: column;
}
.flex-between {
  display: flex;
  align-items: center;
  justify-content: space-between;
}
.flex-center {
  display: flex;
  align-items: center;
  justify-content: center;
}
.text-primary {
  color: #1677FF;
}
.text-success {
  color: #52C41A;
}
.text-warning {
  color: #FAAD14;
}
.text-danger {
  color: #FF4D4F;
}
.text-secondary {
  color: #86909C;
}

.card {
  background: #ffffff;
  border-radius: 16rpx;
  padding: 24rpx;
  box-shadow: 0 2rpx 8rpx rgba(0, 0, 0, 0.04);
  margin-bottom: 16rpx;
}

.btn-primary {
  background: #1677FF;
  color: #ffffff;
  border-radius: 12rpx;
  padding: 20rpx 32rpx;
  text-align: center;
  font-size: 30rpx;

  &:active {
    background: #0958D9;
  }
}

.btn-default {
  background: #ffffff;
  color: #1F2329;
  border: 2rpx solid #E5E6EB;
  border-radius: 12rpx;
  padding: 20rpx 32rpx;
  text-align: center;
  font-size: 30rpx;
}

.empty-state {
  padding: 80rpx 32rpx;
  text-align: center;
  color: #86909C;
}
</style>
