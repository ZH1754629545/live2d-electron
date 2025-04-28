<script setup lang="ts">
import { ref, onMounted,computed } from 'vue';
import TodoList from './todo/TodoList.vue';
import TodoDetail from './todo/TodoDetail.vue';
import TodoSettings from './todo/TodoSettings.vue';

const emit = defineEmits(['close']);
const showDetail = ref(false);
const showSettings = ref(false);
const currentTodo = ref(null);
const todos = ref([]);
const filter = ref({
  dates: [],
  importance: 0
});
const sort = ref('createTime'); // 默认按创建时间排序

// 获取待办事项
const loadTodos = async () => {
  try {
    const todoData = await window.electron.ipcRenderer.invoke('get-todos');
    if(todoData)
    {
        // 新格式，包含待办事项和设置
        todos.value = todoData.todoItems || [];
        if (todoData.settings) {
          filter.value = todoData.settings.filter || filter.value;
          sort.value = todoData.settings.sort || sort.value;
        }
    }else{
      todos.value = [];
    }
    // todos.value = todoData || [];
  } catch (error) {
    console.error('获取待办事项失败:', error);
  }
};

// 保存待办事项
const saveTodos = async () => {
  try {
        // 创建包含待办事项和设置的数据结构
      const todoData = {
      todoItems: JSON.parse(JSON.stringify(todos.value)),
      settings: {
        filter: filter.value,
        sort: sort.value
      }
    };
    await window.electron.ipcRenderer.invoke('save-todos', JSON.parse(JSON.stringify(todoData)));
  } catch (error) {
    console.error('保存待办事项失败:', error);
  }
};

// 添加待办事项
const addTodo = () => {
  const newTodo = {
    id: Date.now(),
    title: '',
    content: '',
    completed: false,
    startTime:'',
    dueTime: '',
    createTime: new Date().toLocaleString(),
    importance: 1
  };
  
  // 先打开详情编辑，不立即添加到列表
  currentTodo.value = newTodo;
  showDetail.value = true;
};



// 完成待办事项
const completeTodo = (todo) => {
  const index = todos.value.findIndex(t => t.id === todo.id);
  if (index !== -1) {
    todos.value[index].completed = true;
    saveTodos();
  }
};

// 删除待办事项
const deleteTodo = (todo) => {
  const index = todos.value.findIndex(t => t.id === todo.id);
  if (index !== -1) {
    todos.value.splice(index, 1);
    saveTodos();
  }
};

// 更新待办事项
const updateTodo = (newTodo) => {
  const index = todos.value.findIndex(t => t.id === newTodo.id);
  if (index !== -1) {
    // 更新已有的待办事项
    todos.value[index] = newTodo;
  } else {
    // 添加新的待办事项
    todos.value.push(newTodo);
  }
  saveTodos();
  showDetail.value = false;
};

// 打开详情
const openDetail = (todo) => {
  currentTodo.value = todo;
  showDetail.value = true;
};

// 打开设置
const openSettings = () => {
  showSettings.value = true;
};

// 应用筛选和排序
const applySettings = (newFilter, newSort) => {
  filter.value = newFilter;
  sort.value = newSort;
  showSettings.value = false;
  saveTodos();
};

// 关闭对话框
const closeDialog = () => {
  emit('close');
};

// 获取筛选和排序后的待办事项
const filteredAndSortedTodos = computed(() => {
  let result = [...todos.value];
  // 应用筛选
  if (filter.value.dates&&filter.value.dates.length > 0) {
    result = result.filter(todo => {
      const todoDate = todo.dueTime.replaceAll('-','/');
      console.log(todoDate)
      return filter.value.dates.includes(todoDate);
    });
    console.log(filter.value.dates)
  }
  
  if (filter.value.dates&&filter.value.importance > 0) {
    result = result.filter(todo => todo.importance >= filter.value.importance);
  }
  
  // 应用排序
  if (sort.value === 'createTime') {
    result.sort((a, b) => new Date(b.createTime) - new Date(a.createTime));
  } else if (sort.value === 'importance') {
    result.sort((a, b) => b.importance - a.importance);
  } else if (sort.value === 'dueTime') {
    result.sort((a, b) => new Date(a.dueTime) - new Date(b.dueTime));
  }
  
  return result;
});

onMounted(() => {
  loadTodos();
});
</script>

<template>
  <div class="todo-dialog">
    <TodoList 
      :todos="filteredAndSortedTodos" 
      @complete="completeTodo"
      @delete="deleteTodo"
      @open-detail="openDetail"
    />
    
    <div class="floating-actions">
      <q-btn icon="add" round color="primary" @click="addTodo" />
      <q-btn icon="settings" round color="primary" @click="openSettings" />
    </div>
    
    <TodoDetail 
      v-if="showDetail" 
      :todo="currentTodo" 
      @close="showDetail = false"
      @update="updateTodo"
      @delete="deleteTodo"
    />
    
    <TodoSettings 
      v-if="showSettings" 
      :filter="filter"
      :sort="sort"
      @close="showSettings = false"
      @apply="applySettings"
    />
  </div>
</template>

<style scoped>
.todo-dialog {
  padding: 10px;
  min-height: 300px;
  max-height: 500px;
  overflow-y: auto;
  position: relative;
}

.todo-dialog::-webkit-scrollbar {
  display: none;
}

.floating-actions {
  position: fixed; /* 改为fixed定位，相对于视口 */
  bottom: 20px;
  right: 20px;
  display: flex;
  gap: 10px;
  z-index: 100; /* 提高z-index确保在最上层 */
}

.floating-actions .q-btn {
  box-shadow: 0 3px 5px rgba(0, 0, 0, 0.2);
}
</style>