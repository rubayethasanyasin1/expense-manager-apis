import { validationResult } from 'express-validator';
import passport from 'passport';
import authService from '../services/authService.js';
import catchAsync from '../utils/catchAsync.js';
import AppError from '../utils/AppError.js';

export const register = catchAsync(async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    throw new AppError('Validation Error', 400); // Or handle it explicitly if you want validation arrays
  }

  // To keep validation array in the response, we can just do:
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
});

export const login = catchAsync(async (req, res) => {
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
});

export const getProfile = catchAsync(async (req, res) => {
  const user = await authService.getUserProfile(req.userId);
  res.json({ user });
});

export const updateProfile = catchAsync(async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ errors: errors.array() });
  }

  const user = await authService.updateUserProfile(req.userId, req.body);
  res.json({
    message: 'Profile updated successfully',
    user
  });
});

export const googleAuth = (req, res, next) => {
  // Pass state parameter if provided
  const state = req.query.returnTo 
    ? Buffer.from(JSON.stringify({ returnTo: req.query.returnTo })).toString('base64') 
    : undefined;

  const dynamicCallbackUrl = `${req.protocol}://${req.get('host')}/api/v1/auth/google/callback`;

  passport.authenticate('google', {
    scope: ['profile', 'email'],
    session: false,
    state,
    callbackURL: dynamicCallbackUrl
  })(req, res, next);
};

export const googleFailure = (req, res) => {
  const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:5173';
  res.redirect(`${frontendUrl}/auth/error?message=Authentication failed`);
};

export const googleAuthCallbackMiddleware = (req, res, next) => {
  const dynamicCallbackUrl = `${req.protocol}://${req.get('host')}/api/v1/auth/google/callback`;
  
  passport.authenticate('google', {
    session: false,
    callbackURL: dynamicCallbackUrl
  }, (err, user) => {
    const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:5173';
    
    if (err || !user) {
      // Redirect to frontend error page on failure or internal error
      return res.redirect(`${frontendUrl}/auth/error?message=Authentication failed`);
    }

    req.user = user;
    next();
  })(req, res, next);
};

export const googleCallback = catchAsync(async (req, res) => {
  const user = req.user;
  const token = authService.generateToken(user.id);

  const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:5173';
  
  const state = req.query.state;
  let redirectPath = '/dashboard';
  
  if (state) {
    try {
      const decodedState = Buffer.from(state, 'base64').toString('utf-8');
      const stateObj = JSON.parse(decodedState);
      if (stateObj.returnTo) {
        redirectPath = stateObj.returnTo;
      }
    } catch (e) {
      console.log('Error decoding state parameter:', e.message);
    }
  }

  const redirectUrl = `${frontendUrl}${redirectPath}?token=${token}`;
  res.redirect(redirectUrl);
});
