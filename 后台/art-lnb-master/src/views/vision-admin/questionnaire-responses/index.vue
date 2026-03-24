<template>
  <div class="vision-questionnaire-responses art-full-height">
    <ElCard class="mb-4" shadow="never">
      <div class="flex flex-wrap gap-3">
        <ElSelect v-model="searchForm.questionnaire_id" placeholder="选择问卷" clearable style="width: 220px">
          <ElOption
            v-for="item in questionnaireOptions"
            :key="item._id"
            :label="item.title"
            :value="item._id"
          />
        </ElSelect>
        <ElInput v-model="searchForm.q" placeholder="学生/手机号/用户编号" clearable style="width: 220px" />
        <ElInput v-model="searchForm.school" placeholder="学校" clearable style="width: 180px" />
        <ElInput v-model="searchForm.grade_name" placeholder="年级" clearable style="width: 140px" />
        <ElInput v-model="searchForm.class_name" placeholder="班级" clearable style="width: 180px" />
        <ElSelect v-model="searchForm.status" placeholder="状态" clearable style="width: 140px">
          <ElOption label="草稿" value="draft" />
          <ElOption label="已提交" value="submitted" />
        </ElSelect>
        <ElDatePicker
          v-model="searchForm.dateRange"
          type="daterange"
          value-format="YYYY-MM-DD HH:mm:ss"
          start-placeholder="开始时间"
          end-placeholder="结束时间"
          style="width: 320px"
        />
        <ElButton type="primary" @click="fetchList">搜索</ElButton>
        <ElButton @click="resetSearch">重置</ElButton>
        <ElButton type="success" @click="exportRows" :loading="exporting">导出</ElButton>
      </div>
    </ElCard>

    <ElCard shadow="never">
      <ElTable :data="tableData" v-loading="loading" border>
        <ElTableColumn type="index" width="60" label="序号" />
        <ElTableColumn prop="questionnaire_title" label="问卷" min-width="220" show-overflow-tooltip />
        <ElTableColumn prop="child_name" label="学生姓名" width="120" />
        <ElTableColumn prop="school" label="学校" min-width="150" show-overflow-tooltip />
        <ElTableColumn prop="grade_name" label="年级" width="100" />
        <ElTableColumn prop="class_name" label="班级" min-width="120" show-overflow-tooltip />
        <ElTableColumn prop="user_no" label="用户编号" width="110" />
        <ElTableColumn prop="user_phone" label="手机号" width="120" />
        <ElTableColumn prop="status" label="状态" width="90">
          <template #default="{ row }">
            <ElTag :type="row.status === 'submitted' ? 'success' : 'warning'" size="small">
              {{ row.status === 'submitted' ? '已提交' : '草稿' }}
            </ElTag>
          </template>
        </ElTableColumn>
        <ElTableColumn prop="attempt_no" label="第几次" width="80" />
        <ElTableColumn prop="answered_count" label="答题数" width="80" />
        <ElTableColumn prop="total_score" label="总分" width="80" />
        <ElTableColumn prop="submitted_at" label="提交时间" width="170" />
        <ElTableColumn label="操作" width="120" fixed="right">
          <template #default="{ row }">
            <ElButton link type="primary" @click="openDetail(row)">查看详情</ElButton>
          </template>
        </ElTableColumn>
      </ElTable>

      <div class="mt-4 flex justify-end">
        <ElPagination
          background
          layout="total, sizes, prev, pager, next"
          :total="pagination.total"
          :page-size="pagination.pageSize"
          :current-page="pagination.page"
          :page-sizes="[10, 20, 50, 100]"
          @size-change="handlePageSizeChange"
          @current-change="handlePageChange"
        />
      </div>
    </ElCard>

    <ElDialog v-model="detailVisible" title="答卷详情" width="880px">
      <div v-if="detailSubmission" class="detail-wrap">
        <ElDescriptions :column="2" border>
          <ElDescriptionsItem label="问卷">{{ detailSubmission.questionnaire_title || detailSubmission.questionnaire_id }}</ElDescriptionsItem>
          <ElDescriptionsItem label="学生">{{ detailSubmission.child_name }}</ElDescriptionsItem>
          <ElDescriptionsItem label="学校">{{ detailSubmission.school }}</ElDescriptionsItem>
          <ElDescriptionsItem label="年级">{{ detailSubmission.grade_name || '未设置' }}</ElDescriptionsItem>
          <ElDescriptionsItem label="班级">{{ detailSubmission.class_name }}</ElDescriptionsItem>
          <ElDescriptionsItem label="用户编号">{{ detailSubmission.user_no }}</ElDescriptionsItem>
          <ElDescriptionsItem label="手机号">{{ detailSubmission.user_phone }}</ElDescriptionsItem>
          <ElDescriptionsItem label="状态">{{ detailSubmission.status }}</ElDescriptionsItem>
          <ElDescriptionsItem label="第几次">{{ detailSubmission.attempt_no }}</ElDescriptionsItem>
          <ElDescriptionsItem label="提交时间">{{ detailSubmission.submitted_at || detailSubmission.updated_at }}</ElDescriptionsItem>
          <ElDescriptionsItem label="总分">{{ detailSubmission.total_score ?? '—' }}</ElDescriptionsItem>
          <ElDescriptionsItem label="答题数">{{ detailSubmission.answered_count }}</ElDescriptionsItem>
        </ElDescriptions>

        <ElTable class="mt-4" :data="detailAnswers" border max-height="420">
          <ElTableColumn type="index" width="60" />
          <ElTableColumn prop="question_title" label="题目" min-width="260" show-overflow-tooltip />
          <ElTableColumn prop="question_type" label="题型" width="120" />
          <ElTableColumn prop="answer_text" label="答案" min-width="260" show-overflow-tooltip />
          <ElTableColumn prop="score" label="得分" width="100" />
        </ElTable>
      </div>
      <template #footer>
        <ElButton @click="detailVisible = false">关闭</ElButton>
      </template>
    </ElDialog>
  </div>
</template>

<script setup lang="ts">
  import { onMounted, reactive, ref } from 'vue'
  import * as XLSX from 'xlsx'
  import { ElMessage } from 'element-plus'
  import {
    questionnairesList,
    questionnaireSubmissionDetail,
    questionnaireSubmissionsExport,
    questionnaireSubmissionsList
  } from '@/api/vision-admin'

  defineOptions({ name: 'VisionAdminQuestionnaireResponses' })

  const loading = ref(false)
  const exporting = ref(false)
  const detailVisible = ref(false)
  const detailSubmission = ref<any>(null)
  const detailAnswers = ref<any[]>([])
  const questionnaireOptions = ref<any[]>([])
  const tableData = ref<any[]>([])

  const searchForm = reactive({
    questionnaire_id: '',
    q: '',
    school: '',
    grade_name: '',
    class_name: '',
    status: '',
    dateRange: [] as string[]
  })

  const pagination = reactive({
    page: 1,
    pageSize: 20,
    total: 0
  })

  async function fetchQuestionnaireOptions() {
    const data = await questionnairesList({ current: 1, size: 200 })
    questionnaireOptions.value = Array.isArray((data as any).list) ? (data as any).list : []
  }

  async function fetchList() {
    loading.value = true
    try {
      const [dateFrom, dateTo] = Array.isArray(searchForm.dateRange) ? searchForm.dateRange : []
      const data = await questionnaireSubmissionsList({
        current: pagination.page,
        size: pagination.pageSize,
        questionnaire_id: searchForm.questionnaire_id || undefined,
        q: searchForm.q || undefined,
        school: searchForm.school || undefined,
        grade_name: searchForm.grade_name || undefined,
        class_name: searchForm.class_name || undefined,
        status: searchForm.status || undefined,
        date_from: dateFrom || undefined,
        date_to: dateTo || undefined
      })
      tableData.value = Array.isArray((data as any).list) ? (data as any).list : []
      pagination.total = Number((data as any).total || 0)
      pagination.page = Number((data as any).page || pagination.page)
      pagination.pageSize = Number((data as any).page_size || pagination.pageSize)
    } finally {
      loading.value = false
    }
  }

  function resetSearch() {
    searchForm.questionnaire_id = ''
    searchForm.q = ''
    searchForm.school = ''
    searchForm.grade_name = ''
    searchForm.class_name = ''
    searchForm.status = ''
    searchForm.dateRange = []
    pagination.page = 1
    fetchList()
  }

  function handlePageChange(page: number) {
    pagination.page = page
    fetchList()
  }

  function handlePageSizeChange(size: number) {
    pagination.pageSize = size
    pagination.page = 1
    fetchList()
  }

  async function openDetail(row: any) {
    const detail = await questionnaireSubmissionDetail({ submission_id: row._id })
    detailSubmission.value = detail && (detail as any).submission ? (detail as any).submission : null
    detailAnswers.value = detail && Array.isArray((detail as any).answers) ? (detail as any).answers : []
    detailVisible.value = true
  }

  async function exportRows() {
    exporting.value = true
    try {
      const [dateFrom, dateTo] = Array.isArray(searchForm.dateRange) ? searchForm.dateRange : []
      const data = await questionnaireSubmissionsExport({
        questionnaire_id: searchForm.questionnaire_id || undefined,
        q: searchForm.q || undefined,
        school: searchForm.school || undefined,
        grade_name: searchForm.grade_name || undefined,
        class_name: searchForm.class_name || undefined,
        status: searchForm.status || undefined,
        date_from: dateFrom || undefined,
        date_to: dateTo || undefined
      })
      const rows = data && Array.isArray((data as any).rows) ? (data as any).rows : []
      const worksheet = XLSX.utils.json_to_sheet(rows)
      const workbook = XLSX.utils.book_new()
      XLSX.utils.book_append_sheet(workbook, worksheet, '问卷填写数据')
      XLSX.writeFile(workbook, `问卷填写数据_${Date.now()}.xlsx`)
      ElMessage.success('导出成功')
    } finally {
      exporting.value = false
    }
  }

  onMounted(async () => {
    await fetchQuestionnaireOptions()
    await fetchList()
  })
</script>
