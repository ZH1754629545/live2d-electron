<script setup lang="ts">
import { ref, onMounted ,watch} from 'vue';
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

// 监听 activeTab 的变化
//TODO 以后加了每周任务等逻辑要改变

const activeTab = ref(todoStore.filter.dailyShowOnly ? 'daily' : 'all');

watch(activeTab, () => {
  if(activeTab.value === 'daily') {
    todoStore.filter.dailyShowOnly = true; 
  }else{
    todoStore.filter.dailyShowOnly = false;
  }
  todoStore.saveTodos();
});
</script>

<template>
  <div class="todo-dialog">
    <!-- 添加顶部导航栏 -->
    <div class="todo-tabs">
      <q-tabs
        v-model="activeTab"
        dense
        class="text-primary"
        active-color="primary"
        indicator-color="primary"
        align="justify"
      >
        <q-tab name="all" label="全部待办" />
        <q-tab name="daily" label="每日任务" />
      </q-tabs>
    </div>
    
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

/* 添加导航栏样式 */
.todo-tabs {
  margin-bottom: 15px;
  background-color: white;
  border-radius: 8px;
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.1);
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