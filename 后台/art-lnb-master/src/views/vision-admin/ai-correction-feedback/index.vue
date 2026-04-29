<template>
  <div class="ai-correction-feedback art-full-height">
    <ArtSearchBar
      v-model="searchForm"
      :items="searchItems"
      @reset="handleReset"
      @search="handleSearch"
    />

    <ElRow :gutter="16" style="margin-bottom: 16px;">
      <ElCol :span="8">
        <ElCard shadow="never">
          <div class="stat-title">修订样本数</div>
          <div class="stat-value">{{ stats.sample_size }}</div>
          <div class="stat-desc">最近用于统计的 AI 修订反馈记录数</div>
        </ElCard>
      </ElCol>
      <ElCol :span="8">
        <ElCard shadow="never">
          <div class="stat-title">自填补充次数</div>
          <div class="stat-value">{{ stats.custom_reason_count }}</div>
          <div class="stat-desc">员工认为现有选项不够时的补充说明次数</div>
        </ElCard>
      </ElCol>
      <ElCol :span="8">
        <ElCard shadow="never">
          <div class="stat-title">高频原因 Top1</div>
          <div class="stat-value stat-small">{{ stats.list[0]?.label || '-' }}</div>
          <div class="stat-desc">{{ stats.list[0]?.count ? `出现 ${stats.list[0]?.count} 次` : '暂无统计' }}</div>
        </ElCard>
      </ElCol>
    </ElRow>

    <ElCard class="art-table-card" shadow="never">
      <ArtTableHeader v-model:columns="columnChecks" :loading="loading" @refresh="refreshData" />

      <ArtTable
        :loading="loading"
        :data="data"
        :columns="columns"
        :pagination="pagination"
        @pagination:size-change="handleSizeChange"
        @pagination:current-change="handleCurrentChange"
      />
    </ElCard>

    <ElDialog v-model="detailVisible" title="AI 修订反馈详情" width="1000px" destroy-on-close>
      <template v-if="activeRow">
        <div class="detail-meta">
          <ElTag type="info">孩子：{{ activeRow.child_name || '-' }}</ElTag>
          <ElTag type="success">员工：{{ activeRow.employee_name || '-' }}</ElTag>
          <ElTag type="warning">原始 AI #{{ activeRow.original_analysis_id }}</ElTag>
          <ElTag type="primary">修订版 #{{ activeRow.corrected_analysis_id }}</ElTag>
        </div>

        <div class="detail-block">
          <div class="detail-label">追问问题</div>
          <div class="detail-text">{{ activeRow.question_prompt || '-' }}</div>
        </div>

        <div class="detail-block" v-if="activeRow.question_summary">
          <div class="detail-label">系统摘要</div>
          <div class="detail-text">{{ activeRow.question_summary }}</div>
        </div>

        <div class="detail-block">
          <div class="detail-label">员工选择原因</div>
          <div class="chip-list">
            <ElTag
              v-for="opt in activeRow.selected_options"
              :key="`${opt.code || opt.label}-${opt.source}`"
              :type="opt.source === 'ai' ? 'warning' : 'info'"
              effect="light"
            >{{ opt.label }}</ElTag>
            <span v-if="!activeRow.selected_options?.length">-</span>
          </div>
        </div>

        <div class="detail-block" v-if="activeRow.custom_reason">
          <div class="detail-label">员工补充说明</div>
          <div class="detail-text">{{ activeRow.custom_reason }}</div>
        </div>

        <ElRow :gutter="16">
          <ElCol :span="12">
            <div class="detail-label">原始 AI 报告</div>
            <div class="content-box">{{ activeRow.original_content || '-' }}</div>
          </ElCol>
          <ElCol :span="12">
            <div class="detail-label">修订后报告</div>
            <div class="content-box">{{ activeRow.corrected_content || '-' }}</div>
          </ElCol>
        </ElRow>
      </template>
    </ElDialog>
  </div>
</template>

<script setup lang="ts">
  import { h, onMounted, ref } from 'vue'
  import { useTable } from '@/hooks/core/useTable'
  import {
    adminGetAiCorrectionStats,
    adminListAiCorrections,
    employeesList,
    type AiCorrectionReasonStat,
    type AiCorrectionRow,
    type EmployeeRow
  } from '@/api/vision-admin'
  import { ElButton, ElCard, ElCol, ElDialog, ElMessage, ElRow, ElTag } from 'element-plus'
  import ArtButtonTable from '@/components/core/forms/art-button-table/index.vue'

  defineOptions({ name: 'VisionAdminAiCorrectionFeedback' })

  const employeeOptions = ref<EmployeeRow[]>([])
  const stats = ref<{ list: AiCorrectionReasonStat[]; custom_reason_count: number; sample_size: number }>({
    list: [],
    custom_reason_count: 0,
    sample_size: 0
  })
  const detailVisible = ref(false)
  const activeRow = ref<AiCorrectionRow | null>(null)

  async function loadOptions() {
    try {
      const res: any = await employeesList({ page: 1, page_size: 500, active: true })
      employeeOptions.value = (res?.list || res?.data?.list || []) as EmployeeRow[]
    } catch {
      employeeOptions.value = []
    }
  }

  async function loadStats() {
    try {
      const res: any = await adminGetAiCorrectionStats()
      stats.value = (res?.stats || res?.data?.stats || stats.value) as typeof stats.value
    } catch (e: any) {
      ElMessage.error(e?.message || '加载修订统计失败')
    }
  }

  const searchForm = ref({
    keyword: undefined as string | undefined,
    source_employee_id: undefined as number | undefined,
    reason_code: undefined as string | undefined,
    child_id: undefined as number | undefined
  })

  const searchItems = [
    { label: '关键词', key: 'keyword', type: 'input', props: { placeholder: '孩子名/报告内容/补充说明' } },
    {
      label: '员工',
      key: 'source_employee_id',
      type: 'select',
      props: {
        filterable: true,
        options: () => [
          { label: '全部', value: undefined },
          ...employeeOptions.value.map((e) => ({ label: `${e.display_name}(${e.phone})`, value: e.id }))
        ]
      }
    },
    {
      label: '原因标签',
      key: 'reason_code',
      type: 'select',
      props: {
        filterable: true,
        options: () => [
          { label: '全部', value: undefined },
          ...stats.value.list.map((item) => ({ label: `${item.label}（${item.count}）`, value: item.code }))
        ]
      }
    },
    { label: '孩子ID', key: 'child_id', type: 'input', props: { placeholder: '按孩子ID筛选' } }
  ]

  function openDetail(row: AiCorrectionRow) {
    activeRow.value = row
    detailVisible.value = true
  }

  const {
    columns,
    columnChecks,
    data,
    loading,
    pagination,
    getData,
    searchParams,
    resetSearchParams,
    handleSizeChange,
    handleCurrentChange,
    refreshData
  } = useTable({
    core: {
      apiFn: adminListAiCorrections as (p: Record<string, unknown>) => Promise<{ list?: AiCorrectionRow[] }>,
      apiParams: { current: 1, size: 20, ...searchForm.value },
      columnsFactory: () => [
        { type: 'index', width: 60, label: '序号' },
        { prop: 'child_name', label: '孩子', width: 120 },
        { prop: 'grade_name', label: '年级', width: 90 },
        { prop: 'employee_name', label: '修订员工', width: 120 },
        {
          prop: 'selected_options', label: '主要原因', minWidth: 240,
          formatter: (row: AiCorrectionRow) =>
            h('div', { class: 'inline-tags' },
              (row.selected_options || []).slice(0, 3).map((item) =>
                h(ElTag, {
                  size: 'small',
                  effect: 'light',
                  type: item.source === 'ai' ? 'warning' : 'info',
                  style: 'margin-right:6px; margin-bottom:4px;'
                }, () => item.label)
              )
            )
        },
        {
          prop: 'custom_reason', label: '补充说明', minWidth: 220,
          formatter: (row: AiCorrectionRow) => String(row.custom_reason || '-').slice(0, 60)
        },
        { prop: 'created_at', label: '提交时间', width: 170 },
        {
          prop: 'operation', label: '操作', width: 120, fixed: 'right',
          formatter: (row: AiCorrectionRow) =>
            h(ArtButtonTable, {
              buttonList: [
                {
                  label: '查看',
                  type: 'primary',
                  link: true,
                  onClick: () => openDetail(row)
                }
              ]
            })
        }
      ]
    }
  })

  function handleSearch() {
    Object.assign(searchParams, searchForm.value)
    getData()
  }

  function handleReset() {
    resetSearchParams()
    Object.keys(searchForm.value).forEach((key) => {
      ;(searchForm.value as any)[key] = undefined
    })
  }

  onMounted(async () => {
    await Promise.all([loadOptions(), loadStats()])
  })
</script>

<style scoped>
.stat-title {
  color: #4E5969;
  font-size: 14px;
}
.stat-value {
  margin-top: 12px;
  font-size: 28px;
  font-weight: 700;
  color: #1F2329;
}
.stat-small {
  font-size: 18px;
  line-height: 1.4;
}
.stat-desc {
  margin-top: 8px;
  color: #86909C;
  font-size: 12px;
}
.detail-meta {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  margin-bottom: 16px;
}
.detail-block {
  margin-bottom: 16px;
}
.detail-label {
  margin-bottom: 8px;
  font-size: 14px;
  font-weight: 600;
  color: #1F2329;
}
.detail-text {
  color: #4E5969;
  line-height: 1.7;
  white-space: pre-wrap;
}
.content-box {
  min-height: 220px;
  padding: 12px;
  border-radius: 8px;
  background: #FAFBFC;
  border: 1px solid #EBEEF5;
  color: #1F2329;
  line-height: 1.7;
  white-space: pre-wrap;
  overflow-y: auto;
}
.chip-list {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
}
.inline-tags {
  display: flex;
  flex-wrap: wrap;
}
</style>
