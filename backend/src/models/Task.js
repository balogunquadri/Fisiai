const mongoose = require('mongoose');

const taskSchema = new mongoose.Schema(
  {
    merchantId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Merchant',
      required: true,
      index: true,
    },
    title: {
      type: String,
      required: [true, 'Task title is required'],
      trim: true,
    },
    description: {
      type: String,
      trim: true,
      default: '',
    },
    status: {
      type: String,
      enum: ['pending', 'in_progress', 'completed', 'cancelled'],
      default: 'pending',
      index: true,
    },
    workflowStage: {
      type: String,
      trim: true,
      default: 'created',
    },
    assignedTo: {
      name: { type: String, trim: true, default: '' },
      phone: { type: String, trim: true, default: '' },
      telegramChatId: { type: String, trim: true, default: '' },
      role: { type: String, trim: true, default: '' },
    },
    invite: {
      channel: {
        type: String,
        enum: ['whatsapp', 'telegram'],
      },
      recipientPhone: { type: String, trim: true, default: '' },
      recipientChatId: { type: String, trim: true, default: '' },
      status: {
        type: String,
        enum: ['pending', 'sent', 'accepted', 'declined'],
        default: 'pending',
        index: true,
      },
      messageId: { type: String, trim: true, default: '' },
      sentAt: { type: Date },
      respondedAt: { type: Date },
      responseText: { type: String, trim: true, default: '' },
    },
    delivery: {
      status: {
        type: String,
        enum: ['pending', 'dispatched', 'enroute', 'delivered', 'failed'],
        default: 'pending',
        index: true,
      },
      partner: { type: String, trim: true, default: '' },
      address: { type: String, trim: true, default: '' },
      pickupLocation: { type: String, trim: true, default: '' },
      expectedDeliveryDate: { type: Date },
      completedAt: { type: Date },
      notes: { type: String, trim: true, default: '' },
    },
    dueDate: { type: Date },
    metadata: { type: mongoose.Schema.Types.Mixed, default: {} },
  },
  {
    timestamps: true,
  }
);

module.exports = mongoose.model('Task', taskSchema);
