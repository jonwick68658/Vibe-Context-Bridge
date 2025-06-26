import * as vscode from 'vscode';
import * as path from 'path';
import { 
  ProjectContextManager, 
  SecurityValidator, 
  ContinuityChecker, 
  AuthTemplateManager, 
  ContextMemory,
  ProjectContext,
  SecurityIssue,
  ContinuityIssue
} from 'vibe-context-bridge';

class VibeContextBridgeExtension {
  private contextManager: ProjectContextManager;
  private securityValidator: SecurityValidator | null = null;
  private continuityChecker: ContinuityChecker | null = null;
  private authTemplateManager: AuthTemplateManager | null = null;
  private contextMemory: ContextMemory | null = null;
  private context: ProjectContext | null = null;
  private diagnosticCollection: vscode.DiagnosticCollection;
  private statusBarItem: vscode.StatusBarItem;

  constructor(private extensionContext: vscode.ExtensionContext) {
    this.contextManager = new ProjectContextManager();
    this.diagnosticCollection = vscode.languages.createDiagnosticCollection('vibeContextBridge');
    this.statusBarItem = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Left, 100);
    this.statusBarItem.text = "$(shield) Vibe Context Bridge";
    this.statusBarItem.command = 'vibeContextBridge.showContextMemory';
  }

  public async activate(): Promise<void> {
    // Register commands
    this.registerCommands();
    
    // Set up event listeners
    this.setupEventListeners();
    
    // Initialize if project has context
    await this.tryInitializeFromExistingContext();
    
    // Show status bar
    this.statusBarItem.show();
    
    // Set context for when clauses
    vscode.commands.executeCommand('setContext', 'vibeContextBridge.isActive', true);
  }

  private registerCommands(): void {
    const commands = [
      vscode.commands.registerCommand('vibeContextBridge.initializeProject', () => this.initializeProject()),
      vscode.commands.registerCommand('vibeContextBridge.scanSecurity', () => this.scanSecurity()),
      vscode.commands.registerCommand('vibeContextBridge.checkContinuity', () => this.checkContinuity()),
      vscode.commands.registerCommand('vibeContextBridge.generateAuth', () => this.generateAuth()),
      vscode.commands.registerCommand('vibeContextBridge.showContextMemory', () => this.showContextMemory()),
      vscode.commands.registerCommand('vibeContextBridge.fixSecurityIssue', () => this.fixSecurityIssue()),
      vscode.commands.registerCommand('vibeContextBridge.updateContext', () => this.updateContextFromCode())
    ];

    commands.forEach(command => this.extensionContext.subscriptions.push(command));
  }

  private setupEventListeners(): void {
    // Auto-scan on file changes
    const watcher = vscode.workspace.createFileSystemWatcher('**/*.{js,ts,jsx,tsx,py,php,java,cs,rb,go}');
    
    watcher.onDidChange(async (uri) => {
      if (this.shouldAutoScan()) {
        await this.scanFileForSecurity(uri.fsPath);
      }
    });

    watcher.onDidCreate(async (uri) => {
      if (this.shouldAutoScan()) {
        await this.scanFileForSecurity(uri.fsPath);
      }
    });

    this.extensionContext.subscriptions.push(watcher);

    // Context file watcher
    const contextWatcher = vscode.workspace.createFileSystemWatcher('**/.project-context.{yaml,json}');
    
    contextWatcher.onDidChange(async () => {
      await this.reloadContext();
    });

    this.extensionContext.subscriptions.push(contextWatcher);
  }

  private async tryInitializeFromExistingContext(): Promise<void> {
    const workspaceFolders = vscode.workspace.workspaceFolders;
    if (!workspaceFolders) return;

    for (const folder of workspaceFolders) {
      try {
        this.context = this.contextManager.loadContext(folder.uri.fsPath);
        await this.initializeFromContext();
        this.updateStatusBar('Context Loaded');
        return;
      } catch (error) {
        // No context file found, continue
      }
    }
  }

  private async initializeProject(): Promise<void> {
    const workspaceFolders = vscode.workspace.workspaceFolders;
    if (!workspaceFolders) {
      vscode.window.showErrorMessage('Please open a workspace folder first');
      return;
    }

    const projectPath = workspaceFolders[0].uri.fsPath;

    // Show project type selection
    const projectTypes = [
      { label: 'Web Application', value: 'web-app' },
      { label: 'E-commerce', value: 'e-commerce' },
      { label: 'Blog/CMS', value: 'blog' },
      { label: 'Dashboard', value: 'dashboard' },
      { label: 'API Only', value: 'api-only' }
    ];

    const selectedType = await vscode.window.showQuickPick(projectTypes, {
      placeHolder: 'Select your project type'
    });

    if (!selectedType) return;

    // Get project name
    const projectName = await vscode.window.showInputBox({
      prompt: 'Enter project name',
      value: path.basename(projectPath)
    });

    if (!projectName) return;

    // Get project description
    const projectDescription = await vscode.window.showInputBox({
      prompt: 'Enter project description (optional)',
      placeHolder: 'A brief description of your project'
    });

    try {
      this.context = await this.contextManager.initializeContext(projectPath, {
        project: {
          name: projectName,
          description: projectDescription,
          type: selectedType.value as any
        }
      });

      await this.initializeFromContext();
      
      vscode.window.showInformationMessage('Vibe Context Bridge initialized successfully!');
      this.updateStatusBar('Initialized');

      // Record the initialization
      this.contextMemory?.recordInteraction(
        'project-initialization',
        `Project: ${projectName}, Type: ${selectedType.value}`,
        'Context bridge successfully initialized'
      );

      // Auto-scan for security issues
      await this.scanSecurity();

    } catch (error) {
      vscode.window.showErrorMessage(`Failed to initialize: ${error}`);
    }
  }

  private async initializeFromContext(): Promise<void> {
    if (!this.context) return;

    this.securityValidator = new SecurityValidator(this.context);
    this.continuityChecker = new ContinuityChecker(this.context);
    this.authTemplateManager = new AuthTemplateManager(this.context);
    this.contextMemory = new ContextMemory(this.context, this.getConfigValue('contextMemorySize', 100));
  }

  private async scanSecurity(): Promise<void> {
    if (!this.securityValidator || !vscode.workspace.workspaceFolders) {
      vscode.window.showWarningMessage('Please initialize Vibe Context Bridge first');
      return;
    }

    const projectPath = vscode.workspace.workspaceFolders[0].uri.fsPath;
    this.updateStatusBar('Scanning Security...');

    try {
      const issues = await this.securityValidator.scanProject(projectPath);
      this.displaySecurityIssues(issues);
      
      const criticalCount = issues.filter(i => i.severity === 'error').length;
      const warningCount = issues.filter(i => i.severity === 'warning').length;

      if (criticalCount > 0) {
        vscode.window.showWarningMessage(
          `Found ${criticalCount} critical security issues and ${warningCount} warnings`,
          'View Issues'
        ).then(selection => {
          if (selection === 'View Issues') {
            vscode.commands.executeCommand('workbench.action.problems.focus');
          }
        });
      } else if (warningCount > 0) {
        vscode.window.showInformationMessage(`Found ${warningCount} security warnings`);
      } else {
        vscode.window.showInformationMessage('No security issues found! 🛡️');
      }

      this.updateStatusBar(`${issues.length} Security Issues`);

      // Record the scan
      this.contextMemory?.recordInteraction(
        'security-scan',
        `Scanned ${projectPath}`,
        `Found ${criticalCount} critical issues, ${warningCount} warnings`
      );

    } catch (error) {
      vscode.window.showErrorMessage(`Security scan failed: ${error}`);
      this.updateStatusBar('Scan Failed');
    }
  }

  private async checkContinuity(): Promise<void> {
    if (!this.continuityChecker || !vscode.workspace.workspaceFolders) {
      vscode.window.showWarningMessage('Please initialize Vibe Context Bridge first');
      return;
    }

    const projectPath = vscode.workspace.workspaceFolders[0].uri.fsPath;
    this.updateStatusBar('Checking Continuity...');

    try {
      const issues = await this.continuityChecker.checkContinuity(projectPath);
      this.displayContinuityIssues(issues);

      if (issues.length > 0) {
        vscode.window.showWarningMessage(
          `Found ${issues.length} continuity issues`,
          'View Issues'
        ).then(selection => {
          if (selection === 'View Issues') {
            vscode.commands.executeCommand('workbench.action.problems.focus');
          }
        });
      } else {
        vscode.window.showInformationMessage('Frontend/Backend continuity looks good! ✅');
      }

      this.updateStatusBar(`${issues.length} Continuity Issues`);

      // Record the check
      this.contextMemory?.recordInteraction(
        'continuity-check',
        `Checked ${projectPath}`,
        `Found ${issues.length} continuity issues`
      );

    } catch (error) {
      vscode.window.showErrorMessage(`Continuity check failed: ${error}`);
      this.updateStatusBar('Check Failed');
    }
  }

  private async generateAuth(): Promise<void> {
    if (!this.authTemplateManager || !vscode.workspace.workspaceFolders) {
      vscode.window.showWarningMessage('Please initialize Vibe Context Bridge first');
      return;
    }

    const projectPath = vscode.workspace.workspaceFolders[0].uri.fsPath;

    try {
      const templates = await this.authTemplateManager.generateAuthTemplates(projectPath);
      
      // Create auth directory if it doesn't exist
      const authDir = path.join(projectPath, 'auth');
      await vscode.workspace.fs.createDirectory(vscode.Uri.file(authDir));

      // Write template files
      for (const [filename, content] of Object.entries(templates)) {
        const filePath = path.join(projectPath, filename);
        const fileDir = path.dirname(filePath);
        
        // Ensure directory exists
        await vscode.workspace.fs.createDirectory(vscode.Uri.file(fileDir));
        
        // Write file
        await vscode.workspace.fs.writeFile(
          vscode.Uri.file(filePath),
          Buffer.from(content, 'utf8')
        );
      }

      vscode.window.showInformationMessage(
        `Generated ${Object.keys(templates).length} authentication templates`,
        'Open Auth Directory'
      ).then(selection => {
        if (selection === 'Open Auth Directory') {
          vscode.commands.executeCommand('revealFileInOS', vscode.Uri.file(authDir));
        }
      });

      // Record the generation
      this.contextMemory?.recordInteraction(
        'auth-template-generation',
        `Generated templates for ${this.context?.authentication?.type || 'jwt'}`,
        `Created ${Object.keys(templates).length} auth files`
      );

    } catch (error) {
      vscode.window.showErrorMessage(`Auth generation failed: ${error}`);
    }
  }

  private async showContextMemory(): Promise<void> {
    if (!this.contextMemory) {
      vscode.window.showWarningMessage('Please initialize Vibe Context Bridge first');
      return;
    }

    const insights = this.contextMemory.getLearningInsights();
    const summary = this.contextMemory.getContextSummary();

    // Create and show webview
    const panel = vscode.window.createWebviewPanel(
      'vibeContextMemory',
      'Vibe Context Memory',
      vscode.ViewColumn.One,
      { enableScripts: true }
    );

    panel.webview.html = this.getContextMemoryWebviewContent(insights, summary);
  }

  private async fixSecurityIssue(): Promise<void> {
    const editor = vscode.window.activeTextEditor;
    if (!editor || !this.securityValidator) {
      return;
    }

    const selection = editor.selection;
    const selectedText = editor.document.getText(selection);

    if (!selectedText) {
      vscode.window.showWarningMessage('Please select the code you want to fix');
      return;
    }

    // Scan the selected text for issues
    const issues = await this.securityValidator.scanFile(editor.document.fileName);
    const lineNumber = selection.start.line + 1;
    
    const relevantIssue = issues.find(issue => 
      issue.line && Math.abs(issue.line - lineNumber) <= 2
    );

    if (!relevantIssue) {
      vscode.window.showInformationMessage('No security issues found in selected code');
      return;
    }

    // Try to auto-fix
    const fixedIssues = await this.securityValidator.autoFixSecurityIssues(
      path.dirname(editor.document.fileName),
      [relevantIssue]
    );

    if (fixedIssues.length > 0) {
      vscode.window.showInformationMessage('Security issue fixed automatically');
    } else {
      vscode.window.showInformationMessage(
        `Manual fix needed: ${relevantIssue.suggestion}`,
        'Learn More'
      ).then(selection => {
        if (selection === 'Learn More') {
          vscode.env.openExternal(vscode.Uri.parse('https://github.com/your-repo/security-fixes'));
        }
      });
    }
  }

  private async updateContextFromCode(): Promise<void> {
    if (!this.continuityChecker || !vscode.workspace.workspaceFolders) {
      vscode.window.showWarningMessage('Please initialize Vibe Context Bridge first');
      return;
    }

    const projectPath = vscode.workspace.workspaceFolders[0].uri.fsPath;

    try {
      const updates = await this.continuityChecker.updateContextFromCode(projectPath);
      
      if (this.context) {
        // Merge updates into context
        this.context = { ...this.context, ...updates };
        
        // Save updated context
        await this.contextManager.saveContext(projectPath, this.context);
        
        vscode.window.showInformationMessage('Context updated from code analysis');

        // Record the update
        this.contextMemory?.recordInteraction(
          'context-update',
          'Updated context from code analysis',
          `Updated API endpoints, components, and models`
        );
      }
    } catch (error) {
      vscode.window.showErrorMessage(`Context update failed: ${error}`);
    }
  }

  private async scanFileForSecurity(filePath: string): Promise<void> {
    if (!this.securityValidator) return;

    try {
      const issues = await this.securityValidator.scanFile(filePath);
      this.displaySecurityIssuesForFile(filePath, issues);
    } catch (error) {
      console.error('Failed to scan file:', error);
    }
  }

  private displaySecurityIssues(issues: SecurityIssue[]): void {
    const diagnostics = new Map<string, vscode.Diagnostic[]>();

    for (const issue of issues) {
      const uri = vscode.Uri.file(issue.file);
      const line = Math.max(0, (issue.line || 1) - 1);
      
      const diagnostic = new vscode.Diagnostic(
        new vscode.Range(line, 0, line, Number.MAX_SAFE_INTEGER),
        `${issue.message} (${issue.suggestion})`,
        issue.severity === 'error' ? vscode.DiagnosticSeverity.Error : vscode.DiagnosticSeverity.Warning
      );

      diagnostic.source = 'Vibe Context Bridge';
      diagnostic.code = issue.rule;

      if (!diagnostics.has(issue.file)) {
        diagnostics.set(issue.file, []);
      }
      diagnostics.get(issue.file)!.push(diagnostic);
    }

    // Clear existing diagnostics
    this.diagnosticCollection.clear();

    // Set new diagnostics
    for (const [file, fileDiagnostics] of diagnostics) {
      this.diagnosticCollection.set(vscode.Uri.file(file), fileDiagnostics);
    }
  }

  private displaySecurityIssuesForFile(filePath: string, issues: SecurityIssue[]): void {
    const fileIssues = issues.filter(issue => issue.file === filePath);
    if (fileIssues.length === 0) return;

    const diagnostics: vscode.Diagnostic[] = [];

    for (const issue of fileIssues) {
      const line = Math.max(0, (issue.line || 1) - 1);
      
      const diagnostic = new vscode.Diagnostic(
        new vscode.Range(line, 0, line, Number.MAX_SAFE_INTEGER),
        `${issue.message} (${issue.suggestion})`,
        issue.severity === 'error' ? vscode.DiagnosticSeverity.Error : vscode.DiagnosticSeverity.Warning
      );

      diagnostic.source = 'Vibe Context Bridge';
      diagnostic.code = issue.rule;
      diagnostics.push(diagnostic);
    }

    this.diagnosticCollection.set(vscode.Uri.file(filePath), diagnostics);
  }

  private displayContinuityIssues(issues: ContinuityIssue[]): void {
    // For now, just show them as information messages
    // Could be enhanced to show in problems panel
    for (const issue of issues) {
      console.log(`Continuity Issue: ${issue.message}`);
    }
  }

  private async reloadContext(): Promise<void> {
    if (!vscode.workspace.workspaceFolders) return;

    try {
      this.context = this.contextManager.loadContext(vscode.workspace.workspaceFolders[0].uri.fsPath);
      await this.initializeFromContext();
      this.updateStatusBar('Context Reloaded');
    } catch (error) {
      console.error('Failed to reload context:', error);
    }
  }

  private shouldAutoScan(): boolean {
    return this.getConfigValue('autoScan', true);
  }

  private getConfigValue<T>(key: string, defaultValue: T): T {
    const config = vscode.workspace.getConfiguration('vibeContextBridge');
    return config.get<T>(key, defaultValue);
  }

  private updateStatusBar(text: string): void {
    this.statusBarItem.text = `$(shield) ${text}`;
  }

  private getContextMemoryWebviewContent(insights: any, summary: string): string {
    return `
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Vibe Context Memory</title>
    <style>
        body { font-family: Arial, sans-serif; padding: 20px; }
        .section { margin-bottom: 20px; }
        .metric { background: #f0f0f0; padding: 10px; margin: 5px 0; border-radius: 5px; }
        .suggestion { background: #e6f3ff; padding: 10px; margin: 5px 0; border-radius: 5px; }
        .summary { background: #f9f9f9; padding: 15px; border-radius: 5px; font-family: monospace; white-space: pre-wrap; }
    </style>
</head>
<body>
    <h1>🧠 Vibe Context Memory</h1>
    
    <div class="section">
        <h2>Project Summary</h2>
        <div class="summary">${summary}</div>
    </div>
    
    <div class="section">
        <h2>Learning Insights</h2>
        <div class="metric">Project Maturity: ${insights.projectMaturity}</div>
        <div class="metric">Total Interactions: ${insights.patterns.totalInteractions}</div>
        <div class="metric">Active Days: ${insights.patterns.patterns.find((p: any) => p.type === 'frequency')?.activeDays || 0}</div>
    </div>
    
    <div class="section">
        <h2>Common Actions</h2>
        ${insights.patterns.commonActions.map((action: any) => 
          `<div class="metric">${action.action}: ${action.count} times</div>`
        ).join('')}
    </div>
    
    <div class="section">
        <h2>Skill Areas</h2>
        ${insights.skillAreas.map((skill: string) => 
          `<div class="metric">${skill}</div>`
        ).join('')}
    </div>
    
    <div class="section">
        <h2>Suggestions</h2>
        ${insights.suggestions.map((suggestion: string) => 
          `<div class="suggestion">💡 ${suggestion}</div>`
        ).join('')}
    </div>
    
    <div class="section">
        <h2>Next Steps</h2>
        ${insights.nextSteps.map((step: string) => 
          `<div class="suggestion">🎯 ${step}</div>`
        ).join('')}
    </div>
</body>
</html>
    `;
  }

  public dispose(): void {
    this.diagnosticCollection.dispose();
    this.statusBarItem.dispose();
  }
}

let extension: VibeContextBridgeExtension;

export function activate(context: vscode.ExtensionContext) {
  extension = new VibeContextBridgeExtension(context);
  extension.activate();
}

export function deactivate() {
  if (extension) {
    extension.dispose();
  }
}
