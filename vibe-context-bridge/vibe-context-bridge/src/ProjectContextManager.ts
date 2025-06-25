import * as fs from 'fs';
import * as path from 'path';
import * as yaml from 'yaml';
import Ajv from 'ajv';
import { ProjectContext, ValidationResult, ValidationError } from './types';

export class ProjectContextManager {
  private static readonly CONTEXT_FILENAME = '.project-context.yaml';
  private static readonly CONTEXT_FILENAME_JSON = '.project-context.json';
  private ajv: Ajv;
  private schema: any;

  constructor() {
    this.ajv = new Ajv({ allErrors: true });
    this.loadSchema();
  }

  private loadSchema(): void {
    try {
      const schemaPath = path.join(__dirname, '..', 'schemas', 'project-context.schema.json');
      this.schema = JSON.parse(fs.readFileSync(schemaPath, 'utf8'));
      this.ajv.addSchema(this.schema, 'project-context');
    } catch (error) {
      console.warn('Could not load schema, validation will be limited');
    }
  }

  /**
   * Initialize a new project context file with intelligent defaults
   */
  public async initializeContext(projectPath: string, projectInfo: Partial<ProjectContext>): Promise<ProjectContext> {
    const contextPath = path.join(projectPath, ProjectContextManager.CONTEXT_FILENAME);
    
    // Check if context already exists
    if (fs.existsSync(contextPath)) {
      return this.loadContext(projectPath);
    }

    // Create intelligent defaults based on project structure
    const detectedInfo = await this.detectProjectStructure(projectPath);
    
    const defaultContext: ProjectContext = {
      project: {
        name: projectInfo.project?.name || path.basename(projectPath),
        description: projectInfo.project?.description || 'AI-assisted project built with Vibe Context Bridge',
        type: projectInfo.project?.type || detectedInfo.type || 'web-app',
        framework: {
          ...detectedInfo.framework,
          ...projectInfo.project?.framework
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
        patterns: this.getDefaultSecurityPatterns()
      },
      architecture: detectedInfo.architecture,
      api: detectedInfo.api,
      authentication: {
        type: 'jwt',
        config: {
          expiry: '24h',
          refreshToken: true
        },
        routes: {
          login: '/auth/login',
          logout: '/auth/logout',
          register: '/auth/register',
          refresh: '/auth/refresh',
          profile: '/auth/profile'
        }
      },
      contextMemory: {
        lastUpdated: new Date().toISOString(),
        aiInteractions: [],
        codeGeneration: {
          preferences: {
            codeStyle: 'clean',
            commentLevel: 'moderate',
            errorHandling: 'comprehensive',
            testGeneration: true
          }
        }
      }
    };

    await this.saveContext(projectPath, defaultContext);
    return defaultContext;
  }

  /**
   * Load existing project context
   */
  public loadContext(projectPath: string): ProjectContext {
    const yamlPath = path.join(projectPath, ProjectContextManager.CONTEXT_FILENAME);
    const jsonPath = path.join(projectPath, ProjectContextManager.CONTEXT_FILENAME_JSON);

    let contextData: any;
    
    if (fs.existsSync(yamlPath)) {
      const yamlContent = fs.readFileSync(yamlPath, 'utf8');
      contextData = yaml.parse(yamlContent);
    } else if (fs.existsSync(jsonPath)) {
      const jsonContent = fs.readFileSync(jsonPath, 'utf8');
      contextData = JSON.parse(jsonContent);
    } else {
      throw new Error(`No project context found in ${projectPath}`);
    }

    return contextData as ProjectContext;
  }

  /**
   * Save project context to file
   */
  public async saveContext(projectPath: string, context: ProjectContext): Promise<void> {
    const contextPath = path.join(projectPath, ProjectContextManager.CONTEXT_FILENAME);
    
    // Update lastUpdated timestamp
    if (!context.contextMemory) {
      context.contextMemory = {};
    }
    context.contextMemory.lastUpdated = new Date().toISOString();

    const yamlContent = yaml.stringify(context, {
      indent: 2,
      lineWidth: 100,
      minContentWidth: 50
    });

    fs.writeFileSync(contextPath, yamlContent, 'utf8');
  }

  /**
   * Validate project context against schema
   */
  public validateContext(context: ProjectContext): ValidationResult {
    const errors: ValidationError[] = [];
    const warnings: ValidationError[] = [];

    // Schema validation
    if (this.schema && this.ajv) {
      const validate = this.ajv.getSchema('project-context');
      if (validate && !validate(context)) {
        validate.errors?.forEach(error => {
          errors.push({
            path: error.instancePath || 'root',
            message: error.message || 'Unknown validation error',
            severity: 'error'
          });
        });
      }
    }

    // Business logic validation
    this.validateBusinessLogic(context, errors, warnings);

    return {
      valid: errors.length === 0,
      errors,
      warnings
    };
  }

  /**
   * Update context with AI interaction memory
   */
  public recordAiInteraction(context: ProjectContext, action: string, contextInfo: string, result: string): void {
    if (!context.contextMemory) {
      context.contextMemory = {};
    }
    if (!context.contextMemory.aiInteractions) {
      context.contextMemory.aiInteractions = [];
    }

    context.contextMemory.aiInteractions.push({
      timestamp: new Date().toISOString(),
      action,
      context: contextInfo,
      result
    });

    // Keep only last 50 interactions to prevent bloat
    if (context.contextMemory.aiInteractions.length > 50) {
      context.contextMemory.aiInteractions = context.contextMemory.aiInteractions.slice(-50);
    }
  }

  private async detectProjectStructure(projectPath: string): Promise<any> {
    const packageJsonPath = path.join(projectPath, 'package.json');
    let framework = {};
    let type = 'web-app';
    
    if (fs.existsSync(packageJsonPath)) {
      try {
        const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, 'utf8'));
        const dependencies = { ...packageJson.dependencies, ...packageJson.devDependencies };
        
        // Detect frontend framework
        if (dependencies.react) framework = { ...framework, frontend: 'React' };
        else if (dependencies.vue) framework = { ...framework, frontend: 'Vue' };
        else if (dependencies.angular) framework = { ...framework, frontend: 'Angular' };
        else if (dependencies.svelte) framework = { ...framework, frontend: 'Svelte' };
        
        // Detect backend framework
        if (dependencies.express) framework = { ...framework, backend: 'Express' };
        else if (dependencies.fastify) framework = { ...framework, backend: 'Fastify' };
        else if (dependencies.koa) framework = { ...framework, backend: 'Koa' };
        else if (dependencies['next']) framework = { ...framework, backend: 'Next.js' };
        
        // Detect database
        if (dependencies.mongoose) framework = { ...framework, database: 'MongoDB' };
        else if (dependencies.pg) framework = { ...framework, database: 'PostgreSQL' };
        else if (dependencies.mysql2) framework = { ...framework, database: 'MySQL' };
        else if (dependencies.sqlite3) framework = { ...framework, database: 'SQLite' };
      } catch (error) {
        console.warn('Could not parse package.json');
      }
    }

    // Detect project structure
    const structure: any = {};
    const commonDirs = ['src', 'components', 'pages', 'api', 'models', 'utils', 'styles', 'assets'];
    
    for (const dir of commonDirs) {
      const dirPath = path.join(projectPath, dir);
      if (fs.existsSync(dirPath)) {
        structure[dir] = dir;
      }
    }

    return {
      type,
      framework,
      architecture: { structure }
    };
  }

  private getDefaultSecurityPatterns(): any[] {
    return [
      {
        name: 'hardcoded-api-key',
        pattern: '(api[_-]?key|secret[_-]?key)\\s*[=:]\\s*["\'][a-zA-Z0-9]{10,}["\']',
        severity: 'error',
        message: 'Hardcoded API key detected. Use environment variables instead.'
      },
      {
        name: 'hardcoded-password',
        pattern: 'password\\s*[=:]\\s*["\'][^"\']+["\']',
        severity: 'error',
        message: 'Hardcoded password detected. Use secure configuration management.'
      },
      {
        name: 'sql-injection-risk',
        pattern: '(SELECT|INSERT|UPDATE|DELETE).*\\+.*\\$|\\$\\{.*\\}',
        severity: 'error',
        message: 'Potential SQL injection vulnerability. Use parameterized queries.'
      },
      {
        name: 'xss-vulnerability',
        pattern: 'innerHTML\\s*=\\s*[^"\']*\\$|dangerouslySetInnerHTML',
        severity: 'warning',
        message: 'Potential XSS vulnerability. Sanitize user input before rendering.'
      },
      {
        name: 'insecure-http',
        pattern: 'http://(?!localhost|127\\.0\\.0\\.1)',
        severity: 'warning',
        message: 'Insecure HTTP protocol detected. Use HTTPS in production.'
      },
      {
        name: 'credit-card-data',
        pattern: '(credit[_-]?card|cc[_-]?number|card[_-]?number)\\s*[=:]',
        severity: 'error',
        message: 'Credit card data handling detected. Ensure PCI DSS compliance.'
      },
      {
        name: 'personal-data',
        pattern: '(ssn|social[_-]?security|phone[_-]?number|email[_-]?address)\\s*[=:]',
        severity: 'warning',
        message: 'Personal data handling detected. Ensure GDPR/privacy compliance.'
      }
    ];
  }

  private validateBusinessLogic(context: ProjectContext, errors: ValidationError[], warnings: ValidationError[]): void {
    // Validate API endpoints match authentication requirements
    if (context.api?.endpoints && context.authentication) {
      for (const endpoint of context.api.endpoints) {
        if (endpoint.authentication && context.authentication.type === 'none') {
          warnings.push({
            path: `api.endpoints[${endpoint.path}]`,
            message: 'Endpoint requires authentication but no auth method is configured',
            severity: 'warning',
            suggestion: 'Configure authentication or remove auth requirement from endpoint'
          });
        }
      }
    }

    // Validate security rules are enabled for sensitive data
    if (context.database?.models) {
      const hasSensitiveData = context.database.models.some(model =>
        model.fields.some(field =>
          ['password', 'email', 'phone', 'ssn', 'credit_card'].some(sensitive =>
            field.name.toLowerCase().includes(sensitive)
          )
        )
      );

      if (hasSensitiveData && !context.security.rules?.inputSanitization) {
        errors.push({
          path: 'security.rules.inputSanitization',
          message: 'Input sanitization must be enabled when handling sensitive data',
          severity: 'error',
          suggestion: 'Enable inputSanitization in security rules'
        });
      }
    }

    // Validate production deployment security
    if (context.deployment?.environment?.production) {
      if (!context.security.rules?.enforceHttps) {
        errors.push({
          path: 'security.rules.enforceHttps',
          message: 'HTTPS must be enforced in production environment',
          severity: 'error',
          suggestion: 'Enable enforceHttps in security rules'
        });
      }
    }
  }
}