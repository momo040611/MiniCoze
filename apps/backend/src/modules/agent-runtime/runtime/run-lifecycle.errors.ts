// 运行生命周期专用错误：用于在 runtime 内部区分「用户取消」与「真正失败」。

export class RunCanceledError extends Error {
  constructor(message = '运行已被取消') {
    super(message);
    this.name = 'RunCanceledError';
  }
}

export class RunTimeoutError extends Error {
  constructor(message = '运行超时') {
    super(message);
    this.name = 'RunTimeoutError';
  }
}
