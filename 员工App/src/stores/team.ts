import { defineStore } from 'pinia'
import * as employeeApi from '@/api/employee'

const ONE_HOUR = 60 * 60 * 1000

interface CacheEntry<T> {
  data: T
  fetchedAt: number
}

function isFresh<T>(entry: CacheEntry<T> | null): boolean {
  return !!entry && Date.now() - entry.fetchedAt < ONE_HOUR
}

export const useTeamStore = defineStore('team', {
  state: () => ({
    members: null as CacheEntry<any[]> | null,
    tags: null as CacheEntry<any[]> | null,
    announcements: null as CacheEntry<any[]> | null
  }),
  getters: {
    memberList: (s) => s.members?.data || [],
    tagList: (s) => s.tags?.data || [],
    announcementList: (s) => s.announcements?.data || []
  },
  actions: {
    async loadMembers(force = false) {
      if (!force && isFresh(this.members)) return this.members!.data
      const data = (await employeeApi.getTeamMembers()) || []
      this.members = { data, fetchedAt: Date.now() }
      return data
    },
    async loadTags(force = false) {
      if (!force && isFresh(this.tags)) return this.tags!.data
      const data = (await employeeApi.getCustomerTags()) || []
      this.tags = { data, fetchedAt: Date.now() }
      return data
    },
    async loadAnnouncements(force = false) {
      if (!force && isFresh(this.announcements)) return this.announcements!.data
      const data = (await employeeApi.getAnnouncements()) || []
      this.announcements = { data, fetchedAt: Date.now() }
      return data
    },
    reset() {
      this.members = null
      this.tags = null
      this.announcements = null
    }
  }
})
