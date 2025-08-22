import express from "express";
import multer from "multer";
import {
  uploadFile,
  getUserFiles,
  createFolder,
  renameItem,
  softDeleteFile,
  restoreFile,
  deleteFile,
  moveFile,
  searchFiles,
  deleteFolder,
} from "../controllers/fileController.js";
import { supabase } from "../config/supabaseClient.js";
import { authMiddleware } from "../middlewares/authMiddleware.js";

const router = express.Router();
const storage = multer.memoryStorage();
const upload = multer({ storage });

// File routes
router.post("/upload", authMiddleware, upload.single("file"), uploadFile);
router.get("/", authMiddleware, getUserFiles);
router.post("/folder", authMiddleware, createFolder);
router.put("/rename", authMiddleware, renameItem);
router.delete("/trash/:id", authMiddleware, softDeleteFile);
router.put("/restore/:id", authMiddleware, restoreFile);
router.delete("/:id", authMiddleware, deleteFile);
router.put("/move", authMiddleware, moveFile);

// Folder delete
router.delete("/folders/:id", authMiddleware, deleteFolder);

// Search
router.get("/search", authMiddleware, searchFiles);

// Optional: list folders only
router.get("/folders", authMiddleware, async (req, res) => {
  try {
    const { data, error } = await supabase
      .from("folders")
      .select("*")
      .eq("user_id", req.user.id);
    if (error) throw error;
    return res.status(200).json(data);
  } catch (err) {
    console.error("Error in GET /folders:", err);
    return res.status(500).json({ error: err.message });
  }
});

export default router;
