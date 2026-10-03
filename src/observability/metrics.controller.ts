import { Controller, Get, Res } from '@nestjs/common';
import { ApiExcludeController } from '@nestjs/swagger';
import { SkipThrottle } from '@nestjs/throttler';
import type { Response } from 'express';
import { Public } from '../common/decorators/public.decorator';
import { MetricsService } from './metrics.service';

@Public()
@SkipThrottle()
@ApiExcludeController()
@Controller('metrics')
export class MetricsController {
  constructor(private readonly metrics: MetricsService) {}

  @Get()
  async text(@Res({ passthrough: true }) res: Response): Promise<string> {
    res.set('Content-Type', this.metrics.contentType);
    return this.metrics.text();
  }
}
