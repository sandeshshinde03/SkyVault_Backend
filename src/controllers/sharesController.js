import { supabase } from "../config/supabaseClient.js";

// ✅ helper to check if user can manage shares
const canManageShares = async (fileId, user) => {
  const { data: fileOwner } = await supabase
    .from("files")
    .select("user_id")
    .eq("id", fileId)
    .single();
  if (fileOwner?.user_id === user.id) return true;

  const { data: shareOwner } = await supabase
    .from("shares")
    .select("role")
    .eq("file_id", fileId)
    .eq("shared_with_email", user.email)
    .maybeSingle();
  return shareOwner?.role === "owner";
};

// ✅ Create a share
export const createShare = async (req, res) => {
  try {
    const { file_id, shared_with_email, role } = req.body;
    if (!file_id || !shared_with_email || !role)
      return res
        .status(400)
        .json({ error: "file_id, shared_with_email, and role are required" });

    if (!["viewer", "editor", "owner"].includes(role))
      return res.status(400).json({ error: "Invalid role" });

    if (!(await canManageShares(file_id, req.user)))
      return res
        .status(403)
        .json({ error: "Not authorized to share this file" });

    const { data: existing } = await supabase
      .from("shares")
      .select("id")
      .eq("file_id", file_id)
      .eq("shared_with_email", shared_with_email)
      .maybeSingle();
    if (existing)
      return res
        .status(409)
        .json({ error: "File already shared with this user" });

    const { data, error } = await supabase
      .from("shares")
      .insert([{ file_id, shared_with_email, role }])
      .select();
    if (error) throw error;

    res
      .status(201)
      .json({ message: "File shared successfully", share: data[0] });
  } catch (err) {
    console.error("Error creating share:", err.message);
    res.status(500).json({ error: err.message || "Failed to create share" });
  }
};

// ✅ Get shares for a file
export const getSharesForFile = async (req, res) => {
  try {
    const { fileId } = req.params;
    if (!(await canManageShares(fileId, req.user)))
      return res.status(403).json({ error: "Not authorized to view shares" });

    const { data, error } = await supabase
      .from("shares")
      .select("*")
      .eq("file_id", fileId);
    if (error) throw error;

    res.status(200).json(data);
  } catch (err) {
    console.error("Error fetching shares:", err.message);
    res.status(500).json({ error: err.message || "Failed to fetch shares" });
  }
};
