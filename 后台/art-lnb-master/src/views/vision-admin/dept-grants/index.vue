<template>
  <div class="dept-grants-page art-full-height">
    <ElCard class="art-table-card" shadow="never">
      <template #header>
        <div style="display:flex; align-items:center; justify-content:space-between;">
          <div style="font-size:16px; font-weight:600;">部门字段组授权</div>
          <ElButton size="small" @click="loadAll" :loading="loading">刷新</ElButton>
        </div>
      </template>

      <ElAlert
        type="info"
        :closable="false"
        show-icon
        title="勾选某部门可编辑哪些字段组。字段组的定义在【档案字段配置】页修改，本页只决定权限。"
        style="margin-bottom: 16px;"
      />

      <div v-if="loading" class="loading">加载中...</div>
      <div v-else-if="!sections.length" class="empty">
        当前没有任何字段组。请先到【档案字段配置】添加 sections。
      </div>
      <ElTable
        v-else
        :data="depts"
        border
        style="width: 100%"
      >
        <ElTableColumn prop="name" label="部门" width="180" fixed />
        <ElTableColumn
          v-for="sec in sections"
          :key="sec.key"
          :label="sec.label"
          align="center"
          min-width="140"
        >
          <template #default="{ row }">
            <ElCheckbox
              :model-value="isGranted(row.id, sec.key)"
              :disabled="savingDept === row.id"
              @change="(v: boolean | string | number) => onToggle(row, sec.key, !!v)"
            />
          </template>
        </ElTableColumn>
      </ElTable>
    </ElCard>
  </div>
</template>

<script setup lang="ts">
  import { ref, onMounted } from 'vue'
  import {
    adminListAllDeptGrants,
    adminSetDeptGrants,
    departmentsList,
    type DepartmentRow,
    type SectionMeta
  } from '@/api/vision-admin'
  import {
    ElCard,
    ElButton,
    ElAlert,
    ElTable,
    ElTableColumn,
    ElCheckbox,
    ElMessage
  } from 'element-plus'

  defineOptions({ name: 'VisionAdminDeptGrants' })

  const loading = ref(false)
  const savingDept = ref<number | null>(null)
  const depts = ref<DepartmentRow[]>([])
  const sections = ref<SectionMeta[]>([])
  const grantsMap = ref<Map<number, Set<string>>>(new Map())

  function isGranted(deptId: number, key: string): boolean {
    const set = grantsMap.value.get(Number(deptId))
    return set ? set.has(key) : false
  }

  async function loadAll() {
    loading.value = true
    try {
      const [deptRes, grantsRes]: [any, any] = await Promise.all([
        departmentsList({ page: 1, page_size: 200, active: true }),
        adminListAllDeptGrants()
      ])
      depts.value = (deptRes?.list || deptRes?.data?.list || []) as DepartmentRow[]
      sections.value = ((grantsRes?.sections || grantsRes?.data?.sections || []) as SectionMeta[])
        .filter((s) => s.enabled !== false)
        .sort((a, b) => (a.sort_order || 0) - (b.sort_order || 0))
      const grants = (grantsRes?.grants || grantsRes?.data?.grants || []) as Array<{ department_id: number; section_keys: string[] }>
      const m = new Map<number, Set<string>>()
      for (const g of grants) {
        m.set(Number(g.department_id), new Set(g.section_keys))
      }
      grantsMap.value = m
    } catch (e: any) {
      ElMessage.error(e?.message || '加载失败')
    } finally {
      loading.value = false
    }
  }

  async function onToggle(dept: DepartmentRow, sectionKey: string, granted: boolean) {
    const deptId = Number(dept.id)
    const set = new Set(grantsMap.value.get(deptId) || [])
    if (granted) set.add(sectionKey)
    else set.delete(sectionKey)
    savingDept.value = deptId
    try {
      await adminSetDeptGrants({ dept_id: deptId, section_keys: Array.from(set) })
      grantsMap.value.set(deptId, set)
      // 触发响应式更新
      grantsMap.value = new Map(grantsMap.value)
      ElMessage.success(granted ? `已授权「${sectionKey}」` : `已取消授权「${sectionKey}」`)
    } catch (e: any) {
      ElMessage.error(e?.message || '保存失败')
    } finally {
      savingDept.value = null
    }
  }

  onMounted(() => {
    loadAll()
  })
</script>

<style scoped>
  .loading,
  .empty {
    padding: 40px 0;
    text-align: center;
    color: #909399;
  }
</style>
