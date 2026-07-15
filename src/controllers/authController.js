import { validationResult } from 'express-validator';
import logger from '../config/logger.js';
import authService from '../services/authService.js';
import passport from '../config/passport.js';

const register = async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { email, password, name } = req.body;
    const { user, token } = await authService.registerUser(email, password, name);

    res.status(201).json({
      message: 'User registered successfully',
      user,
      token
    });
  } catch (error) {
    if (error.message === 'Email already registered') {
      return res.status(400).json({ error: error.message });
    }
    logger.logError(error, null, { context: 'user-registration' });
    res.status(500).json({ error: 'Internal server error' });
  }
};

const login = async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { email, password } = req.body;
    const { user, token } = await authService.loginUser(email, password);

    res.json({
      message: 'Login successful',
      user,
      token
    });
  } catch (error) {
    if (error.message === 'Invalid credentials' || error.message.includes('registered with')) {
      return res.status(401).json({ error: error.message });
    }
    logger.logError(error, null, { context: 'user-login' });
    res.status(500).json({ error: 'Internal server error' });
  }
};

const getProfile = async (req, res) => {
  try {
    const user = await authService.getUserProfile(req.userId);
    res.json(user);
  } catch (error) {
    if (error.message === 'User not found') {
      return res.status(404).json({ error: error.message });
    }
    logger.logError(error, null, { context: 'get-user-profile' });
    res.status(500).json({ error: 'Internal server error' });
  }
};

const updateProfile = async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { name, email, password } = req.body;
    const user = await authService.updateUserProfile(req.userId, { name, email, password });

    res.json({
      message: 'Profile updated successfully',
      user
    });
  } catch (error) {
    if (error.message === 'Email already in use') {
      return res.status(400).json({ error: error.message });
    }
    logger.logError(error, null, { context: 'update-user-profile' });
    res.status(500).json({ error: 'Internal server error' });
  }
};

// Google OAuth Handlers
const googleAuth = (req, res, next) => {
  const state = req.query.redirectUrl ? Buffer.from(req.query.redirectUrl).toString('base64') : undefined;
  const dynamicCallbackUrl = `${req.protocol}://${req.get('host')}/api/v1/auth/google/callback`;

  passport.authenticate('google', {
    scope: ['profile', 'email'],
    state: state,
    callbackURL: dynamicCallbackUrl
  })(req, res, next);
};

const googleAuthCallbackMiddleware = (req, res, next) => {
  const dynamicCallbackUrl = `${req.protocol}://${req.get('host')}/api/v1/auth/google/callback`;
  
  passport.authenticate('google', {
    failureRedirect: '/api/v1/auth/google/failure',
    session: false,
    callbackURL: dynamicCallbackUrl
  })(req, res, next);
};

const googleCallback = async (req, res) => {
  try {
    const user = req.user;
    const token = authService.generateToken(user.id);

    let frontendUrl = process.env.FRONTEND_URL || 'http://localhost:5173';
    let redirectPath = '/auth/callback';

    if (req.query.state) {
      try {
        const decodedState = Buffer.from(req.query.state, 'base64').toString('ascii');
        console.log('Google Auth - Decoded state (redirect URL):', decodedState);
        
        if (decodedState && (decodedState.startsWith('exp://') || decodedState.startsWith('http') || decodedState.includes('://'))) {
          const separator = decodedState.includes('?') ? '&' : '?';
          const redirectUrl = `${decodedState}${separator}token=${token}`;
          console.log('Google Auth - Redirecting to Expo App:', redirectUrl);
          return res.redirect(redirectUrl);
        } else {
          console.log('Google Auth - Invalid state URL format, falling back to web URL');
        }
      } catch (err) {
        console.error('Google Auth - Error decoding state:', err);
      }
    } else {
      console.log('Google Auth - No state parameter received, falling back to web URL');
    }

    const redirectUrl = `${frontendUrl}${redirectPath}?token=${token}`;
    res.redirect(redirectUrl);
  } catch (error) {
    logger.logError(error, null, { context: 'google-oauth-callback' });
    const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:5173';
    res.redirect(`${frontendUrl}/auth/error?message=Authentication failed`);
  }
};

const googleFailure = (req, res) => {
  const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:5173';
  res.redirect(`${frontendUrl}/auth/error?message=Google authentication failed`);
};

export { 
  register, 
  login, 
  getProfile, 
  updateProfile, 
  googleAuth, 
  googleAuthCallbackMiddleware, 
  googleCallback, 
  googleFailure 
};
