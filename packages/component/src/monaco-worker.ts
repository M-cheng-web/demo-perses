// Monaco Editor Worker 配置
import * as monaco from 'monaco-editor';
import editorWorker from 'monaco-editor/esm/vs/editor/editor.worker?worker';
import jsonWorker from 'monaco-editor/esm/vs/language/json/json.worker?worker';

// 扩展 Window 接口
declare global {
  interface Window {
    MonacoEnvironment?: monaco.Environment;
  }
}

// 配置 Monaco Editor 的 worker 环境
self.MonacoEnvironment = {
  getWorker(_: string, label: string) {
    if (label === 'json') {
      return new jsonWorker();
    }
    return new editorWorker();
  },
};

export default monaco;
