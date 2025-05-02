<script setup lang="ts">
import { computed, ref, onMounted,onBeforeUnmount } from 'vue';

const props = defineProps({
  todos: {
    type: Array,
    required: true
  }
});

const emit = defineEmits(['complete', 'delete', 'open-detail']);

// 格式化时间
const changeHHMMToDate = (time:string)=>{
  if(time.length>10) return time;
  const [hour, minute] = time.split(':');
  const date = new Date();
  date.setHours(parseInt(hour, 10));
  date.setMinutes(parseInt(minute, 10));
  return date.toLocaleString();
} 
// 分离已完成和未完成的待办事项，同时检查是否过期
const forceUpdate = ref(0);
const incompleteTodos = computed(() => {
  forceUpdate.value;
  const now = new Date();
  return props.todos.filter(todo => {
    if (!todo.completed) {
      // 检查是否过期
      if (todo.dueTime && new Date(changeHHMMToDate(todo.dueTime)) < now) {

        // 如果过期，自动标记为完成
        completeTodo(todo);

        return false; // 不显示在未完成列表中
      }
      return true;
    }
    return false;
  });
});

const completedTodos = computed(() => {
  return props.todos.filter(todo => todo.completed);
});

// 控制折叠状态
const showIncomplete = ref(true);
const showCompleted = ref(false);

// 完成待办事项
const completeTodo = (todo) => {
  emit('complete', todo);
};

// 删除待办事项
const deleteTodo = (todo) => {
  emit('delete', todo);
};

// 打开详情
const openDetail = (todo) => {
  emit('open-detail', todo);
};

// 切换显示状态
const toggleIncomplete = () => {
  showIncomplete.value = !showIncomplete.value;
};

const toggleCompleted = () => {
  showCompleted.value = !showCompleted.value;
};

const dataShow=(data)=>{
  if(data.isDaily) return '每日任务' +data.startTime;
  const startTime = new Date(data.startTime);
  const today = new Date();
  if(startTime.toLocaleDateString()===today.toLocaleDateString()){
    return '今天' + startTime.toLocaleTimeString().slice(0,5);
  }
  today.setDate(today.getDate() +1);
  if(startTime.toLocaleDateString()===today.toLocaleDateString()){
    return '明天' + startTime.toLocaleTimeString().slice(0,5);
  }
  today.setDate(today.getDate() +1);
  if(startTime.toLocaleDateString()===today.toLocaleDateString()){
    return '后天' + startTime.toLocaleTimeString().slice(0,5); 
  }
  return startTime.toLocaleDateString();
}

// 新增：根据距离截止时间动态设置背景色
const getTodoBgColor = (todo) => {
  // 只对未完成事项高亮
  if (todo.completed) return {};
  let due = todo.dueTime;
  // 支持每日任务的HH:mm格式
  if (due && due.length <= 5) {
    const [hour, minute] = due.split(':');
    const now = new Date();
    due = new Date();
    due.setHours(parseInt(hour, 10), parseInt(minute, 10), 0, 0);
    if (due < now) due.setDate(due.getDate() + 1); // 如果已过，算明天
  } else {
    due = new Date(due);
  }
  const now = new Date();
  const diffMs = due - now;
  const diffH = diffMs / (1000 * 60 * 60);

  // 距离越近颜色越深
  if (diffH <= 1) {
    return { background: '#ff5252', color: '#fff' }; // 1小时内，红色
  } else if (diffH <= 6) {
    return { background: '#ff9800', color: '#fff' }; // 6小时内，橙色
  } else if (diffH <= 24) {
    return { background: '#ffd54f', color: '#333' }; // 24小时内，黄色
  } else {
    return { background: '#68ed9b', color: '#333' }; // 默认
  }
}
// 定时检查过期的待办事项
let checkInterval;

onMounted(() => {
  // 每分钟检查一次是否有过期的待办事项
  checkInterval = setInterval(() => {
    // 触发computed重新计算
    forceUpdate.value++;
  }, 60000);
});

// 组件卸载时清除定时器
onBeforeUnmount (() => {
  if (checkInterval) {
    clearInterval(checkInterval);
  }
});
</script>

<template>
  <div class="todo-list">
    <div class="todo-section">
        
      <div class="section-header">
        <div class="section-title">
            <q-btn flat class="show-bnt" :label="('未完成 '+ incompleteTodos.length)" :icon="(showIncomplete?'expand_more' : 'chevron_right')" @click="toggleIncomplete"/>
        </div>
      </div>
      
      <div v-if="showIncomplete">
        <div v-if="incompleteTodos.length === 0" class="empty-message">
          没有未完成的待办事项
        </div>
        <div v-else class="todo-items">
          <div 
            v-for="todo in incompleteTodos" 
            :key="todo.id" 
            class="todo-item"
            :style="getTodoBgColor(todo)"
            @click="openDetail(todo)"
          >
            <div class="todo-content">
              <div class="todo-title">{{ todo.title }}</div>
              <div class="todo-info">
                <span class="todo-date">{{ dataShow(todo) }}</span>
                <span class="todo-importance">重要度: {{ todo.importance }}</span>
              </div>
            </div>
            <div class="todo-actions" @click.stop>
              <q-checkbox 
                v-model="todo.completed" 
                @update:model-value="completeTodo(todo)" 
                color="primary"
              />
            </div>
          </div>
        </div>
      </div>
    </div>
    
    <div class="todo-section">
        <div class="section-header">
        <div class="section-title">
            <q-btn flat class="show-bnt" :label="('已完成 '+ completedTodos.length)" :icon="(showCompleted?'expand_more' : 'chevron_right')" @click="toggleCompleted"/>
        </div>
      </div>
    
      <div v-if="showCompleted">
        <div v-if="completedTodos.length === 0" class="empty-message">
          没有已完成的待办事项
        </div>
        <div v-else class="todo-items">
          <div 
            v-for="todo in completedTodos" 
            :key="todo.id" 
            class="todo-item completed"
            @click="openDetail(todo)"
          >
            <div class="todo-actions" @click.stop>
              <q-btn 
                icon="delete" 
                flat 
                round 
                size="sm" 
                color="grey" 
                @click="deleteTodo(todo)" 
              />
            </div>
            <div class="todo-content">
              <div class="todo-title">{{ todo.title }}</div>
              <div class="todo-info">
                <span class="todo-date">{{ dataShow(todo) }}</span>
                <span class="todo-importance">重要度: {{ todo.importance }}</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.todo-list {
  display: flex;
  flex-direction: column;
  gap: 20px;
}

.todo-section {
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.section-header {
  cursor: pointer;
  border-radius: 8px;
}

.section-title {
  display: flex;
  align-items: center;
  width: 100%;
}

.section-title h4 {
  margin: 0 0 0 8px;
}

.todo-items {
  display: flex;
  flex-direction: column;
  gap: 8px;
  margin-left: 10px;
}

.todo-item {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 10px;
  border-radius: 8px;
  background-color: #f5f5f5;
  cursor: pointer;
  transition: all 0.2s;
}

.todo-item:hover {
  background-color: #e0e0e0;
}

.todo-item.completed {
  background-color: #e0e0e0;
  color: #757575;
  text-decoration: line-through;
}

.todo-content {
  flex: 1;
}

.todo-title {
  font-weight: bold;
  margin-bottom: 5px;
}

.todo-info {
  display: flex;
  justify-content: space-between;
  font-size: 0.8rem;
  color: #757575;
}

.todo-actions {
  margin-left: 10px;
}

.empty-message {
  color: #757575;
  font-style: italic;
  text-align: center;
  padding: 10px;
  margin-left: 10px;
}
.show-btn{
  width: 100%;
}
</style>