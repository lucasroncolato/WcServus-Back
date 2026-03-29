import { BadRequestException, ForbiddenException, INestApplication, ValidationPipe } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { Test } from '@nestjs/testing';
import { Role } from '@prisma/client';
import request = require('supertest');
import { RolesGuard } from 'src/common/guards/roles.guard';
import { TeamsController } from 'src/modules/teams/teams.controller';
import { TeamsService } from 'src/modules/teams/teams.service';
import { UsersController } from 'src/modules/users/users.controller';
import { UsersService } from 'src/modules/users/users.service';

type FakeEntity = { id: string; churchId: string };

describe('E2E tenant link integrity (cross-church links blocked)', () => {
  let app: INestApplication;

  const servants: Record<string, FakeEntity> = {
    'servant-a': { id: 'servant-a', churchId: 'church-a' },
    'servant-b': { id: 'servant-b', churchId: 'church-b' },
  };

  const teams: Record<string, FakeEntity> = {
    'team-a': { id: 'team-a', churchId: 'church-a' },
    'team-b': { id: 'team-b', churchId: 'church-b' },
  };

  const users: Record<string, FakeEntity> = {
    'user-a': { id: 'user-a', churchId: 'church-a' },
    'user-b': { id: 'user-b', churchId: 'church-b' },
  };

  beforeAll(async () => {
    const teamsServiceMock = {
      addMember: jest.fn((teamId: string, servantId: string, actor: { churchId?: string | null }) => {
        const team = teams[teamId];
        const servant = servants[servantId];
        if (!team || !servant) {
          throw new BadRequestException('Entity not found');
        }
        if (team.churchId !== actor.churchId || servant.churchId !== actor.churchId) {
          throw new ForbiddenException('Cross-church link blocked');
        }
        return { data: { teamId, servantId } };
      }),
      removeMember: jest.fn(() => ({ data: {} })),
      findAll: jest.fn(() => ({ data: [] })),
      findOne: jest.fn(() => ({ data: {} })),
      create: jest.fn(() => ({ data: {} })),
      update: jest.fn(() => ({ data: {} })),
      remove: jest.fn(() => ({ data: {} })),
      members: jest.fn(() => ({ data: [] })),
      updateLeader: jest.fn(() => ({ data: {} })),
    };

    const usersServiceMock = {
      setServantLink: jest.fn((userId: string, dto: { servantId?: string | null }, actorUserId?: string) => {
        const actorChurch = actorUserId === 'admin-a' ? 'church-a' : 'church-b';
        const user = users[userId];
        if (!user) {
          throw new BadRequestException('User not found');
        }
        if (user.churchId !== actorChurch) {
          throw new ForbiddenException('Cross-church user access blocked');
        }
        if (dto.servantId) {
          const servant = servants[dto.servantId];
          if (!servant || servant.churchId !== actorChurch) {
            throw new ForbiddenException('Cross-church servant link blocked');
          }
        }
        return { data: { userId, servantId: dto.servantId ?? null } };
      }),
      findAll: jest.fn(),
      findEligible: jest.fn(),
      findOne: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      updateStatus: jest.fn(),
      resetPassword: jest.fn(),
      updateRole: jest.fn(),
      updateScope: jest.fn(),
      remove: jest.fn(),
    };

    const moduleRef = await Test.createTestingModule({
      controllers: [TeamsController, UsersController],
      providers: [
        { provide: TeamsService, useValue: teamsServiceMock },
        { provide: UsersService, useValue: usersServiceMock },
      ],
    }).compile();

    app = moduleRef.createNestApplication();
    app.use((req: { headers: Record<string, string | string[] | undefined>; user?: unknown }, _res: unknown, next: () => void) => {
      const churchId = String(req.headers['x-test-church'] ?? 'church-a');
      req.user = {
        sub: churchId === 'church-a' ? 'admin-a' : 'admin-b',
        email: 'admin@local',
        role: String(req.headers['x-test-role'] ?? Role.ADMIN),
        churchId,
        servantId: null,
      };
      next();
    });
    app.useGlobalGuards(new RolesGuard(new Reflector()));
    app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true, forbidNonWhitelisted: true }));
    await app.init();
  });

  afterAll(async () => {
    await app.close();
  });

  it('blocks adding member from church B into team from church A', async () => {
    await request(app.getHttpServer())
      .post('/teams/team-a/members/servant-b')
      .set('x-test-role', Role.ADMIN)
      .set('x-test-church', 'church-a')
      .expect(403);
  });

  it('allows adding member when team and servant belong to same church', async () => {
    await request(app.getHttpServer())
      .post('/teams/team-a/members/servant-a')
      .set('x-test-role', Role.ADMIN)
      .set('x-test-church', 'church-a')
      .expect(201);
  });

  it('blocks linking user to servant from another church by id tampering', async () => {
    await request(app.getHttpServer())
      .patch('/users/user-a/servant-link')
      .set('x-test-role', Role.ADMIN)
      .set('x-test-church', 'church-a')
      .send({ servantId: 'servant-b' })
      .expect(403);
  });
});
