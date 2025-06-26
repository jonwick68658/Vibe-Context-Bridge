export interface ProjectContext {
  project: ProjectInfo;
  architecture?: Architecture;
  api?: ApiConfiguration;
  security: SecurityConfiguration;
  authentication?: AuthenticationConfiguration;
  database?: DatabaseConfiguration;
  frontend?: FrontendConfiguration;
  deployment?: DeploymentConfiguration;
  contextMemory?: ContextMemory;
}

export interface ProjectInfo {
  name: string;
  description?: string;
  version?: string;
  type: 'web-app' | 'api' | 'mobile-app' | 'desktop-app' | 'library' | 'full-stack';
  framework?: {
    frontend?: string;
    backend?: string;
    database?: string;
    deployment?: string;
  };
}

export interface Architecture {
  structure?: {
    src?: string;
    components?: string;
    pages?: string;
    api?: string;
    models?: string;
    utils?: string;
    styles?: string;
    assets?: string;
  };
  patterns?: Array<'MVC' | 'MVP' | 'MVVM' | 'Component-Based' | 'Layered' | 'Microservices' | 'Monolithic'>;
}

export interface ApiConfiguration {
  baseUrl?: string;
  version?: string;
  endpoints?: ApiEndpoint[];
}

export interface ApiEndpoint {
  path: string;
  method: 'GET' | 'POST' | 'PUT' | 'DELETE' | 'PATCH' | 'OPTIONS' | 'HEAD';
  description?: string;
  parameters?: ApiParameter[];
  response?: {
    type?: string;
    structure?: any;
  };
  authentication?: boolean;
  security?: string[];
}

export interface ApiParameter {
  name: string;
  type: string;
  required: boolean;
  description?: string;
}

export interface SecurityConfiguration {
  rules?: {
    enforceHttps?: boolean;
    inputSanitization?: boolean;
    sqlInjectionPrevention?: boolean;
    xssProtection?: boolean;
    csrfProtection?: boolean;
    corsConfiguration?: boolean;
    rateLimiting?: boolean;
    dataValidation?: boolean;
  };
  patterns?: SecurityPattern[];
}

export interface SecurityPattern {
  name: string;
  pattern: string;
  severity: 'error' | 'warning' | 'info';
  message: string;
}

export interface AuthenticationConfiguration {
  type?: 'jwt' | 'session' | 'oauth2' | 'basic' | 'api-key' | 'none';
  config?: {
    secret?: string;
    expiry?: string;
    refreshToken?: boolean;
    providers?: string[];
  };
  routes?: {
    login?: string;
    logout?: string;
    register?: string;
    refresh?: string;
    profile?: string;
  };
}

export interface DatabaseConfiguration {
  type?: 'mysql' | 'postgresql' | 'sqlite' | 'mongodb' | 'redis' | 'firebase';
  models?: DatabaseModel[];
}

export interface DatabaseModel {
  name: string;
  fields: DatabaseField[];
  relationships?: DatabaseRelationship[];
}

export interface DatabaseField {
  name: string;
  type: string;
  required?: boolean;
  unique?: boolean;
  default?: string;
}

export interface DatabaseRelationship {
  type: 'hasOne' | 'hasMany' | 'belongsTo' | 'belongsToMany';
  model: string;
  foreignKey?: string;
}

export interface FrontendConfiguration {
  components?: FrontendComponent[];
  pages?: FrontendPage[];
}

export interface FrontendComponent {
  name: string;
  path: string;
  props?: ComponentProp[];
  apiCalls?: string[];
}

export interface ComponentProp {
  name: string;
  type: string;
  required: boolean;
}

export interface FrontendPage {
  name: string;
  path: string;
  route: string;
  components?: string[];
  authentication?: boolean;
}

export interface DeploymentConfiguration {
  environment?: {
    development?: EnvironmentConfig;
    production?: EnvironmentConfig;
  };
  platform?: 'vercel' | 'netlify' | 'heroku' | 'aws' | 'gcp' | 'azure' | 'docker';
}

export interface EnvironmentConfig {
  port?: number;
  database?: string;
  apiUrl?: string;
}

export interface ContextMemory {
  lastUpdated?: string;
  aiInteractions?: AiInteraction[];
  codeGeneration?: {
    preferences?: {
      codeStyle?: string;
      commentLevel?: string;
      errorHandling?: string;
      testGeneration?: boolean;
    };
  };
}

export interface AiInteraction {
  timestamp: string;
  action: string;
  context: string;
  result: string;
  metadata?: any;
}

export interface ValidationResult {
  valid: boolean;
  errors: ValidationError[];
  warnings: ValidationError[];
}

export interface ValidationError {
  path: string;
  message: string;
  severity: 'error' | 'warning' | 'info';
  suggestion?: string;
}

export interface ContinuityIssue {
  type: 'api-mismatch' | 'component-missing' | 'route-undefined' | 'auth-mismatch';
  frontend: string;
  backend: string;
  message: string;
  suggestion: string;
}

export interface SecurityIssue {
  file: string;
  line?: number;
  rule: string;
  severity: 'error' | 'warning' | 'info';
  message: string;
  suggestion: string;
}
