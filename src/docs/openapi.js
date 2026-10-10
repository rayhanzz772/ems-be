const jsonResponse = (description) => ({
  description,
  content: {
    'application/json': {
      schema: { $ref: '#/components/schemas/ApiResponse' }
    }
  }
})

const csvResponse = {
  description: 'CSV file download',
  content: {
    'text/csv': {
      schema: { type: 'string', format: 'binary' }
    }
  }
}

const operation = (tag, summary, responses, options = {}) => ({
  tags: [tag],
  summary,
  responses,
  ...options
})

const secured = (tag, summary, responses, options = {}) =>
  operation(tag, summary, responses, {
    security: [{ BearerAuth: [] }],
    ...options
  })

const body = (schema, required = true) => ({
  required,
  content: {
    'application/json': {
      schema: { $ref: `#/components/schemas/${schema}` }
    }
  }
})

const idParameter = {
  name: 'id',
  in: 'path',
  required: true,
  schema: { type: 'string' }
}

const query = (name, schema, description) => ({
  name,
  in: 'query',
  required: false,
  description,
  schema
})

const paginationParameters = [
  query('page', { type: 'integer', minimum: 1, default: 1 }),
  query('per_page', { type: 'integer', minimum: 1, maximum: 100, default: 10 }),
  query('q', { type: 'string' }, 'Free-text search')
]

const sortParameters = (fields) => [
  query('sort_by', { type: 'string', enum: fields }),
  query('sort_order', { type: 'string', enum: ['ASC', 'DESC'], default: 'DESC' })
]

const standardResponses = {
  400: jsonResponse('Invalid request'),
  401: jsonResponse('Authentication required or invalid token'),
  403: jsonResponse('Insufficient role'),
  500: jsonResponse('Internal server error')
}

const idPath = (collection, suffix) => `${collection}/{id}/${suffix}`

module.exports = {
  openapi: '3.0.3',
  info: {
    title: 'Employee Management System API',
    version: '1.0.0',
    description: 'API contract for the Employee Management System.'
  },
  servers: [
    {
      url: process.env.API_BASE_URL || 'http://localhost:8000',
      description: 'API server origin'
    }
  ],
  tags: [
    { name: 'Health' },
    { name: 'System' },
    { name: 'Dashboard' },
    { name: 'Auth' },
    { name: 'Roles' },
    { name: 'Users' },
    { name: 'Departments' },
    { name: 'Branches' },
    { name: 'Positions' },
    { name: 'Employees' },
    { name: 'Leaves' },
    { name: 'Audit Logs' }
  ],
  paths: {
    '/health': {
      get: operation('Health', 'Check API and database readiness', {
        200: jsonResponse('Service is ready'),
        503: jsonResponse('Service or database is unavailable')
      })
    },
    '/api/v1/status': {
      get: operation('System', 'Check that the API process is responding', {
        200: { description: 'Running status text', content: { 'text/plain': { schema: { type: 'string' } } } }
      })
    },
    '/api/v1/dashboard': {
      get: secured('Dashboard', 'Get dashboard metrics, employment lifecycle counts, and recent activity', {
        200: jsonResponse('Dashboard summary'),
        ...standardResponses
      })
    },
    '/api/v1/auth/login': {
      post: operation('Auth', 'Log in and receive a JWT', {
        200: jsonResponse('Login successful'),
        400: jsonResponse('Invalid credentials'),
        500: jsonResponse('Internal server error')
      }, {
        requestBody: body('LoginRequest'),
        description: 'The token is returned in an HTTP-only cookie and user data is returned in the response.'
      })
    },
    '/api/v1/auth/get-me': {
      get: secured('Auth', 'Get the authenticated user', {
        200: jsonResponse('Authenticated user'),
        ...standardResponses
      })
    },
    '/api/v1/roles': {
      get: secured('Roles', 'List roles', {
        200: jsonResponse('Paginated roles'),
        ...standardResponses
      }, {
        parameters: [
          ...paginationParameters,
          query('status', { type: 'boolean' }),
          ...sortParameters(['name', 'status', 'created_at', 'updated_at'])
        ]
      })
    },
    '/api/v1/roles/create': {
      post: secured('Roles', 'Create a role', {
        201: jsonResponse('Role created'),
        ...standardResponses
      }, { requestBody: body('RoleCreateRequest') })
    },
    [idPath('/api/v1/roles', 'detail')]: {
      get: secured('Roles', 'Get a role by ID', {
        200: jsonResponse('Role details'),
        404: jsonResponse('Role not found'),
        ...standardResponses
      }, { parameters: [idParameter] })
    },
    [idPath('/api/v1/roles', 'update')]: {
      put: secured('Roles', 'Update a role', {
        200: jsonResponse('Role updated'),
        404: jsonResponse('Role not found'),
        ...standardResponses
      }, { parameters: [idParameter], requestBody: body('RoleUpdateRequest') })
    },
    [idPath('/api/v1/roles', 'delete')]: {
      delete: secured('Roles', 'Delete a role', {
        200: jsonResponse('Role deleted'),
        404: jsonResponse('Role not found'),
        409: jsonResponse('Role is assigned to users'),
        ...standardResponses
      }, { parameters: [idParameter] })
    },
    [idPath('/api/v1/roles', 'status')]: {
      patch: secured('Roles', 'Toggle role active status', {
        200: jsonResponse('Role status changed'),
        404: jsonResponse('Role not found'),
        ...standardResponses
      }, {
        parameters: [idParameter],
        description: 'Bodyless operation. The server negates the current status.'
      })
    },
    '/api/v1/users': {
      get: secured('Users', 'List users', {
        200: jsonResponse('Paginated users'),
        ...standardResponses
      }, {
        parameters: [
          ...paginationParameters,
          query('role', { type: 'string', enum: ['ADMIN', 'HR', 'EMPLOYEE'] }),
          query('status', { type: 'boolean' }),
          ...sortParameters(['email', 'role', 'status', 'created_at'])
        ]
      })
    },
    '/api/v1/users/create': {
      post: secured('Users', 'Create a user', {
        201: jsonResponse('User created'),
        409: jsonResponse('Email already exists'),
        ...standardResponses
      }, { requestBody: body('UserCreateRequest') })
    },
    [idPath('/api/v1/users', 'detail')]: {
      get: secured('Users', 'Get a user by ID', {
        200: jsonResponse('User details'),
        404: jsonResponse('User not found'),
        ...standardResponses
      }, { parameters: [idParameter] })
    },
    [idPath('/api/v1/users', 'update')]: {
      put: secured('Users', 'Update a user', {
        200: jsonResponse('User updated'),
        404: jsonResponse('User not found'),
        409: jsonResponse('Email already exists'),
        ...standardResponses
      }, { parameters: [idParameter], requestBody: body('UserUpdateRequest') })
    },
    [idPath('/api/v1/users', 'delete')]: {
      delete: secured('Users', 'Soft-delete a user', {
        200: jsonResponse('User deleted'),
        404: jsonResponse('User not found'),
        ...standardResponses
      }, { parameters: [idParameter] })
    },
    [idPath('/api/v1/users', 'status')]: {
      patch: secured('Users', 'Toggle user active status', {
        200: jsonResponse('User status changed'),
        404: jsonResponse('User not found'),
        ...standardResponses
      }, {
        parameters: [idParameter],
        description: 'Bodyless operation. The server negates the current status.'
      })
    },
    '/api/v1/departments': {
      get: secured('Departments', 'List departments', {
        200: jsonResponse('Paginated departments'),
        ...standardResponses
      }, {
        parameters: [
          ...paginationParameters,
          query('status', { type: 'boolean' }),
          ...sortParameters(['name', 'status', 'created_at', 'updated_at'])
        ]
      })
    },
    '/api/v1/departments/create': {
      post: secured('Departments', 'Create a department', {
        201: jsonResponse('Department created'),
        ...standardResponses
      }, { requestBody: body('DepartmentCreateRequest') })
    },
    [idPath('/api/v1/departments', 'detail')]: {
      get: secured('Departments', 'Get a department by ID', {
        200: jsonResponse('Department details'),
        404: jsonResponse('Department not found'),
        ...standardResponses
      }, { parameters: [idParameter] })
    },
    [idPath('/api/v1/departments', 'update')]: {
      put: secured('Departments', 'Update a department', {
        200: jsonResponse('Department updated'),
        404: jsonResponse('Department not found'),
        ...standardResponses
      }, { parameters: [idParameter], requestBody: body('DepartmentUpdateRequest') })
    },
    [idPath('/api/v1/departments', 'delete')]: {
      delete: secured('Departments', 'Delete an unused department', {
        200: jsonResponse('Department deleted'),
        404: jsonResponse('Department not found'),
        409: jsonResponse('Department is assigned to employees'),
        ...standardResponses
      }, { parameters: [idParameter] })
    },
    '/api/v1/branches': {
      get: secured('Branches', 'List branches', {
        200: jsonResponse('Paginated branches'),
        ...standardResponses
      }, {
        parameters: [
          ...paginationParameters,
          query('status', { type: 'boolean' }),
          ...sortParameters(['name', 'status', 'created_at', 'updated_at'])
        ]
      })
    },
    '/api/v1/branches/create': {
      post: secured('Branches', 'Create a branch', {
        201: jsonResponse('Branch created'),
        ...standardResponses
      }, { requestBody: body('BranchCreateRequest') })
    },
    [idPath('/api/v1/branches', 'detail')]: {
      get: secured('Branches', 'Get a branch by ID', {
        200: jsonResponse('Branch details'),
        404: jsonResponse('Branch not found'),
        ...standardResponses
      }, { parameters: [idParameter] })
    },
    [idPath('/api/v1/branches', 'update')]: {
      put: secured('Branches', 'Update a branch', {
        200: jsonResponse('Branch updated'),
        404: jsonResponse('Branch not found'),
        ...standardResponses
      }, { parameters: [idParameter], requestBody: body('BranchUpdateRequest') })
    },
    [idPath('/api/v1/branches', 'delete')]: {
      delete: secured('Branches', 'Delete an unused branch', {
        200: jsonResponse('Branch deleted'),
        404: jsonResponse('Branch not found'),
        409: jsonResponse('Branch is assigned to employees'),
        ...standardResponses
      }, { parameters: [idParameter] })
    },
    [idPath('/api/v1/branches', 'status')]: {
      patch: secured('Branches', 'Toggle branch active status', {
        200: jsonResponse('Branch status changed'),
        404: jsonResponse('Branch not found'),
        ...standardResponses
      }, {
        parameters: [idParameter],
        description: 'Bodyless operation. The server negates the current status.'
      })
    },
    '/api/v1/positions': {
      get: secured('Positions', 'List positions', {
        200: jsonResponse('Paginated positions'),
        ...standardResponses
      }, {
        parameters: [
          ...paginationParameters,
          ...sortParameters(['name', 'created_at', 'updated_at'])
        ]
      })
    },
    '/api/v1/positions/create': {
      post: secured('Positions', 'Create a position', {
        201: jsonResponse('Position created'),
        ...standardResponses
      }, { requestBody: body('PositionCreateRequest') })
    },
    [idPath('/api/v1/positions', 'detail')]: {
      get: secured('Positions', 'Get a position by ID', {
        200: jsonResponse('Position details'),
        404: jsonResponse('Position not found'),
        ...standardResponses
      }, { parameters: [idParameter] })
    },
    [idPath('/api/v1/positions', 'update')]: {
      put: secured('Positions', 'Update a position', {
        200: jsonResponse('Position updated'),
        404: jsonResponse('Position not found'),
        ...standardResponses
      }, { parameters: [idParameter], requestBody: body('PositionUpdateRequest') })
    },
    [idPath('/api/v1/positions', 'delete')]: {
      delete: secured('Positions', 'Delete a position not assigned to employees', {
        200: jsonResponse('Position deleted'),
        404: jsonResponse('Position not found'),
        409: jsonResponse('Position is assigned to employees'),
        ...standardResponses
      }, { parameters: [idParameter] })
    },
    '/api/v1/employees': {
      get: secured('Employees', 'List employees', {
        200: jsonResponse('Paginated employees'),
        ...standardResponses
      }, {
        parameters: [
          ...paginationParameters,
          query('status', { type: 'boolean' }),
          query('department_id', { type: 'string' }),
          query('branch_id', { type: 'string' }),
          query('manager_id', { type: 'string' }),
          query('position', { type: 'string' }),
          query('employment_type', { type: 'string', enum: ['PERMANENT', 'CONTRACT', 'INTERN'] }),
          query('employment_status', { type: 'string', enum: ['ACTIVE', 'ON_LEAVE', 'RESIGNED', 'TERMINATED'] }),
          query('hire_date_from', { type: 'string', format: 'date' }),
          query('hire_date_to', { type: 'string', format: 'date' }),
          ...sortParameters(['employee_code', 'first_name', 'last_name', 'email', 'department_name', 'position', 'branch_name', 'employment_type', 'employment_status', 'status', 'hire_date', 'created_at', 'updated_at'])
        ]
      })
    },
    '/api/v1/employees/export': {
      get: secured('Employees', 'Export employees to CSV', {
        200: csvResponse,
        ...standardResponses
      })
    },
    '/api/v1/employees/create': {
      post: secured('Employees', 'Create an employee', {
        201: jsonResponse('Employee created'),
        ...standardResponses
      }, { requestBody: body('EmployeeCreateRequest') })
    },
    [idPath('/api/v1/employees', 'detail')]: {
      get: secured('Employees', 'Get an employee by ID', {
        200: jsonResponse('Employee details'),
        404: jsonResponse('Employee not found'),
        ...standardResponses
      }, { parameters: [idParameter] })
    },
    [idPath('/api/v1/employees', 'update')]: {
      put: secured('Employees', 'Update an employee', {
        200: jsonResponse('Employee updated'),
        404: jsonResponse('Employee not found'),
        ...standardResponses
      }, { parameters: [idParameter], requestBody: body('EmployeeUpdateRequest') })
    },
    [idPath('/api/v1/employees', 'delete')]: {
      delete: secured('Employees', 'Soft-delete an employee', {
        200: jsonResponse('Employee deleted'),
        404: jsonResponse('Employee not found'),
        ...standardResponses
      }, { parameters: [idParameter] })
    },
    [idPath('/api/v1/employees', 'status')]: {
      patch: secured('Employees', 'Toggle employee active status', {
        200: jsonResponse('Employee status changed'),
        404: jsonResponse('Employee not found'),
        ...standardResponses
      }, {
        parameters: [idParameter],
        description: 'Bodyless operation. The server negates the current status.'
      })
    },
    '/api/v1/leaves/types': {
      get: secured('Leaves', 'List leave types', {
        200: jsonResponse('Paginated leave types'),
        ...standardResponses
      }, {
        parameters: [
          ...paginationParameters,
          query('is_active', { type: 'boolean' })
        ]
      })
    },
    '/api/v1/leaves/types/create': {
      post: secured('Leaves', 'Create a leave type', {
        201: jsonResponse('Leave type created'),
        ...standardResponses
      }, { requestBody: body('LeaveTypeCreateRequest') })
    },
    [idPath('/api/v1/leaves/types', 'detail')]: {
      get: secured('Leaves', 'Get a leave type', {
        200: jsonResponse('Leave type details'),
        404: jsonResponse('Leave type not found'),
        ...standardResponses
      }, { parameters: [idParameter] })
    },
    [idPath('/api/v1/leaves/types', 'update')]: {
      put: secured('Leaves', 'Update a leave type', {
        200: jsonResponse('Leave type updated'),
        404: jsonResponse('Leave type not found'),
        ...standardResponses
      }, { parameters: [idParameter], requestBody: body('LeaveTypeUpdateRequest') })
    },
    [idPath('/api/v1/leaves/types', 'delete')]: {
      delete: secured('Leaves', 'Delete an unused leave type', {
        200: jsonResponse('Leave type deleted'),
        404: jsonResponse('Leave type not found'),
        409: jsonResponse('Leave type is used by requests or balances'),
        ...standardResponses
      }, { parameters: [idParameter] })
    },
    '/api/v1/leaves/requests': {
      get: secured('Leaves', 'List leave requests', {
        200: jsonResponse('Paginated leave requests'),
        ...standardResponses
      }, {
        parameters: [
          ...paginationParameters,
          query('employee_id', { type: 'string' }),
          query('leave_type_id', { type: 'string' }),
          query('approver_id', { type: 'string' }),
          query('status', { type: 'string', enum: ['PENDING', 'APPROVED', 'REJECTED', 'CANCELLED'] }),
          query('start_date', { type: 'string', format: 'date' }),
          query('end_date', { type: 'string', format: 'date' })
        ]
      })
    },
    '/api/v1/leaves/requests/create': {
      post: secured('Leaves', 'Submit a leave request', {
        201: jsonResponse('Leave request created'),
        409: jsonResponse('Leave dates overlap an existing request'),
        ...standardResponses
      }, { requestBody: body('LeaveRequestCreateRequest') })
    },
    [idPath('/api/v1/leaves/requests', 'detail')]: {
      get: secured('Leaves', 'Get a leave request', {
        200: jsonResponse('Leave request details'),
        404: jsonResponse('Leave request not found'),
        ...standardResponses
      }, { parameters: [idParameter] })
    },
    [idPath('/api/v1/leaves/requests', 'update')]: {
      put: secured('Leaves', 'Update a pending leave request', {
        200: jsonResponse('Leave request updated'),
        404: jsonResponse('Leave request not found'),
        409: jsonResponse('Leave request is no longer pending or dates overlap'),
        ...standardResponses
      }, { parameters: [idParameter], requestBody: body('LeaveRequestUpdateRequest') })
    },
    [idPath('/api/v1/leaves/requests', 'delete')]: {
      delete: secured('Leaves', 'Delete a pending leave request', {
        200: jsonResponse('Leave request deleted'),
        404: jsonResponse('Leave request not found'),
        409: jsonResponse('Leave request is no longer pending'),
        ...standardResponses
      }, { parameters: [idParameter] })
    },
    [idPath('/api/v1/leaves/requests', 'decision')]: {
      patch: secured('Leaves', 'Approve or reject a pending leave request', {
        200: jsonResponse('Leave request decision recorded'),
        404: jsonResponse('Leave request not found'),
        409: jsonResponse('Insufficient leave balance or request is no longer pending'),
        ...standardResponses
      }, {
        parameters: [idParameter],
        requestBody: body('LeaveDecisionRequest'),
        description: 'Balance-based leave must fall within one calendar year. Approval consumes balance atomically.'
      })
    },
    [idPath('/api/v1/leaves/requests', 'cancel')]: {
      patch: secured('Leaves', 'Cancel a pending or approved leave request', {
        200: jsonResponse('Leave request cancelled'),
        404: jsonResponse('Leave request not found'),
        409: jsonResponse('Leave request cannot be cancelled'),
        ...standardResponses
      }, { parameters: [idParameter] })
    },
    '/api/v1/leaves/calendar': {
      get: secured('Leaves', 'Get leave requests overlapping a calendar date range', {
        200: jsonResponse('Calendar leave requests'),
        ...standardResponses
      }, {
        parameters: [
          query('start_date', { type: 'string', format: 'date' }, 'Required range start'),
          query('end_date', { type: 'string', format: 'date' }, 'Required range end'),
          query('employee_id', { type: 'string' }),
          query('leave_type_id', { type: 'string' }),
          query('status', { type: 'string', enum: ['PENDING', 'APPROVED'] })
        ]
      })
    },
    '/api/v1/leaves/balances': {
      get: secured('Leaves', 'List employee leave balances', {
        200: jsonResponse('Paginated leave balances'),
        ...standardResponses
      }, {
        parameters: [
          ...paginationParameters,
          query('employee_id', { type: 'string' }),
          query('leave_type_id', { type: 'string' }),
          query('year', { type: 'integer', minimum: 2000, maximum: 9999 })
        ]
      })
    },
    '/api/v1/leaves/balances/create': {
      post: secured('Leaves', 'Create an employee leave balance', {
        201: jsonResponse('Leave balance created'),
        409: jsonResponse('Balance already exists for this employee, leave type, and year'),
        ...standardResponses
      }, { requestBody: body('LeaveBalanceCreateRequest') })
    },
    [idPath('/api/v1/leaves/balances', 'detail')]: {
      get: secured('Leaves', 'Get a leave balance', {
        200: jsonResponse('Leave balance details'),
        404: jsonResponse('Leave balance not found'),
        ...standardResponses
      }, { parameters: [idParameter] })
    },
    [idPath('/api/v1/leaves/balances', 'update')]: {
      put: secured('Leaves', 'Update leave allocation or adjustment', {
        200: jsonResponse('Leave balance updated'),
        404: jsonResponse('Leave balance not found'),
        409: jsonResponse('Allocation cannot be lower than used leave'),
        ...standardResponses
      }, { parameters: [idParameter], requestBody: body('LeaveBalanceUpdateRequest') })
    },
    [idPath('/api/v1/leaves/balances', 'delete')]: {
      delete: secured('Leaves', 'Delete an unused leave balance', {
        200: jsonResponse('Leave balance deleted'),
        404: jsonResponse('Leave balance not found'),
        409: jsonResponse('Leave balance has used days'),
        ...standardResponses
      }, { parameters: [idParameter] })
    },
    '/api/v1/audit-logs': {
      get: secured('Audit Logs', 'List audit logs', {
        200: jsonResponse('Paginated audit logs'),
        ...standardResponses
      }, {
        parameters: [
          ...paginationParameters,
          query('action', { type: 'string', enum: ['CREATE', 'UPDATE', 'DELETE'] }),
          query('entity', { type: 'string' }),
          query('user_id', { type: 'string' }),
          query('date_from', { type: 'string', format: 'date' }),
          query('date_to', { type: 'string', format: 'date' }),
          ...sortParameters(['created_at', 'action', 'entity', 'entity_id', 'user_email'])
        ]
      })
    },
    '/api/v1/audit-logs/export': {
      get: secured('Audit Logs', 'Export filtered audit logs to CSV', {
        200: csvResponse,
        ...standardResponses
      }, {
        parameters: [
          query('q', { type: 'string' }, 'Search entity, entity ID, or user email'),
          query('action', { type: 'string', enum: ['CREATE', 'UPDATE', 'DELETE'] }),
          query('entity', { type: 'string' }),
          query('user_id', { type: 'string' }),
          query('date_from', { type: 'string', format: 'date' }),
          query('date_to', { type: 'string', format: 'date' }),
          ...sortParameters(['created_at', 'action', 'entity', 'entity_id', 'user_email'])
        ]
      })
    }
  },
  components: {
    securitySchemes: {
      BearerAuth: {
        type: 'http',
        scheme: 'bearer',
        bearerFormat: 'JWT'
      }
    },
    schemas: {
      ApiResponse: {
        type: 'object',
        properties: {
          success: { type: 'boolean' },
          message: { type: 'string' },
          metadata: { type: 'object', additionalProperties: true },
          data: { nullable: true, description: 'Endpoint-specific response data' }
        },
        required: ['success', 'message', 'metadata', 'data']
      },
      LoginRequest: {
        type: 'object',
        required: ['email', 'password'],
        properties: {
          email: { type: 'string', format: 'email', example: 'admin@company.com' },
          password: { type: 'string', format: 'password', example: 'admin123' }
        }
      },
      RoleCreateRequest: {
        type: 'object',
        required: ['name'],
        properties: {
          name: { type: 'string', maxLength: 255 },
          description: { type: 'string', maxLength: 255 },
          status: { type: 'boolean', default: true }
        }
      },
      RoleUpdateRequest: {
        type: 'object',
        minProperties: 1,
        properties: {
          name: { type: 'string', maxLength: 255 },
          description: { type: 'string', maxLength: 255 },
          status: { type: 'boolean' }
        }
      },
      UserCreateRequest: {
        type: 'object',
        required: ['email', 'password'],
        properties: {
          email: { type: 'string', format: 'email' },
          password: { type: 'string', minLength: 8, format: 'password' },
          role: { type: 'string', enum: ['ADMIN', 'HR', 'EMPLOYEE'], default: 'EMPLOYEE' },
          status: { type: 'boolean', default: true }
        }
      },
      UserUpdateRequest: {
        type: 'object',
        minProperties: 1,
        properties: {
          email: { type: 'string', format: 'email' },
          password: { type: 'string', minLength: 8, format: 'password' },
          role: { type: 'string', enum: ['ADMIN', 'HR', 'EMPLOYEE'] },
          status: { type: 'boolean' }
        }
      },
      DepartmentCreateRequest: {
        type: 'object',
        required: ['name'],
        properties: {
          name: { type: 'string', maxLength: 255 },
          description: { type: 'string', maxLength: 255 },
          status: { type: 'boolean', default: true }
        }
      },
      DepartmentUpdateRequest: {
        type: 'object',
        minProperties: 1,
        properties: {
          name: { type: 'string', maxLength: 255 },
          description: { type: 'string', maxLength: 255 },
          status: { type: 'boolean' }
        }
      },
      BranchCreateRequest: {
        type: 'object',
        required: ['name'],
        properties: {
          name: { type: 'string', maxLength: 255 },
          address: { type: 'string', maxLength: 255, nullable: true }
        }
      },
      BranchUpdateRequest: {
        type: 'object',
        minProperties: 1,
        properties: {
          name: { type: 'string', maxLength: 255 },
          address: { type: 'string', maxLength: 255, nullable: true },
          status: { type: 'boolean' }
        }
      },
      PositionCreateRequest: {
        type: 'object',
        required: ['name', 'description'],
        properties: {
          name: { type: 'string', maxLength: 255 },
          description: { type: 'string', maxLength: 255 }
        }
      },
      PositionUpdateRequest: {
        type: 'object',
        minProperties: 1,
        properties: {
          name: { type: 'string', maxLength: 255 },
          description: { type: 'string', maxLength: 255 }
        }
      },
      LeaveTypeCreateRequest: {
        type: 'object',
        required: ['name'],
        properties: {
          name: { type: 'string', maxLength: 255 },
          description: { type: 'string', nullable: true },
          annual_quota: { type: 'number', minimum: 0, nullable: true },
          requires_balance: { type: 'boolean', default: true },
          color: { type: 'string', pattern: '^#[0-9A-Fa-f]{6}$', default: '#2563EB' },
          is_active: { type: 'boolean', default: true }
        }
      },
      LeaveTypeUpdateRequest: {
        type: 'object',
        minProperties: 1,
        properties: {
          name: { type: 'string', maxLength: 255 },
          description: { type: 'string', nullable: true },
          annual_quota: { type: 'number', minimum: 0, nullable: true },
          requires_balance: { type: 'boolean' },
          color: { type: 'string', pattern: '^#[0-9A-Fa-f]{6}$' },
          is_active: { type: 'boolean' }
        }
      },
      LeaveRequestCreateRequest: {
        type: 'object',
        required: ['employee_id', 'leave_type_id', 'start_date', 'end_date', 'duration_days', 'reason'],
        properties: {
          employee_id: { type: 'string' },
          leave_type_id: { type: 'string' },
          approver_id: { type: 'string', nullable: true },
          start_date: { type: 'string', format: 'date' },
          end_date: { type: 'string', format: 'date' },
          duration_days: {
            type: 'number',
            exclusiveMinimum: 0,
            maximum: 999.99,
            description: 'Explicit leave duration; working days and holidays are not calculated automatically.'
          },
          reason: { type: 'string', minLength: 1, maxLength: 5000 }
        }
      },
      LeaveRequestUpdateRequest: {
        type: 'object',
        minProperties: 1,
        properties: {
          leave_type_id: { type: 'string' },
          approver_id: { type: 'string', nullable: true },
          start_date: { type: 'string', format: 'date' },
          end_date: { type: 'string', format: 'date' },
          duration_days: { type: 'number', exclusiveMinimum: 0, maximum: 999.99 },
          reason: { type: 'string', minLength: 1, maxLength: 5000 }
        }
      },
      LeaveDecisionRequest: {
        type: 'object',
        required: ['status'],
        properties: {
          status: { type: 'string', enum: ['APPROVED', 'REJECTED'] },
          decision_note: { type: 'string', nullable: true }
        }
      },
      LeaveBalanceCreateRequest: {
        type: 'object',
        required: ['employee_id', 'leave_type_id', 'year', 'allocated_days'],
        properties: {
          employee_id: { type: 'string' },
          leave_type_id: { type: 'string' },
          year: { type: 'integer', minimum: 2000, maximum: 9999 },
          allocated_days: { type: 'number', minimum: 0 },
          adjustment_days: { type: 'number', default: 0 }
        }
      },
      LeaveBalanceUpdateRequest: {
        type: 'object',
        minProperties: 1,
        properties: {
          allocated_days: { type: 'number', minimum: 0 },
          adjustment_days: { type: 'number' }
        }
      },
      EmployeeCreateRequest: {
        type: 'object',
        required: ['first_name', 'last_name', 'email', 'phone_number', 'department_id', 'position_id', 'hire_date'],
        properties: {
          first_name: { type: 'string', maxLength: 100 },
          last_name: { type: 'string', maxLength: 100 },
          email: { type: 'string', format: 'email' },
          phone_number: { type: 'string', minLength: 8, maxLength: 20 },
          department_id: { type: 'string' },
          position_id: { type: 'string' },
          branch_id: { type: 'string', nullable: true },
          manager_id: { type: 'string', nullable: true },
          employment_type: { type: 'string', enum: ['PERMANENT', 'CONTRACT', 'INTERN'], default: 'PERMANENT' },
          employment_status: { type: 'string', enum: ['ACTIVE', 'ON_LEAVE', 'RESIGNED', 'TERMINATED'], default: 'ACTIVE' },
          contract_start_date: { type: 'string', format: 'date', nullable: true },
          contract_end_date: { type: 'string', format: 'date', nullable: true },
          status: { type: 'boolean', default: true },
          hire_date: { type: 'string', format: 'date' },
          address: { type: 'string', maxLength: 255 }
        }
      },
      EmployeeUpdateRequest: {
        type: 'object',
        minProperties: 1,
        properties: {
          employee_code: { type: 'string', maxLength: 50 },
          first_name: { type: 'string', maxLength: 100 },
          last_name: { type: 'string', maxLength: 100 },
          email: { type: 'string', format: 'email' },
          phone_number: { type: 'string', minLength: 8, maxLength: 20 },
          department_id: { type: 'string' },
          position_id: { type: 'string' },
          branch_id: { type: 'string', nullable: true },
          manager_id: { type: 'string', nullable: true },
          employment_type: { type: 'string', enum: ['PERMANENT', 'CONTRACT', 'INTERN'] },
          employment_status: { type: 'string', enum: ['ACTIVE', 'ON_LEAVE', 'RESIGNED', 'TERMINATED'] },
          contract_start_date: { type: 'string', format: 'date', nullable: true },
          contract_end_date: { type: 'string', format: 'date', nullable: true },
          status: { type: 'boolean' },
          hire_date: { type: 'string', format: 'date' },
          address: { type: 'string', maxLength: 255 }
        }
      }
    }
  }
}