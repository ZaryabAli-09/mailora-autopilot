import { Injectable, OnApplicationShutdown } from '@nestjs/common';
import { startSnoozeWorker } from './snooze-worker.js';
import { startSyncWorker } from './sync.service.js';

/** Starts background work only after the database is connected. */
@Injectable()
export class WorkersService implements OnApplicationShutdown {
  private timers: NodeJS.Timeout[] = [];

  start() {
    if (this.timers.length) return;
    this.timers.push(startSnoozeWorker(), startSyncWorker());
  }

  onApplicationShutdown() {
    this.timers.forEach(clearInterval);
    this.timers = [];
  }
}
