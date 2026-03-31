import { AnalyticsOpsController } from './analytics-ops.controller';

describe('AnalyticsOpsController', () => {
  const scheduler = {
    runNow: jest.fn(),
  } as any;

  const snapshots = {
    refreshMinistryById: jest.fn(),
    refreshTeamById: jest.fn(),
    refreshServantById: jest.fn(),
    getSnapshotStatus: jest.fn(),
  } as any;

  let controller: AnalyticsOpsController;

  beforeEach(() => {
    jest.clearAllMocks();
    controller = new AnalyticsOpsController(scheduler, snapshots);
  });

  it('delegates internal refresh operations', async () => {
    await controller.refreshAll('church-1');
    await controller.refreshChurch('church-1');
    await controller.refreshMinistry('min-1');
    await controller.refreshTeam('team-1');
    await controller.refreshServant('serv-1');
    await controller.status();

    expect(scheduler.runNow).toHaveBeenCalledWith('church-1');
    expect(snapshots.refreshMinistryById).toHaveBeenCalledWith('min-1');
    expect(snapshots.refreshTeamById).toHaveBeenCalledWith('team-1');
    expect(snapshots.refreshServantById).toHaveBeenCalledWith('serv-1');
    expect(snapshots.getSnapshotStatus).toHaveBeenCalled();
  });
});
