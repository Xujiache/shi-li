import { defineStore } from 'pinia'
import * as notificationApi from '@/api/notification'

export const useNotificationsStore = defineStore('notifications', {
  state: () => ({
    unreadCount: 0 as number,
    lastFetchAt: 0 as number
  }),
  actions: {
    async refreshUnread() {
      try {
        const data = await notificationApi.unreadCount()
        this.unreadCount = data?.count || 0
        this.lastFetchAt = Date.now()
      } catch (e) {
        // http.ts 已 toast
      }
    },
    decrement(n = 1) {
      this.unreadCount = Math.max(0, this.unreadCount - n)
    },
    clear() {
      this.unreadCount = 0
    }
  }
})
