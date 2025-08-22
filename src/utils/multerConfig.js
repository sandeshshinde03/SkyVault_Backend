import multer from 'multer';

// Using memory storage because we’ll upload directly to Supabase
const storage = multer.memoryStorage();

export const upload = multer({ storage });
