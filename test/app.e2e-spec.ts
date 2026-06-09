import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { Server } from 'node:http';
import request from 'supertest';
import { AppModule } from '../src/app.module';

interface HealthResponse {
  hostname: string;
  platform: string;
  uptimeSeconds: number;
  cpu: object;
  memory: object;
  disk: object;
}

describe('WinTidy API (e2e)', () => {
  let app: INestApplication;
  let server: Server;

  beforeAll(async () => {
    const moduleFixture = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    app.setGlobalPrefix('api/v1');
    app.useGlobalPipes(
      new ValidationPipe({
        forbidNonWhitelisted: true,
        transform: true,
        whitelist: true,
      }),
    );
    await app.init();
    // Nest's adapter API is typed as any, while Supertest accepts the server.
    // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
    server = app.getHttpServer();
  });

  afterAll(async () => {
    await app.close();
  });

  it('GET /api/v1/system/health', async () => {
    const response = await request(server)
      .get('/api/v1/system/health')
      .expect(200);
    const body = response.body as unknown as HealthResponse;

    expect(typeof body.hostname).toBe('string');
    expect(typeof body.platform).toBe('string');
    expect(typeof body.uptimeSeconds).toBe('number');
    expect(typeof body.cpu).toBe('object');
    expect(typeof body.memory).toBe('object');
    expect(typeof body.disk).toBe('object');
  });

  it('rejects cleanup without explicit confirmation', async () => {
    await request(server)
      .post('/api/v1/cleanup/run')
      .send({
        categories: ['user-temp'],
        confirm: false,
      })
      .expect(400);
  });

  it('rejects unknown cleanup categories', async () => {
    await request(server)
      .post('/api/v1/cleanup/preview')
      .send({
        categories: ['downloads'],
      })
      .expect(400);
  });
});
