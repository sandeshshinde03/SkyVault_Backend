import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
dotenv.config();

import authRoutes from './routes/authRoutes.js';
import fileRoutes from './routes/fileRoutes.js'; 
import shareRoutes from './routes/shares.js';


const app = express();

app.use(cors());
app.use(express.json());

// Routes
app.use('/api/auth', authRoutes);
app.use('/api/files', fileRoutes); 
app.use('/api/shares', shareRoutes);


app.get('/', (req, res) => {
  res.json({ message: 'SkyVault Backend Running 🚀' });
});

export default app;
