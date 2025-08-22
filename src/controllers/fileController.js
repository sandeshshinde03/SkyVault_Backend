import { supabase } from "../config/supabaseClient.js";
import { v4 as uuidv4 } from "uuid";

// === Helpers ===
const publicUrlFor = (path) => {
  const { data, error } = supabase.storage.from("files").getPublicUrl(path);
  if (error) {
    console.error("getPublicUrl error:", error);
    return null;
  }
  return data?.publicUrl ?? null;
};

const normalizeFolderId = (raw) => {
  if (
    !raw ||
    raw === "null" ||
    raw === "root" ||
    raw === "undefined" ||
    raw === ""
  ) {
    return null;
  }
  return raw;
};

// === Upload File ===
export const uploadFile = async (req, res) => {
  try {
    const file = req.file;
    const { folderId: rawFolderId } = req.body;
    const userId = req.user?.id;

    if (!userId) return res.status(401).json({ message: "Unauthorized" });
    if (!file) return res.status(400).json({ message: "No file uploaded" });

    const folderId = normalizeFolderId(rawFolderId);
    const objectKey = `${uuidv4()}_${file.originalname}`;

    const { error: uploadError } = await supabase.storage
      .from("files")
      .upload(objectKey, file.buffer, { contentType: file.mimetype });
    if (uploadError) throw uploadError;

    const publicUrl = publicUrlFor(objectKey);

    const { data: fileRow, error: dbError } = await supabase
      .from("files")
      .insert([
        {
          user_id: userId,
          name: file.originalname,
          path: objectKey,
          size: file.size,
          type: file.mimetype,
          folder_id: folderId,
          is_deleted: false,
        },
      ])
      .select()
      .single();
    if (dbError) throw dbError;

    return res
      .status(201)
      .json({ message: "File uploaded", file: { ...fileRow, publicUrl } });
  } catch (err) {
    console.error("uploadFile:", err);
    return res.status(500).json({ error: err.message });
  }
};

// === Get Files & Folders ===
export const getUserFiles = async (req, res) => {
  try {
    const userId = req.user?.id;
    const userEmail = req.user?.email;
    if (!userId) return res.status(401).json({ message: "Unauthorized" });

    let { folderId: rawFolderId, tab = "drive" } = req.query;
    const folderId = normalizeFolderId(rawFolderId);

    let folders = [];
    let files = [];

    if (tab === "drive") {
      // Folders
      let folderQuery = supabase
        .from("folders")
        .select("*")
        .eq("user_id", userId);
      folderId
        ? folderQuery.eq("parent_id", folderId)
        : folderQuery.is("parent_id", null);
      const { data: folderRows, error: folderErr } = await folderQuery;
      if (folderErr) throw folderErr;
      folders = folderRows || [];

      // Files
      let fileQuery = supabase
        .from("files")
        .select("*")
        .eq("user_id", userId)
        .eq("is_deleted", false);
      folderId
        ? fileQuery.eq("folder_id", folderId)
        : fileQuery.is("folder_id", null);
      const { data: fileRows, error: fileErr } = await fileQuery;
      if (fileErr) throw fileErr;
      files = (fileRows || []).map((f) => ({
        ...f,
        publicUrl: publicUrlFor(f.path),
      }));
    } else if (tab === "trash") {
      const { data: fileRows, error: fileErr } = await supabase
        .from("files")
        .select("*")
        .eq("user_id", userId)
        .eq("is_deleted", true);
      if (fileErr) throw fileErr;
      files = (fileRows || []).map((f) => ({
        ...f,
        publicUrl: publicUrlFor(f.path),
      }));
    } else if (tab === "shared") {
      const { data: sharedRows, error: sharedErr } = await supabase
        .from("shares")
        .select("file_id")
        .eq("shared_with_email", userEmail);
      if (sharedErr) throw sharedErr;
      const ids = (sharedRows || []).map((s) => s.file_id);
      if (ids.length) {
        const { data: fileRows, error: fileErr } = await supabase
          .from("files")
          .select("*")
          .in("id", ids);
        if (fileErr) throw fileErr;
        files = (fileRows || []).map((f) => ({
          ...f,
          publicUrl: publicUrlFor(f.path),
        }));
      }
    }

    return res.status(200).json({ folders, files });
  } catch (err) {
    console.error("getUserFiles:", err);
    return res.status(500).json({ error: err.message });
  }
};

// === Folder CRUD ===
export const createFolder = async (req, res) => {
  try {
    const userId = req.user?.id;
    if (!userId) return res.status(401).json({ message: "Unauthorized" });

    const { name, parent_id } = req.body;
    if (!name) return res.status(400).json({ message: "Name required" });

    const parentIdNorm = normalizeFolderId(parent_id);
    const { data, error } = await supabase
      .from("folders")
      .insert([{ user_id: userId, name, parent_id: parentIdNorm }])
      .select()
      .single();
    if (error) throw error;

    return res.status(201).json({ message: "Folder created", folder: data });
  } catch (err) {
    console.error("createFolder:", err);
    return res.status(500).json({ error: err.message });
  }
};

export const deleteFolder = async (req, res) => {
  try {
    const userId = req.user?.id;
    const { id } = req.params;
    if (!userId) return res.status(401).json({ message: "Unauthorized" });

    const { error } = await supabase
      .from("folders")
      .delete()
      .eq("id", id)
      .eq("user_id", userId);
    if (error) throw error;

    return res.status(200).json({ message: "Folder deleted" });
  } catch (err) {
    console.error("deleteFolder:", err);
    return res.status(500).json({ error: err.message });
  }
};

// === File + Folder Rename ===
export const renameItem = async (req, res) => {
  try {
    const userId = req.user?.id;
    const { id, newName, type } = req.body;
    if (!userId) return res.status(401).json({ message: "Unauthorized" });
    if (!id || !newName)
      return res.status(400).json({ message: "Missing fields" });

    const table = type === "file" ? "files" : "folders";
    const { data, error } = await supabase
      .from(table)
      .update({ name: newName })
      .eq("id", id)
      .eq("user_id", userId)
      .select();
    if (error) throw error;
    if (!data || data.length === 0)
      return res.status(404).json({ message: "Item not found" });

    return res.status(200).json({ message: `${type} renamed`, data: data[0] });
  } catch (err) {
    console.error("renameItem:", err);
    return res.status(500).json({ error: err.message });
  }
};

// === File Soft Delete / Restore / Delete ===
export const softDeleteFile = async (req, res) => {
  try {
    const userId = req.user?.id;
    const { id } = req.params;
    if (!userId) return res.status(401).json({ message: "Unauthorized" });

    const { data, error } = await supabase
      .from("files")
      .update({ is_deleted: true })
      .eq("id", id)
      .eq("user_id", userId)
      .select();
    if (error) throw error;
    if (!data || data.length === 0)
      return res.status(404).json({ message: "File not found" });

    return res
      .status(200)
      .json({ message: "File moved to Trash", file: data[0] });
  } catch (err) {
    console.error("softDeleteFile:", err);
    return res.status(500).json({ error: err.message });
  }
};

export const restoreFile = async (req, res) => {
  try {
    const userId = req.user?.id;
    const { id } = req.params;
    if (!userId) return res.status(401).json({ message: "Unauthorized" });

    const { data, error } = await supabase
      .from("files")
      .update({ is_deleted: false })
      .eq("id", id)
      .eq("user_id", userId)
      .select();
    if (error) throw error;
    if (!data || data.length === 0)
      return res.status(404).json({ message: "File not found" });

    return res.status(200).json({ message: "File restored", file: data[0] });
  } catch (err) {
    console.error("restoreFile:", err);
    return res.status(500).json({ error: err.message });
  }
};

export const deleteFile = async (req, res) => {
  try {
    const userId = req.user?.id;
    const { id } = req.params;
    if (!userId) return res.status(401).json({ message: "Unauthorized" });

    const { error } = await supabase
      .from("files")
      .delete()
      .eq("id", id)
      .eq("user_id", userId);
    if (error) throw error;

    return res.status(200).json({ message: "File permanently deleted" });
  } catch (err) {
    console.error("deleteFile:", err);
    return res.status(500).json({ error: err.message });
  }
};

// === File Move ===
export const moveFile = async (req, res) => {
  try {
    const userId = req.user?.id;
    const { id, folder_id } = req.body;
    if (!userId) return res.status(401).json({ message: "Unauthorized" });

    const normalized = normalizeFolderId(folder_id);

    const { data, error } = await supabase
      .from("files")
      .update({ folder_id: normalized })
      .eq("id", id)
      .eq("user_id", userId)
      .select();
    if (error) throw error;
    if (!data || data.length === 0)
      return res.status(404).json({ message: "File not found" });

    return res.status(200).json({ message: "File moved", file: data[0] });
  } catch (err) {
    console.error("moveFile:", err);
    return res.status(500).json({ error: err.message });
  }
};

// === Search Files & Folders ===
export const searchFiles = async (req, res) => {
  try {
    const userId = req.user?.id;
    const { query } = req.query;

    if (!userId) return res.status(401).json({ message: "Unauthorized" });
    if (!query) return res.status(400).json({ message: "Query required" });

    const { data: files, error: fileErr } = await supabase
      .from("files")
      .select("*")
      .eq("user_id", userId)
      .eq("is_deleted", false)
      .ilike("name", `%${query}%`);
    const { data: folders, error: folderErr } = await supabase
      .from("folders")
      .select("*")
      .eq("user_id", userId)
      .ilike("name", `%${query}%`);

    if (fileErr) throw fileErr;
    if (folderErr) throw folderErr;

    return res.status(200).json({
      files: (files || []).map((f) => ({
        ...f,
        publicUrl: f.path
          ? supabase.storage.from("files").getPublicUrl(f.path).data.publicUrl
          : null,
      })),
      folders: folders || [],
    });
  } catch (err) {
    console.error("searchFiles:", err);
    return res.status(500).json({ error: err.message });
  }
};
