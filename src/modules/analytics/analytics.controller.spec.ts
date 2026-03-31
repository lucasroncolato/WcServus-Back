import { AnalyticsController } from './analytics.controller';

describe('AnalyticsController', () => {
  const analyticsService = {
    church: jest.fn(),
    churchTrends: jest.fn(),
    churchPastoral: jest.fn(),
    ministry: jest.fn(),
    team: jest.fn(),
    servant: jest.fn(),
    timelineSummary: jest.fn(),
  } as any;

  let controller: AnalyticsController;

  beforeEach(() => {
    jest.clearAllMocks();
    controller = new AnalyticsController(analyticsService);
  });

  it('maps canonical routes to service methods', async () => {
    const actor = { sub: 'u1', churchId: 'c1' } as any;
    const query = { window: '30d' } as any;

    await controller.church(actor, query);
    await controller.churchTrends(actor, query);
    await controller.churchPastoral(actor, query);
    await controller.ministry(actor, 'm1', query);
    await controller.team(actor, 't1', query);
    await controller.servant(actor, 's1', query);
    await controller.timelineSummary(actor, query);

    expect(analyticsService.church).toHaveBeenCalledWith(actor, query);
    expect(analyticsService.churchTrends).toHaveBeenCalledWith(actor, query);
    expect(analyticsService.churchPastoral).toHaveBeenCalledWith(actor, query);
    expect(analyticsService.ministry).toHaveBeenCalledWith(actor, 'm1', query);
    expect(analyticsService.team).toHaveBeenCalledWith(actor, 't1', query);
    expect(analyticsService.servant).toHaveBeenCalledWith(actor, 's1', query);
    expect(analyticsService.timelineSummary).toHaveBeenCalledWith(actor, query);
  });
});
