import { defineStore } from 'pinia';
import { ref, computed } from 'vue';

export const useTodoStore = defineStore('todo', () => {
  // 状态
  const todos = ref([]);
  const filter = ref({
    dates: [],
    importance: 0
  });
  const sort = ref('createTime');
  const lastChecked = ref(0);

  // 格式化时间
  const changeHHMMToDate = (time) => {
    if (time.length > 10) return time;
    const [hour, minute] = time.split(':');
    const date = new Date();
    date.setHours(parseInt(hour, 10));
    date.setMinutes(parseInt(minute, 10));
    return date.toLocaleString();
  };

  // 加载待办事项
  const loadTodos = async () => {
    try {
      const todoData = await window.electron.ipcRenderer.invoke('get-todos');
      if (todoData) {
        todos.value = todoData.todoItems || [];
        if (todoData.settings) {
          filter.value = todoData.settings.filter || filter.value;
          sort.value = todoData.settings.sort || sort.value;
        }
        
        // 如果是今天第一次打开，更新日常为未完成
        const today = new Date();
        const lastUpdateTime = new Date(todoData.updateTime);
        if (today.toLocaleDateString() !== lastUpdateTime.toLocaleDateString()) {
          todos.value.forEach(todo => {
            if (todo.isDaily) todo.completed = false;
          });
          saveTodos();
        }
      } else {
        todos.value = [];
      }
    } catch (error) {
      console.error('获取待办事项失败:', error);
    }
  };

  // 保存待办事项
  const saveTodos = async () => {
    try {
      const todoData = {
        todoItems: JSON.parse(JSON.stringify(todos.value)),
        settings: {
          filter: filter.value,
          sort: sort.value
        },
        updateTime: new Date().toLocaleString()
      };
      await window.electron.ipcRenderer.invoke('save-todos', JSON.parse(JSON.stringify(todoData)));
    } catch (error) {
      console.error('保存待办事项失败:', error);
    }
  };

  // 获取筛选和排序后的待办事项
  const filteredAndSortedTodos = computed(() => {
    let result = [...todos.value];
    // 应用筛选
    if (filter.value.dates && filter.value.dates.length > 0) {
      result = result.filter(todo => {
        if (todo.isDaily) return true;
        if (!todo.startTime && !todo.dueTime) return true;
        
        const startDate = todo.startTime ? new Date(todo.startTime).toLocaleDateString() : null;
        const dueDate = todo.dueTime ? new Date(todo.dueTime).toLocaleDateString() : null;
        
        return filter.value.dates.some(dateStr => {
          const filterDate = new Date(dateStr).toLocaleDateString();
          if (startDate && dueDate) {
            return filterDate >= startDate && filterDate <= dueDate;
          } else if (startDate && !dueDate) {
            return filterDate >= startDate;
          } else if (!startDate && dueDate) {
            return filterDate <= dueDate;
          }
          return false;
        });
      });
    }
    
    if (filter.value.importance > 0) {
      result = result.filter(todo => todo.importance >= filter.value.importance);
    }
    
    // 应用排序
    if (sort.value === 'createTime') {
      result.sort((a, b) => new Date(b.createTime) - new Date(a.createTime));
    } else if (sort.value === 'importance') {
      result.sort((a, b) => b.importance - a.importance);
    } else if (sort.value === 'dueTime') {
      result.sort((a, b) => new Date(changeHHMMToDate(a.dueTime)) - new Date(changeHHMMToDate(b.dueTime)));
    } else if (sort.value === 'startTime') {
      result.sort((a, b) => new Date(changeHHMMToDate(a.startTime)) - new Date(changeHHMMToDate(b.startTime)));
    }
    
    return result;
  });

  // 添加待办事项
  const addTodo = (todo) => {
    todos.value.push(todo);
    saveTodos();
  };

  // 更新待办事项
  const updateTodo = (newTodo) => {
    const index = todos.value.findIndex(t => t.id === newTodo.id);
    if (index !== -1) {
      todos.value[index] = newTodo;
    } else {
      todos.value.push(newTodo);
    }
    saveTodos();
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

  // 初始化加载
  loadTodos();

  return {
    todos,
    filter,
    sort,
    lastChecked,
    filteredAndSortedTodos,
    loadTodos,
    saveTodos,
    addTodo,
    updateTodo,
    completeTodo,
    deleteTodo,
    changeHHMMToDate
  };
});