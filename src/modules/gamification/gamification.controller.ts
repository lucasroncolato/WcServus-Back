import { Body, Controller, ForbiddenException, Get, Param, Post, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { Role } from '@prisma/client';
import { CurrentUser } from 'src/common/decorators/current-user.decorator';
import { Roles } from 'src/common/decorators/roles.decorator';
import { JwtPayload } from '../auth/types/jwt-payload.type';
import { AnalyticsQueryDto } from './dto/analytics-query.dto';
import { AwardPointsDto } from './dto/award-points.dto';
import {
  ApproveGrowthTrackStepDto,
  AssignGrowthTrackServantDto,
  CreateGrowthTrackDto,
  CreateGrowthTrackStepDto,
  UpdateGrowthTrackProgressDto,
} from './dto/growth-track.dto';
import { ListRankingQueryDto } from './dto/list-ranking-query.dto';
import { RankingQueryDto } from './dto/ranking-query.dto';
import { GamificationService } from './gamification.service';

@ApiTags('Gamification')
@ApiBearerAuth()
@Controller('gamification')
export class GamificationController {
  constructor(private readonly gamificationService: GamificationService) {}

  @Get('me')
  @Roles(Role.SUPER_ADMIN, Role.ADMIN, Role.PASTOR, Role.COORDENADOR, Role.SERVO)
  myProgress(@CurrentUser() user: JwtPayload) {
    const servantId = user.servantId;
    if (!servantId) throw new ForbiddenException('User is not linked to a servant');
    return this.gamificationService.getServantProgress(servantId, user.churchId ?? undefined);
  }

  @Get('servants/:servantId')
  @Roles(Role.SUPER_ADMIN, Role.ADMIN, Role.PASTOR, Role.COORDENADOR)
  servantProgress(@Param('servantId') servantId: string, @CurrentUser() user: JwtPayload) {
    return this.gamificationService.getServantProgress(servantId, user.churchId ?? undefined);
  }

  @Get('ranking')
  @Roles(Role.SUPER_ADMIN, Role.ADMIN, Role.PASTOR, Role.COORDENADOR, Role.SERVO)
  ranking(@Query() query: ListRankingQueryDto, @CurrentUser() user: JwtPayload) {
    return this.gamificationService.ranking({
      churchId: user.churchId ?? undefined,
      ministryId: query.ministryId,
      limit: query.limit,
    }, user);
  }

  @Get('dashboard')
  @Roles(Role.SUPER_ADMIN, Role.ADMIN, Role.PASTOR, Role.COORDENADOR, Role.SERVO)
  dashboard(@Query() query: ListRankingQueryDto, @CurrentUser() user: JwtPayload) {
    return this.gamificationService.dashboard(user, {
      ministryId: query.ministryId,
    });
  }

  @Get('dashboard/admin')
  @Roles(Role.SUPER_ADMIN, Role.ADMIN)
  dashboardAdmin(@Query() query: AnalyticsQueryDto, @CurrentUser() user: JwtPayload) {
    return this.gamificationService.dashboardAdmin(user, query);
  }

  @Get('dashboard/pastor')
  @Roles(Role.SUPER_ADMIN, Role.ADMIN, Role.PASTOR)
  dashboardPastor(@Query() query: AnalyticsQueryDto, @CurrentUser() user: JwtPayload) {
    return this.gamificationService.dashboardPastor(user, query);
  }

  @Get('dashboard/coordinator')
  @Roles(Role.SUPER_ADMIN, Role.ADMIN, Role.COORDENADOR)
  dashboardCoordinator(@Query() query: AnalyticsQueryDto, @CurrentUser() user: JwtPayload) {
    return this.gamificationService.dashboardCoordinator(user, query);
  }

  @Get('dashboard/servo')
  @Roles(Role.SUPER_ADMIN, Role.ADMIN, Role.PASTOR, Role.COORDENADOR, Role.SERVO)
  dashboardServo(@Query() query: AnalyticsQueryDto, @CurrentUser() user: JwtPayload) {
    return this.gamificationService.dashboardServo(user, query);
  }

  @Get('ranking/monthly')
  @Roles(Role.SUPER_ADMIN, Role.ADMIN, Role.PASTOR, Role.COORDENADOR, Role.SERVO)
  rankingMonthly(@Query() query: RankingQueryDto, @CurrentUser() user: JwtPayload) {
    return this.gamificationService.rankingMonthly(query, user);
  }

  @Get('ranking/yearly')
  @Roles(Role.SUPER_ADMIN, Role.ADMIN, Role.PASTOR, Role.COORDENADOR, Role.SERVO)
  rankingYearly(@Query() query: RankingQueryDto, @CurrentUser() user: JwtPayload) {
    return this.gamificationService.rankingYearly(query, user);
  }

  @Get('ranking/ministry/:id')
  @Roles(Role.SUPER_ADMIN, Role.ADMIN, Role.PASTOR, Role.COORDENADOR, Role.SERVO)
  rankingByMinistry(@Param('id') ministryId: string, @Query() query: RankingQueryDto, @CurrentUser() user: JwtPayload) {
    return this.gamificationService.ranking({ churchId: user.churchId ?? undefined, ministryId, limit: query.limit }, user);
  }

  @Get('ranking/tasks')
  @Roles(Role.SUPER_ADMIN, Role.ADMIN, Role.PASTOR, Role.COORDENADOR, Role.SERVO)
  rankingTasks(@Query() query: RankingQueryDto, @CurrentUser() user: JwtPayload) {
    return this.gamificationService.rankingByMetric('tasks', query, user);
  }

  @Get('ranking/attendance')
  @Roles(Role.SUPER_ADMIN, Role.ADMIN, Role.PASTOR, Role.COORDENADOR, Role.SERVO)
  rankingAttendance(@Query() query: RankingQueryDto, @CurrentUser() user: JwtPayload) {
    return this.gamificationService.rankingByMetric('attendance', query, user);
  }

  @Get('ranking/checklist')
  @Roles(Role.SUPER_ADMIN, Role.ADMIN, Role.PASTOR, Role.COORDENADOR, Role.SERVO)
  rankingChecklist(@Query() query: RankingQueryDto, @CurrentUser() user: JwtPayload) {
    return this.gamificationService.rankingByMetric('checklist', query, user);
  }

  @Get('ranking/growth')
  @Roles(Role.SUPER_ADMIN, Role.ADMIN, Role.PASTOR, Role.COORDENADOR, Role.SERVO)
  rankingGrowth(@Query() query: RankingQueryDto, @CurrentUser() user: JwtPayload) {
    return this.gamificationService.rankingByMetric('growth', query, user);
  }

  @Post('award')
  @Roles(Role.SUPER_ADMIN, Role.ADMIN, Role.COORDENADOR)
  award(@Body() dto: AwardPointsDto, @CurrentUser() user: JwtPayload) {
    return this.gamificationService.awardPoints({
      ...dto,
      churchId: user.churchId ?? undefined,
      actorUserId: user.sub,
    });
  }

  @Post('recompute/:servantId')
  @Roles(Role.SUPER_ADMIN, Role.ADMIN, Role.COORDENADOR)
  recompute(@Param('servantId') servantId: string, @CurrentUser() user: JwtPayload) {
    return this.gamificationService.recomputeServantProfile(servantId, user.churchId ?? undefined);
  }

  @Post('recompute-all')
  @Roles(Role.SUPER_ADMIN, Role.ADMIN)
  recomputeAll(@CurrentUser() user: JwtPayload) {
    return this.gamificationService.recomputeAllProfiles(user.churchId ?? undefined);
  }

  @Get('growth-tracks/my')
  @Roles(Role.SUPER_ADMIN, Role.ADMIN, Role.PASTOR, Role.COORDENADOR, Role.SERVO)
  myGrowthTracks(@CurrentUser() user: JwtPayload) {
    return this.gamificationService.myGrowthTracks(user);
  }

  @Get('achievements/catalog')
  @Roles(Role.SUPER_ADMIN, Role.ADMIN, Role.PASTOR, Role.COORDENADOR, Role.SERVO)
  achievementsCatalog(@CurrentUser() user: JwtPayload) {
    return this.gamificationService.listAchievementsCatalog(user);
  }

  @Get('achievements/me')
  @Roles(Role.SUPER_ADMIN, Role.ADMIN, Role.PASTOR, Role.COORDENADOR, Role.SERVO)
  myAchievements(@CurrentUser() user: JwtPayload) {
    if (!user.servantId) throw new ForbiddenException('User is not linked to a servant');
    return this.gamificationService.listAchievementsCatalog(user, user.servantId);
  }

  @Post('achievements/catalog/sync')
  @Roles(Role.SUPER_ADMIN, Role.ADMIN)
  syncAchievementsCatalog(@CurrentUser() user: JwtPayload) {
    return this.gamificationService.syncDefaultAchievementsCatalog(user.sub, user.churchId ?? null);
  }

  @Get('growth-tracks')
  @Roles(Role.SUPER_ADMIN, Role.ADMIN, Role.PASTOR, Role.COORDENADOR)
  listGrowthTracks(@CurrentUser() user: JwtPayload) {
    return this.gamificationService.listGrowthTracks(user);
  }

  @Get('growth-tracks/:id')
  @Roles(Role.SUPER_ADMIN, Role.ADMIN, Role.PASTOR, Role.COORDENADOR)
  getGrowthTrack(@Param('id') id: string, @CurrentUser() user: JwtPayload) {
    return this.gamificationService.getGrowthTrack(id, user);
  }

  @Post('growth-tracks')
  @Roles(Role.SUPER_ADMIN, Role.ADMIN, Role.COORDENADOR)
  createGrowthTrack(@Body() dto: CreateGrowthTrackDto, @CurrentUser() user: JwtPayload) {
    return this.gamificationService.createGrowthTrack(dto, user);
  }

  @Post('growth-tracks/:trackId/steps')
  @Roles(Role.SUPER_ADMIN, Role.ADMIN, Role.COORDENADOR)
  addGrowthTrackStep(
    @Param('trackId') trackId: string,
    @Body() dto: CreateGrowthTrackStepDto,
    @CurrentUser() user: JwtPayload,
  ) {
    return this.gamificationService.addGrowthTrackStep(trackId, dto, user);
  }

  @Post('growth-tracks/:id/assign')
  @Roles(Role.SUPER_ADMIN, Role.ADMIN, Role.COORDENADOR)
  assignServantToTrack(
    @Param('id') trackId: string,
    @Body() dto: AssignGrowthTrackServantDto,
    @CurrentUser() user: JwtPayload,
  ) {
    return this.gamificationService.assignServantToTrack(trackId, dto.servantId, user);
  }

  @Post('growth-tracks/:id/progress/:servantId')
  @Roles(Role.SUPER_ADMIN, Role.ADMIN, Role.COORDENADOR, Role.SERVO)
  updateGrowthTrackProgress(
    @Param('id') trackId: string,
    @Param('servantId') servantId: string,
    @Body() dto: UpdateGrowthTrackProgressDto,
    @CurrentUser() user: JwtPayload,
  ) {
    return this.gamificationService.updateGrowthTrackProgress(trackId, servantId, dto, user);
  }

  @Post('growth-tracks/:id/approve-step')
  @Roles(Role.SUPER_ADMIN, Role.ADMIN, Role.PASTOR, Role.COORDENADOR)
  approveGrowthTrackStep(
    @Param('id') trackId: string,
    @Body() dto: ApproveGrowthTrackStepDto,
    @CurrentUser() user: JwtPayload,
  ) {
    return this.gamificationService.approveGrowthTrackStep(trackId, dto, user);
  }

  @Get('analytics/church')
  @Roles(Role.SUPER_ADMIN, Role.ADMIN, Role.PASTOR, Role.COORDENADOR)
  analyticsChurch(@Query() query: AnalyticsQueryDto, @CurrentUser() user: JwtPayload) {
    return this.gamificationService.analyticsChurch(user, query);
  }

  @Get('analytics/ministry/:id')
  @Roles(Role.SUPER_ADMIN, Role.ADMIN, Role.PASTOR, Role.COORDENADOR)
  analyticsMinistry(@Param('id') ministryId: string, @Query() query: AnalyticsQueryDto, @CurrentUser() user: JwtPayload) {
    return this.gamificationService.analyticsMinistry(user, ministryId, query);
  }

  @Get('analytics/servant/:id')
  @Roles(Role.SUPER_ADMIN, Role.ADMIN, Role.PASTOR, Role.COORDENADOR, Role.SERVO)
  analyticsServant(@Param('id') servantId: string, @Query() query: AnalyticsQueryDto, @CurrentUser() user: JwtPayload) {
    return this.gamificationService.analyticsServant(user, servantId, query);
  }

  @Get('analytics/me')
  @Roles(Role.SUPER_ADMIN, Role.ADMIN, Role.PASTOR, Role.COORDENADOR, Role.SERVO)
  analyticsMe(@Query() query: AnalyticsQueryDto, @CurrentUser() user: JwtPayload) {
    return this.gamificationService.analyticsMe(user, query);
  }

  @Post('jobs/monthly-stats')
  @Roles(Role.SUPER_ADMIN, Role.ADMIN)
  monthlyStats() {
    return this.gamificationService.buildMonthlyStats(new Date());
  }
}
