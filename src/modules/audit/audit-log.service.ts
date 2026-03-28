import { Injectable } from '@nestjs/common';
import { JwtPayload } from '../auth/types/jwt-payload.type';
import { AuditService } from './audit.service';

@Injectable()
export class AuditLogService {
  constructor(private readonly auditService: AuditService) {}

  log = this.auditService.log.bind(this.auditService);

  list(limit = 50, actor?: JwtPayload) {
    return this.auditService.list(limit, actor);
  }
}
