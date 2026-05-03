import { Router, type IRouter } from "express";
import multer from "multer";
import path from "path";
import { randomUUID } from "crypto";
import { authenticate } from "../middlewares/authenticate";

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024 },
  fileFilter(_req, file, cb) {
    if (file.mimetype.startsWith("image/")) {
      cb(null, true);
    } else {
      cb(new Error("Only image files are allowed"));
    }
  },
});

const router: IRouter = Router();

router.post("/upload", authenticate, upload.single("image"), async (req, res) => {
  if (!req.file) {
    res.status(400).json({ message: "No image file provided" });
    return;
  }

  const supabaseUrl = process.env.SUPABASE_URL;
  const supabaseKey = process.env.SUPABASE_SERVICE_KEY;

  if (!supabaseUrl || !supabaseKey) {
    res.status(500).json({ message: "Storage not configured" });
    return;
  }

  const ext = path.extname(req.file.originalname) || ".jpg";
  const filename = `${randomUUID()}${ext}`;

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 15000);

  let response: Response;
  try {
    response = await fetch(
      `${supabaseUrl}/storage/v1/object/visit-images/${filename}`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${supabaseKey}`,
          "Content-Type": req.file.mimetype,
        },
        body: req.file.buffer,
        signal: controller.signal,
      },
    );
  } catch (err) {
    res.status(500).json({ message: "Upload timed out or network error", detail: String(err) });
    return;
  } finally {
    clearTimeout(timeout);
  }

  if (!response.ok) {
    const detail = await response.text();
    res.status(500).json({ message: "Image upload failed", detail });
    return;
  }

  res.json({ url: `${supabaseUrl}/storage/v1/object/public/visit-images/${filename}` });
});

export default router;
