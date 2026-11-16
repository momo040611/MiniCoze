import { RunControlService } from './run-control.service';

describe('RunControlService', () => {
  it('cancel 返回 canceled 并触发 abort', () => {
    const service = new RunControlService();
    const controller = service.register('run-1', {
      userId: 'user-1',
      workspaceId: 'ws-1',
    });
    const onAbort = jest.fn();
    controller.signal.addEventListener('abort', onAbort);

    expect(service.cancel('run-1', 'user-1')).toBe('canceled');
    expect(controller.signal.aborted).toBe(true);
    expect(onAbort).toHaveBeenCalled();
  });

  it('非发起人且无工作区校验回调时返回 forbidden', () => {
    const service = new RunControlService();
    service.register('run-1', { userId: 'user-1', workspaceId: 'ws-1' });

    expect(service.cancel('run-1', 'user-2')).toBe('forbidden');
  });

  it('release 后 cancel 返回 not_found', () => {
    const service = new RunControlService();
    service.register('run-1', { userId: 'user-1', workspaceId: 'ws-1' });
    service.release('run-1');

    expect(service.cancel('run-1', 'user-1')).toBe('not_found');
  });
});
