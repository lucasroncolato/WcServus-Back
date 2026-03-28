import {
  Aptitude,
  ServantApprovalStatus,
  ServantStatus,
  TrainingStatus,
} from '@prisma/client';

export type EligibilityRuleResult = {
  eligible: boolean;
  reason?: string;
};

export type EligibilityEngineResult = {
  eligible: boolean;
  reasons: string[];
  score?: number;
  priority?: 'LOW' | 'MEDIUM' | 'HIGH';
};

export type EligibilityServantInput = {
  id: string;
  status: ServantStatus;
  approvalStatus: ServantApprovalStatus;
  aptitude: Aptitude | null;
  trainingStatus: TrainingStatus;
  mainMinistryId: string | null;
  servantMinistries: Array<{
    ministryId: string;
    trainingStatus: TrainingStatus;
    trainingCompletedAt: Date | null;
  }>;
};

export type EligibilitySlotInput = {
  id: string;
  functionName: string;
  requiredTraining: boolean;
  blocked: boolean;
  blockedReason: string | null;
  assignedServantId?: string | null;
};

export type EligibilityContext = {
  ministryId: string;
  servant: EligibilityServantInput;
  slot?: EligibilitySlotInput;
  hasPastoralPending: boolean;
  unavailableAtServiceTime: boolean;
  conflictMinistryIds: string[];
  requiredAptitude: Aptitude | null;
};

export interface EligibilityRule {
  evaluate(context: EligibilityContext): EligibilityRuleResult;
}
