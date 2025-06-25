import * as fs from 'fs';
import * as path from 'path';
import { glob } from 'glob';
import { ProjectContext, SecurityIssue, SecurityPattern } from './types';

export class SecurityValidator {
  private context: ProjectContext;
  
  constructor(context: ProjectContext) {
    this.context = context;
  }

  /**
   * Scan entire project for security vulnerabilities
   */
  public async scanProject(projectPath: string): Promise<SecurityIssue[]> {
    const issues: SecurityIssue[] = [];
    
    // Get all relevant files to scan
    const files = await this.getFilesToScan(projectPath);
    
    for (const file of files) {
      const fileIssues = await this.scanFile(file);
      issues.push(...fileIssues);
    }

    // Additional project-level security checks
    const projectIssues = await this.scanProjectConfiguration(projectPath);
    issues.push(...projectIssues);

    return issues;
  }

  /**
   * Scan a single file for security issues
   */
  public async scanFile(filePath: string): Promise<SecurityIssue[]> {
    const issues: SecurityIssue[] = [];
    
    try {
      const content = fs.readFileSync(filePath, 'utf8');
      const lines = content.split('\n');
      
      // Apply security patterns from context
      if (this.context.security?.patterns) {
        for (const pattern of this.context.security.patterns) {
          const patternIssues = this.applySecurityPattern(filePath, content, lines, pattern);
          issues.push(...patternIssues);
        }
      }

      // Apply built-in security checks
      const builtInIssues = this.applyBuiltInSecurityChecks(filePath, content, lines);
      issues.push(...builtInIssues);

    } catch (error) {
      console.warn(`Could not scan file ${filePath}: ${error}`);
    }

    return issues;
  }

  /**
   * Auto-fix common security issues
   */
  public async autoFixSecurityIssues(projectPath: string, issues: SecurityIssue[]): Promise<SecurityIssue[]> {
    const fixedIssues: SecurityIssue[] = [];
    
    for (const issue of issues) {
      const fixed = await this.tryAutoFix(projectPath, issue);
      if (fixed) {
        fixedIssues.push(issue);
      }
    }

    return fixedIssues;
  }

  /**
   * Generate security configuration for specific app types
   */
  public generateSecurityConfig(appType: string): Partial<ProjectContext> {
    const configs: Record<string, Partial<ProjectContext>> = {
      'e-commerce': {
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
            ...this.getDefaultPatterns(),
            {
              name: 'pci-compliance-check',
              pattern: '(card[_-]?number|cvv|expiry)\\s*[=:]',
              severity: 'error',
              message: 'Credit card data detected. Ensure PCI DSS compliance and use secure payment processors.'
            },
            {
              name: 'payment-validation',
              pattern: 'payment.*validate|charge.*card',
              severity: 'warning',
              message: 'Payment processing detected. Ensure proper validation and error handling.'
            }
          ]
        },
        authentication: {
          type: 'jwt',
          config: {
            expiry: '15m',
            refreshToken: true
          }
        }
      },
      'healthcare': {
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
            ...this.getDefaultPatterns(),
            {
              name: 'hipaa-compliance',
              pattern: '(medical[_-]?record|patient[_-]?data|health[_-]?info)',
              severity: 'error',
              message: 'Medical data detected. Ensure HIPAA compliance and data encryption.'
            },
            {
              name: 'phi-protection',
              pattern: '(ssn|dob|medical[_-]?id)',
              severity: 'error',
              message: 'Protected Health Information (PHI) detected. Implement proper access controls.'
            }
          ]
        }
      },
      'financial': {
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
            ...this.getDefaultPatterns(),
            {
              name: 'financial-data',
              pattern: '(account[_-]?number|routing[_-]?number|balance)',
              severity: 'error',
              message: 'Financial data detected. Ensure SOX compliance and data encryption.'
            },
            {
              name: 'transaction-logging',
              pattern: 'transaction|transfer|deposit|withdraw',
              severity: 'warning',
              message: 'Financial transaction detected. Ensure proper audit logging.'
            }
          ]
        }
      }
    };

    return configs[appType] || configs['web-app'] || {};
  }

  private async getFilesToScan(projectPath: string): Promise<string[]> {
    const patterns = [
      '**/*.js',
      '**/*.ts',
      '**/*.jsx',
      '**/*.tsx',
      '**/*.vue',
      '**/*.py',
      '**/*.php',
      '**/*.java',
      '**/*.cs',
      '**/*.rb',
      '**/*.go',
      '**/*.rs',
      '**/*.sql',
      '**/*.env*',
      '**/config.json',
      '**/package.json'
    ];

    const ignorePatterns = [
      '**/node_modules/**',
      '**/dist/**',
      '**/build/**',
      '**/.git/**',
      '**/coverage/**',
      '**/*.min.js',
      '**/*.bundle.js'
    ];

    const files: string[] = [];
    
    for (const pattern of patterns) {
      try {
        const matches = await glob(pattern, { 
          cwd: projectPath,
          ignore: ignorePatterns,
          absolute: true
        });
        files.push(...matches);
      } catch (error) {
        console.warn(`Could not scan pattern ${pattern}: ${error}`);
      }
    }

    return [...new Set(files)]; // Remove duplicates
  }

  private applySecurityPattern(filePath: string, content: string, lines: string[], pattern: SecurityPattern): SecurityIssue[] {
    const issues: SecurityIssue[] = [];
    const regex = new RegExp(pattern.pattern, 'gi');
    
    lines.forEach((line, index) => {
      if (regex.test(line)) {
        issues.push({
          file: filePath,
          line: index + 1,
          rule: pattern.name,
          severity: pattern.severity,
          message: pattern.message,
          suggestion: this.getSuggestionForPattern(pattern.name, line)
        });
      }
    });

    return issues;
  }

  private applyBuiltInSecurityChecks(filePath: string, content: string, lines: string[]): SecurityIssue[] {
    const issues: SecurityIssue[] = [];
    
    // Check for environment files with sensitive data
    if (filePath.includes('.env')) {
      issues.push(...this.checkEnvironmentFile(filePath, lines));
    }

    // Check for package.json vulnerabilities
    if (filePath.endsWith('package.json')) {
      issues.push(...this.checkPackageJson(filePath, content));
    }

    // Check for common security anti-patterns
    issues.push(...this.checkCommonAntiPatterns(filePath, lines));

    // Check for authentication bypass patterns
    issues.push(...this.checkAuthenticationBypass(filePath, lines));

    // Check for data exposure patterns
    issues.push(...this.checkDataExposure(filePath, lines));

    return issues;
  }

  private checkEnvironmentFile(filePath: string, lines: string[]): SecurityIssue[] {
    const issues: SecurityIssue[] = [];
    
    lines.forEach((line, index) => {
      // Check for sensitive keys without proper naming
      if (line.includes('=') && !line.startsWith('#')) {
        const [key, value] = line.split('=');
        
        // Flag suspicious values
        if (value && value.length > 10 && !value.includes('${') && !value.includes('your_')) {
          if (key.toLowerCase().includes('key') || key.toLowerCase().includes('secret') || key.toLowerCase().includes('token')) {
            issues.push({
              file: filePath,
              line: index + 1,
              rule: 'env-file-security',
              severity: 'warning',
              message: 'Environment file contains what appears to be real credentials. Ensure this file is not committed to version control.',
              suggestion: 'Add .env files to .gitignore and use placeholder values in committed examples'
            });
          }
        }
      }
    });

    return issues;
  }

  private checkPackageJson(filePath: string, content: string): SecurityIssue[] {
    const issues: SecurityIssue[] = [];
    
    try {
      const packageData = JSON.parse(content);
      
      // Check for known vulnerable packages (simplified check)
      const vulnerablePackages = ['lodash', 'moment', 'request', 'underscore'];
      const dependencies = { ...packageData.dependencies, ...packageData.devDependencies };
      
      for (const [pkg, version] of Object.entries(dependencies)) {
        if (vulnerablePackages.includes(pkg)) {
          issues.push({
            file: filePath,
            rule: 'vulnerable-dependency',
            severity: 'warning',
            message: `Package ${pkg} may have known vulnerabilities. Consider updating or replacing.`,
            suggestion: `Run 'npm audit' to check for vulnerabilities and update ${pkg} to the latest version`
          });
        }
      }
    } catch (error) {
      // Invalid JSON, but that's not our concern here
    }

    return issues;
  }

  private checkCommonAntiPatterns(filePath: string, lines: string[]): SecurityIssue[] {
    const issues: SecurityIssue[] = [];
    
    lines.forEach((line, index) => {
      // Check for eval() usage
      if (line.includes('eval(')) {
        issues.push({
          file: filePath,
          line: index + 1,
          rule: 'eval-usage',
          severity: 'error',
          message: 'Use of eval() detected. This is a serious security risk.',
          suggestion: 'Avoid eval(). Use JSON.parse() for JSON data or proper function calls'
        });
      }

      // Check for document.write usage
      if (line.includes('document.write(')) {
        issues.push({
          file: filePath,
          line: index + 1,
          rule: 'document-write',
          severity: 'warning',
          message: 'document.write() usage detected. This can lead to XSS vulnerabilities.',
          suggestion: 'Use DOM manipulation methods like createElement() and appendChild()'
        });
      }

      // Check for console.log with sensitive data patterns
      if (line.includes('console.log') && (line.includes('password') || line.includes('token') || line.includes('secret'))) {
        issues.push({
          file: filePath,
          line: index + 1,
          rule: 'console-log-sensitive',
          severity: 'warning',
          message: 'Console.log with potentially sensitive data detected.',
          suggestion: 'Remove console.log statements with sensitive data before production'
        });
      }
    });

    return issues;
  }

  private checkAuthenticationBypass(filePath: string, lines: string[]): SecurityIssue[] {
    const issues: SecurityIssue[] = [];
    
    lines.forEach((line, index) => {
      // Check for authentication bypass patterns
      if (line.includes('if (') && line.includes('||') && (line.includes('admin') || line.includes('bypass'))) {
        issues.push({
          file: filePath,
          line: index + 1,
          rule: 'auth-bypass-pattern',
          severity: 'error',
          message: 'Potential authentication bypass pattern detected.',
          suggestion: 'Review authentication logic to ensure no unintended bypass conditions'
        });
      }

      // Check for hardcoded admin credentials
      if ((line.includes('admin') || line.includes('root')) && line.includes('password')) {
        issues.push({
          file: filePath,
          line: index + 1,
          rule: 'hardcoded-admin',
          severity: 'error',
          message: 'Hardcoded admin credentials detected.',
          suggestion: 'Use environment variables and secure credential management'
        });
      }
    });

    return issues;
  }

  private checkDataExposure(filePath: string, lines: string[]): SecurityIssue[] {
    const issues: SecurityIssue[] = [];
    
    lines.forEach((line, index) => {
      // Check for potential data exposure in API responses
      if (line.includes('res.json') && line.includes('user') && (line.includes('password') || line.includes('secret'))) {
        issues.push({
          file: filePath,
          line: index + 1,
          rule: 'data-exposure',
          severity: 'error',
          message: 'Potential sensitive data exposure in API response.',
          suggestion: 'Filter sensitive fields before sending API responses'
        });
      }

      // Check for SQL queries that might expose data
      if (line.includes('SELECT *') && line.includes('user')) {
        issues.push({
          file: filePath,
          line: index + 1,
          rule: 'sql-data-exposure',
          severity: 'warning',
          message: 'SELECT * query on user table may expose sensitive data.',
          suggestion: 'Specify only the columns needed instead of using SELECT *'
        });
      }
    });

    return issues;
  }

  private async tryAutoFix(projectPath: string, issue: SecurityIssue): Promise<boolean> {
    // This would implement automatic fixes for common issues
    // For now, we'll return false to indicate manual fix needed
    
    switch (issue.rule) {
      case 'hardcoded-api-key':
        return await this.fixHardcodedApiKey(issue);
      case 'insecure-http':
        return await this.fixInsecureHttp(issue);
      default:
        return false;
    }
  }

  private async fixHardcodedApiKey(issue: SecurityIssue): Promise<boolean> {
    // Implementation would move hardcoded keys to environment variables
    // This is a placeholder for the actual implementation
    return false;
  }

  private async fixInsecureHttp(issue: SecurityIssue): Promise<boolean> {
    // Implementation would replace http:// with https://
    // This is a placeholder for the actual implementation
    return false;
  }

  private getDefaultPatterns(): SecurityPattern[] {
    return [
      {
        name: 'hardcoded-api-key',
        pattern: '(api[_-]?key|secret[_-]?key|access[_-]?token)\\s*[=:]\\s*["\'][a-zA-Z0-9]{10,}["\']',
        severity: 'error',
        message: 'Hardcoded API key detected. Use environment variables instead.'
      },
      {
        name: 'hardcoded-password',
        pattern: 'password\\s*[=:]\\s*["\'][^"\']{3,}["\']',
        severity: 'error',
        message: 'Hardcoded password detected. Use secure configuration management.'
      },
      {
        name: 'sql-injection-risk',
        pattern: '(SELECT|INSERT|UPDATE|DELETE).*[+].*[$]|[$][{].*[}]',
        severity: 'error',
        message: 'Potential SQL injection vulnerability. Use parameterized queries.'
      },
      {
        name: 'xss-vulnerability',
        pattern: 'innerHTML\\s*=\\s*[^"\']*[$]|dangerouslySetInnerHTML',
        severity: 'warning',
        message: 'Potential XSS vulnerability. Sanitize user input before rendering.'
      },
      {
        name: 'insecure-http',
        pattern: 'http://(?!localhost|127\\.0\\.0\\.1|0\\.0\\.0\\.0)',
        severity: 'warning',
        message: 'Insecure HTTP protocol detected. Use HTTPS in production.'
      }
    ];
  }

  private getSuggestionForPattern(patternName: string, line: string): string {
    const suggestions: Record<string, string> = {
      'hardcoded-api-key': 'Move to environment variable: process.env.API_KEY',
      'hardcoded-password': 'Use environment variables and bcrypt for password hashing',
      'sql-injection-risk': 'Use parameterized queries or an ORM like Prisma/Sequelize',
      'xss-vulnerability': 'Use DOMPurify to sanitize HTML or avoid innerHTML',
      'insecure-http': 'Replace with https:// for production URLs'
    };

    return suggestions[patternName] || 'Review this security issue and apply appropriate fixes';
  }

  private async scanProjectConfiguration(projectPath: string): Promise<SecurityIssue[]> {
    const issues: SecurityIssue[] = [];
    
    // Check for .gitignore
    const gitignorePath = path.join(projectPath, '.gitignore');
    if (!fs.existsSync(gitignorePath)) {
      issues.push({
        file: '.gitignore',
        rule: 'missing-gitignore',
        severity: 'warning',
        message: 'Missing .gitignore file. Sensitive files may be accidentally committed.',
        suggestion: 'Create .gitignore file with appropriate patterns for your project type'
      });
    } else {
      const gitignoreContent = fs.readFileSync(gitignorePath, 'utf8');
      if (!gitignoreContent.includes('.env')) {
        issues.push({
          file: '.gitignore',
          rule: 'gitignore-env-missing',
          severity: 'error',
          message: '.env files not ignored in .gitignore. Environment variables may be exposed.',
          suggestion: 'Add .env* to your .gitignore file'
        });
      }
    }

    return issues;
  }
}
