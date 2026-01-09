import express from 'express';
import { aiPrompts } from '../config.js';
import { successResponse } from '../utils/response.js';

const router = express.Router();

// GET /api/ai/prompts
router.get('/prompts', (req, res, next) => {
  try {
    successResponse(res, aiPrompts);
  } catch (error) {
    next(error);
  }
});

export default router;
