<template>
  <div class="vision-questionnaires art-full-height">
    <ElCard class="mb-4" shadow="never">
      <div class="flex flex-wrap gap-3">
        <ElInput v-model="searchForm.q" placeholder="问卷标题/描述" clearable style="width: 220px" />
        <ElSelect v-model="searchForm.status" placeholder="状态" clearable style="width: 140px">
          <ElOption label="草稿" value="draft" />
          <ElOption label="已发布" value="published" />
          <ElOption label="已归档" value="archived" />
        </ElSelect>
        <ElSelect v-model="searchForm.active" placeholder="启用状态" clearable style="width: 140px">
          <ElOption label="启用" :value="true" />
          <ElOption label="停用" :value="false" />
        </ElSelect>
        <ElButton type="primary" @click="fetchList">搜索</ElButton>
        <ElButton @click="resetSearch">重置</ElButton>
        <ElButton type="success" @click="openCreate">新增问卷</ElButton>
      </div>
    </ElCard>

    <ElCard shadow="never">
      <ElTable :data="tableData" v-loading="loading" border>
        <ElTableColumn type="index" label="序号" width="60" />
        <ElTableColumn prop="title" label="问卷标题" min-width="220" show-overflow-tooltip />
        <ElTableColumn prop="status" label="状态" width="100">
          <template #default="{ row }">
            <ElTag :type="row.status === 'published' ? 'success' : row.status === 'archived' ? 'info' : 'warning'" size="small">
              {{ row.status === 'published' ? '已发布' : row.status === 'archived' ? '已归档' : '草稿' }}
            </ElTag>
          </template>
        </ElTableColumn>
        <ElTableColumn prop="submit_rule_type" label="提交规则" width="130">
          <template #default="{ row }">
            {{ getSubmitRuleText(row) }}
          </template>
        </ElTableColumn>
        <ElTableColumn prop="question_count" label="题目数" width="90" />
        <ElTableColumn prop="section_count" label="分组数" width="90" />
        <ElTableColumn prop="submission_count" label="填写数" width="90" />
        <ElTableColumn prop="updated_at" label="更新时间" width="170" />
        <ElTableColumn label="操作" width="360" fixed="right">
          <template #default="{ row }">
            <div class="flex flex-wrap gap-2">
              <ElButton link type="primary" @click="openEdit(row)">编辑</ElButton>
              <ElButton link type="primary" @click="handleCopy(row)">复制</ElButton>
              <ElButton link type="primary" @click="togglePublish(row)">
                {{ row.status === 'published' ? '设为草稿' : '发布' }}
              </ElButton>
              <ElButton link type="warning" @click="toggleActive(row)">
                {{ row.active ? '停用' : '启用' }}
              </ElButton>
              <ElButton link type="danger" @click="handleDelete(row)">删除</ElButton>
            </div>
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

    <ElDrawer v-model="editorVisible" :title="editorMode === 'add' ? '新增问卷' : '编辑问卷'" size="82%">
      <div class="editor-body">
        <ElTabs v-model="editorTab">
          <ElTabPane label="基础信息" name="basic">
            <ElForm ref="basicFormRef" :model="questionnaireForm" :rules="basicRules" label-width="120px">
              <ElFormItem label="问卷标题" prop="title">
                <ElInput v-model="questionnaireForm.title" maxlength="200" show-word-limit />
              </ElFormItem>
              <ElFormItem label="问卷描述" prop="description">
                <ElInput v-model="questionnaireForm.description" type="textarea" :rows="3" />
              </ElFormItem>
              <ElFormItem label="问卷封面" prop="cover_image_url">
                <CloudImageField v-model="questionnaireForm.cover_image_url" prefix="questionnaire/covers" />
              </ElFormItem>
              <ElFormItem label="发布状态" prop="status">
                <ElSelect v-model="questionnaireForm.status" style="width: 220px">
                  <ElOption label="草稿" value="draft" />
                  <ElOption label="已发布" value="published" />
                  <ElOption label="已归档" value="archived" />
                </ElSelect>
              </ElFormItem>
              <ElFormItem label="启用状态">
                <ElSwitch v-model="questionnaireForm.active" />
              </ElFormItem>
              <ElFormItem label="允许存草稿">
                <ElSwitch v-model="questionnaireForm.allow_save_draft" />
              </ElFormItem>
              <ElFormItem label="允许查看结果">
                <ElSwitch v-model="questionnaireForm.allow_view_result" />
              </ElFormItem>
              <ElFormItem label="默认提交规则">
                <div class="grid grid-cols-2 gap-3 w-full">
                  <ElSelect v-model="questionnaireForm.submit_rule_type" placeholder="请选择">
                    <ElOption label="一次" value="once" />
                    <ElOption label="限制次数" value="limited" />
                    <ElOption label="不限次数" value="unlimited" />
                  </ElSelect>
                  <ElInputNumber v-model="questionnaireForm.max_submit_count" :min="1" :disabled="questionnaireForm.submit_rule_type !== 'limited'" />
                  <ElSelect v-model="questionnaireForm.cycle_type" placeholder="周期">
                    <ElOption label="无周期" value="none" />
                    <ElOption label="每日" value="day" />
                    <ElOption label="每周" value="week" />
                    <ElOption label="每月" value="month" />
                    <ElOption label="每学期" value="term" />
                  </ElSelect>
                  <ElInputNumber v-model="questionnaireForm.cycle_value" :min="1" :disabled="questionnaireForm.cycle_type === 'none'" />
                </div>
              </ElFormItem>
              <ElFormItem label="开始时间">
                <ElDatePicker
                  v-model="questionnaireForm.publish_start_at"
                  type="datetime"
                  value-format="YYYY-MM-DD HH:mm:ss"
                  style="width: 240px"
                />
              </ElFormItem>
              <ElFormItem label="结束时间">
                <ElDatePicker
                  v-model="questionnaireForm.publish_end_at"
                  type="datetime"
                  value-format="YYYY-MM-DD HH:mm:ss"
                  style="width: 240px"
                />
              </ElFormItem>
              <ElFormItem label="欢迎说明">
                <ElInput v-model="questionnaireForm.welcome_text" type="textarea" :rows="3" />
              </ElFormItem>
              <ElFormItem label="提交成功文案">
                <ElInput v-model="questionnaireForm.submit_success_text" type="textarea" :rows="2" />
              </ElFormItem>
            </ElForm>
          </ElTabPane>

          <ElTabPane label="派发规则" name="rules">
            <div class="mb-3">
              <ElButton type="primary" @click="openRuleDialog()">新增规则</ElButton>
            </div>
            <ElTable :data="questionnaireForm.assignment_rules" border>
              <ElTableColumn type="index" width="60" label="#" />
              <ElTableColumn prop="rule_name" label="规则名称" min-width="150" />
              <ElTableColumn prop="scope_type" label="范围类型" width="140">
                <template #default="{ row }">
                  {{ getScopeLabel(row.scope_type) }}
                </template>
              </ElTableColumn>
              <ElTableColumn label="派发范围" min-width="220">
                <template #default="{ row }">
                  <div class="text-sm">
                    <div v-if="row.school">学校：{{ row.school }}</div>
                    <div v-if="row.grade_name">年级：{{ row.grade_name }}</div>
                    <div v-if="row.class_name">班级：{{ row.class_name }}</div>
                    <div v-if="row.child_id">指定孩子：{{ getChildLabel(row.child_id) }}</div>
                    <div v-if="row.user_id">指定用户：{{ getUserLabel(row.user_id) }}</div>
                    <div v-if="!row.school && !row.grade_name && !row.class_name && !row.child_id && !row.user_id">全部</div>
                  </div>
                </template>
              </ElTableColumn>
              <ElTableColumn label="提交规则" min-width="160">
                <template #default="{ row }">
                  {{ formatRuleSubmitText(row) }}
                </template>
              </ElTableColumn>
              <ElTableColumn prop="active" label="启用" width="90">
                <template #default="{ row }">
                  <ElTag :type="row.active ? 'success' : 'info'" size="small">{{ row.active ? '启用' : '停用' }}</ElTag>
                </template>
              </ElTableColumn>
              <ElTableColumn label="操作" width="180" fixed="right">
                <template #default="{ $index }">
                  <ElButton link type="primary" @click="openRuleDialog($index)">编辑</ElButton>
                  <ElButton link type="danger" @click="removeRule($index)">删除</ElButton>
                </template>
              </ElTableColumn>
            </ElTable>
          </ElTabPane>

          <ElTabPane label="分组与题目" name="sections">
            <div class="mb-3">
              <ElButton type="primary" @click="openSectionDialog()">新增分组</ElButton>
            </div>
            <div class="section-list">
              <ElCard v-for="(section, sectionIndex) in questionnaireForm.sections" :key="sectionIndex" class="mb-4" shadow="never">
                <template #header>
                  <div class="flex justify-between items-center gap-3">
                    <div>
                      <div class="font-semibold">{{ section.title }}</div>
                      <div class="text-xs text-g-600">第 {{ section.page_no }} 页 · 排序 {{ section.sort_order }}</div>
                    </div>
                    <div class="flex gap-2">
                      <ElButton size="small" @click="openSectionDialog(sectionIndex)">编辑分组</ElButton>
                      <ElButton size="small" type="primary" @click="openQuestionDialog(sectionIndex)">新增题目</ElButton>
                      <ElButton size="small" type="danger" plain @click="removeSection(sectionIndex)">删除分组</ElButton>
                    </div>
                  </div>
                </template>

                <div class="text-sm text-g-600 mb-3" v-if="section.description">{{ section.description }}</div>

                <ElTable :data="section.questions || []" border>
                  <ElTableColumn type="index" width="60" label="#" />
                  <ElTableColumn prop="title" label="题目标题" min-width="220" show-overflow-tooltip />
                  <ElTableColumn prop="type" label="题型" width="120" />
                  <ElTableColumn prop="required" label="必答" width="80">
                    <template #default="{ row }">
                      <ElTag :type="row.required ? 'danger' : 'info'" size="small">{{ row.required ? '是' : '否' }}</ElTag>
                    </template>
                  </ElTableColumn>
                  <ElTableColumn prop="sort_order" label="排序" width="80" />
                  <ElTableColumn label="操作" width="220" fixed="right">
                    <template #default="{ row, $index }">
                      <div class="flex gap-2">
                        <ElButton link type="primary" @click="openQuestionDialog(sectionIndex, $index)">编辑</ElButton>
                        <ElButton link type="primary" @click="copyQuestion(sectionIndex, $index)">复制</ElButton>
                        <ElButton link type="danger" @click="removeQuestion(sectionIndex, $index)">删除</ElButton>
                      </div>
                    </template>
                  </ElTableColumn>
                </ElTable>
              </ElCard>
            </div>
          </ElTabPane>
        </ElTabs>
      </div>

      <template #footer>
        <div class="flex justify-end gap-3">
          <ElButton @click="editorVisible = false">取消</ElButton>
          <ElButton type="primary" :loading="saving" @click="saveQuestionnaire">保存问卷</ElButton>
        </div>
      </template>
    </ElDrawer>

    <ElDialog v-model="sectionDialogVisible" :title="sectionDialogIndex === -1 ? '新增分组' : '编辑分组'" width="480px">
      <ElForm :model="sectionForm" label-width="100px">
        <ElFormItem label="分组标题">
          <ElInput v-model="sectionForm.title" />
        </ElFormItem>
        <ElFormItem label="分组说明">
          <ElInput v-model="sectionForm.description" type="textarea" :rows="2" />
        </ElFormItem>
        <ElFormItem label="页码">
          <ElInputNumber v-model="sectionForm.page_no" :min="1" />
        </ElFormItem>
        <ElFormItem label="排序">
          <ElInputNumber v-model="sectionForm.sort_order" :min="1" />
        </ElFormItem>
      </ElForm>
      <template #footer>
        <ElButton @click="sectionDialogVisible = false">取消</ElButton>
        <ElButton type="primary" @click="saveSection">保存</ElButton>
      </template>
    </ElDialog>

    <ElDialog v-model="ruleDialogVisible" :title="ruleDialogIndex === -1 ? '新增规则' : '编辑规则'" width="620px">
      <ElForm :model="ruleForm" label-width="120px">
        <ElFormItem label="规则名称">
          <ElInput v-model="ruleForm.rule_name" />
        </ElFormItem>
        <ElFormItem label="范围类型">
          <ElSelect v-model="ruleForm.scope_type" style="width: 220px">
            <ElOption v-for="item in scopeTypeOptions" :key="item.value" :label="item.label" :value="item.value" />
          </ElSelect>
        </ElFormItem>
        <ElFormItem label="学校" v-if="['school', 'grade', 'grade_range', 'class'].includes(ruleForm.scope_type)">
          <ElSelect v-model="ruleForm.school" clearable filterable style="width: 260px">
            <ElOption v-for="item in schoolOptions" :key="item" :label="item" :value="item" />
          </ElSelect>
        </ElFormItem>
        <ElFormItem label="年级" v-if="ruleForm.scope_type === 'grade'">
          <ElSelect v-model="ruleForm.grade_name" clearable filterable style="width: 220px">
            <ElOption v-for="item in ruleGradeOptions" :key="item" :label="item" :value="item" />
          </ElSelect>
        </ElFormItem>
        <ElFormItem label="年级范围" v-if="ruleForm.scope_type === 'grade_range'">
          <div class="flex items-center gap-2">
            <ElSelect v-model="ruleForm.grade_min" clearable style="width: 140px">
              <ElOption v-for="item in gradeLevelOptions" :key="item.value" :label="item.label" :value="item.value" />
            </ElSelect>
            <span>到</span>
            <ElSelect v-model="ruleForm.grade_max" clearable style="width: 140px">
              <ElOption v-for="item in gradeLevelOptions" :key="item.value" :label="item.label" :value="item.value" />
            </ElSelect>
          </div>
        </ElFormItem>
        <ElFormItem label="班级" v-if="ruleForm.scope_type === 'class'">
          <ElSelect v-model="ruleForm.class_name" clearable filterable style="width: 260px">
            <ElOption v-for="item in ruleClassOptions" :key="item" :label="item" :value="item" />
          </ElSelect>
        </ElFormItem>
        <ElFormItem label="指定用户" v-if="ruleForm.scope_type === 'user'">
          <ElSelect v-model="ruleForm.user_id" clearable filterable style="width: 100%">
            <ElOption v-for="item in userOptions" :key="item.value" :label="item.label" :value="item.value" />
          </ElSelect>
        </ElFormItem>
        <ElFormItem label="指定孩子" v-if="ruleForm.scope_type === 'child'">
          <ElSelect v-model="ruleForm.child_id" clearable filterable style="width: 100%">
            <ElOption v-for="item in childOptions" :key="item.value" :label="item.label" :value="item.value" />
          </ElSelect>
        </ElFormItem>
        <ElFormItem label="提交规则">
          <div class="grid grid-cols-2 gap-3 w-full">
            <ElSelect v-model="ruleForm.submit_rule_type">
              <ElOption label="继承问卷默认" value="inherit" />
              <ElOption label="一次" value="once" />
              <ElOption label="限制次数" value="limited" />
              <ElOption label="不限次数" value="unlimited" />
            </ElSelect>
            <ElInputNumber v-model="ruleForm.max_submit_count" :min="1" :disabled="ruleForm.submit_rule_type !== 'limited'" />
            <ElSelect v-model="ruleForm.cycle_type">
              <ElOption label="无周期" value="none" />
              <ElOption label="每日" value="day" />
              <ElOption label="每周" value="week" />
              <ElOption label="每月" value="month" />
              <ElOption label="每学期" value="term" />
            </ElSelect>
            <ElInputNumber v-model="ruleForm.cycle_value" :min="1" :disabled="ruleForm.cycle_type === 'none'" />
          </div>
        </ElFormItem>
        <ElFormItem label="开始时间">
          <ElDatePicker v-model="ruleForm.start_at" type="datetime" value-format="YYYY-MM-DD HH:mm:ss" style="width: 220px" />
        </ElFormItem>
        <ElFormItem label="结束时间">
          <ElDatePicker v-model="ruleForm.end_at" type="datetime" value-format="YYYY-MM-DD HH:mm:ss" style="width: 220px" />
        </ElFormItem>
        <ElFormItem label="启用">
          <ElSwitch v-model="ruleForm.active" />
        </ElFormItem>
      </ElForm>
      <template #footer>
        <ElButton @click="ruleDialogVisible = false">取消</ElButton>
        <ElButton type="primary" @click="saveRule">保存</ElButton>
      </template>
    </ElDialog>

    <ElDialog v-model="questionDialogVisible" :title="questionDialogMode === 'add' ? '新增题目' : '编辑题目'" width="760px">
      <ElForm :model="questionForm" label-width="120px">
        <ElFormItem label="题型">
          <ElSelect v-model="questionForm.type" style="width: 240px">
            <ElOption v-for="item in questionTypeOptions" :key="item.value" :label="item.label" :value="item.value" />
          </ElSelect>
        </ElFormItem>
        <ElFormItem label="题目标题">
          <ElInput v-model="questionForm.title" />
        </ElFormItem>
        <ElFormItem label="题目说明">
          <ElInput v-model="questionForm.description" type="textarea" :rows="2" />
        </ElFormItem>
        <ElFormItem label="占位文本">
          <ElInput v-model="questionForm.placeholder" />
        </ElFormItem>
        <ElFormItem label="必答">
          <ElSwitch v-model="questionForm.required" />
        </ElFormItem>
        <ElFormItem label="排序">
          <ElInputNumber v-model="questionForm.sort_order" :min="1" />
        </ElFormItem>
        <template v-if="questionForm.type === 'profile_field'">
          <ElFormItem label="档案字段">
            <ElSelect v-model="questionForm.profile_key" style="width: 240px">
              <ElOption label="孩子姓名" value="name" />
              <ElOption label="学校" value="school" />
              <ElOption label="年级" value="grade_name" />
              <ElOption label="班级" value="class_name" />
              <ElOption label="用户编号" value="user_no" />
              <ElOption label="手机号" value="phone" />
            </ElSelect>
          </ElFormItem>
          <ElFormItem label="数据来源">
            <ElSelect v-model="questionForm.source_mode" style="width: 240px">
              <ElOption label="手动填写" value="manual" />
              <ElOption label="自动带出并允许修改" value="editable_profile" />
              <ElOption label="自动带出且只读" value="readonly_profile" />
            </ElSelect>
          </ElFormItem>
        </template>

        <template v-if="['text', 'textarea', 'profile_field'].includes(questionForm.type)">
          <ElFormItem label="最大字数">
            <ElInputNumber v-model="questionForm.max_length" :min="1" :max="2000" />
          </ElFormItem>
        </template>

        <template v-if="questionForm.type === 'number'">
          <ElFormItem label="最小值">
            <ElInputNumber v-model="questionForm.min_value" />
          </ElFormItem>
          <ElFormItem label="最大值">
            <ElInputNumber v-model="questionForm.max_value" />
          </ElFormItem>
        </template>

        <template v-if="questionForm.type === 'rating'">
          <ElFormItem label="评分范围">
            <div class="flex items-center gap-2">
              <ElInputNumber v-model="questionForm.rating_min" :min="1" />
              <span>到</span>
              <ElInputNumber v-model="questionForm.rating_max" :min="1" />
            </div>
          </ElFormItem>
          <ElFormItem label="最低标签">
            <ElInput v-model="questionForm.rating_min_label" />
          </ElFormItem>
          <ElFormItem label="最高标签">
            <ElInput v-model="questionForm.rating_max_label" />
          </ElFormItem>
        </template>

        <template v-if="questionForm.type === 'single_choice' || questionForm.type === 'multi_choice' || questionForm.type === 'select'">
          <ElFormItem label="最多选择数" v-if="questionForm.type === 'multi_choice'">
            <ElInputNumber v-model="questionForm.max_select_count" :min="1" />
          </ElFormItem>
          <ElFormItem label="选项配置">
            <div class="w-full">
              <div class="mb-2">
                <ElButton size="small" type="primary" plain @click="addQuestionOption">新增选项</ElButton>
              </div>
              <ElTable :data="questionForm.options" border>
                <ElTableColumn type="index" width="60" />
                <ElTableColumn label="文案" min-width="160">
                  <template #default="{ row }">
                    <ElInput v-model="row.label" />
                  </template>
                </ElTableColumn>
                <ElTableColumn label="分值" width="120">
                  <template #default="{ row }">
                    <ElInputNumber v-model="row.score" :min="0" />
                  </template>
                </ElTableColumn>
                <ElTableColumn label="排序" width="120">
                  <template #default="{ row }">
                    <ElInputNumber v-model="row.sort_order" :min="1" />
                  </template>
                </ElTableColumn>
                <ElTableColumn label="操作" width="100">
                  <template #default="{ $index }">
                    <ElButton link type="danger" @click="removeQuestionOption($index)">删除</ElButton>
                  </template>
                </ElTableColumn>
              </ElTable>
            </div>
          </ElFormItem>
        </template>

        <ElFormItem label="显示方式">
          <ElSelect v-model="questionForm.show_condition_mode" style="width: 240px">
            <ElOption label="始终显示" value="always" />
            <ElOption label="按其他题答案控制" value="question" />
          </ElSelect>
        </ElFormItem>
        <template v-if="questionForm.show_condition_mode === 'question'">
          <ElFormItem label="参考题目">
            <ElSelect v-model="questionForm.condition_question_id" filterable clearable style="width: 100%">
              <ElOption v-for="item in questionSourceOptions" :key="item.value" :label="item.label" :value="item.value" />
            </ElSelect>
          </ElFormItem>
          <ElFormItem label="显示条件">
            <ElSelect v-model="questionForm.condition_comparator" style="width: 240px">
              <ElOption v-for="item in conditionComparatorOptions" :key="item.value" :label="item.label" :value="item.value" />
            </ElSelect>
          </ElFormItem>
          <ElFormItem label="对比内容">
            <ElSelect
              v-if="conditionValueOptions.length > 0"
              v-model="questionForm.condition_value"
              clearable
              filterable
              style="width: 100%"
            >
              <ElOption v-for="item in conditionValueOptions" :key="item.value" :label="item.label" :value="item.value" />
            </ElSelect>
            <ElInput v-else v-model="questionForm.condition_value" placeholder="请输入触发条件的内容" />
          </ElFormItem>
        </template>
      </ElForm>
      <template #footer>
        <ElButton @click="questionDialogVisible = false">取消</ElButton>
        <ElButton type="primary" @click="saveQuestion">保存</ElButton>
      </template>
    </ElDialog>
  </div>
</template>

<script setup lang="ts">
  import { computed, onMounted, reactive, ref } from 'vue'
  import { ElMessage, ElMessageBox, type FormInstance, type FormRules } from 'element-plus'
  import CloudImageField from '@/components/business/cloudbase/cloud-image-field.vue'
  import {
    childrenList,
    questionnaireCopy,
    questionnaireCreate,
    questionnaireDelete,
    questionnaireDetail,
    schoolClassesList,
    questionnairesList,
    questionnaireStatusUpdate,
    questionnaireUpdate,
    usersList,
    type QuestionnairePayload,
    type QuestionnaireSection,
    type QuestionnaireQuestion,
    type QuestionnaireQuestionOption,
    type QuestionnaireAssignmentRule
  } from '@/api/vision-admin'

  defineOptions({ name: 'VisionAdminQuestionnaires' })

  const gradeLevelOptions = [
    { label: '一年级', value: 1 },
    { label: '二年级', value: 2 },
    { label: '三年级', value: 3 },
    { label: '四年级', value: 4 },
    { label: '五年级', value: 5 },
    { label: '六年级', value: 6 },
    { label: '七年级', value: 7 },
    { label: '八年级', value: 8 },
    { label: '九年级', value: 9 },
    { label: '十年级', value: 10 },
    { label: '十一年级', value: 11 },
    { label: '十二年级', value: 12 }
  ]

  const scopeTypeOptions = [
    { label: '全部孩子', value: 'all' },
    { label: '按学校派发', value: 'school' },
    { label: '按单个年级派发', value: 'grade' },
    { label: '按年级范围派发', value: 'grade_range' },
    { label: '按班级派发', value: 'class' },
    { label: '指定用户填写', value: 'user' },
    { label: '指定孩子填写', value: 'child' }
  ]

  const questionTypeOptions = [
    { label: '单选题', value: 'single_choice' },
    { label: '多选题', value: 'multi_choice' },
    { label: '单行文本', value: 'text' },
    { label: '多行文本', value: 'textarea' },
    { label: '数字题', value: 'number' },
    { label: '日期题', value: 'date' },
    { label: '评分题', value: 'rating' },
    { label: '档案字段题', value: 'profile_field' }
  ]

  const conditionComparatorOptions = [
    { label: '等于', value: 'eq' },
    { label: '不等于', value: 'neq' },
    { label: '包含', value: 'includes' },
    { label: '不包含', value: 'not_includes' },
    { label: '大于', value: 'gt' },
    { label: '大于等于', value: 'gte' },
    { label: '小于', value: 'lt' },
    { label: '小于等于', value: 'lte' }
  ]

  function createDefaultQuestionnaire(): QuestionnairePayload {
    return {
      title: '',
      description: '',
      cover_image_url: '',
      status: 'draft',
      allow_save_draft: true,
      allow_view_result: false,
      submit_rule_type: 'once',
      max_submit_count: 1,
      cycle_type: 'none',
      cycle_value: 1,
      publish_start_at: '',
      publish_end_at: '',
      welcome_text: '',
      submit_success_text: '',
      schema_version: 1,
      active: true,
      sections: [
        {
          title: '默认分组',
          description: '',
          page_no: 1,
          sort_order: 1,
          questions: []
        }
      ],
      assignment_rules: []
    }
  }

  function createDefaultRule(): QuestionnaireAssignmentRule {
    return {
      rule_name: '',
      scope_type: 'all',
      school: '',
      grade_name: '',
      grade_min: null,
      grade_max: null,
      class_name: '',
      user_id: '',
      child_id: '',
      submit_rule_type: 'inherit',
      max_submit_count: null,
      cycle_type: 'none',
      cycle_value: 1,
      start_at: '',
      end_at: '',
      active: true,
      extra: {}
    }
  }

  function createDefaultQuestion(): any {
    return {
      type: 'single_choice',
      code: '',
      title: '',
      description: '',
      required: true,
      sort_order: 1,
      placeholder: '',
      profile_key: 'name',
      source_mode: 'readonly_profile',
      rating_min: 1,
      rating_max: 5,
      rating_min_label: '低',
      rating_max_label: '高',
      max_select_count: 1,
      max_length: 100,
      min_value: null,
      max_value: null,
      show_condition_mode: 'always',
      condition_question_id: '',
      condition_comparator: 'eq',
      condition_value: '',
      options: [
        { label: '选项1', value: '选项1', score: 0, sort_order: 1 }
      ]
    }
  }

  const loading = ref(false)
  const saving = ref(false)
  const editorVisible = ref(false)
  const editorMode = ref<'add' | 'edit'>('add')
  const editorTab = ref('basic')
  const currentQuestionnaireId = ref('')
  const basicFormRef = ref<FormInstance>()

  const searchForm = reactive({
    q: '',
    status: '',
    active: '' as '' | boolean
  })

  const pagination = reactive({
    page: 1,
    pageSize: 20,
    total: 0
  })

  const tableData = ref<any[]>([])
  const questionnaireForm = ref<QuestionnairePayload>(createDefaultQuestionnaire())

  const basicRules: FormRules = {
    title: [{ required: true, message: '请输入问卷标题', trigger: 'blur' }]
  }

  const sectionDialogVisible = ref(false)
  const sectionDialogIndex = ref(-1)
  const sectionForm = reactive({
    title: '',
    description: '',
    page_no: 1,
    sort_order: 1
  })

  const ruleDialogVisible = ref(false)
  const ruleDialogIndex = ref(-1)
  const ruleForm = reactive<QuestionnaireAssignmentRule>(createDefaultRule())

  const questionDialogVisible = ref(false)
  const questionDialogMode = ref<'add' | 'edit'>('add')
  const questionDialogSectionIndex = ref(-1)
  const questionDialogIndex = ref(-1)
  const questionForm = reactive<any>(createDefaultQuestion())
  const userOptions = ref<any[]>([])
  const childOptions = ref<any[]>([])
  const schoolClassRows = ref<any[]>([])

  const schoolOptions = computed(() =>
    Array.from(
      new Set(
        (schoolClassRows.value || [])
          .map((item) => String(item.school || '').trim())
          .filter(Boolean)
      )
    )
  )

  const ruleGradeOptions = computed(() => {
    const rows = (schoolClassRows.value || []).filter((item) => !ruleForm.school || item.school === ruleForm.school)
    return Array.from(new Set(rows.map((item) => String(item.grade_name || '').trim()).filter(Boolean)))
  })

  const ruleClassOptions = computed(() => {
    return (schoolClassRows.value || [])
      .filter((item) => (!ruleForm.school || item.school === ruleForm.school) && (!ruleForm.grade_name || item.grade_name === ruleForm.grade_name))
      .map((item) => String(item.class_name || '').trim())
      .filter(Boolean)
  })

  const questionSourceOptions = computed(() => {
    const options: Array<{ label: string; value: string; type: string; options: any[] }> = []
    ;(questionnaireForm.value.sections || []).forEach((section: any, sectionIndex: number) => {
      ;(section.questions || []).forEach((question: any, questionIndex: number) => {
        if (sectionIndex === questionDialogSectionIndex.value && questionIndex === questionDialogIndex.value) return
        options.push({
          label: `${section.title} / ${question.title}`,
          value: String(question.id || question.code || `${sectionIndex}_${questionIndex}`),
          type: question.type || '',
          options: Array.isArray(question.options) ? question.options : []
        })
      })
    })
    return options
  })

  const selectedConditionQuestion = computed(() => {
    return questionSourceOptions.value.find((item) => item.value === questionForm.condition_question_id) || null
  })

  const conditionValueOptions = computed(() => {
    const question = selectedConditionQuestion.value
    if (!question) return []
    return (question.options || []).map((option: any) => ({
      label: option.label,
      value: option.value || option.label
    }))
  })

  function resetSearch() {
    searchForm.q = ''
    searchForm.status = ''
    searchForm.active = ''
    pagination.page = 1
    fetchList()
  }

  async function fetchList() {
    loading.value = true
    try {
      const data = await questionnairesList({
        current: pagination.page,
        size: pagination.pageSize,
        q: searchForm.q || undefined,
        status: searchForm.status || undefined,
        active: searchForm.active === '' ? undefined : searchForm.active
      })
      tableData.value = Array.isArray((data as any).list) ? (data as any).list : []
      pagination.total = Number((data as any).total || 0)
      pagination.page = Number((data as any).page || pagination.page)
      pagination.pageSize = Number((data as any).page_size || pagination.pageSize)
    } finally {
      loading.value = false
    }
  }

  async function fetchSupportOptions() {
    const [userData, childData, schoolClassData] = await Promise.all([
      usersList({ current: 1, size: 200 }),
      childrenList({ current: 1, size: 200 }),
      schoolClassesList({ current: 1, size: 500 })
    ])

    userOptions.value = Array.isArray((userData as any).list)
      ? (userData as any).list.map((item: any) => ({
          label: `${item.display_name || '未命名用户'} / ${item.phone || ''} / ${item.user_no || ''}`,
          value: String(item._id)
        }))
      : []

    childOptions.value = Array.isArray((childData as any).list)
      ? (childData as any).list.map((item: any) => ({
          label: `${item.name || '未命名孩子'} / ${item.school || ''} / ${item.grade_name || ''} / ${item.class_name || ''}`,
          value: String(item._id)
        }))
      : []

    schoolClassRows.value = Array.isArray((schoolClassData as any).list) ? (schoolClassData as any).list : []
  }

  function getScopeLabel(scopeType: string) {
    const item = scopeTypeOptions.find((option) => option.value === scopeType)
    return item ? item.label : scopeType
  }

  function getUserLabel(userId?: string) {
    const hit = userOptions.value.find((item) => String(item.value) === String(userId || ''))
    return hit ? hit.label : (userId || '')
  }

  function getChildLabel(childId?: string) {
    const hit = childOptions.value.find((item) => String(item.value) === String(childId || ''))
    return hit ? hit.label : (childId || '')
  }

  function getGradeLabel(level?: number | null) {
    const item = gradeLevelOptions.find((option) => option.value === Number(level))
    return item ? item.label : ''
  }

  function buildGradeRangeLabel(min?: number | null, max?: number | null) {
    const start = getGradeLabel(min)
    const end = getGradeLabel(max)
    if (start && end) return `${start} 到 ${end}`
    return start || end || ''
  }

  function normalizeRulePayload(rawRule: QuestionnaireAssignmentRule) {
    const next = JSON.parse(JSON.stringify(rawRule || createDefaultRule()))
    if (next.scope_type !== 'school' && next.scope_type !== 'grade' && next.scope_type !== 'grade_range' && next.scope_type !== 'class') {
      next.school = ''
    }
    if (next.scope_type !== 'grade') {
      if (next.scope_type !== 'grade_range') next.grade_name = ''
    }
    if (next.scope_type !== 'grade_range') {
      next.grade_min = null
      next.grade_max = null
    }
    if (next.scope_type === 'grade_range') {
      next.grade_name = buildGradeRangeLabel(next.grade_min, next.grade_max)
    }
    if (next.scope_type !== 'class') next.class_name = ''
    if (next.scope_type !== 'user') next.user_id = ''
    if (next.scope_type !== 'child') next.child_id = ''
    if (next.submit_rule_type !== 'limited') next.max_submit_count = null
    if (next.cycle_type === 'none') next.cycle_value = 1
    return next
  }

  function autoGenerateQuestionCode(title: string, fallbackIndex = 1) {
    const safe = String(title || '')
      .trim()
      .replace(/[^\w\u4e00-\u9fa5]+/g, '_')
      .replace(/^_+|_+$/g, '')
      .slice(0, 24)
    return safe ? `question_${safe}` : `question_${Date.now()}_${fallbackIndex}`
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

  function getSubmitRuleText(row: any) {
    if (row.submit_rule_type === 'unlimited') return '不限次数'
    if (row.submit_rule_type === 'once') return '1 次'
    const count = row.max_submit_count || 1
    if (row.cycle_type === 'term') return `每学期 ${count} 次`
    if (row.cycle_type === 'month') return `每月 ${count} 次`
    if (row.cycle_type === 'week') return `每周 ${count} 次`
    if (row.cycle_type === 'day') return `每日 ${count} 次`
    return `${count} 次`
  }

  function formatRuleSubmitText(rule: any) {
    if (rule.submit_rule_type === 'inherit') return '继承问卷默认'
    if (rule.submit_rule_type === 'unlimited') return '不限次数'
    if (rule.submit_rule_type === 'once') return '仅 1 次'
    const count = rule.max_submit_count || 1
    if (rule.cycle_type === 'term') return `每学期 ${count} 次`
    if (rule.cycle_type === 'month') return `每月 ${count} 次`
    if (rule.cycle_type === 'week') return `每周 ${count} 次`
    if (rule.cycle_type === 'day') return `每日 ${count} 次`
    return `最多 ${count} 次`
  }

  function openCreate() {
    currentQuestionnaireId.value = ''
    editorMode.value = 'add'
    editorTab.value = 'basic'
    questionnaireForm.value = createDefaultQuestionnaire()
    editorVisible.value = true
  }

  async function openEdit(row: any) {
    const detail = await questionnaireDetail({ questionnaire_id: row._id })
    currentQuestionnaireId.value = row._id
    editorMode.value = 'edit'
    editorTab.value = 'basic'
    questionnaireForm.value = {
      ...(detail as any).questionnaire,
      sections: Array.isArray((detail as any).sections) ? (detail as any).sections : [],
      assignment_rules: Array.isArray((detail as any).assignment_rules) ? (detail as any).assignment_rules : []
    }
    editorVisible.value = true
  }

  async function handleDelete(row: any) {
    await ElMessageBox.confirm('确定删除该问卷吗？若已有填写记录将不允许删除。', '删除问卷', {
      type: 'warning'
    })
    await questionnaireDelete({ questionnaire_id: row._id })
    ElMessage.success('已删除')
    fetchList()
  }

  async function handleCopy(row: any) {
    await questionnaireCopy({ questionnaire_id: row._id })
    ElMessage.success('复制成功')
    fetchList()
  }

  async function togglePublish(row: any) {
    const nextStatus = row.status === 'published' ? 'draft' : 'published'
    await questionnaireStatusUpdate({
      questionnaire_id: row._id,
      status: nextStatus,
      active: row.active
    })
    ElMessage.success('状态已更新')
    fetchList()
  }

  async function toggleActive(row: any) {
    await questionnaireStatusUpdate({
      questionnaire_id: row._id,
      status: row.status,
      active: !row.active
    })
    ElMessage.success('启用状态已更新')
    fetchList()
  }

  function openSectionDialog(index = -1) {
    sectionDialogIndex.value = index
    if (index >= 0) {
      const section = (questionnaireForm.value.sections || [])[index] || {}
      sectionForm.title = section.title || ''
      sectionForm.description = section.description || ''
      sectionForm.page_no = Number(section.page_no || 1)
      sectionForm.sort_order = Number(section.sort_order || index + 1)
    } else {
      sectionForm.title = ''
      sectionForm.description = ''
      sectionForm.page_no = 1
      sectionForm.sort_order = (questionnaireForm.value.sections || []).length + 1
    }
    sectionDialogVisible.value = true
  }

  function saveSection() {
    if (!sectionForm.title.trim()) {
      ElMessage.warning('请输入分组标题')
      return
    }
    const sections = Array.isArray(questionnaireForm.value.sections) ? [...questionnaireForm.value.sections] : []
    const nextSection: QuestionnaireSection = {
      title: sectionForm.title.trim(),
      description: sectionForm.description.trim(),
      page_no: Number(sectionForm.page_no || 1),
      sort_order: Number(sectionForm.sort_order || 1),
      questions: sectionDialogIndex.value >= 0 ? sections[sectionDialogIndex.value].questions || [] : []
    }
    if (sectionDialogIndex.value >= 0) sections[sectionDialogIndex.value] = nextSection
    else sections.push(nextSection)
    questionnaireForm.value.sections = sections
    sectionDialogVisible.value = false
  }

  function removeSection(index: number) {
    const sections = Array.isArray(questionnaireForm.value.sections) ? [...questionnaireForm.value.sections] : []
    sections.splice(index, 1)
    questionnaireForm.value.sections = sections
  }

  function openRuleDialog(index = -1) {
    ruleDialogIndex.value = index
    const source =
      index >= 0
        ? (Array.isArray(questionnaireForm.value.assignment_rules) ? questionnaireForm.value.assignment_rules[index] : createDefaultRule())
        : createDefaultRule()
    Object.assign(ruleForm, createDefaultRule(), normalizeRulePayload(source))
    ruleDialogVisible.value = true
  }

  function saveRule() {
    if (!ruleForm.rule_name || !String(ruleForm.rule_name).trim()) {
      ElMessage.warning('请输入规则名称')
      return
    }
    const rules = Array.isArray(questionnaireForm.value.assignment_rules) ? [...questionnaireForm.value.assignment_rules] : []
    const nextRule = normalizeRulePayload(ruleForm)
    if (ruleDialogIndex.value >= 0) rules[ruleDialogIndex.value] = nextRule
    else rules.push(nextRule)
    questionnaireForm.value.assignment_rules = rules
    ruleDialogVisible.value = false
  }

  function removeRule(index: number) {
    const rules = Array.isArray(questionnaireForm.value.assignment_rules) ? [...questionnaireForm.value.assignment_rules] : []
    rules.splice(index, 1)
    questionnaireForm.value.assignment_rules = rules
  }

  function resetQuestionForm() {
    Object.assign(questionForm, createDefaultQuestion())
  }

  function applyQuestionToForm(question: any) {
    resetQuestionForm()
    questionForm.type = question.type || 'single_choice'
    questionForm.code = question.code || ''
    questionForm.title = question.title || ''
    questionForm.description = question.description || ''
    questionForm.required = !!question.required
    questionForm.sort_order = Number(question.sort_order || 1)
    questionForm.placeholder = question.placeholder || ''
    questionForm.options = Array.isArray(question.options) ? JSON.parse(JSON.stringify(question.options)) : []

    const settings = question.settings || {}
    const validation = question.validation || {}
    const visibilityRule = question.visibility_rule || {}
    const firstCondition = Array.isArray(visibilityRule.conditions) && visibilityRule.conditions.length > 0 ? visibilityRule.conditions[0] : null

    questionForm.profile_key = settings.profile_key || 'name'
    questionForm.source_mode = settings.source_mode || 'readonly_profile'
    questionForm.rating_min = Number(settings.min || 1)
    questionForm.rating_max = Number(settings.max || 5)
    questionForm.rating_min_label = settings.min_label || '低'
    questionForm.rating_max_label = settings.max_label || '高'
    questionForm.max_select_count = Number(settings.max_select_count || 1)
    questionForm.max_length = Number(validation.max_length || settings.max_length || (question.type === 'textarea' ? 500 : 100))
    questionForm.min_value = validation.min ?? null
    questionForm.max_value = validation.max ?? null
    questionForm.show_condition_mode = firstCondition ? 'question' : 'always'
    questionForm.condition_question_id = firstCondition ? String(firstCondition.question_id || firstCondition.question_code || '') : ''
    questionForm.condition_comparator = firstCondition ? firstCondition.comparator || 'eq' : 'eq'
    questionForm.condition_value = firstCondition ? firstCondition.value ?? '' : ''
  }

  function openQuestionDialog(sectionIndex: number, questionIndex = -1) {
    questionDialogSectionIndex.value = sectionIndex
    questionDialogIndex.value = questionIndex
    questionDialogMode.value = questionIndex >= 0 ? 'edit' : 'add'
    if (questionIndex >= 0) {
      const question = ((questionnaireForm.value.sections || [])[sectionIndex] || { questions: [] }).questions?.[questionIndex]
      applyQuestionToForm(question || {})
    } else {
      resetQuestionForm()
      questionForm.sort_order = ((((questionnaireForm.value.sections || [])[sectionIndex] || { questions: [] }).questions || []).length || 0) + 1
    }
    questionDialogVisible.value = true
  }

  function addQuestionOption() {
    questionForm.options.push({
      label: `选项${questionForm.options.length + 1}`,
      value: `选项${questionForm.options.length + 1}`,
      score: 0,
      sort_order: questionForm.options.length + 1
    })
  }

  function removeQuestionOption(index: number) {
    questionForm.options.splice(index, 1)
  }

  function buildQuestionPayload() {
    const settings: Record<string, unknown> = {}
    const validation: Record<string, unknown> = {}
    const visibilityRule: Record<string, unknown> = {}

    if (questionForm.type === 'profile_field') {
      settings.profile_key = questionForm.profile_key
      settings.source_mode = questionForm.source_mode
      settings.input_type = 'text'
    }
    if (questionForm.type === 'rating') {
      settings.min = Number(questionForm.rating_min || 1)
      settings.max = Number(questionForm.rating_max || 5)
      settings.min_label = questionForm.rating_min_label || '低'
      settings.max_label = questionForm.rating_max_label || '高'
    }
    if (questionForm.type === 'multi_choice') {
      settings.max_select_count = Number(questionForm.max_select_count || 1)
    }
    if (questionForm.type === 'textarea') {
      settings.placeholder = questionForm.placeholder || ''
      settings.max_length = Number(questionForm.max_length || 500)
      settings.rows = 4
    }
    if (questionForm.type === 'single_choice' || questionForm.type === 'multi_choice' || questionForm.type === 'select') {
      settings.option_layout = 'vertical'
    }
    if (['text', 'textarea', 'profile_field'].includes(questionForm.type) && questionForm.max_length) {
      validation.max_length = Number(questionForm.max_length)
    }
    if (questionForm.type === 'number') {
      if (questionForm.min_value !== null && questionForm.min_value !== '') validation.min = Number(questionForm.min_value)
      if (questionForm.max_value !== null && questionForm.max_value !== '') validation.max = Number(questionForm.max_value)
    }
    if (questionForm.show_condition_mode === 'question' && questionForm.condition_question_id) {
      const triggerQuestion = questionSourceOptions.value.find((item) => item.value === questionForm.condition_question_id)
      if (triggerQuestion) {
        visibilityRule.operator = 'and'
        visibilityRule.conditions = [
          {
            source_type: 'question',
            question_id: questionForm.condition_question_id,
            question_code: '',
            comparator: questionForm.condition_comparator || 'eq',
            value: questionForm.condition_value
          }
        ]
      }
    }

    return {
      type: questionForm.type,
      code: questionForm.code || autoGenerateQuestionCode(questionForm.title, Number(questionForm.sort_order || 1)),
      title: questionForm.title,
      description: questionForm.description,
      required: questionForm.required,
      sort_order: Number(questionForm.sort_order || 1),
      placeholder: questionForm.placeholder,
      settings,
      validation,
      visibility_rule: visibilityRule,
      options:
        questionForm.type === 'single_choice' || questionForm.type === 'multi_choice' || questionForm.type === 'select'
          ? questionForm.options.map((option: QuestionnaireQuestionOption, index: number) => ({
              label: option.label,
              value: option.label || option.value || `选项${index + 1}`,
              score: option.score == null ? null : Number(option.score),
              sort_order: Number(option.sort_order || index + 1),
              extra: option.extra || {}
            }))
          : []
    }
  }

  function saveQuestion() {
    if (!questionForm.title.trim()) {
      ElMessage.warning('请输入题目标题')
      return
    }
    if (questionForm.show_condition_mode === 'question' && !questionForm.condition_question_id) {
      ElMessage.warning('请选择控制显示的参考题目')
      return
    }
    const questionPayload = buildQuestionPayload()
    const sections = Array.isArray(questionnaireForm.value.sections) ? [...questionnaireForm.value.sections] : []
    const currentSection = sections[questionDialogSectionIndex.value]
    if (!currentSection) return
    const questions = Array.isArray(currentSection.questions) ? [...currentSection.questions] : []
    if (questionDialogIndex.value >= 0) questions[questionDialogIndex.value] = questionPayload
    else questions.push(questionPayload as QuestionnaireQuestion)
    currentSection.questions = questions
    sections[questionDialogSectionIndex.value] = currentSection
    questionnaireForm.value.sections = sections
    questionDialogVisible.value = false
  }

  function copyQuestion(sectionIndex: number, questionIndex: number) {
    const sections = Array.isArray(questionnaireForm.value.sections) ? [...questionnaireForm.value.sections] : []
    const currentSection = sections[sectionIndex]
    if (!currentSection) return
    const questions = Array.isArray(currentSection.questions) ? [...currentSection.questions] : []
    const source = questions[questionIndex]
    if (!source) return
    const copied = JSON.parse(JSON.stringify(source))
    copied.title = `${copied.title} - 副本`
    copied.code = copied.code ? `${copied.code}_copy` : ''
    copied.sort_order = Number(copied.sort_order || questions.length + 1) + 1
    questions.splice(questionIndex + 1, 0, copied)
    currentSection.questions = questions
    sections[sectionIndex] = currentSection
    questionnaireForm.value.sections = sections
  }

  function removeQuestion(sectionIndex: number, questionIndex: number) {
    const sections = Array.isArray(questionnaireForm.value.sections) ? [...questionnaireForm.value.sections] : []
    const currentSection = sections[sectionIndex]
    if (!currentSection) return
    const questions = Array.isArray(currentSection.questions) ? [...currentSection.questions] : []
    questions.splice(questionIndex, 1)
    currentSection.questions = questions
    sections[sectionIndex] = currentSection
    questionnaireForm.value.sections = sections
  }

  async function saveQuestionnaire() {
    if (!basicFormRef.value) return
    await basicFormRef.value.validate()
    if (!Array.isArray(questionnaireForm.value.sections) || questionnaireForm.value.sections.length === 0) {
      ElMessage.warning('请至少配置一个分组')
      return
    }
    const totalQuestions = questionnaireForm.value.sections.reduce(
      (sum, section) => sum + (Array.isArray(section.questions) ? section.questions.length : 0),
      0
    )
    if (totalQuestions === 0) {
      ElMessage.warning('请至少配置一道题目')
      return
    }

    saving.value = true
    try {
      if (editorMode.value === 'add') {
        await questionnaireCreate(questionnaireForm.value)
        ElMessage.success('问卷创建成功')
      } else {
        await questionnaireUpdate({
          questionnaire_id: currentQuestionnaireId.value,
          payload: questionnaireForm.value
        })
        ElMessage.success('问卷保存成功')
      }
      editorVisible.value = false
      fetchList()
    } finally {
      saving.value = false
    }
  }

  onMounted(() => {
    fetchSupportOptions()
    fetchList()
  })
</script>

<style scoped>
  .editor-body {
    padding-right: 8px;
  }

  .section-list :deep(.el-card__header) {
    padding: 14px 18px;
  }
</style>
