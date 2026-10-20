export const swaggerDocument = {
  openapi: '3.0.0',
  info: {
    title: 'ComputeGrid REST API',
    version: '1.0.0',
    description:
      'Cloud-coordinated decentralized compute grid API for distributed task execution, worker management, and artifact storage.',
  },
  servers: [{ url: '/api/v1', description: 'API v1' }],
  components: {
    securitySchemes: {
      BearerAuth: {
        type: 'http',
        scheme: 'bearer',
        bearerFormat: 'JWT',
      },
      WorkerAuth: {
        type: 'apiKey',
        in: 'header',
        name: 'x-worker-secret',
        description: 'Worker secret credential provided along with x-worker-id',
      },
    },
  },
  paths: {
    '/auth/register': {
      post: {
        summary: 'Register new user account',
        requestBody: {
          content: {
            'application/json': {
              schema: {
                type: 'object',
                required: ['email', 'username', 'password'],
                properties: {
                  email: { type: 'string', format: 'email' },
                  username: { type: 'string' },
                  password: { type: 'string', minLength: 8 },
                },
              },
            },
          },
        },
        responses: { 201: { description: 'User registered' } },
      },
    },
    '/auth/login': {
      post: {
        summary: 'Authenticate user and issue JWT',
        requestBody: {
          content: {
            'application/json': {
              schema: {
                type: 'object',
                required: ['email', 'password'],
                properties: {
                  email: { type: 'string', format: 'email' },
                  password: { type: 'string' },
                },
              },
            },
          },
        },
        responses: { 200: { description: 'Authenticated successfully' } },
      },
    },
    '/jobs': {
      post: {
        summary: 'Submit a new distributed compute job',
        security: [{ BearerAuth: [] }],
        requestBody: {
          content: {
            'application/json': {
              schema: {
                type: 'object',
                required: ['name', 'workloadType', 'parameters'],
                properties: {
                  name: { type: 'string' },
                  description: { type: 'string' },
                  workloadType: {
                    type: 'string',
                    enum: ['MATH_PARALLEL', 'FILE_CHUNK_PROCESSING'],
                  },
                  priority: { type: 'integer', default: 5 },
                  maxRetriesPerTask: { type: 'integer', default: 2 },
                  parameters: { type: 'object' },
                },
              },
            },
          },
        },
        responses: { 201: { description: 'Job created and scheduled' } },
      },
      get: {
        summary: 'List jobs with search and filters',
        security: [{ BearerAuth: [] }],
        responses: { 200: { description: 'List of jobs' } },
      },
    },
    '/workers/enroll': {
      post: {
        summary: 'Generate worker enrollment token',
        security: [{ BearerAuth: [] }],
        responses: { 201: { description: 'Enrollment token created' } },
      },
    },
    '/workers/register': {
      post: {
        summary: 'Register new worker agent using enrollment token',
        responses: { 201: { description: 'Worker registered with secret credentials' } },
      },
    },
    '/worker/tasks/claim': {
      get: {
        summary: 'Worker claims next available compatible task',
        security: [{ WorkerAuth: [] }],
        responses: {
          200: { description: 'Task claimed with lease' },
          204: { description: 'No tasks available' },
        },
      },
    },
    '/health/live': {
      get: {
        summary: 'Liveness probe',
        responses: { 200: { description: 'Server alive' } },
      },
    },
    '/health/ready': {
      get: {
        summary: 'Readiness probe checking DB and Queue',
        responses: { 200: { description: 'Server ready' } },
      },
    },
  },
};
