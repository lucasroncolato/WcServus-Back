import { Injectable } from '@nestjs/common';
import { EligibilityContext, EligibilityRuleResult } from '../eligibility.types';

@Injectable()
export class AvailabilityRule {
  evaluate(context: EligibilityContext): EligibilityRuleResult {
    if (context.unavailableAtServiceTime) {
      return { eligible: false, reason: 'UNAVAILABLE_FOR_SERVICE_SHIFT' };
    }

    return { eligible: true };
  }
}
