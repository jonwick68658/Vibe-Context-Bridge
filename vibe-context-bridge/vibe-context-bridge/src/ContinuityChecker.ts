import * as fs from 'fs';
import * as path from 'path';
import { glob } from 'glob';
import { ProjectContext, ContinuityIssue, ApiEndpoint } from './types';

export class ContinuityChecker {
  private context: ProjectContext;

  constructor(context: ProjectContext) {
    this.context = context;
  }

  /**
   * Check frontend/backend continuity across the entire project
   */
  public async checkContinuity(projectPath: string): Promise<ContinuityIssue[]> {
    const issues: ContinuityIssue[] = [];

    // Check API endpoint continuity
    const apiIssues = await this.checkApiContinuity(projectPath);
    issues.push(...apiIssues);

    // Check component usage continuity
    const componentIssues = await this.checkComponentContinuity(projectPath);
    issues.push(...componentIssues);

    // Check route continuity
    const routeIssues = await this.checkRouteContinuity(projectPath);
    issues.push(...routeIssues);

    // Check authentication continuity
    const authIssues = await this.checkAuthenticationContinuity(projectPath);
    issues.push(...authIssues);

    return issues;
  }

  /**
   * Auto-update context based on discovered code patterns
   */
  public async updateContextFromCode(projectPath: string): Promise<Partial<ProjectContext>> {
    const updates: Partial<ProjectContext> = {};

    // Discover API endpoints from backend code
    const discoveredEndpoints = await this.discoverApiEndpoints(projectPath);
    if (discoveredEndpoints.length > 0) {
      updates.api = {
        ...this.context.api,
        endpoints: discoveredEndpoints
      };
    }

    // Discover frontend components
    const discoveredComponents = await this.discoverFrontendComponents(projectPath);
    if (discoveredComponents.length > 0) {
      updates.frontend = {
        ...this.context.frontend,
        components: discoveredComponents
      };
    }

    // Discover database models
    const discoveredModels = await this.discoverDatabaseModels(projectPath);
    if (discoveredModels.length > 0) {
      updates.database = {
        ...this.context.database,
        models: discoveredModels
      };
    }

    return updates;
  }

  /**
   * Generate missing API endpoints based on frontend usage
   */
  public generateMissingEndpoints(frontendCalls: string[]): ApiEndpoint[] {
    const existingPaths = this.context.api?.endpoints?.map(e => e.path) || [];
    const missingEndpoints: ApiEndpoint[] = [];

    for (const call of frontendCalls) {
      const { method, path } = this.parseApiCall(call);
      
      if (path && !existingPaths.includes(path)) {
        missingEndpoints.push({
          path,
          method: method as any,
          description: `Auto-generated endpoint for ${path}`,
          parameters: this.inferParameters(call),
          authentication: this.shouldRequireAuth(path)
        });
      }
    }

    return missingEndpoints;
  }

  private async checkApiContinuity(projectPath: string): Promise<ContinuityIssue[]> {
    const issues: ContinuityIssue[] = [];

    // Get all frontend API calls
    const frontendCalls = await this.findFrontendApiCalls(projectPath);
    
    // Get all backend endpoints
    const backendEndpoints = this.context.api?.endpoints || [];

    // Check for unmatched frontend calls
    for (const call of frontendCalls) {
      const { method, path, file, line } = this.parseApiCallWithLocation(call);
      
      const matchingEndpoint = backendEndpoints.find(endpoint => 
        endpoint.path === path && endpoint.method === method
      );

      if (!matchingEndpoint) {
        issues.push({
          type: 'api-mismatch',
          frontend: `${file}:${line} - ${method} ${path}`,
          backend: 'No matching endpoint found',
          message: `Frontend calls ${method} ${path} but no matching backend endpoint exists`,
          suggestion: `Add ${method} ${path} endpoint to your backend or update the frontend call`
        });
      }
    }

    // Check for unused backend endpoints
    for (const endpoint of backendEndpoints) {
      const isUsed = frontendCalls.some(call => {
        const { method, path } = this.parseApiCall(call);
        return endpoint.path === path && endpoint.method === method;
      });

      if (!isUsed) {
        issues.push({
          type: 'api-mismatch',
          frontend: 'No frontend usage found',
          backend: `${endpoint.method} ${endpoint.path}`,
          message: `Backend endpoint ${endpoint.method} ${endpoint.path} is not used by any frontend code`,
          suggestion: 'Remove unused endpoint or add frontend usage if needed'
        });
      }
    }

    return issues;
  }

  private async checkComponentContinuity(projectPath: string): Promise<ContinuityIssue[]> {
    const issues: ContinuityIssue[] = [];

    // Get all component definitions
    const definedComponents = await this.findComponentDefinitions(projectPath);
    
    // Get all component usages
    const componentUsages = await this.findComponentUsages(projectPath);

    // Check for missing component definitions
    for (const usage of componentUsages) {
      const { componentName, file, line } = usage;
      
      if (!definedComponents.includes(componentName)) {
        issues.push({
          type: 'component-missing',
          frontend: `${file}:${line} - Uses ${componentName}`,
          backend: 'Component definition not found',
          message: `Component ${componentName} is used but not defined`,
          suggestion: `Create ${componentName} component or check import path`
        });
      }
    }

    return issues;
  }

  private async checkRouteContinuity(projectPath: string): Promise<ContinuityIssue[]> {
    const issues: ContinuityIssue[] = [];

    // Get all route definitions
    const definedRoutes = await this.findRouteDefinitions(projectPath);
    
    // Get all route usages (navigation calls)
    const routeUsages = await this.findRouteUsages(projectPath);

    // Check for undefined routes
    for (const usage of routeUsages) {
      const { route, file, line } = usage;
      
      if (!definedRoutes.includes(route)) {
        issues.push({
          type: 'route-undefined',
          frontend: `${file}:${line} - Navigates to ${route}`,
          backend: 'Route definition not found',
          message: `Navigation to ${route} found but route is not defined`,
          suggestion: `Define route ${route} in your router configuration`
        });
      }
    }

    return issues;
  }

  private async checkAuthenticationContinuity(projectPath: string): Promise<ContinuityIssue[]> {
    const issues: ContinuityIssue[] = [];

    if (!this.context.authentication || this.context.authentication.type === 'none') {
      return issues;
    }

    // Find frontend auth calls
    const authCalls = await this.findAuthenticationCalls(projectPath);
    
    // Check if auth endpoints exist
    const authEndpoints = this.context.api?.endpoints?.filter(e => 
      e.path?.includes('auth') || e.authentication
    ) || [];

    for (const call of authCalls) {
      const { type, endpoint, file, line } = call;
      
      const matchingEndpoint = authEndpoints.find(e => e.path === endpoint);
      
      if (!matchingEndpoint) {
        issues.push({
          type: 'auth-mismatch',
          frontend: `${file}:${line} - ${type} call to ${endpoint}`,
          backend: 'Auth endpoint not found',
          message: `Frontend makes ${type} call to ${endpoint} but endpoint is not defined`,
          suggestion: `Add ${endpoint} authentication endpoint to your backend`
        });
      }
    }

    return issues;
  }

  private async findFrontendApiCalls(projectPath: string): Promise<string[]> {
    const calls: string[] = [];
    const frontendFiles = await glob('**/*.{js,ts,jsx,tsx,vue}', {
      cwd: projectPath,
      ignore: ['**/node_modules/**', '**/dist/**', '**/build/**']
    });

    for (const file of frontendFiles) {
      const content = fs.readFileSync(path.join(projectPath, file), 'utf8');
      
      // Look for fetch calls
      const fetchMatches = content.match(/fetch\s*\(\s*['"`]([^'"`]+)['"`]/g);
      if (fetchMatches) {
        calls.push(...fetchMatches.map(match => `${file}:${match}`));
      }

      // Look for axios calls
      const axiosMatches = content.match(/axios\.(get|post|put|delete|patch)\s*\(\s*['"`]([^'"`]+)['"`]/g);
      if (axiosMatches) {
        calls.push(...axiosMatches.map(match => `${file}:${match}`));
      }

      // Look for API service calls
      const apiMatches = content.match(/api\.(get|post|put|delete|patch)\s*\(\s*['"`]([^'"`]+)['"`]/g);
      if (apiMatches) {
        calls.push(...apiMatches.map(match => `${file}:${match}`));
      }
    }

    return calls;
  }

  private async findComponentDefinitions(projectPath: string): Promise<string[]> {
    const components: string[] = [];
    const componentFiles = await glob('**/*.{js,ts,jsx,tsx,vue}', {
      cwd: projectPath,
      ignore: ['**/node_modules/**', '**/dist/**', '**/build/**']
    });

    for (const file of componentFiles) {
      const content = fs.readFileSync(path.join(projectPath, file), 'utf8');
      
      // React function components
      const functionMatches = content.match(/function\s+([A-Z][a-zA-Z0-9]*)\s*\(/g);
      if (functionMatches) {
        components.push(...functionMatches.map(match => match.match(/function\s+([A-Z][a-zA-Z0-9]*)/)?.[1]).filter(Boolean) as string[]);
      }

      // React arrow function components
      const arrowMatches = content.match(/const\s+([A-Z][a-zA-Z0-9]*)\s*=\s*\(/g);
      if (arrowMatches) {
        components.push(...arrowMatches.map(match => match.match(/const\s+([A-Z][a-zA-Z0-9]*)/)?.[1]).filter(Boolean) as string[]);
      }

      // Vue components
      const vueMatches = content.match(/export\s+default\s+{[\s\S]*name\s*:\s*['"`]([^'"`]+)['"`]/);
      if (vueMatches) {
        components.push(vueMatches[1]);
      }
    }

    return [...new Set(components)];
  }

  private async findComponentUsages(projectPath: string): Promise<Array<{ componentName: string; file: string; line: number }>> {
    const usages: Array<{ componentName: string; file: string; line: number }> = [];
    const files = await glob('**/*.{js,ts,jsx,tsx,vue}', {
      cwd: projectPath,
      ignore: ['**/node_modules/**', '**/dist/**', '**/build/**']
    });

    for (const file of files) {
      const content = fs.readFileSync(path.join(projectPath, file), 'utf8');
      const lines = content.split('\n');
      
      lines.forEach((line, index) => {
        // Look for JSX component usage
        const jsxMatches = line.match(/<([A-Z][a-zA-Z0-9]*)/g);
        if (jsxMatches) {
          jsxMatches.forEach(match => {
            const componentName = match.substring(1);
            usages.push({ componentName, file, line: index + 1 });
          });
        }
      });
    }

    return usages;
  }

  private async findRouteDefinitions(projectPath: string): Promise<string[]> {
    const routes: string[] = [];
    const routeFiles = await glob('**/*.{js,ts,jsx,tsx}', {
      cwd: projectPath,
      ignore: ['**/node_modules/**', '**/dist/**', '**/build/**']
    });

    for (const file of routeFiles) {
      const content = fs.readFileSync(path.join(projectPath, file), 'utf8');
      
      // React Router routes
      const reactRouterMatches = content.match(/path\s*=\s*['"`]([^'"`]+)['"`]/g);
      if (reactRouterMatches) {
        routes.push(...reactRouterMatches.map(match => match.match(/path\s*=\s*['"`]([^'"`]+)['"`]/)?.[1]).filter(Boolean) as string[]);
      }

      // Next.js file-based routes (infer from file structure)
      if (file.includes('/pages/') || file.includes('/app/')) {
        const routePath = file
          .replace(/^.*\/(pages|app)\//, '/')
          .replace(/\.(js|ts|jsx|tsx)$/, '')
          .replace(/\/index$/, '');
        if (routePath) {
          routes.push(routePath);
        }
      }
    }

    return [...new Set(routes)];
  }

  private async findRouteUsages(projectPath: string): Promise<Array<{ route: string; file: string; line: number }>> {
    const usages: Array<{ route: string; file: string; line: number }> = [];
    const files = await glob('**/*.{js,ts,jsx,tsx}', {
      cwd: projectPath,
      ignore: ['**/node_modules/**', '**/dist/**', '**/build/**']
    });

    for (const file of files) {
      const content = fs.readFileSync(path.join(projectPath, file), 'utf8');
      const lines = content.split('\n');
      
      lines.forEach((line, index) => {
        // Look for navigation calls
        const navMatches = line.match(/navigate\s*\(\s*['"`]([^'"`]+)['"`]/g) ||
                          line.match(/router\.push\s*\(\s*['"`]([^'"`]+)['"`]/g) ||
                          line.match(/history\.push\s*\(\s*['"`]([^'"`]+)['"`]/g);
        
        if (navMatches) {
          navMatches.forEach(match => {
            const route = match.match(/['"`]([^'"`]+)['"`]/)?.[1];
            if (route) {
              usages.push({ route, file, line: index + 1 });
            }
          });
        }
      });
    }

    return usages;
  }

  private async findAuthenticationCalls(projectPath: string): Promise<Array<{ type: string; endpoint: string; file: string; line: number }>> {
    const calls: Array<{ type: string; endpoint: string; file: string; line: number }> = [];
    const files = await glob('**/*.{js,ts,jsx,tsx}', {
      cwd: projectPath,
      ignore: ['**/node_modules/**', '**/dist/**', '**/build/**']
    });

    for (const file of files) {
      const content = fs.readFileSync(path.join(projectPath, file), 'utf8');
      const lines = content.split('\n');
      
      lines.forEach((line, index) => {
        // Look for auth-related API calls
        const authPatterns = [
          /login/i,
          /logout/i,
          /register/i,
          /signin/i,
          /signup/i,
          /auth/i
        ];

        for (const pattern of authPatterns) {
          if (pattern.test(line)) {
            const endpointMatch = line.match(/['"`]([^'"`]*auth[^'"`]*)['"`]/i);
            if (endpointMatch) {
              calls.push({
                type: 'authentication',
                endpoint: endpointMatch[1],
                file,
                line: index + 1
              });
            }
          }
        }
      });
    }

    return calls;
  }

  private async discoverApiEndpoints(projectPath: string): Promise<ApiEndpoint[]> {
    const endpoints: ApiEndpoint[] = [];
    const backendFiles = await glob('**/*.{js,ts,py,php,java,cs,rb,go}', {
      cwd: projectPath,
      ignore: ['**/node_modules/**', '**/dist/**', '**/build/**', '**/frontend/**', '**/client/**']
    });

    for (const file of backendFiles) {
      const content = fs.readFileSync(path.join(projectPath, file), 'utf8');
      
      // Express.js route patterns
      const expressMatches = content.match(/app\.(get|post|put|delete|patch)\s*\(\s*['"`]([^'"`]+)['"`]/g);
      if (expressMatches) {
        expressMatches.forEach(match => {
          const methodMatch = match.match(/app\.(\w+)/);
          const pathMatch = match.match(/['"`]([^'"`]+)['"`]/);
          
          if (methodMatch && pathMatch) {
            endpoints.push({
              path: pathMatch[1],
              method: methodMatch[1].toUpperCase() as any,
              description: `Discovered from ${file}`
            });
          }
        });
      }

      // FastAPI patterns (Python)
      const fastApiMatches = content.match(/@app\.(get|post|put|delete|patch)\s*\(\s*['"`]([^'"`]+)['"`]/g);
      if (fastApiMatches) {
        fastApiMatches.forEach(match => {
          const methodMatch = match.match(/@app\.(\w+)/);
          const pathMatch = match.match(/['"`]([^'"`]+)['"`]/);
          
          if (methodMatch && pathMatch) {
            endpoints.push({
              path: pathMatch[1],
              method: methodMatch[1].toUpperCase() as any,
              description: `Discovered from ${file}`
            });
          }
        });
      }
    }

    return endpoints;
  }

  private async discoverFrontendComponents(projectPath: string): Promise<any[]> {
    // Implementation would scan for React/Vue/Angular components
    return [];
  }

  private async discoverDatabaseModels(projectPath: string): Promise<any[]> {
    // Implementation would scan for database model definitions
    return [];
  }

  private parseApiCall(call: string): { method: string; path: string } {
    const methodMatch = call.match(/\.(get|post|put|delete|patch)/i);
    const pathMatch = call.match(/['"`]([^'"`]+)['"`]/);
    
    return {
      method: methodMatch ? methodMatch[1].toUpperCase() : 'GET',
      path: pathMatch ? pathMatch[1] : ''
    };
  }

  private parseApiCallWithLocation(call: string): { method: string; path: string; file: string; line: number } {
    const [fileInfo, callInfo] = call.split(':');
    const { method, path } = this.parseApiCall(callInfo);
    
    return {
      method,
      path,
      file: fileInfo,
      line: 1 // Would need more sophisticated parsing for actual line numbers
    };
  }

  private inferParameters(call: string): any[] {
    // Simple parameter inference - could be more sophisticated
    return [];
  }

  private shouldRequireAuth(path: string): boolean {
    const authPaths = ['user', 'profile', 'dashboard', 'admin', 'account'];
    return authPaths.some(authPath => path.toLowerCase().includes(authPath));
  }
}
