import { Injectable } from '@nestjs/common';
import { EligibilityContext, EligibilityRuleResult } from '../eligibility.types';

@Injectable()
export class ActiveRule {
  evaluate(context: EligibilityContext): EligibilityRuleResult {
    if (context.servant.status !== 'ATIVO') {
      return { eligible: false, reason: 'SERVANT_NOT_ACTIVE' };
    }

    if (context.servant.approvalStatus !== 'APPROVED') {
      return { eligible: false, reason: 'PENDING_MINISTRY_APPROVAL' };
    }

    return { eligible: true };
  }
}
