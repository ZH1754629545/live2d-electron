<script setup lang="ts">
import { ref, onMounted, computed } from 'vue';
import { useQuasar } from 'quasar';
const props = defineProps({
  todo: {
    type: Object,
    required: true
  }
});

const emit = defineEmits(['close', 'update', 'delete']);

const editedTodo = ref({...props.todo});
onMounted(() => {
  editedTodo.value = {...props.todo};
  if(editedTodo.value.startTime==null||editedTodo.value.startTime==""){
    const currentDate = new Date();
    // 使用ISO格式的日期时间字符串，确保与q-date和q-time兼容
    editedTodo.value.startTime = formatDateTime(currentDate);
  } else {
    // 确保现有的startTime格式正确
    try {
      const dateStart = new Date(editedTodo.value.startTime);
      editedTodo.value.startTime = formatDateTime(dateStart);
    } catch (e) {
      console.error('起始日期格式转换错误', e);
    }
  }
  if(editedTodo.value.dueTime==null||editedTodo.value.dueTime==""){
    const currentDate = new Date();
    currentDate.setDate(currentDate.getDate() + 1); // 假设默认截止日期为明天，你可以根据需要进行调整
    console.log(currentDate);
    // 使用ISO格式的日期时间字符串，确保与q-date和q-time兼容
    editedTodo.value.dueTime = formatDateTime(currentDate);
  } else {
    // 确保现有的startTime格式正确
    try {
      const dateStart = new Date(editedTodo.value.dueTime);
      editedTodo.value.dueTime = formatDateTime(dateStart);
    } catch (e) {
      console.error('截止日期格式转换错误', e);
    }
  }
});

// 格式化日期时间为YYYY-MM-DD HH:mm格式
function formatDateTime(date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  const hours = String(date.getHours()).padStart(2, '0');
  const minutes = String(date.getMinutes()).padStart(2, '0');
  
  return `${year}-${month}-${day} ${hours}:${minutes}`;
}
const showDeleteConfirm = ref(false);
const showDialog = ref(true); // 添加对话框控制变量
const q = useQuasar();
// 保存修改
const saveTodo = () => {
  console.log(editedTodo.value);
  if(editedTodo.value.title==null||editedTodo.value.title==""){
    q.notify({
      message: '标题不能为空',
      color: 'red',
      icon: 'warning',
      position: 'top',
      timeout: 1000,
    });
    return;
  }
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
            :rules="[val =>val.length>0||'标题不能为空']"

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
            v-model="editedTodo.startTime" 
            label="开始时间" 
            outlined 
            :disable="editedTodo.completed"
          >
            <template v-slot:prepend>
              <q-icon name="event" class="cursor-pointer">
                <q-popup-proxy cover transition-show="scale" transition-hide="scale">
                  <q-date v-model="editedTodo.startTime" mask="YYYY-MM-DD HH:mm" today-btn>
                    <div class="row items-center justify-end">
                      <q-btn v-close-popup label="关闭" color="primary" flat />
                    </div>
                  </q-date>
                </q-popup-proxy>
              </q-icon>
            </template>
            <template v-slot:append>
              <q-icon name="access_time" class="cursor-pointer">
                <q-popup-proxy cover transition-show="scale" transition-hide="scale">
                  <q-time v-model="editedTodo.startTime" mask="YYYY-MM-DD HH:mm" format24h>
                    <div class="row items-center justify-end">
                      <q-btn v-close-popup label="关闭" color="primary" flat />
                    </div>
                  </q-time>
                </q-popup-proxy>
              </q-icon>
            </template>
          </q-input>
        </div>
        
        <div class="q-mb-md">
          <q-input 
            v-model="editedTodo.dueTime" 
            label="截止日期" 
            outlined 
            :disable="editedTodo.completed"
          >
            <template v-slot:prepend>
              <q-icon name="event" class="cursor-pointer">
                <q-popup-proxy cover transition-show="scale" transition-hide="scale">
                  <q-date v-model="editedTodo.dueTime" mask="YYYY-MM-DD HH:mm" today-btn>
                    <div class="row items-center justify-end">
                      <q-btn v-close-popup label="关闭" color="primary" flat />
                    </div>
                  </q-date>
                </q-popup-proxy>
              </q-icon>
            </template>
            <template v-slot:append>
              <q-icon name="access_time" class="cursor-pointer">
                <q-popup-proxy cover transition-show="scale" transition-hide="scale">
                  <q-time v-model="editedTodo.dueTime" mask="YYYY-MM-DD HH:mm" format24h>
                    <div class="row items-center justify-end">
                      <q-btn v-close-popup label="关闭" color="primary" flat />
                    </div>
                  </q-time>
                </q-popup-proxy>
              </q-icon>
            </template>
          </q-input>
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
<style scoped>
::-webkit-scrollbar{
  display: none;
}
</style>