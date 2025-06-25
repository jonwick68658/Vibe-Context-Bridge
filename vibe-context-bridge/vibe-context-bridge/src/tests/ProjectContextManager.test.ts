import { ProjectContextManager } from '../ProjectContextManager';
import { ProjectContext } from '../types';
import * as fs from 'fs';
import * as path from 'path';

// Mock fs module
jest.mock('fs');
const mockFs = fs as jest.Mocked<typeof fs>;

describe('ProjectContextManager', () => {
  let contextManager: ProjectContextManager;
  const testProjectPath = '/test/project';

  beforeEach(() => {
    contextManager = new ProjectContextManager();
    jest.clearAllMocks();
  });

  describe('initializeContext', () => {
    it('should create a new context file with intelligent defaults', async () => {
      mockFs.existsSync.mockReturnValue(false);
      mockFs.readFileSync.mockReturnValue('{}');
      mockFs.writeFileSync.mockImplementation(() => {});

      const projectInfo = {
        project: {
          name: 'Test Project',
          type: 'web-app' as const,
          description: 'A test project'
        }
      };

      const context = await contextManager.initializeContext(testProjectPath, projectInfo);

      expect(context.project.name).toBe('Test Project');
      expect(context.project.type).toBe('web-app');
      expect(context.security.rules?.enforceHttps).toBe(true);
      expect(context.authentication?.type).toBe('jwt');
      expect(mockFs.writeFileSync).toHaveBeenCalled();
    });

    it('should load existing context if file exists', async () => {
      const existingContext = {
        project: { name: 'Existing Project', type: 'api' },
        security: { rules: { enforceHttps: true } }
      };

      mockFs.existsSync.mockReturnValue(true);
      mockFs.readFileSync.mockReturnValue(`
project:
  name: "Existing Project"
  type: "api"
security:
  rules:
    enforceHttps: true
      `);

      const context = await contextManager.initializeContext(testProjectPath, {});

      expect(context.project.name).toBe('Existing Project');
      expect(context.project.type).toBe('api');
    });
  });

  describe('validateContext', () => {
    it('should validate a correct context', () => {
      const validContext: ProjectContext = {
        project: {
          name: 'Valid Project',
          type: 'web-app'
        },
        security: {
          rules: {
            enforceHttps: true,
            inputSanitization: true
          }
        }
      };

      const result = contextManager.validateContext(validContext);
      expect(result.valid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('should identify validation errors', () => {
      const invalidContext = {
        project: {
          // Missing required name
          type: 'web-app'
        },
        security: {
          rules: {
            enforceHttps: true
          }
        }
      } as ProjectContext;

      const result = contextManager.validateContext(invalidContext);
      expect(result.valid).toBe(false);
      expect(result.errors.length).toBeGreaterThan(0);
    });
  });

  describe('recordAiInteraction', () => {
    it('should record AI interactions in context memory', () => {
      const context: ProjectContext = {
        project: { name: 'Test', type: 'web-app' },
        security: { rules: {} }
      };

      contextManager.recordAiInteraction(
        context,
        'component-creation',
        'Created user login component',
        'Successfully generated secure login form'
      );

      expect(context.contextMemory?.aiInteractions).toHaveLength(1);
      expect(context.contextMemory?.aiInteractions?.[0].action).toBe('component-creation');
      expect(context.contextMemory?.lastUpdated).toBeDefined();
    });

    it('should limit interaction history to prevent bloat', () => {
      const context: ProjectContext = {
        project: { name: 'Test', type: 'web-app' },
        security: { rules: {} },
        contextMemory: {
          aiInteractions: new Array(60).fill(null).map((_, i) => ({
            timestamp: new Date().toISOString(),
            action: `action-${i}`,
            context: `context-${i}`,
            result: `result-${i}`
          }))
        }
      };

      contextManager.recordAiInteraction(
        context,
        'new-action',
        'New context',
        'New result'
      );

      expect(context.contextMemory?.aiInteractions).toHaveLength(50);
      expect(context.contextMemory?.aiInteractions?.[0].action).toBe('new-action');
    });
  });
});