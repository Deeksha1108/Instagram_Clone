import { Injectable, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import Redis from 'ioredis';
import { COMMON_CONFIG } from 'src/config/common.config';

@Injectable()
export class RedisService implements OnModuleInit, OnModuleDestroy {
  private client: Redis;

  onModuleInit() {
    this.client = new Redis({
      host: COMMON_CONFIG.redis.host,
      port: COMMON_CONFIG.redis.port,
    });
  }

  onModuleDestroy() {
    this.client.quit();
  }

  async set(key: string, value: any, ttlSeconds: number) {
    await this.client.set(key, JSON.stringify(value), 'EX', ttlSeconds);
  }

  async get(key: string) {
    const data = await this.client.get(key);
    return data ? JSON.parse(data) : null;
  }

  async del(key: string) {
    await this.client.del(key);
  }

  async incr(key: string) {
    await this.client.incr(key);
  }
}