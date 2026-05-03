import { Router, type IRouter } from "express";
import multer from "multer";
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

  const cloudName = process.env.CLOUDINARY_CLOUD_NAME;
  const uploadPreset = process.env.CLOUDINARY_UPLOAD_PRESET;

  if (!cloudName || !uploadPreset) {
    res.status(500).json({ message: "Storage not configured" });
    return;
  }

  const formData = new FormData();
  const blob = new Blob([req.file.buffer], { type: req.file.mimetype });
  formData.append("file", blob, req.file.originalname);
  formData.append("upload_preset", uploadPreset);
  formData.append("folder", "visit-images");
  // Auto compress + convert to WebP for smallest file size
  formData.append("quality", "auto:good");
  formData.append("fetch_format", "auto");

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 20000);

  let response: Response;
  try {
    response = await fetch(
      `https://api.cloudinary.com/v1_1/${cloudName}/image/upload`,
      { method: "POST", body: formData, signal: controller.signal },
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

  const data = await response.json() as { secure_url: string };
  res.json({ url: data.secure_url });
});

export default router;
