import { Role } from '@prisma/client';
import { Capability, capabilities } from './capabilities';

const byRole: Record<Role, Capability[]> = {
  [Role.SUPER_ADMIN]: Object.values(capabilities),
  [Role.ADMIN]: [
    capabilities.ministriesRead,
    capabilities.ministriesUpdateOwn,
    capabilities.servantsCreateWithUser,
    capabilities.schedulesAssignOwnMinistry,
    capabilities.tasksReassignOwnMinistry,
    capabilities.pastoralReadMinistry,
    capabilities.reportsReadMinistry,
    capabilities.usersManageChurch,
    capabilities.integrityReadChurch,
    capabilities.automationReadChurch,
    capabilities.automationManageChurch,
    capabilities.analyticsReadChurch,
    capabilities.timelineReadChurch,
    capabilities.churchSettingsManage,
    capabilities.churchBrandingManage,
  ],
  [Role.PASTOR]: [
    capabilities.ministriesRead,
    capabilities.pastoralReadMinistry,
    capabilities.reportsReadMinistry,
    capabilities.automationReadChurch,
    capabilities.analyticsReadChurch,
    capabilities.timelineReadChurch,
  ],
  [Role.COORDENADOR]: [
    capabilities.ministriesRead,
    capabilities.servantsCreateWithUser,
    capabilities.schedulesAssignOwnMinistry,
    capabilities.tasksReassignOwnMinistry,
    capabilities.pastoralReadMinistry,
    capabilities.reportsReadMinistry,
    capabilities.automationReadChurch,
    capabilities.analyticsReadChurch,
    capabilities.timelineReadChurch,
  ],
  [Role.SERVO]: [
    capabilities.journeyReadSelf,
    capabilities.timelineReadOwn,
  ],
};

export function capabilitiesForRole(role: Role) {
  return byRole[role] ?? [];
}

