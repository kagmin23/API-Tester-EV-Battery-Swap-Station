const { z, ZodError } = require('zod');
const SupportRequest = require('../../models/support/supportRequest.model');

const createSchema = z.object({
  title: z.string().min(3),
  description: z.string().optional(),
  images: z.array(z.string()).optional(),
});

const createSupportRequest = async (req, res) => {
  try {
    const body = createSchema.parse(req.body);
    const ticket = await SupportRequest.create({
      user: req.user.id,
      title: body.title,
      description: body.description,
      images: body.images || [],
    });
    return res.status(201).json({ success: true, data: ticket, message: 'Support request submitted' });
  } catch (err) {
    if (err instanceof ZodError) {
      return res.status(400).json({ success: false, message: err.errors?.[0]?.message || 'Invalid input' });
    }
    return res.status(400).json({ success: false, message: err.message });
  }
};

const listSupportRequests = async (req, res) => {
  try {
    const items = await SupportRequest.find({ user: req.user.id }).sort({ createdAt: -1 });
    return res.status(200).json({ success: true, data: items });
  } catch (err) {
    return res.status(400).json({ success: false, message: err.message });
  }
};

module.exports = { createSupportRequest, listSupportRequests };
