import { Controller, Get } from '@nestjs/common';
import { DataSource } from 'typeorm';
import { ApiTags } from '@nestjs/swagger';

@ApiTags('health')
@Controller('health')
export class HealthController {
  constructor(private readonly ds: DataSource) {}

  @Get()
  live() {
    return { status: 'ok', time: new Date().toISOString() };
  }

  @Get('db')
  async db() {
    try {
      await this.ds.query('SELECT 1 AS ok');
      return { database: 'up' };
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : String(e);
      return { database: 'down', error: msg };
    }
  }
}
