const User = require('../../models/auth/auth.model');
const { z, ZodError } = require('zod');

const meUpdateSchema = z.object({
  fullName: z.string().min(2).max(100).optional(),
  phoneNumber: z.string().regex(/^0\d{9}$/).optional(),
});

const getMe = async (req, res) => {
  try {
    const user = await User.findById(req.user.id).select('-password');
    if (!user) return res.status(404).json({ success: false, message: 'User not found' });
    return res.status(200).json({ success: true, data: user });
  } catch (err) {
    return res.status(400).json({ success: false, message: err.message });
  }
};

const updateMe = async (req, res) => {
  try {
    const body = meUpdateSchema.parse(req.body);
    const user = await User.findById(req.user.id);
    if (!user) return res.status(404).json({ success: false, message: 'User not found' });
    if (body.fullName !== undefined) user.fullName = body.fullName;
    if (body.phoneNumber !== undefined) user.phoneNumber = body.phoneNumber;
    await user.save();
    const sanitized = user.toObject();
    delete sanitized.password;
    return res.status(200).json({ success: true, data: sanitized, message: 'Profile updated' });
  } catch (err) {
    if (err instanceof ZodError) {
      return res.status(400).json({ success: false, message: err.errors?.[0]?.message || 'Invalid input', data: { issues: err.errors } });
    }
    return res.status(400).json({ success: false, message: err.message });
  }
};

module.exports = { getMe, updateMe };
