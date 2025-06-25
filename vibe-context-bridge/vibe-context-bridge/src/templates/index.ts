import { ProjectContext } from '../types';

export const projectTemplates: Record<string, Partial<ProjectContext>> = {
  'web-app': {
    project: {
      type: 'web-app',
      framework: {
        frontend: 'React',
        backend: 'Express',
        database: 'PostgreSQL'
      }
    },
    security: {
      rules: {
        enforceHttps: true,
        inputSanitization: true,
        sqlInjectionPrevention: true,
        xssProtection: true,
        csrfProtection: true,
        corsConfiguration: true,
        rateLimiting: true,
        dataValidation: true
      }
    },
    authentication: {
      type: 'jwt',
      config: {
        expiry: '15m',
        refreshToken: true
      }
    }
  },
  
  'e-commerce': {
    project: {
      type: 'web-app',
      framework: {
        frontend: 'React',
        backend: 'Express',
        database: 'PostgreSQL',
        deployment: 'AWS'
      }
    },
    security: {
      rules: {
        enforceHttps: true,
        inputSanitization: true,
        sqlInjectionPrevention: true,
        xssProtection: true,
        csrfProtection: true,
        corsConfiguration: true,
        rateLimiting: true,
        dataValidation: true
      },
      patterns: [
        {
          name: 'pci-compliance',
          pattern: '(card[_-]?number|cvv|expiry)\\s*[=:]',
          severity: 'error',
          message: 'Credit card data detected. Ensure PCI DSS compliance.'
        },
        {
          name: 'payment-security',
          pattern: 'payment.*process|charge.*amount',
          severity: 'warning',
          message: 'Payment processing detected. Use secure payment processors.'
        }
      ]
    },
    authentication: {
      type: 'jwt',
      config: {
        expiry: '15m',
        refreshToken: true
      }
    },
    api: {
      endpoints: [
        {
          path: '/api/products',
          method: 'GET',
          description: 'Get all products'
        },
        {
          path: '/api/products/:id',
          method: 'GET',
          description: 'Get product by ID'
        },
        {
          path: '/api/cart',
          method: 'GET',
          description: 'Get user cart',
          authentication: true
        },
        {
          path: '/api/cart/add',
          method: 'POST',
          description: 'Add item to cart',
          authentication: true
        },
        {
          path: '/api/orders',
          method: 'POST',
          description: 'Create order',
          authentication: true
        }
      ]
    }
  },

  'blog': {
    project: {
      type: 'web-app',
      framework: {
        frontend: 'React',
        backend: 'Express',
        database: 'MongoDB'
      }
    },
    security: {
      rules: {
        enforceHttps: true,
        inputSanitization: true,
        sqlInjectionPrevention: true,
        xssProtection: true,
        csrfProtection: true,
        corsConfiguration: true,
        rateLimiting: true,
        dataValidation: true
      }
    },
    authentication: {
      type: 'jwt',
      config: {
        expiry: '24h',
        refreshToken: true
      }
    },
    api: {
      endpoints: [
        {
          path: '/api/posts',
          method: 'GET',
          description: 'Get all posts'
        },
        {
          path: '/api/posts/:id',
          method: 'GET',
          description: 'Get post by ID'
        },
        {
          path: '/api/posts',
          method: 'POST',
          description: 'Create new post',
          authentication: true
        },
        {
          path: '/api/posts/:id/comments',
          method: 'POST',
          description: 'Add comment to post',
          authentication: true
        }
      ]
    }
  },

  'dashboard': {
    project: {
      type: 'web-app',
      framework: {
        frontend: 'React',
        backend: 'Express',
        database: 'PostgreSQL'
      }
    },
    security: {
      rules: {
        enforceHttps: true,
        inputSanitization: true,
        sqlInjectionPrevention: true,
        xssProtection: true,
        csrfProtection: true,
        corsConfiguration: true,
        rateLimiting: true,
        dataValidation: true
      }
    },
    authentication: {
      type: 'jwt',
      config: {
        expiry: '8h',
        refreshToken: true
      }
    },
    api: {
      endpoints: [
        {
          path: '/api/analytics',
          method: 'GET',
          description: 'Get analytics data',
          authentication: true
        },
        {
          path: '/api/users',
          method: 'GET',
          description: 'Get user list',
          authentication: true
        },
        {
          path: '/api/settings',
          method: 'GET',
          description: 'Get user settings',
          authentication: true
        },
        {
          path: '/api/settings',
          method: 'PUT',
          description: 'Update user settings',
          authentication: true
        }
      ]
    }
  },

  'api-only': {
    project: {
      type: 'api',
      framework: {
        backend: 'Express',
        database: 'PostgreSQL'
      }
    },
    security: {
      rules: {
        enforceHttps: true,
        inputSanitization: true,
        sqlInjectionPrevention: true,
        corsConfiguration: true,
        rateLimiting: true,
        dataValidation: true
      }
    },
    authentication: {
      type: 'api-key',
      config: {
        expiry: 'never'
      }
    }
  }
};

export const securityTemplates = {
  'basic': {
    rules: {
      enforceHttps: true,
      inputSanitization: true,
      xssProtection: true,
      dataValidation: true
    }
  },
  
  'standard': {
    rules: {
      enforceHttps: true,
      inputSanitization: true,
      sqlInjectionPrevention: true,
      xssProtection: true,
      csrfProtection: true,
      corsConfiguration: true,
      rateLimiting: true,
      dataValidation: true
    }
  },
  
  'enterprise': {
    rules: {
      enforceHttps: true,
      inputSanitization: true,
      sqlInjectionPrevention: true,
      xssProtection: true,
      csrfProtection: true,
      corsConfiguration: true,
      rateLimiting: true,
      dataValidation: true
    },
    patterns: [
      {
        name: 'data-classification',
        pattern: '(confidential|secret|internal)',
        severity: 'warning',
        message: 'Classified data detected. Ensure proper access controls.'
      },
      {
        name: 'audit-logging',
        pattern: '(admin|delete|update).*user',
        severity: 'info',
        message: 'Administrative action detected. Ensure audit logging is enabled.'
      }
    ]
  }
};

export function getTemplate(templateName: string): Partial<ProjectContext> | null {
  return projectTemplates[templateName] || null;
}

export function getSecurityTemplate(level: string): any {
  return securityTemplates[level] || securityTemplates['standard'];
}

export function listAvailableTemplates(): Array<{ name: string; description: string }> {
  return [
    { name: 'web-app', description: 'Standard web application with frontend and backend' },
    { name: 'e-commerce', description: 'E-commerce application with payment security' },
    { name: 'blog', description: 'Blog/CMS application with content management' },
    { name: 'dashboard', description: 'Admin dashboard with analytics and user management' },
    { name: 'api-only', description: 'Backend API without frontend' }
  ];
}
