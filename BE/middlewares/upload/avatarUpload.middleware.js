const multer = require('multer');
const path = require('path');
const fs = require('fs');

const AVATAR_DIR = path.join(__dirname, '../../public/uploads/avatars');

// Ensure directory exists
if (!fs.existsSync(AVATAR_DIR)) {
  fs.mkdirSync(AVATAR_DIR, { recursive: true });
}

const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, AVATAR_DIR);
  },
  filename: function (req, file, cb) {
    const ext = path.extname(file.originalname).toLowerCase();
    const safeName = `${req.user?.id || 'anon'}_${Date.now()}${ext}`;
    cb(null, safeName);
  }
});

const fileFilter = (req, file, cb) => {
  const allowed = ['.png', '.jpg', '.jpeg', '.gif', '.webp'];
  const ext = path.extname(file.originalname).toLowerCase();
  if (!allowed.includes(ext)) {
    return cb(new Error('Only image files are allowed (.png, .jpg, .jpeg, .gif, .webp)'));
  }
  cb(null, true);
};

const upload = multer({
  storage,
  fileFilter,
  limits: {
    fileSize: 2 * 1024 * 1024 // 2MB
  }
});

module.exports = upload.single('avatar');
