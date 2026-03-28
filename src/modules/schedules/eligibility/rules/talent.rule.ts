import { Injectable } from '@nestjs/common';
import { EligibilityContext, EligibilityRuleResult } from '../eligibility.types';

@Injectable()
export class TalentRule {
  evaluate(context: EligibilityContext): EligibilityRuleResult {
    if (!context.requiredAptitude || !context.servant.aptitude) {
      return { eligible: true };
    }

    if (context.servant.aptitude !== context.requiredAptitude) {
      return { eligible: false, reason: 'TALENT_MISMATCH' };
    }

    return { eligible: true };
  }
}
