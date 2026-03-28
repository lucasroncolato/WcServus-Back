import { Injectable } from '@nestjs/common';
import { EligibilityContext, EligibilityRuleResult } from '../eligibility.types';

@Injectable()
export class ConflictRule {
  evaluate(context: EligibilityContext): EligibilityRuleResult {
    if (context.slot?.blocked) {
      return { eligible: false, reason: context.slot.blockedReason || 'SLOT_BLOCKED' };
    }

    const hasOtherMinistryConflict = context.conflictMinistryIds.some(
      (ministryId) => ministryId !== context.ministryId,
    );
    if (hasOtherMinistryConflict) {
      return { eligible: false, reason: 'ALREADY_SCHEDULED_IN_OTHER_MINISTRY' };
    }

    const assignedInSameMinistry = context.conflictMinistryIds.includes(context.ministryId);
    const differentFromCurrentSlot =
      context.slot?.assignedServantId && context.slot.assignedServantId !== context.servant.id;

    if (assignedInSameMinistry && differentFromCurrentSlot) {
      return { eligible: false, reason: 'ALREADY_SCHEDULED_SAME_MINISTRY' };
    }

    return { eligible: true };
  }
}
