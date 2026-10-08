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
    { name: 'Employees' },
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
      get: secured('Dashboard', 'Get dashboard metrics and recent activity', {
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
    '/api/v1/employees': {
      get: secured('Employees', 'List employees', {
        200: jsonResponse('Paginated employees'),
        ...standardResponses
      }, {
        parameters: [
          ...paginationParameters,
          query('status', { type: 'boolean' }),
          query('department_id', { type: 'string' }),
          query('position', { type: 'string' }),
          query('hire_date_from', { type: 'string', format: 'date' }),
          query('hire_date_to', { type: 'string', format: 'date' }),
          ...sortParameters(['employee_code', 'first_name', 'last_name', 'email', 'department_name', 'position', 'status', 'hire_date', 'created_at', 'updated_at'])
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
      EmployeeCreateRequest: {
        type: 'object',
        required: ['first_name', 'last_name', 'email', 'phone_number', 'department_id', 'position', 'hire_date'],
        properties: {
          first_name: { type: 'string', maxLength: 100 },
          last_name: { type: 'string', maxLength: 100 },
          email: { type: 'string', format: 'email' },
          phone_number: { type: 'string', minLength: 8, maxLength: 20 },
          department_id: { type: 'string' },
          position: { type: 'string', maxLength: 100 },
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
          position: { type: 'string', maxLength: 100 },
          status: { type: 'boolean' },
          hire_date: { type: 'string', format: 'date' },
          address: { type: 'string', maxLength: 255 }
        }
      }
    }
  }
}