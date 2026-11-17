import { Injectable, OnApplicationShutdown } from '@nestjs/common';
import mongoose from 'mongoose';
import { connectDB } from './db-connection.js';

@Injectable()
export class DatabaseService implements OnApplicationShutdown {
  connect() { return connectDB(); }

  async onApplicationShutdown() {
    if (mongoose.connection.readyState !== 0) await mongoose.disconnect();
  }
}
