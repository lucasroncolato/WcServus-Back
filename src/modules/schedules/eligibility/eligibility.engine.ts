import { Injectable } from '@nestjs/common';
import { EligibilityEngineResult, EligibilityContext } from './eligibility.types';
import { ActiveRule } from './rules/active.rule';
import { AvailabilityRule } from './rules/availability.rule';
import { ConflictRule } from './rules/conflict.rule';
import { PastoralRule } from './rules/pastoral.rule';
import { TalentRule } from './rules/talent.rule';
import { EligibilityScoreService } from './eligibility-score.service';
import { TrainingRule } from './rules/training.rule';

@Injectable()
export class EligibilityEngine {
  constructor(
    private readonly activeRule: ActiveRule,
    private readonly trainingRule: TrainingRule,
    private readonly pastoralRule: PastoralRule,
    private readonly availabilityRule: AvailabilityRule,
    private readonly conflictRule: ConflictRule,
    private readonly talentRule: TalentRule,
    private readonly eligibilityScoreService: EligibilityScoreService,
  ) {}

  async evaluate(context: EligibilityContext): Promise<EligibilityEngineResult> {
    const results = [
      this.activeRule.evaluate(context),
      this.trainingRule.evaluate(context),
      this.pastoralRule.evaluate(context),
      this.availabilityRule.evaluate(context),
      this.conflictRule.evaluate(context),
      this.talentRule.evaluate(context),
    ];

    const reasons = results
      .filter((result) => !result.eligible)
      .map((result) => result.reason)
      .filter((reason): reason is string => Boolean(reason));

    const scoring = await this.eligibilityScoreService.score(context);

    return {
      eligible: reasons.length === 0,
      reasons,
      score: scoring.score,
      priority: scoring.priority,
    };
  }
}
