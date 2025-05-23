import { join } from 'path'
import fs from 'fs'
import { getAppDataPath } from './config'
import {is} from '@electron-toolkit/utils'
const getTODOPath =()=>{
  const appDataPath = getAppDataPath()
  if(is.dev){
    return join(__dirname, '../../resources/public/todo/TODO.json')
  }
  return join(appDataPath,'public','todo','TODO.json')
}

export const getTodos = ()=>{
    const todosPath = getTODOPath()
    try {
        if (fs.existsSync(todosPath)) {
          const data = fs.readFileSync(todosPath, 'utf8');
          return JSON.parse(data);
        }
        return [];
      } catch (error) {
        console.error('读取待办事项失败:', error);
        return [];
      }
}

export const saveTodos = (todos:any)=>{
    // 保存待办事项到 TOD
    const todosPath = getTODOPath()
    try {
        fs.writeFileSync(todosPath, JSON.stringify(todos, null, 2), 'utf8');
        return true;
      } catch (error) {
        console.error('保存待办事项失败:', error);
        return false;
      }
}