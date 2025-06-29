import * as fs from 'fs';
import * as path from 'path';
import { AuthenticationConfiguration, ProjectContext } from './types';

export class AuthTemplateManager {
  private context: ProjectContext;

  constructor(context: ProjectContext) {
    this.context = context;
  }

  /**
   * Generate authentication templates based on context configuration
   */
  public generateAuthTemplates(projectPath: string): Promise<{ [filename: string]: string }> {
    const authType = this.context.authentication?.type || 'jwt';
    
    switch (authType) {
      case 'jwt':
        return this.generateJwtTemplates(projectPath);
      case 'session':
        return this.generateSessionTemplates(projectPath);
      case 'oauth2':
        return this.generateOAuth2Templates(projectPath);
      default:
        return this.generateBasicAuthTemplates(projectPath);
    }
  }

  /**
   * Generate secure authentication middleware
   */
  public async generateAuthMiddleware(framework: string): Promise<string> {
    switch (framework.toLowerCase()) {
      case 'express':
        return await this.generateExpressAuthMiddleware();
      case 'fastify':
        return this.generateFastifyAuthMiddleware();
      case 'next.js':
        return this.generateNextAuthMiddleware();
      default:
        return this.generateGenericAuthMiddleware();
    }
  }

  /**
   * Generate secure password handling utilities
   */
  public generatePasswordUtilities(): string {
    return `
// Secure password utilities - Generated by Vibe Context Bridge
import bcrypt from 'bcryptjs';
import crypto from 'crypto';

export class PasswordManager {
  private static readonly SALT_ROUNDS = 12;
  private static readonly MIN_PASSWORD_LENGTH = 8;

  /**
   * Hash a password securely
   */
  public static async hashPassword(password: string): Promise<string> {
    if (!this.validatePasswordStrength(password)) {
      throw new Error('Password does not meet security requirements');
    }
    
    return await bcrypt.hash(password, this.SALT_ROUNDS);
  }

  /**
   * Verify a password against its hash
   */
  public static async verifyPassword(password: string, hash: string): Promise<boolean> {
    return await bcrypt.compare(password, hash);
  }

  /**
   * Validate password strength
   */
  public static validatePasswordStrength(password: string): boolean {
    if (password.length < this.MIN_PASSWORD_LENGTH) {
      return false;
    }

    // Check for at least one uppercase, lowercase, number, and special character
    const hasUppercase = /[A-Z]/.test(password);
    const hasLowercase = /[a-z]/.test(password);
    const hasNumber = /\\d/.test(password);
    const hasSpecialChar = /[!@#$%^&*(),.?":{}|<>]/.test(password);

    return hasUppercase && hasLowercase && hasNumber && hasSpecialChar;
  }

  /**
   * Generate a secure random token
   */
  public static generateSecureToken(length: number = 32): string {
    return crypto.randomBytes(length).toString('hex');
  }

  /**
   * Generate password reset token with expiry
   */
  public static generatePasswordResetToken(): { token: string; expires: Date } {
    const token = this.generateSecureToken();
    const expires = new Date();
    expires.setHours(expires.getHours() + 1); // 1 hour expiry

    return { token, expires };
  }
}

// Password validation rules for frontend
export const passwordRules = {
  minLength: ${this.context.authentication?.config?.expiry || 8},
  requireUppercase: true,
  requireLowercase: true,
  requireNumbers: true,
  requireSpecialChars: true,
  forbiddenPasswords: [
    'password', '123456', 'qwerty', 'admin', 'letmein', 
    'welcome', 'monkey', '1234567890', 'password123'
  ]
};
`;
  }

  private async generateJwtTemplates(projectPath: string): Promise<{ [filename: string]: string }> {
    const templates: { [filename: string]: string } = {};

    // JWT Auth Service
    templates['auth/jwtAuth.js'] = `
// JWT Authentication Service - Generated by Vibe Context Bridge
import jwt from 'jsonwebtoken';
import { PasswordManager } from './passwordManager.js';

export class JWTAuthService {
  private static readonly SECRET = process.env.JWT_SECRET || '${this.generateSecureSecret()}';
  private static readonly REFRESH_SECRET = process.env.JWT_REFRESH_SECRET || '${this.generateSecureSecret()}';
  private static readonly ACCESS_TOKEN_EXPIRY = '${this.context.authentication?.config?.expiry || '15m'}';
  private static readonly REFRESH_TOKEN_EXPIRY = '7d';

  /**
   * Generate access and refresh tokens
   */
  public static generateTokens(payload: any): { accessToken: string; refreshToken: string } {
    const accessToken = jwt.sign(payload, this.SECRET, { 
      expiresIn: this.ACCESS_TOKEN_EXPIRY 
    });
    
    const refreshToken = jwt.sign(payload, this.REFRESH_SECRET, { 
      expiresIn: this.REFRESH_TOKEN_EXPIRY 
    });

    return { accessToken, refreshToken };
  }

  /**
   * Verify access token
   */
  public static verifyAccessToken(token: string): any {
    try {
      return jwt.verify(token, this.SECRET);
    } catch (error) {
      throw new Error('Invalid access token');
    }
  }

  /**
   * Verify refresh token
   */
  public static verifyRefreshToken(token: string): any {
    try {
      return jwt.verify(token, this.REFRESH_SECRET);
    } catch (error) {
      throw new Error('Invalid refresh token');
    }
  }

  /**
   * Authenticate user with credentials
   */
  public static async authenticateUser(email: string, password: string, getUserByEmail: Function): Promise<any> {
    const user = await getUserByEmail(email);
    if (!user) {
      throw new Error('Invalid credentials');
    }

    const isValidPassword = await PasswordManager.verifyPassword(password, user.password);
    if (!isValidPassword) {
      throw new Error('Invalid credentials');
    }

    const payload = { 
      id: user.id, 
      email: user.email, 
      role: user.role 
    };

    return this.generateTokens(payload);
  }
}
`;

    // JWT Middleware
    templates['middleware/authMiddleware.js'] = `
// JWT Authentication Middleware - Generated by Vibe Context Bridge
import { JWTAuthService } from '../auth/jwtAuth.js';

export const authenticateToken = (req, res, next) => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1]; // Bearer TOKEN

  if (!token) {
    return res.status(401).json({ error: 'Access token required' });
  }

  try {
    const decoded = JWTAuthService.verifyAccessToken(token);
    req.user = decoded;
    next();
  } catch (error) {
    return res.status(403).json({ error: 'Invalid or expired token' });
  }
};

export const requireRole = (roles) => {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({ error: 'Authentication required' });
    }

    if (!roles.includes(req.user.role)) {
      return res.status(403).json({ error: 'Insufficient permissions' });
    }

    next();
  };
};

export const refreshTokenMiddleware = async (req, res, next) => {
  const { refreshToken } = req.body;

  if (!refreshToken) {
    return res.status(401).json({ error: 'Refresh token required' });
  }

  try {
    const decoded = JWTAuthService.verifyRefreshToken(refreshToken);
    const newTokens = JWTAuthService.generateTokens({
      id: decoded.id,
      email: decoded.email,
      role: decoded.role
    });

    res.json(newTokens);
  } catch (error) {
    res.status(403).json({ error: 'Invalid refresh token' });
  }
};
`;

    // Auth Routes
    templates['routes/auth.js'] = this.generateAuthRoutes('jwt');

    // Frontend Auth Hook (React)
    templates['hooks/useAuth.js'] = this.generateReactAuthHook();

    return templates;
  }

  private async generateSessionTemplates(projectPath: string): Promise<{ [filename: string]: string }> {
    const templates: { [filename: string]: string } = {};

    templates['auth/sessionAuth.js'] = `
// Session Authentication Service - Generated by Vibe Context Bridge
import session from 'express-session';
import MongoStore from 'connect-mongo';
import { PasswordManager } from './passwordManager.js';

export const sessionConfig = {
  secret: process.env.SESSION_SECRET || '${this.generateSecureSecret()}',
  resave: false,
  saveUninitialized: false,
  store: MongoStore.create({
    mongoUrl: process.env.MONGODB_URI || 'mongodb://localhost:27017/your-app'
  }),
  cookie: {
    secure: process.env.NODE_ENV === 'production',
    httpOnly: true,
    maxAge: 24 * 60 * 60 * 1000 // 24 hours
  }
};

export class SessionAuthService {
  public static async authenticateUser(email: string, password: string, getUserByEmail: Function): Promise<any> {
    const user = await getUserByEmail(email);
    if (!user) {
      throw new Error('Invalid credentials');
    }

    const isValidPassword = await PasswordManager.verifyPassword(password, user.password);
    if (!isValidPassword) {
      throw new Error('Invalid credentials');
    }

    return { id: user.id, email: user.email, role: user.role };
  }
}
`;

    templates['middleware/sessionMiddleware.js'] = `
// Session Authentication Middleware - Generated by Vibe Context Bridge

export const requireAuth = (req, res, next) => {
  if (!req.session.user) {
    return res.status(401).json({ error: 'Authentication required' });
  }
  next();
};

export const requireRole = (roles) => {
  return (req, res, next) => {
    if (!req.session.user) {
      return res.status(401).json({ error: 'Authentication required' });
    }

    if (!roles.includes(req.session.user.role)) {
      return res.status(403).json({ error: 'Insufficient permissions' });
    }

    next();
  };
};
`;

    templates['routes/auth.js'] = this.generateAuthRoutes('session');

    return templates;
  }

  private async generateOAuth2Templates(projectPath: string): Promise<{ [filename: string]: string }> {
    const templates: { [filename: string]: string } = {};

    templates['auth/oauth2Auth.js'] = `
// OAuth2 Authentication Service - Generated by Vibe Context Bridge
import passport from 'passport';
import { Strategy as GoogleStrategy } from 'passport-google-oauth20';
import { Strategy as GitHubStrategy } from 'passport-github2';

export class OAuth2AuthService {
  public static configurePassport() {
    // Google OAuth2 Strategy
    if (process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET) {
      passport.use(new GoogleStrategy({
        clientID: process.env.GOOGLE_CLIENT_ID,
        clientSecret: process.env.GOOGLE_CLIENT_SECRET,
        callbackURL: "/auth/google/callback"
      }, async (accessToken, refreshToken, profile, done) => {
        try {
          // Find or create user logic here
          const user = await this.findOrCreateUser('google', profile);
          return done(null, user);
        } catch (error) {
          return done(error, null);
        }
      }));
    }

    // GitHub OAuth2 Strategy
    if (process.env.GITHUB_CLIENT_ID && process.env.GITHUB_CLIENT_SECRET) {
      passport.use(new GitHubStrategy({
        clientID: process.env.GITHUB_CLIENT_ID,
        clientSecret: process.env.GITHUB_CLIENT_SECRET,
        callbackURL: "/auth/github/callback"
      }, async (accessToken, refreshToken, profile, done) => {
        try {
          const user = await this.findOrCreateUser('github', profile);
          return done(null, user);
        } catch (error) {
          return done(error, null);
        }
      }));
    }

    passport.serializeUser((user, done) => {
      done(null, user.id);
    });

    passport.deserializeUser(async (id, done) => {
      try {
        // Get user by ID logic here
        const user = await this.getUserById(id);
        done(null, user);
      } catch (error) {
        done(error, null);
      }
    });
  }

  private static async findOrCreateUser(provider: string, profile: any): Promise<any> {
    // Implementation would find or create user based on OAuth profile
    return {
      id: profile.id,
      email: profile.emails[0].value,
      name: profile.displayName,
      provider
    };
  }

  private static async getUserById(id: string): Promise<any> {
    // Implementation would get user from database
    return null;
  }
}
`;

    return templates;
  }

  private async generateBasicAuthTemplates(projectPath: string): Promise<{ [filename: string]: string }> {
    const templates: { [filename: string]: string } = {};

    templates['auth/basicAuth.js'] = `
// Basic Authentication Service - Generated by Vibe Context Bridge
import { PasswordManager } from './passwordManager.js';

export class BasicAuthService {
  public static async authenticateUser(email: string, password: string, getUserByEmail: Function): Promise<any> {
    const user = await getUserByEmail(email);
    if (!user) {
      throw new Error('Invalid credentials');
    }

    const isValidPassword = await PasswordManager.verifyPassword(password, user.password);
    if (!isValidPassword) {
      throw new Error('Invalid credentials');
    }

    return { id: user.id, email: user.email, role: user.role };
  }
}
`;

    return templates;
  }

  private generateAuthRoutes(authType: string): string {
    const routes = this.context.authentication?.routes || {};
    
    return `
// Authentication Routes - Generated by Vibe Context Bridge
import express from 'express';
import { ${authType === 'jwt' ? 'JWTAuthService' : authType === 'session' ? 'SessionAuthService' : 'BasicAuthService'} } from '../auth/${authType}Auth.js';
import { PasswordManager } from '../auth/passwordManager.js';

const router = express.Router();

// Login route
router.post('${routes.login || '/auth/login'}', async (req, res) => {
  try {
    const { email, password } = req.body;

    // Input validation
    if (!email || !password) {
      return res.status(400).json({ error: 'Email and password are required' });
    }

    // Rate limiting check (implement according to your rate limiter)
    // await rateLimiter.check(req.ip);

    ${authType === 'jwt' 
      ? `const tokens = await JWTAuthService.authenticateUser(email, password, getUserByEmail);
         res.json({ success: true, ...tokens });`
      : `const user = await ${authType === 'session' ? 'SessionAuthService' : 'BasicAuthService'}.authenticateUser(email, password, getUserByEmail);
         req.session.user = user;
         res.json({ success: true, user });`
    }
  } catch (error) {
    res.status(401).json({ error: error.message });
  }
});

// Register route
router.post('${routes.register || '/auth/register'}', async (req, res) => {
  try {
    const { email, password, name } = req.body;

    // Input validation
    if (!email || !password || !name) {
      return res.status(400).json({ error: 'Email, password, and name are required' });
    }

    // Password strength validation
    if (!PasswordManager.validatePasswordStrength(password)) {
      return res.status(400).json({ 
        error: 'Password must be at least 8 characters with uppercase, lowercase, number, and special character' 
      });
    }

    // Check if user already exists
    const existingUser = await getUserByEmail(email);
    if (existingUser) {
      return res.status(409).json({ error: 'User already exists' });
    }

    // Hash password and create user
    const hashedPassword = await PasswordManager.hashPassword(password);
    const newUser = await createUser({ email, password: hashedPassword, name });

    ${authType === 'jwt' 
      ? `const tokens = JWTAuthService.generateTokens({ id: newUser.id, email: newUser.email, role: newUser.role });
         res.status(201).json({ success: true, ...tokens });`
      : `req.session.user = { id: newUser.id, email: newUser.email, role: newUser.role };
         res.status(201).json({ success: true, user: req.session.user });`
    }
  } catch (error) {
    res.status(500).json({ error: 'Registration failed' });
  }
});

// Logout route
router.post('${routes.logout || '/auth/logout'}', (req, res) => {
  ${authType === 'session' 
    ? `req.session.destroy((err) => {
         if (err) {
           return res.status(500).json({ error: 'Logout failed' });
         }
         res.json({ success: true });
       });`
    : `// For JWT, logout is handled client-side by removing tokens
       res.json({ success: true });`
  }
});

${authType === 'jwt' ? `
// Refresh token route
router.post('${routes.refresh || '/auth/refresh'}', refreshTokenMiddleware);
` : ''}

// Profile route
router.get('${routes.profile || '/auth/profile'}', authenticateToken, async (req, res) => {
  try {
    const user = await getUserById(req.user.id);
    res.json({ user: { id: user.id, email: user.email, name: user.name, role: user.role } });
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch profile' });
  }
});

export default router;

// Helper functions (implement these according to your database)
async function getUserByEmail(email) {
  // Implement database query
  return null;
}

async function getUserById(id) {
  // Implement database query
  return null;
}

async function createUser(userData) {
  // Implement user creation
  return null;
}
`;
  }

  private generateReactAuthHook(): string {
    return `
// React Authentication Hook - Generated by Vibe Context Bridge
import { useState, useEffect, createContext, useContext } from 'react';

const AuthContext = createContext();

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Check for existing authentication
    checkAuth();
  }, []);

  const checkAuth = async () => {
    try {
      const token = localStorage.getItem('accessToken');
      if (token) {
        const response = await fetch('/auth/profile', {
          headers: { Authorization: \`Bearer \${token}\` }
        });
        
        if (response.ok) {
          const data = await response.json();
          setUser(data.user);
        } else {
          localStorage.removeItem('accessToken');
          localStorage.removeItem('refreshToken');
        }
      }
    } catch (error) {
      console.error('Auth check failed:', error);
    } finally {
      setLoading(false);
    }
  };

  const login = async (email, password) => {
    try {
      const response = await fetch('/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password })
      });

      const data = await response.json();
      
      if (response.ok) {
        localStorage.setItem('accessToken', data.accessToken);
        localStorage.setItem('refreshToken', data.refreshToken);
        await checkAuth();
        return { success: true };
      } else {
        return { success: false, error: data.error };
      }
    } catch (error) {
      return { success: false, error: 'Login failed' };
    }
  };

  const register = async (email, password, name) => {
    try {
      const response = await fetch('/auth/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password, name })
      });

      const data = await response.json();
      
      if (response.ok) {
        localStorage.setItem('accessToken', data.accessToken);
        localStorage.setItem('refreshToken', data.refreshToken);
        await checkAuth();
        return { success: true };
      } else {
        return { success: false, error: data.error };
      }
    } catch (error) {
      return { success: false, error: 'Registration failed' };
    }
  };

  const logout = async () => {
    try {
      await fetch('/auth/logout', { method: 'POST' });
    } catch (error) {
      console.error('Logout request failed:', error);
    } finally {
      localStorage.removeItem('accessToken');
      localStorage.removeItem('refreshToken');
      setUser(null);
    }
  };

  const value = {
    user,
    loading,
    login,
    register,
    logout
  };

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
};
`;
  }

  private async generateExpressAuthMiddleware(): Promise<string> {
    const templates = await this.generateJwtTemplates('');
    return templates['middleware/authMiddleware.js'] || '';
  }

  private generateFastifyAuthMiddleware(): string {
    return `
// Fastify Authentication Middleware - Generated by Vibe Context Bridge
import { JWTAuthService } from '../auth/jwtAuth.js';

export const authenticateToken = async (request, reply) => {
  const authHeader = request.headers.authorization;
  const token = authHeader && authHeader.split(' ')[1];

  if (!token) {
    reply.code(401).send({ error: 'Access token required' });
    return;
  }

  try {
    const decoded = JWTAuthService.verifyAccessToken(token);
    request.user = decoded;
  } catch (error) {
    reply.code(403).send({ error: 'Invalid or expired token' });
  }
};

export const requireRole = (roles) => {
  return async (request, reply) => {
    if (!request.user) {
      reply.code(401).send({ error: 'Authentication required' });
      return;
    }

    if (!roles.includes(request.user.role)) {
      reply.code(403).send({ error: 'Insufficient permissions' });
    }
  };
};
`;
  }

  private generateNextAuthMiddleware(): string {
    return `
// Next.js Authentication Middleware - Generated by Vibe Context Bridge
import { NextRequest, NextResponse } from 'next/server';
import { JWTAuthService } from '../auth/jwtAuth';

export function middleware(request: NextRequest) {
  const token = request.cookies.get('accessToken')?.value;

  if (!token) {
    return NextResponse.redirect(new URL('/login', request.url));
  }

  try {
    JWTAuthService.verifyAccessToken(token);
    return NextResponse.next();
  } catch (error) {
    return NextResponse.redirect(new URL('/login', request.url));
  }
}

export const config = {
  matcher: ['/dashboard/:path*', '/profile/:path*', '/admin/:path*']
};
`;
  }

  private generateGenericAuthMiddleware(): string {
    return `
// Generic Authentication Middleware - Generated by Vibe Context Bridge
// Adapt this to your specific framework

export const createAuthMiddleware = (verifyTokenFunction) => {
  return (req, res, next) => {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1];

    if (!token) {
      return res.status(401).json({ error: 'Access token required' });
    }

    try {
      const decoded = verifyTokenFunction(token);
      req.user = decoded;
      next();
    } catch (error) {
      return res.status(403).json({ error: 'Invalid or expired token' });
    }
  };
};
`;
  }

  private generateSecureSecret(): string {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789!@#$%^&*';
    let result = '';
    for (let i = 0; i < 64; i++) {
      result += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return result;
  }
}
