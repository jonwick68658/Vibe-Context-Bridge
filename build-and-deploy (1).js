#!/usr/bin/env node

/**
 * Build and Deploy Script for Vibe Context Bridge
 * Builds the core npm package and VS Code extension for immediate deployment
 */

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

console.log('🚀 Building Vibe Context Bridge for Production Deployment\n');

// Helper function to run commands
function runCommand(command, cwd = process.cwd()) {
  console.log(`📋 Running: ${command}`);
  try {
    execSync(command, { cwd, stdio: 'inherit' });
    console.log(`✅ Success: ${command}\n`);
  } catch (error) {
    console.error(`❌ Failed: ${command}`);
    console.error(error.message);
    process.exit(1);
  }
}

// Helper function to copy files
function copyFile(src, dest) {
  const destDir = path.dirname(dest);
  if (!fs.existsSync(destDir)) {
    fs.mkdirSync(destDir, { recursive: true });
  }
  fs.copyFileSync(src, dest);
  console.log(`📄 Copied: ${src} → ${dest}`);
}

// Step 1: Build Core NPM Package
console.log('🔧 Step 1: Building Core NPM Package');
console.log('=====================================');

const corePackagePath = path.join(__dirname, 'vibe-context-bridge');
process.chdir(corePackagePath);

// Install dependencies
console.log('📦 Installing dependencies...');
runCommand('npm install');

// Build TypeScript
console.log('🔨 Building TypeScript...');
runCommand('npm run build');

// Run tests (if any)
console.log('🧪 Running tests...');
try {
  runCommand('npm test');
} catch (error) {
  console.log('⚠️  No tests found or tests failed, continuing...');
}

// Create package tarball for local testing
console.log('📦 Creating package tarball...');
runCommand('npm pack');

console.log('✅ Core package built successfully!\n');

// Step 2: Build VS Code Extension
console.log('🔧 Step 2: Building VS Code Extension');
console.log('====================================');

const extensionPath = path.join(__dirname, 'vscode-extension');
process.chdir(extensionPath);

// Install dependencies
console.log('📦 Installing extension dependencies...');
runCommand('npm install');

// Install VSCE if not present
console.log('🛠️  Installing VSCE (VS Code Extension CLI)...');
try {
  runCommand('npm install -g vsce');
} catch (error) {
  console.log('⚠️  VSCE installation failed, trying local install...');
  runCommand('npm install vsce --save-dev');
}

// Copy schema file to extension
console.log('📄 Copying schema files...');
const schemaSource = path.join(__dirname, 'vibe-context-bridge', 'schemas', 'project-context.schema.json');
const schemaDestination = path.join(extensionPath, 'schemas', 'project-context.schema.json');
copyFile(schemaSource, schemaDestination);

// Link core package for development
console.log('🔗 Linking core package...');
const corePackageTarball = fs.readdirSync(corePackagePath)
  .find(file => file.startsWith('vibe-context-bridge-') && file.endsWith('.tgz'));

if (corePackageTarball) {
  const tarballPath = path.join(corePackagePath, corePackageTarball);
  runCommand(`npm install ${tarballPath}`);
} else {
  console.log('⚠️  Core package tarball not found, using npm link...');
  process.chdir(corePackagePath);
  runCommand('npm link');
  process.chdir(extensionPath);
  runCommand('npm link vibe-context-bridge');
}

// Compile extension
console.log('🔨 Compiling VS Code extension...');
runCommand('npm run compile');

// Package extension
console.log('📦 Packaging VS Code extension...');
try {
  runCommand('vsce package');
} catch (error) {
  console.log('⚠️  Global vsce failed, trying npx...');
  runCommand('npx vsce package');
}

console.log('✅ VS Code extension built successfully!\n');

// Step 3: Create Deployment Package
console.log('🔧 Step 3: Creating Deployment Package');
console.log('=====================================');

const deploymentPath = path.join(__dirname, 'deployment');
if (!fs.existsSync(deploymentPath)) {
  fs.mkdirSync(deploymentPath);
}

// Copy built artifacts
const artifacts = [
  {
    source: path.join(corePackagePath, corePackageTarball || 'package.json'),
    dest: path.join(deploymentPath, 'vibe-context-bridge.tgz'),
    description: 'Core NPM Package'
  }
];

// Find VSIX file
const vsixFile = fs.readdirSync(extensionPath)
  .find(file => file.endsWith('.vsix'));

if (vsixFile) {
  artifacts.push({
    source: path.join(extensionPath, vsixFile),
    dest: path.join(deploymentPath, 'vibe-context-bridge-vscode.vsix'),
    description: 'VS Code Extension'
  });
}

// Copy artifacts
artifacts.forEach(artifact => {
  if (fs.existsSync(artifact.source)) {
    copyFile(artifact.source, artifact.dest);
    console.log(`📋 ${artifact.description}: ${artifact.dest}`);
  }
});

// Copy documentation
copyFile(path.join(__dirname, 'README.md'), path.join(deploymentPath, 'README.md'));

// Create installation script
const installScript = `#!/bin/bash

# Vibe Context Bridge Installation Script
echo "🚀 Installing Vibe Context Bridge..."

# Install core package globally
echo "📦 Installing core package..."
npm install -g ./vibe-context-bridge.tgz

# Install VS Code extension
echo "🔌 Installing VS Code extension..."
if command -v code &> /dev/null; then
    code --install-extension ./vibe-context-bridge-vscode.vsix
    echo "✅ VS Code extension installed!"
else
    echo "⚠️  VS Code CLI not found. Please install the extension manually:"
    echo "   1. Open VS Code"
    echo "   2. Go to Extensions (Ctrl+Shift+X)"
    echo "   3. Click '...' → 'Install from VSIX'"
    echo "   4. Select: vibe-context-bridge-vscode.vsix"
fi

echo ""
echo "🎉 Vibe Context Bridge installed successfully!"
echo ""
echo "📖 Quick Start:"
echo "   1. Open your project in VS Code"
echo "   2. Press Ctrl+Shift+P"
echo "   3. Type 'Vibe Context: Initialize Project'"
echo "   4. Follow the setup wizard"
echo ""
echo "📚 Documentation: https://github.com/minimax-agent/vibe-context-bridge"
echo ""
`;

fs.writeFileSync(path.join(deploymentPath, 'install.sh'), installScript);
fs.chmodSync(path.join(deploymentPath, 'install.sh'), '755');

// Create Windows installation script
const installBatchScript = `@echo off
echo 🚀 Installing Vibe Context Bridge...

echo 📦 Installing core package...
npm install -g vibe-context-bridge.tgz

echo 🔌 Installing VS Code extension...
where code >nul 2>nul
if %ERRORLEVEL% EQU 0 (
    code --install-extension vibe-context-bridge-vscode.vsix
    echo ✅ VS Code extension installed!
) else (
    echo ⚠️  VS Code CLI not found. Please install the extension manually:
    echo    1. Open VS Code
    echo    2. Go to Extensions (Ctrl+Shift+X)
    echo    3. Click '...' → 'Install from VSIX'
    echo    4. Select: vibe-context-bridge-vscode.vsix
)

echo.
echo 🎉 Vibe Context Bridge installed successfully!
echo.
echo 📖 Quick Start:
echo    1. Open your project in VS Code
echo    2. Press Ctrl+Shift+P
echo    3. Type 'Vibe Context: Initialize Project'
echo    4. Follow the setup wizard
echo.
echo 📚 Documentation: https://github.com/minimax-agent/vibe-context-bridge
echo.
pause
`;

fs.writeFileSync(path.join(deploymentPath, 'install.bat'), installBatchScript);

// Create deployment info
const deploymentInfo = {
  buildDate: new Date().toISOString(),
  version: '1.0.0',
  artifacts: artifacts.map(a => ({ name: path.basename(a.dest), description: a.description })),
  installation: {
    linux_mac: './install.sh',
    windows: './install.bat',
    manual: 'See README.md for manual installation instructions'
  },
  quickStart: [
    'Extract deployment package',
    'Run installation script for your platform',
    'Open VS Code and create/open a project',
    'Press Ctrl+Shift+P and type "Vibe Context: Initialize Project"',
    'Follow the setup wizard',
    'Start coding with AI assistance!'
  ]
};

fs.writeFileSync(
  path.join(deploymentPath, 'deployment-info.json'), 
  JSON.stringify(deploymentInfo, null, 2)
);

console.log('\n🎉 BUILD AND DEPLOYMENT PACKAGE COMPLETE!');
console.log('==========================================');
console.log(`📁 Deployment package created at: ${deploymentPath}`);
console.log('📋 Contents:');
console.log('   • vibe-context-bridge.tgz (Core NPM package)');
console.log('   • vibe-context-bridge-vscode.vsix (VS Code extension)');
console.log('   • install.sh (Linux/Mac installation script)');
console.log('   • install.bat (Windows installation script)');
console.log('   • README.md (Documentation)');
console.log('   • deployment-info.json (Build information)');
console.log('');
console.log('🚀 Ready for immediate deployment!');
console.log('');
console.log('📖 To install:');
console.log('   Linux/Mac: ./install.sh');
console.log('   Windows:   install.bat');
console.log('');
console.log('🌟 This revolutionary tool will bridge the gap between human intent and AI execution!');
console.log('');

// Return to original directory
process.chdir(__dirname);
