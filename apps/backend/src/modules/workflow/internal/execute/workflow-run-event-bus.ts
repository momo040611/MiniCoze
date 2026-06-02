import { Injectable } from '@nestjs/common';
import { WorkflowRunEvent } from './workflow-run-event';

type WorkflowRunEventHandler = (event: WorkflowRunEvent) => Promise<void> | void;

@Injectable()
export class WorkflowRunEventBus {
  private readonly handlers: WorkflowRunEventHandler[] = [];

  subscribe(handler: WorkflowRunEventHandler): void {
    this.handlers.push(handler);
  }

  async publish(event: WorkflowRunEvent): Promise<void> {
    for (const handler of this.handlers) {
      await handler(event);
    }
  }
}

