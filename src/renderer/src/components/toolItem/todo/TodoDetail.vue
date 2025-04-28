<script setup lang="ts">
import { ref, onMounted } from 'vue';

const props = defineProps({
  todo: {
    type: Object,
    required: true
  }
});

const emit = defineEmits(['close', 'update', 'delete']);

const editedTodo = ref({...props.todo});
const showDeleteConfirm = ref(false);
const showDialog = ref(true); // 添加对话框控制变量

// 保存修改
const saveTodo = () => {
  emit('update', {...editedTodo.value});
};

// 删除待办事项
const deleteTodo = () => {
  emit('delete', props.todo);
  emit('close');
};

// 关闭详情
const closeDetail = () => {
  showDialog.value = false; // 设置为false以关闭对话框
  emit('close');
};

// 确认删除
const confirmDelete = () => {
  showDeleteConfirm.value = true;
};

// 取消删除
const cancelDelete = () => {
  showDeleteConfirm.value = false;
};
</script>

<template>
  <q-dialog v-model="showDialog" persistent>
    <q-card style="min-width: 350px">
      <q-card-section class="row items-center">
        <div class="text-h6">待办详情</div>
        <q-space />
        <q-btn icon="close" flat round dense @click="closeDetail" />
      </q-card-section>

      <q-card-section>
        <div class="q-mb-md">
          <q-input 
            v-model="editedTodo.title" 
            label="标题" 
            outlined 
            :disable="editedTodo.completed"
          />
        </div>
        
        <div class="q-mb-md">
          <q-input 
            v-model="editedTodo.content" 
            label="内容" 
            type="textarea" 
            outlined 
            :disable="editedTodo.completed"
          />
        </div>
        
        <div class="q-mb-md">
          <q-input 
            v-model="editedTodo.dueTime" 
            label="截止日期" 
            type="date" 
            outlined 
            :disable="editedTodo.completed"
          />
        </div>
        
        <div class="q-mb-md">
          <div class="row items-center">
            <div class="col-4">重要度:</div>
            <div class="col-8">
              <q-slider 
                v-model="editedTodo.importance" 
                :min="1" 
                :max="5" 
                :step="1" 
                label 
                :disable="editedTodo.completed"
              />
            </div>
          </div>
        </div>
        
        <div class="q-mb-md">
          <q-checkbox 
            v-model="editedTodo.completed" 
            label="已完成" 
            disable 
          />
        </div>
        
        <div class="q-mb-md">
          <div>创建时间: {{ new Date(editedTodo.createTime).toLocaleString() }}</div>
        </div>
      </q-card-section>

      <q-card-actions align="right">
        <q-btn label="删除" color="negative" flat @click="confirmDelete" />
        <q-btn label="保存" color="primary" @click="saveTodo" />
      </q-card-actions>
    </q-card>
  </q-dialog>
  
  <!-- 删除确认对话框 -->
  <q-dialog v-model="showDeleteConfirm">
    <q-card>
      <q-card-section class="row items-center">
        <div class="text-h6">确认删除</div>
      </q-card-section>

      <q-card-section>
        确定要删除这个待办事项吗？此操作不可撤销。
      </q-card-section>

      <q-card-actions align="right">
        <q-btn flat label="取消" color="primary" @click="cancelDelete" />
        <q-btn flat label="删除" color="negative" @click="deleteTodo" />
      </q-card-actions>
    </q-card>
  </q-dialog>
</template>