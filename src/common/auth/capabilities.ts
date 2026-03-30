export const capabilities = {
  ministriesRead: 'ministries.read',
  ministriesUpdateOwn: 'ministries.update.own',
  servantsCreateWithUser: 'servants.create-with-user',
  schedulesAssignOwnMinistry: 'schedules.assign.own-ministry',
  tasksReassignOwnMinistry: 'tasks.reassign.own-ministry',
  pastoralReadMinistry: 'pastoral.read.ministry',
  reportsReadMinistry: 'reports.read.ministry',
  journeyReadSelf: 'journey.read.self',
  usersManageChurch: 'users.manage.church',
  automationManageChurch: 'automation.manage.church',
  analyticsReadChurch: 'analytics.read.church',
  timelineReadChurch: 'timeline.read.church',
  timelineReadOwn: 'timeline.read.own',
  churchSettingsManage: 'church.settings.manage',
  churchBrandingManage: 'church.branding.manage',
  onboardingProvision: 'onboarding.provision',
} as const;

export type Capability = (typeof capabilities)[keyof typeof capabilities];

