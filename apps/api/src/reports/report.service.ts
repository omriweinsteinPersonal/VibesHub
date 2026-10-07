import { Injectable } from '@nestjs/common';
import type { ContentReportInput, ContentReportReceipt } from '@vibeshub/contracts';

import { problem } from '../api-problem.js';
import { ReportRepository } from './report.repository.js';

@Injectable()
export class ReportService {
  constructor(private readonly reports: ReportRepository) {}

  async create(input: ContentReportInput): Promise<ContentReportReceipt> {
    const report = await this.reports.create(input);
    if (!report) {
      throw problem(404, 'RESOURCE_NOT_FOUND', 'The reported content is unavailable');
    }
    return report;
  }
}
