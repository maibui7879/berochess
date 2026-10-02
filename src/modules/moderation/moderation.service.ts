import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { PaginationQueryDto } from '../../common/dto/pagination-query.dto';
import { ReportStatus } from '../../common/enums';
import { CreateActionDto } from './dto/create-action.dto';
import { CreateReportDto } from './dto/create-report.dto';
import { ModerationAction } from './entities/moderation-action.entity';
import { Report } from './entities/report.entity';

@Injectable()
export class ModerationService {
  constructor(
    @InjectRepository(Report) private readonly reports: Repository<Report>,
    @InjectRepository(ModerationAction)
    private readonly actions: Repository<ModerationAction>,
  ) {}

  createReport(reporterId: string, dto: CreateReportDto): Promise<Report> {
    return this.reports.save(
      this.reports.create({
        reporterId,
        targetType: dto.targetType,
        targetId: dto.targetId,
        reason: dto.reason,
      }),
    );
  }

  findReports(query: PaginationQueryDto, status?: ReportStatus): Promise<Report[]> {
    return this.reports.find({
      where: status ? { status } : {},
      take: Math.min(query.limit ?? 20, 100),
      skip: query.offset ?? 0,
      order: { createdAt: 'DESC' },
    });
  }

  async updateReportStatus(id: string, status: ReportStatus): Promise<Report> {
    const report = await this.reports.findOneBy({ id });
    if (!report) throw new NotFoundException('Report not found');
    report.status = status;
    return this.reports.save(report);
  }

  createAction(moderatorId: string, dto: CreateActionDto): Promise<ModerationAction> {
    return this.actions.save(
      this.actions.create({
        moderatorId,
        targetUserId: dto.targetUserId ?? null,
        matchId: dto.matchId ?? null,
        action: dto.action,
        reason: dto.reason ?? null,
        expiresAt: dto.expiresAt ? new Date(dto.expiresAt) : null,
      }),
    );
  }

  findActions(query: PaginationQueryDto): Promise<ModerationAction[]> {
    return this.actions.find({
      take: Math.min(query.limit ?? 20, 100),
      skip: query.offset ?? 0,
      order: { createdAt: 'DESC' },
    });
  }
}
