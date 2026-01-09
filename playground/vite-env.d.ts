/// <reference types="vite/client" />

// 声明 ?worker 导入
declare module '*?worker' {
  const workerConstructor: {
    new (): Worker;
  };
  export default workerConstructor;
}

// 声明 monaco editor 的 worker
declare module 'monaco-editor/esm/vs/editor/editor.worker?worker' {
  const workerConstructor: {
    new (): Worker;
  };
  export default workerConstructor;
}

declare module 'monaco-editor/esm/vs/language/json/json.worker?worker' {
  const workerConstructor: {
    new (): Worker;
  };
  export default workerConstructor;
}
