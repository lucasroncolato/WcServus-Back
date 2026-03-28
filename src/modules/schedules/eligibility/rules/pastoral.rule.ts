import { Injectable } from '@nestjs/common';
import { EligibilityContext, EligibilityRuleResult } from '../eligibility.types';

@Injectable()
export class PastoralRule {
  evaluate(context: EligibilityContext): EligibilityRuleResult {
    if (context.hasPastoralPending) {
      return { eligible: false, reason: 'PASTORAL_PENDING' };
    }

    return { eligible: true };
  }
}
