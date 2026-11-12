import assert from 'node:assert/strict';
import { EventEmitter } from 'node:events';
import { Duplex, Readable } from 'node:stream';
import { test } from 'node:test';
import mongoose from 'mongoose';

process.env.NODE_ENV = 'test';
process.env.JWT_SECRET = 'skillorbit-provider-test-secret-at-least-32-chars';
process.env.JWT_EXPIRES_IN = '5m';
process.env.MONGODB_URI = 'mongodb://127.0.0.1:27017/skillorbit_provider_test';
process.env.AI_PROVIDER = 'test';
process.env.AI_API_KEY = 'test-only';

const [
  { default: app },
  { AUTH_COOKIE_NAME },
  { generateToken },
  {
    buildSafeLearnerSummary,
    calculateProviderCompletion,
    computeActiveEnrollmentCount,
  },
  {
    upsertProviderOrganizationSchema,
    createCourseSchema,
    updateCourseSchema,
    updateCourseStatusSchema,
    enrollCourseSchema,
    updateEngagementSchema,
    providerCoursesQuerySchema,
    publicCoursesQuerySchema,
    providerEngagementsQuerySchema,
  },
  { Course },
  { User },
  { Profile },
  {
    getProviderEngagementById,
    updateProviderEngagement,
  },
  {
    getCourseById,
    updateCourse,
    updateCourseStatus,
    deleteCourse,
  },
] = await Promise.all([
  import('../src/app.js'),
  import('../src/utils/auth-cookie.util.js'),
  import('../src/utils/token.util.js'),
  import('../src/utils/provider.util.js'),
  import('../src/validators/provider.validator.js'),
  import('../src/models/Course.model.js'),
  import('../src/models/user.model.js'),
  import('../src/models/Profile.model.js'),
  import('../src/controllers/provider.controller.js'),
  import('../src/controllers/provider-course.controller.js'),
]);

async function dispatchToApp(
  path: string,
  method = 'GET',
  options?: { body?: unknown; headers?: Record<string, string> }
): Promise<Response> {
  return new Promise<Response>((resolve, reject) => {
    const rawBody = options?.body !== undefined ? JSON.stringify(options.body) : null;
    const reqStream = new Readable({
      read() {
        if (rawBody !== null) {
          this.push(rawBody);
        }
        this.push(null);
      },
    }) as any;

    const headers: Record<string, string> = {
      origin: 'http://localhost:5173',
      ...(rawBody !== null ? { 'content-type': 'application/json' } : {}),
      ...(options?.headers ?? {}),
    };

    reqStream.method = method;
    reqStream.url = path;
    reqStream.headers = headers;
    reqStream.rawHeaders = [];

    const mockSocket = new Duplex({
      read() {},
      write(_chunk, _encoding, callback) {
        callback();
      },
    }) as any;
    mockSocket.remoteAddress = '127.0.0.1';
    reqStream.socket = mockSocket;
    reqStream.connection = mockSocket;
    reqStream.ip = '127.0.0.1';

    const resHeaders = new Headers();
    const chunks: Buffer[] = [];
    let statusCode = 200;

    const mockRes = new EventEmitter() as any;
    mockRes.statusCode = statusCode;
    mockRes.headersSent = false;
    mockRes.socket = mockSocket;
    mockRes.connection = mockSocket;

    mockRes.setHeader = (name: string, value: string | string[]) => {
      if (Array.isArray(value)) {
        for (const v of value) resHeaders.append(name, v);
      } else {
        resHeaders.set(name, value);
      }
      return mockRes;
    };
    mockRes.getHeader = (name: string) => resHeaders.get(name);
    mockRes.removeHeader = (name: string) => resHeaders.delete(name);
    mockRes.hasHeader = (name: string) => resHeaders.has(name);
    mockRes.writeHead = (code: number) => {
      statusCode = code;
      mockRes.statusCode = code;
      return mockRes;
    };
    mockRes.write = (chunk: any) => {
      if (chunk) chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
      return true;
    };
    mockRes.end = (chunk?: any) => {
      if (chunk) chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
      mockRes.headersSent = true;
      resolve(
        new Response(Buffer.concat(chunks), {
          status: mockRes.statusCode ?? statusCode,
          headers: resHeaders,
        })
      );
    };

    app(reqStream, mockRes, (err: unknown) => {
      if (err) reject(err);
    });
  });
}

function createMockRes(): {
  res: any;
  getStatus: () => number;
  getBody: () => any;
} {
  let statusCode = 200;
  let body: any = null;
  const res = {
    status(code: number) {
      statusCode = code;
      return this;
    },
    json(payload: unknown) {
      body = payload;
      return this;
    },
  };
  return {
    res,
    getStatus: () => statusCode,
    getBody: () => body,
  };
}

test('calculateProviderCompletion calculates completion % and missing fields accurately', () => {
  const empty = calculateProviderCompletion(null);
  assert.equal(empty.percentage, 0);
  assert.equal(empty.missingFields.length, 10);

  const partial = calculateProviderCompletion({
    name: 'CloudCraft Academy',
    specialization: 'Cloud Architecture & Kubernetes',
    industry: 'Cloud Computing',
    description: 'Hands-on labs and industry certification prep.',
  });
  assert.equal(partial.percentage, 50);
  assert.ok(!partial.missingFields.includes('Specialization'));
  assert.ok(partial.missingFields.includes('Logo Image'));

  const complete = calculateProviderCompletion({
    name: 'CloudCraft Academy',
    specialization: 'Cloud Architecture & Kubernetes',
    industry: 'Cloud Computing',
    location: 'Seattle, WA',
    description: 'Hands-on labs and certification bootcamps.',
    size: '11-50',
    websiteUrl: 'https://cloudcraft.example.com',
    logoUrl: 'https://cdn.example.com/cloudcraft.png',
    contactEmail: 'admissions@cloudcraft.example.com',
    socialLinks: { linkedin: 'https://linkedin.com/company/cloudcraft' },
  });
  assert.equal(complete.percentage, 100);
  assert.deepEqual(complete.missingFields, []);
});

test('computeActiveEnrollmentCount counts confirmed/active/completed enrollments only', () => {
  const learnerId = new mongoose.Types.ObjectId();
  const count = computeActiveEnrollmentCount([
    { learner: learnerId, type: 'enrollment', status: 'enrolled', progress: 10, statusHistory: [], enrolledAt: new Date() },
    { learner: learnerId, type: 'enrollment', status: 'active', progress: 60, statusHistory: [], enrolledAt: new Date() },
    { learner: learnerId, type: 'enrollment', status: 'completed', progress: 100, statusHistory: [], enrolledAt: new Date() },
    { learner: learnerId, type: 'enrollment', status: 'pending', progress: 0, statusHistory: [], enrolledAt: new Date() },
    { learner: learnerId, type: 'enrollment', status: 'withdrawn', progress: 0, statusHistory: [], enrolledAt: new Date() },
    { learner: learnerId, type: 'enquiry', status: 'enrolled', progress: 0, statusHistory: [], enrolledAt: new Date() },
  ]);
  assert.equal(count, 3);
});

test('buildSafeLearnerSummary projects safe career data without leaking private contact info', () => {
  const learnerId = String(new mongoose.Types.ObjectId());
  const summary = buildSafeLearnerSummary(
    learnerId,
    { name: 'Ada Lovelace', email: 'private-secret@example.com' } as any,
    {
      headline: 'Backend Systems Engineer',
      location: 'London, UK',
      phone: '+44-7700-900077',
      skills: ['TypeScript', 'Docker'],
      availability: 'immediate',
    } as any
  ) as any;

  assert.equal(summary.name, 'Ada Lovelace');
  assert.equal(summary.email, undefined);
  assert.equal(summary.profile.phone, undefined);
  assert.equal(summary.profile.headline, 'Backend Systems Engineer');
  assert.deepEqual(summary.profile.skills, ['TypeScript', 'Docker']);
});

test('upsertProviderOrganizationSchema rejects XSS URLs and unknown fields (mass assignment)', () => {
  const valid = upsertProviderOrganizationSchema.safeParse({
    name: 'SkillForge Institute',
    specialization: 'Applied ML & Data Engineering',
    industry: 'EdTech',
    size: '11-50',
    founded: 2020,
    location: 'Remote / Toronto',
    description: 'Cohort-based technical upskilling for cloud & AI practitioners.',
    websiteUrl: 'https://skillforge.example.com',
    logoUrl: 'https://cdn.skillforge.example.com/logo.png',
    contactEmail: 'hello@skillforge.example.com',
    socialLinks: {
      linkedin: 'https://linkedin.com/school/skillforge',
    },
  });
  assert.equal(valid.success, true);

  const badUrl = upsertProviderOrganizationSchema.safeParse({
    name: 'SkillForge Institute',
    websiteUrl: 'javascript:alert(1)',
  });
  assert.equal(badUrl.success, false);

  const massAssign = upsertProviderOrganizationSchema.safeParse({
    name: 'SkillForge Institute',
    isVerified: true,
    type: 'admin',
  });
  assert.equal(massAssign.success, false);
});

test('course schemas validate syllabus, pricing, URLs, status transitions, and reject unexpected keys', () => {
  const validCourse = createCourseSchema.safeParse({
    title: 'Production Kubernetes Bootcamp',
    description: 'Deep dive into Kubernetes clusters, Helm, observability, and GitOps pipelines.',
    category: 'Cloud & DevOps',
    level: 'intermediate',
    deliveryMode: 'live-cohort',
    duration: 40,
    price: 299,
    currency: 'usd',
    certificationOffered: true,
    skills: ['Kubernetes', 'Docker', 'Terraform'],
    tags: ['devops', 'k8s'],
    thumbnailUrl: 'https://cdn.example.com/k8s.png',
    externalUrl: 'https://courses.example.com/k8s',
    syllabus: [
      {
        moduleTitle: 'Cluster Internals',
        lessons: ['Control Plane Deep Dive', 'etcd Backup & Restore'],
        duration: 6,
      },
    ],
    status: 'published',
  });
  assert.equal(validCourse.success, true);
  if (validCourse.success) {
    assert.equal(validCourse.data.currency, 'USD');
  }

  const badUrlCourse = createCourseSchema.safeParse({
    title: 'XSS Course Test',
    description: 'Valid long description exceeding twenty characters cleanly.',
    externalUrl: 'ftp://invalid.example.com/course',
  });
  assert.equal(badUrlCourse.success, false);

  const massAssignCourse = createCourseSchema.safeParse({
    title: 'Valid Course Title',
    description: 'Valid long description exceeding twenty characters cleanly.',
    enrollmentCount: 9999,
  });
  assert.equal(massAssignCourse.success, false);

  assert.equal(updateCourseSchema.safeParse({}).success, false);
  assert.equal(updateCourseStatusSchema.safeParse({ status: 'archived' }).success, true);
  assert.equal(updateCourseStatusSchema.safeParse({ status: 'active' }).success, false);
});

test('engagement and query schemas validate constraints accurately', () => {
  assert.equal(enrollCourseSchema.safeParse({ type: 'enquiry', learnerMessage: 'What prerequisites exist?' }).success, true);
  assert.equal(updateEngagementSchema.safeParse({}).success, false);
  assert.equal(updateEngagementSchema.safeParse({ status: 'completed', progress: 100 }).success, true);
  assert.equal(updateEngagementSchema.safeParse({ progress: 120 }).success, false);
  assert.equal(providerCoursesQuerySchema.safeParse({ status: 'published', sort: 'enrollments_desc' }).success, true);
  assert.equal(publicCoursesQuerySchema.safeParse({ sort: 'popular', limit: 12 }).success, true);
  assert.equal(providerEngagementsQuerySchema.safeParse({ status: 'pending', type: 'enquiry' }).success, true);
});

test('provider and course write/owned HTTP routes enforce authentication (401) and ObjectId validation (400)', async () => {
  const fakeId = String(new mongoose.Types.ObjectId());
  const protectedRoutes: Array<[string, string, unknown?]> = [
    ['GET', '/api/provider/dashboard'],
    ['GET', '/api/provider/profile'],
    ['PUT', '/api/provider/profile', { name: 'Test Academy' }],
    ['GET', '/api/provider/engagements'],
    ['GET', `/api/provider/engagements/${fakeId}`],
    ['PATCH', `/api/provider/engagements/${fakeId}`, { status: 'enrolled' }],
    ['GET', '/api/courses/provider'],
    ['POST', '/api/courses', { title: 'Test Course', description: 'Valid course description longer than 20 chars' }],
    ['PUT', `/api/courses/${fakeId}`, { title: 'Updated Title' }],
    ['PATCH', `/api/courses/${fakeId}/status`, { status: 'published' }],
    ['DELETE', `/api/courses/${fakeId}`],
    ['POST', `/api/courses/${fakeId}/enroll`, { type: 'enrollment' }],
    ['GET', `/api/courses/${fakeId}/learners`],
  ];

  for (const [method, path, body] of protectedRoutes) {
    const res = await dispatchToApp(path, method, { body });
    assert.equal(res.status, 401, `${method} ${path} must reject unauthenticated callers`);
  }

  const badIdRes = await dispatchToApp('/api/courses/not-a-valid-id', 'GET');
  assert.equal(badIdRes.status, 400);
});

test('role-based access control rejects seeker/employer roles on /api/provider/* and provider role on /enroll', async () => {
  const seekerId = String(new mongoose.Types.ObjectId());
  const providerId = String(new mongoose.Types.ObjectId());
  const fakeCourseId = String(new mongoose.Types.ObjectId());
  const originalFindById = User.findById;

  try {
    // 1) Seeker token calling provider dashboard -> 403
    (User as any).findById = () => ({
      select: async () => ({
        id: seekerId,
        name: 'Seeker User',
        email: 'seeker@example.com',
        role: 'seeker',
        isActive: true,
        isDeleted: false,
        deletedAt: null,
        createdAt: new Date(),
        updatedAt: new Date(),
      }),
    });

    const seekerToken = generateToken(seekerId);
    const seekerDashRes = await dispatchToApp('/api/provider/dashboard', 'GET', {
      headers: { cookie: `${AUTH_COOKIE_NAME}=${seekerToken}` },
    });
    assert.equal(seekerDashRes.status, 403);
    assert.equal(((await seekerDashRes.json()) as { code: string }).code, 'FORBIDDEN');

    // 2) Provider token calling seeker enroll route -> 403
    (User as any).findById = () => ({
      select: async () => ({
        id: providerId,
        name: 'Provider User',
        email: 'provider@example.com',
        role: 'provider',
        isActive: true,
        isDeleted: false,
        deletedAt: null,
        createdAt: new Date(),
        updatedAt: new Date(),
      }),
    });

    const providerToken = generateToken(providerId);
    const providerEnrollRes = await dispatchToApp(`/api/courses/${fakeCourseId}/enroll`, 'POST', {
      headers: { cookie: `${AUTH_COOKIE_NAME}=${providerToken}` },
      body: { type: 'enrollment' },
    });
    assert.equal(providerEnrollRes.status, 403);
    assert.equal(((await providerEnrollRes.json()) as { code: string }).code, 'FORBIDDEN');
  } finally {
    User.findById = originalFindById;
  }
});

test('getCourseById hides unpublished draft courses from non-owners while allowing owning provider', async () => {
  const ownerId = new mongoose.Types.ObjectId();
  const intruderId = new mongoose.Types.ObjectId();
  const courseId = new mongoose.Types.ObjectId();
  const originalFindOne = Course.findOne;

  (Course as any).findOne = () => ({
    populate() {
      return this;
    },
    lean: async () => ({
      _id: courseId,
      provider: { _id: ownerId, name: 'Real Provider' },
      title: 'Confidential AI Syllabus',
      description: 'Internal draft curriculum not yet published.',
      status: 'draft',
      enrollments: [{ _id: new mongoose.Types.ObjectId(), providerNote: 'Secret' }],
    }),
  });

  try {
    const anon = createMockRes();
    await getCourseById({ params: { id: String(courseId) } } as any, anon.res);
    assert.equal(anon.getStatus(), 404);

    const intruder = createMockRes();
    await getCourseById(
      { params: { id: String(courseId) }, userId: String(intruderId), userRole: 'provider' } as any,
      intruder.res
    );
    assert.equal(intruder.getStatus(), 404);

    const owner = createMockRes();
    await getCourseById(
      { params: { id: String(courseId) }, userId: String(ownerId), userRole: 'provider' } as any,
      owner.res
    );
    assert.equal(owner.getStatus(), 200);
    assert.equal(owner.getBody().data.course.title, 'Confidential AI Syllabus');
    assert.equal(owner.getBody().data.course.enrollments, undefined);
  } finally {
    Course.findOne = originalFindOne;
  }
});

test('updateCourse, updateCourseStatus, and deleteCourse reject cross-provider modifications (403)', async () => {
  const ownerId = new mongoose.Types.ObjectId();
  const attackerId = new mongoose.Types.ObjectId();
  const courseId = new mongoose.Types.ObjectId();
  const originalFindOne = Course.findOne;

  (Course as any).findOne = async () => ({
    _id: courseId,
    provider: ownerId,
    title: 'Owned Course',
    status: 'draft',
  });

  try {
    const updateMock = createMockRes();
    await updateCourse(
      {
        params: { id: String(courseId) },
        userId: String(attackerId),
        userRole: 'provider',
        body: { title: 'Hijacked Title' },
      } as any,
      updateMock.res
    );
    assert.equal(updateMock.getStatus(), 403);
    assert.equal(updateMock.getBody().code, 'FORBIDDEN');

    const statusMock = createMockRes();
    await updateCourseStatus(
      {
        params: { id: String(courseId) },
        userId: String(attackerId),
        userRole: 'provider',
        body: { status: 'published' },
      } as any,
      statusMock.res
    );
    assert.equal(statusMock.getStatus(), 403);
    assert.equal(statusMock.getBody().code, 'FORBIDDEN');

    const deleteMock = createMockRes();
    await deleteCourse(
      {
        params: { id: String(courseId) },
        userId: String(attackerId),
        userRole: 'provider',
      } as any,
      deleteMock.res
    );
    assert.equal(deleteMock.getStatus(), 403);
    assert.equal(deleteMock.getBody().code, 'FORBIDDEN');
  } finally {
    Course.findOne = originalFindOne;
  }
});

test('getProviderEngagementById and updateProviderEngagement enforce ownership and reject withdrawn edits', async () => {
  const realProviderId = new mongoose.Types.ObjectId();
  const attackerProviderId = new mongoose.Types.ObjectId();
  const learnerId = new mongoose.Types.ObjectId();
  const courseId = new mongoose.Types.ObjectId();
  const engagementId = new mongoose.Types.ObjectId();

  const originalCourseFindOne = Course.findOne;
  const originalUserFindOne = User.findOne;
  const originalProfileFindOne = Profile.findOne;

  try {
    // 1) Cross-provider read returns 403 FORBIDDEN
    (Course as any).findOne = () => ({
      populate() {
        return this;
      },
      lean: async () => ({
        _id: courseId,
        provider: realProviderId,
        title: 'Protected Bootcamp',
        status: 'published',
        enrollments: [
          {
            _id: engagementId,
            learner: learnerId,
            type: 'enrollment',
            status: 'active',
            progress: 40,
            statusHistory: [],
            enrolledAt: new Date(),
          },
        ],
      }),
    });

    const getForbidden = createMockRes();
    await getProviderEngagementById(
      {
        params: { engagementId: String(engagementId) },
        userId: String(attackerProviderId),
        userRole: 'provider',
      } as any,
      getForbidden.res
    );
    assert.equal(getForbidden.getStatus(), 403);
    assert.equal(getForbidden.getBody().code, 'FORBIDDEN');

    // 2) Cross-provider update returns 403 FORBIDDEN
    (Course as any).findOne = async () => ({
      _id: courseId,
      provider: realProviderId,
      title: 'Protected Bootcamp',
      enrollments: [
        {
          _id: engagementId,
          learner: learnerId,
          type: 'enrollment',
          status: 'active',
          progress: 40,
          statusHistory: [],
          enrolledAt: new Date(),
        },
      ],
    });

    const patchForbidden = createMockRes();
    await updateProviderEngagement(
      {
        params: { engagementId: String(engagementId) },
        userId: String(attackerProviderId),
        userRole: 'provider',
        body: { status: 'completed' },
      } as any,
      patchForbidden.res
    );
    assert.equal(patchForbidden.getStatus(), 403);

    // 3) Owner cannot edit withdrawn engagement
    (Course as any).findOne = async () => ({
      _id: courseId,
      provider: realProviderId,
      title: 'Protected Bootcamp',
      enrollments: [
        {
          _id: engagementId,
          learner: learnerId,
          type: 'enrollment',
          status: 'withdrawn',
          progress: 0,
          statusHistory: [],
          enrolledAt: new Date(),
        },
      ],
    });

    const withdrawnMock = createMockRes();
    await updateProviderEngagement(
      {
        params: { engagementId: String(engagementId) },
        userId: String(realProviderId),
        userRole: 'provider',
        body: { status: 'active' },
      } as any,
      withdrawnMock.res
    );
    assert.equal(withdrawnMock.getStatus(), 400);
    assert.equal(withdrawnMock.getBody().code, 'INVALID_STATUS_TRANSITION');
  } finally {
    Course.findOne = originalCourseFindOne;
    User.findOne = originalUserFindOne;
    Profile.findOne = originalProfileFindOne;
  }
});
