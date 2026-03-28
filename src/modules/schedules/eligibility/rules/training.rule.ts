import { Injectable } from '@nestjs/common';
import { TrainingStatus } from '@prisma/client';
import { EligibilityContext, EligibilityRuleResult } from '../eligibility.types';

@Injectable()
export class TrainingRule {
  evaluate(context: EligibilityContext): EligibilityRuleResult {
    const requiresTraining = context.slot?.requiredTraining ?? true;
    if (!requiresTraining) {
      return { eligible: true };
    }

    const ministryTraining = context.servant.servantMinistries.find(
      (item) => item.ministryId === context.ministryId,
    );

    const completedByMinistry = ministryTraining?.trainingStatus === TrainingStatus.COMPLETED;
    const completedByMainMinistryFallback =
      context.servant.mainMinistryId === context.ministryId &&
      context.servant.trainingStatus === TrainingStatus.COMPLETED;

    if (!completedByMinistry && !completedByMainMinistryFallback) {
      return { eligible: false, reason: 'MINISTRY_TRAINING_NOT_COMPLETED' };
    }

    return { eligible: true };
  }
}
