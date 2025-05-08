// 定义 Todo 接口
export interface TodoType {
    id: number;
    title: string;
    content: string;
    completed: boolean;
    startTime: string;
    dueTime: string;
    createTime: string;
    importance: number;
    isDaily?: boolean;
  }