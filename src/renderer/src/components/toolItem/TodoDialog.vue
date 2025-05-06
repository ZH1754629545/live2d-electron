<script setup lang="ts">
import { ref, onMounted } from 'vue';
import TodoList from './todo/TodoList.vue';
import TodoDetail from './todo/TodoDetail.vue';
import TodoSettings from './todo/TodoSettings.vue';
import { useTodoStore } from '../../stores/todoStore';

const emit = defineEmits(['close']);
const showDetail = ref(false);
const showSettings = ref(false);
const currentTodo = ref(null);

// 使用 todoStore
const todoStore = useTodoStore();

// 添加待办事项
const addTodo = () => {
  const newTodo = {
    id: Date.now(),
    title: '',
    content: '',
    completed: false,
    startTime: '',
    dueTime: '',
    createTime: new Date().toLocaleString(),
    importance: 1
  };
  
  // 先打开详情编辑，不立即添加到列表
  currentTodo.value = newTodo;

  showDetail.value = true;
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
  todoStore.filter = newFilter;
  todoStore.sort = newSort;
  showSettings.value = false;
  todoStore.saveTodos();
};

// 关闭对话框
const closeDialog = () => {
  emit('close');
};

// 更新待办事项
const updateTodo = (newTodo) => {
  console.log('Updating todo:', newTodo);
  todoStore.updateTodo(newTodo);
  showDetail.value = false;
};

onMounted(() => {
  // 确保数据是最新的
  todoStore.loadTodos();
});
</script>

<template>
  <div class="todo-dialog">
    <TodoList 
      :todos="todoStore.filteredAndSortedTodos" 
      @complete="todoStore.completeTodo"
      @delete="todoStore.deleteTodo"
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
      @delete="todoStore.deleteTodo"
    />
    
    <TodoSettings 
      v-if="showSettings" 
      :filter="todoStore.filter"
      :sort="todoStore.sort"
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