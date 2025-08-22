import express from 'express';
import { createShare, getSharesForFile } from '../controllers/sharesController.js';
import { authMiddleware } from "../middlewares/authMiddleware.js";

const router = express.Router();

router.post('/', authMiddleware, createShare);
router.get('/:fileId', authMiddleware, getSharesForFile);

export default router;
