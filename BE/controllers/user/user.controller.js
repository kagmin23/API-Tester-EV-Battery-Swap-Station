const User = require("../../models/auth/auth.model");
const { ZodError, z } = require("zod");

const formatUser = (u) => ({
	id: u._id,
	email: u.email,
	fullName: u.fullName,
	phoneNumber: u.phoneNumber,
	role: u.role,
	status: u.status,
	avatar: u.avatar || null,
	createdAt: u.createdAt,
	updatedAt: u.updatedAt,
});

const updateMeSchema = z.object({
	fullName: z.string().min(2).max(100).optional(),
	phoneNumber: z.string().regex(/^0\d{9}$/).optional(),
});

const getMe = async (req, res) => {
	try {
		const user = await User.findById(req.user.id);
		if (!user) return res.status(404).json({ success: false, message: "User not found" });
		return res.status(200).json({ success: true, data: formatUser(user) });
	} catch (err) {
		return res.status(400).json({ success: false, message: err.message });
	}
};

const updateMe = async (req, res) => {
	try {
		const body = updateMeSchema.parse(req.body);
		const user = await User.findById(req.user.id);
		if (!user) return res.status(404).json({ success: false, message: "User not found" });
		if (body.fullName !== undefined) user.fullName = body.fullName;
		if (body.phoneNumber !== undefined) {
			if (user.phoneNumber !== body.phoneNumber) {
				const exists = await User.findOne({ phoneNumber: body.phoneNumber });
				if (exists && exists._id.toString() !== user._id.toString()) {
					return res.status(409).json({ success: false, message: 'Phone number already in use' });
				}
			}
			user.phoneNumber = body.phoneNumber;
		}
		await user.save();
		return res.status(200).json({ success: true, data: formatUser(user), message: 'Profile updated' });
	} catch (err) {
		if (err instanceof ZodError) {
			const first = err.errors?.[0];
			return res.status(400).json({ success: false, data: { issues: err.errors }, message: first?.message || 'Invalid input' });
		}
		return res.status(400).json({ success: false, message: err.message });
	}
};

// Upload avatar handler (multer sets req.file)
const uploadAvatar = async (req, res) => {
	try {
		if (!req.file) return res.status(400).json({ success: false, message: 'No file uploaded' });
		const user = await User.findById(req.user.id);
		if (!user) return res.status(404).json({ success: false, message: 'User not found' });

		// Build public URL; express serves /public statically
		// Saved path e.g. public/uploads/avatars/filename.ext
		const filePath = req.file.path.replace(/\\/g, '/');
		// Remove leading 'BE/' if any and leading 'public/' for URL base
		const publicIndex = filePath.indexOf('/public/');
		const relative = publicIndex !== -1 ? filePath.substring(publicIndex + '/public'.length) : filePath;
		user.avatar = relative.startsWith('/') ? relative : `/${relative}`;
		await user.save();
		return res.status(200).json({ success: true, data: { avatar: user.avatar }, message: 'Avatar updated' });
	} catch (err) {
		return res.status(400).json({ success: false, message: err.message });
	}
};

module.exports = { getMe, updateMe, uploadAvatar };
