import { ProjectContext, AiInteraction } from './types';

export class ContextMemory {
  private context: ProjectContext;
  private maxInteractions: number;

  constructor(context: ProjectContext, maxInteractions: number = 100) {
    this.context = context;
    this.maxInteractions = maxInteractions;
  }

  /**
   * Record an AI interaction with context preservation
   */
  public recordInteraction(action: string, contextInfo: string, result: string, metadata?: any): void {
    if (!this.context.contextMemory) {
      this.context.contextMemory = {};
    }
    
    if (!this.context.contextMemory.aiInteractions) {
      this.context.contextMemory.aiInteractions = [];
    }

    const interaction: AiInteraction = {
      timestamp: new Date().toISOString(),
      action,
      context: contextInfo,
      result,
      metadata
    };

    this.context.contextMemory.aiInteractions.unshift(interaction);

    // Keep only the most recent interactions
    if (this.context.contextMemory.aiInteractions.length > this.maxInteractions) {
      this.context.contextMemory.aiInteractions = this.context.contextMemory.aiInteractions.slice(0, this.maxInteractions);
    }

    this.context.contextMemory.lastUpdated = new Date().toISOString();
  }

  /**
   * Get recent interactions by action type
   */
  public getInteractionsByAction(action: string, limit: number = 10): AiInteraction[] {
    if (!this.context.contextMemory?.aiInteractions) {
      return [];
    }

    return this.context.contextMemory.aiInteractions
      .filter(interaction => interaction.action === action)
      .slice(0, limit);
  }

  /**
   * Get interactions within a time range
   */
  public getInteractionsByTimeRange(startDate: Date, endDate: Date): AiInteraction[] {
    if (!this.context.contextMemory?.aiInteractions) {
      return [];
    }

    return this.context.contextMemory.aiInteractions.filter(interaction => {
      const interactionDate = new Date(interaction.timestamp);
      return interactionDate >= startDate && interactionDate <= endDate;
    });
  }

  /**
   * Get context summary for AI tools
   */
  public getContextSummary(): string {
    const project = this.context.project;
    const recentInteractions = this.getRecentInteractions(5);
    
    let summary = `Project: ${project.name} (${project.type})\n`;
    
    if (project.description) {
      summary += `Description: ${project.description}\n`;
    }

    if (project.framework) {
      summary += `Framework: ${Object.entries(project.framework)
        .filter(([key, value]) => value)
        .map(([key, value]) => `${key}: ${value}`)
        .join(', ')}\n`;
    }

    if (this.context.api?.endpoints) {
      summary += `\nAPI Endpoints (${this.context.api.endpoints.length}):\n`;
      this.context.api.endpoints.forEach(endpoint => {
        summary += `- ${endpoint.method} ${endpoint.path}${endpoint.authentication ? ' (auth required)' : ''}\n`;
      });
    }

    if (this.context.frontend?.components) {
      summary += `\nComponents (${this.context.frontend.components.length}):\n`;
      this.context.frontend.components.forEach(component => {
        summary += `- ${component.name} (${component.path})\n`;
      });
    }

    if (this.context.database?.models) {
      summary += `\nDatabase Models (${this.context.database.models.length}):\n`;
      this.context.database.models.forEach(model => {
        summary += `- ${model.name} (${model.fields.length} fields)\n`;
      });
    }

    if (recentInteractions.length > 0) {
      summary += `\nRecent AI Interactions:\n`;
      recentInteractions.forEach(interaction => {
        summary += `- ${interaction.action}: ${interaction.context} -> ${interaction.result}\n`;
      });
    }

    return summary;
  }

  /**
   * Get personalized preferences for code generation
   */
  public getCodeGenerationPreferences(): any {
    return this.context.contextMemory?.codeGeneration?.preferences || {
      codeStyle: 'clean',
      commentLevel: 'moderate',
      errorHandling: 'comprehensive',
      testGeneration: true
    };
  }

  /**
   * Update code generation preferences based on user behavior
   */
  public updateCodeGenerationPreferences(preferences: Partial<any>): void {
    if (!this.context.contextMemory) {
      this.context.contextMemory = {};
    }
    
    if (!this.context.contextMemory.codeGeneration) {
      this.context.contextMemory.codeGeneration = {};
    }

    this.context.contextMemory.codeGeneration.preferences = {
      ...this.getCodeGenerationPreferences(),
      ...preferences
    };

    this.context.contextMemory.lastUpdated = new Date().toISOString();
  }

  /**
   * Analyze patterns in AI interactions
   */
  public analyzeInteractionPatterns(): any {
    if (!this.context.contextMemory?.aiInteractions || this.context.contextMemory.aiInteractions.length === 0) {
      return {
        totalInteractions: 0,
        commonActions: [],
        averageSessionLength: 0,
        patterns: []
      };
    }

    const interactions = this.context.contextMemory.aiInteractions;
    
    // Count actions
    const actionCounts: Record<string, number> = {};
    interactions.forEach(interaction => {
      actionCounts[interaction.action] = (actionCounts[interaction.action] || 0) + 1;
    });

    // Sort by frequency
    const commonActions = Object.entries(actionCounts)
      .sort(([, a], [, b]) => b - a)
      .slice(0, 5)
      .map(([action, count]) => ({ action, count }));

    // Analyze temporal patterns
    const patterns = this.analyzeTemporalPatterns(interactions);

    // Calculate average session length (rough estimate)
    const averageSessionLength = this.calculateAverageSessionLength(interactions);

    return {
      totalInteractions: interactions.length,
      commonActions,
      averageSessionLength,
      patterns,
      lastInteraction: interactions[0]?.timestamp,
      firstInteraction: interactions[interactions.length - 1]?.timestamp
    };
  }

  /**
   * Generate context-aware suggestions
   */
  public generateSuggestions(): string[] {
    const suggestions: string[] = [];
    const patterns = this.analyzeInteractionPatterns();
    
    // Suggest based on common actions
    if (patterns.commonActions.length > 0) {
      const topAction = patterns.commonActions[0];
      
      switch (topAction.action) {
        case 'component-creation':
          suggestions.push('Consider creating a component library for reusable components');
          break;
        case 'api-endpoint-creation':
          suggestions.push('Consider implementing API documentation with Swagger/OpenAPI');
          break;
        case 'security-fix':
          suggestions.push('Consider implementing automated security scanning in your CI/CD pipeline');
          break;
        case 'database-model':
          suggestions.push('Consider setting up database migrations for schema changes');
          break;
      }
    }

    // Suggest based on project structure
    if (!this.context.api?.endpoints || this.context.api.endpoints.length === 0) {
      suggestions.push('Define your API endpoints in the project context for better continuity checking');
    }

    if (!this.context.authentication || this.context.authentication.type === 'none') {
      suggestions.push('Consider implementing authentication for your application');
    }

    if (!this.context.security?.rules?.enforceHttps) {
      suggestions.push('Enable HTTPS enforcement for production security');
    }

    // Suggest based on missing components
    if (!this.context.frontend?.components || this.context.frontend.components.length === 0) {
      suggestions.push('Document your frontend components for better project understanding');
    }

    if (!this.context.database?.models || this.context.database.models.length === 0) {
      suggestions.push('Define your database models in the project context');
    }

    return suggestions.slice(0, 5); // Return top 5 suggestions
  }

  /**
   * Get learning insights from interaction history
   */
  public getLearningInsights(): any {
    const patterns = this.analyzeInteractionPatterns();
    const preferences = this.getCodeGenerationPreferences();
    const suggestions = this.generateSuggestions();

    return {
      patterns,
      preferences,
      suggestions,
      projectMaturity: this.assessProjectMaturity(),
      skillAreas: this.identifySkillAreas(),
      nextSteps: this.recommendNextSteps()
    };
  }

  /**
   * Clear old interactions to manage memory usage
   */
  public cleanupOldInteractions(daysToKeep: number = 30): number {
    if (!this.context.contextMemory?.aiInteractions) {
      return 0;
    }

    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - daysToKeep);

    const originalCount = this.context.contextMemory.aiInteractions.length;
    
    this.context.contextMemory.aiInteractions = this.context.contextMemory.aiInteractions.filter(
      interaction => new Date(interaction.timestamp) > cutoffDate
    );

    const removedCount = originalCount - this.context.contextMemory.aiInteractions.length;
    
    if (removedCount > 0) {
      this.context.contextMemory.lastUpdated = new Date().toISOString();
    }

    return removedCount;
  }

  private getRecentInteractions(limit: number = 10): AiInteraction[] {
    if (!this.context.contextMemory?.aiInteractions) {
      return [];
    }

    return this.context.contextMemory.aiInteractions.slice(0, limit);
  }

  private analyzeTemporalPatterns(interactions: AiInteraction[]): any[] {
    const patterns: any[] = [];
    
    // Group by hour of day
    const hourCounts: Record<number, number> = {};
    interactions.forEach(interaction => {
      const hour = new Date(interaction.timestamp).getHours();
      hourCounts[hour] = (hourCounts[hour] || 0) + 1;
    });

    const peakHours = Object.entries(hourCounts)
      .sort(([, a], [, b]) => b - a)
      .slice(0, 3)
      .map(([hour, count]) => ({ hour: parseInt(hour), count }));

    patterns.push({
      type: 'peak-hours',
      data: peakHours
    });

    // Analyze interaction frequency
    const dates = interactions.map(i => new Date(i.timestamp).toDateString());
    const dateCounts = dates.reduce((acc, date) => {
      acc[date] = (acc[date] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);

    const averageInteractionsPerDay = Object.values(dateCounts).reduce((a, b) => a + b, 0) / Object.keys(dateCounts).length;

    patterns.push({
      type: 'frequency',
      averagePerDay: averageInteractionsPerDay,
      activeDays: Object.keys(dateCounts).length
    });

    return patterns;
  }

  private calculateAverageSessionLength(interactions: AiInteraction[]): number {
    if (interactions.length < 2) return 0;

    // Group interactions by session (interactions within 30 minutes of each other)
    const sessions: AiInteraction[][] = [];
    let currentSession: AiInteraction[] = [interactions[0]];

    for (let i = 1; i < interactions.length; i++) {
      const current = new Date(interactions[i].timestamp);
      const previous = new Date(interactions[i - 1].timestamp);
      const timeDiff = Math.abs(current.getTime() - previous.getTime()) / (1000 * 60); // minutes

      if (timeDiff <= 30) {
        currentSession.push(interactions[i]);
      } else {
        sessions.push(currentSession);
        currentSession = [interactions[i]];
      }
    }
    sessions.push(currentSession);

    // Calculate average session length
    const sessionLengths = sessions.map(session => session.length);
    return sessionLengths.reduce((a, b) => a + b, 0) / sessionLengths.length;
  }

  private assessProjectMaturity(): string {
    let score = 0;
    
    // Check various aspects of project completeness
    if (this.context.api?.endpoints && this.context.api.endpoints.length > 0) score += 20;
    if (this.context.authentication && this.context.authentication.type !== 'none') score += 20;
    if (this.context.security?.rules?.enforceHttps) score += 15;
    if (this.context.database?.models && this.context.database.models.length > 0) score += 15;
    if (this.context.frontend?.components && this.context.frontend.components.length > 0) score += 15;
    if (this.context.deployment?.platform) score += 15;

    if (score >= 80) return 'mature';
    if (score >= 50) return 'developing';
    if (score >= 25) return 'early';
    return 'initial';
  }

  private identifySkillAreas(): string[] {
    const areas: string[] = [];
    const patterns = this.analyzeInteractionPatterns();
    
    patterns.commonActions.forEach(({ action }) => {
      switch (action) {
        case 'component-creation':
          areas.push('Frontend Development');
          break;
        case 'api-endpoint-creation':
          areas.push('Backend Development');
          break;
        case 'security-fix':
          areas.push('Security');
          break;
        case 'database-model':
          areas.push('Database Design');
          break;
        case 'deployment':
          areas.push('DevOps');
          break;
      }
    });

    return [...new Set(areas)];
  }

  private recommendNextSteps(): string[] {
    const steps: string[] = [];
    const maturity = this.assessProjectMaturity();
    
    switch (maturity) {
      case 'initial':
        steps.push('Define your project structure and main components');
        steps.push('Set up basic authentication');
        steps.push('Create your first API endpoints');
        break;
      case 'early':
        steps.push('Implement comprehensive security measures');
        steps.push('Add input validation and error handling');
        steps.push('Set up testing framework');
        break;
      case 'developing':
        steps.push('Optimize performance and add caching');
        steps.push('Implement CI/CD pipeline');
        steps.push('Add monitoring and logging');
        break;
      case 'mature':
        steps.push('Consider microservices architecture');
        steps.push('Implement advanced security features');
        steps.push('Add comprehensive documentation');
        break;
    }

    return steps;
  }
}
