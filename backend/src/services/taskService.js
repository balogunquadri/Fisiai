const mongoose = require('mongoose');
const Task = require('../models/Task');
const Merchant = require('../models/Merchant');
const WhatsAppService = require('./WhatsAppService');
const TelegramService = require('./TelegramService');
const ActivityLog = require('../models/ActivityLog');

function normalizeTaskPayload(payload = {}) {
  return {
    title: (payload.title || '').toString().trim(),
    description: (payload.description || '').toString().trim(),
    workflowStage: (payload.workflowStage || 'created').toString().trim(),
    status: payload.status || 'pending',
    assignedTo: {
      name: (payload.assignedTo?.name || '').toString().trim(),
      phone: (payload.assignedTo?.phone || '').toString().replace(/[^\d+]/g, ''),
      telegramChatId: (payload.assignedTo?.telegramChatId || '').toString().trim(),
      role: (payload.assignedTo?.role || '').toString().trim(),
    },
    invite: {
      channel: payload.invite?.channel || null,
      recipientPhone: (payload.invite?.recipientPhone || '').toString().replace(/[^\d+]/g, ''),
      recipientChatId: (payload.invite?.recipientChatId || '').toString().trim(),
    },
    delivery: {
      status: payload.delivery?.status || 'pending',
      partner: (payload.delivery?.partner || '').toString().trim(),
      address: (payload.delivery?.address || '').toString().trim(),
      pickupLocation: (payload.delivery?.pickupLocation || '').toString().trim(),
      expectedDeliveryDate: payload.delivery?.expectedDeliveryDate ? new Date(payload.delivery.expectedDeliveryDate) : undefined,
      notes: (payload.delivery?.notes || '').toString().trim(),
    },
    dueDate: payload.dueDate ? new Date(payload.dueDate) : undefined,
    metadata: payload.metadata || {},
  };
}

function buildInviteMessage(task) {
  const dueLine = task.dueDate ? `Due: ${new Date(task.dueDate).toLocaleString()}` : 'Due: ASAP';
  const assignedTo = task.assignedTo?.name ? `${task.assignedTo.name}${task.assignedTo.role ? ` (${task.assignedTo.role})` : ''}` : 'Team member';
  return `🚀 *Task Invitation*

*${task.title}*
${task.description || 'No details provided.'}

Assigned to: ${assignedTo}
${dueLine}

Reply with *ACCEPT TASK ${task._id}* or *DECLINE TASK ${task._id}* to update the workflow status.

Track this task and delivery updates in your merchant dashboard.`;
}

async function createTask(merchantId, payload = {}, sendInvite = false) {
  const normalized = normalizeTaskPayload(payload);
  const task = await Task.create({
    merchantId: mongoose.Types.ObjectId(merchantId),
    title: normalized.title,
    description: normalized.description,
    workflowStage: normalized.workflowStage,
    status: normalized.status,
    assignedTo: normalized.assignedTo,
    invite: {
      channel: normalized.invite.channel,
      recipientPhone: normalized.invite.recipientPhone,
      recipientChatId: normalized.invite.recipientChatId,
      status: normalized.invite.channel ? 'pending' : 'pending',
    },
    delivery: normalized.delivery,
    dueDate: normalized.dueDate,
    metadata: normalized.metadata,
  });

  if (sendInvite && normalized.invite.channel) {
    await sendTaskInvite(task._id, merchantId);
  }

  return task.toObject();
}

async function listTasks(merchantId, filters = {}) {
  const query = { merchantId: mongoose.Types.ObjectId(merchantId) };
  if (filters.status) query.status = filters.status;
  if (filters.inviteStatus) query['invite.status'] = filters.inviteStatus;
  if (filters.deliveryStatus) query['delivery.status'] = filters.deliveryStatus;

  const tasks = await Task.find(query).sort({ createdAt: -1 }).lean();
  return tasks.map((task) => ({
    ...task,
    id: task._id.toString(),
  }));
}

async function getTaskById(merchantId, taskId) {
  if (!mongoose.Types.ObjectId.isValid(taskId)) return null;
  return Task.findOne({ _id: taskId, merchantId: mongoose.Types.ObjectId(merchantId) }).lean();
}

async function updateTask(merchantId, taskId, updates = {}) {
  const normalized = normalizeTaskPayload(updates);
  const actualUpdates = {};
  if (normalized.title) actualUpdates.title = normalized.title;
  if (normalized.description) actualUpdates.description = normalized.description;
  if (normalized.workflowStage) actualUpdates.workflowStage = normalized.workflowStage;
  if (normalized.status) actualUpdates.status = normalized.status;
  if (normalized.dueDate) actualUpdates.dueDate = normalized.dueDate;
  if (updates.assignedTo) actualUpdates.assignedTo = normalized.assignedTo;
  if (updates.invite) actualUpdates.invite = {
    ...normalized.invite,
    status: updates.invite.status || 'pending',
  };
  if (updates.delivery) actualUpdates.delivery = {
    ...normalized.delivery,
    status: updates.delivery.status || normalized.delivery.status,
    partner: updates.delivery.partner || normalized.delivery.partner,
  };
  if (updates.metadata) actualUpdates.metadata = updates.metadata;

  const task = await Task.findOneAndUpdate(
    { _id: taskId, merchantId: mongoose.Types.ObjectId(merchantId) },
    { $set: actualUpdates },
    { new: true }
  ).lean();

  return task;
}

async function sendTaskInvite(taskId, merchantId) {
  const task = await Task.findOne({ _id: taskId, merchantId: mongoose.Types.ObjectId(merchantId) });
  if (!task) {
    throw new Error('Task not found');
  }

  if (!task.invite?.channel) {
    throw new Error('Task invite channel is not configured');
  }

  const text = buildInviteMessage(task);
  let result;

  if (task.invite.channel === 'whatsapp') {
    if (!task.invite.recipientPhone) {
      throw new Error('WhatsApp recipient phone is required to send task invite');
    }
    result = await WhatsAppService.sendTextMessage(task.invite.recipientPhone, text, merchantId);
  } else if (task.invite.channel === 'telegram') {
    if (!task.invite.recipientChatId) {
      throw new Error('Telegram chat ID is required to send task invite');
    }
    const keyboard = [[
      { text: '✅ Accept Task', callback_data: `task_accept_${task._id}` },
      { text: '❌ Decline Task', callback_data: `task_decline_${task._id}` },
    ]];
    result = await TelegramService.sendTextMessage(task.invite.recipientChatId, text, merchantId, keyboard);
  } else {
    throw new Error('Unsupported invite channel');
  }

  const inviteUpdates = {
    'invite.status': result.success ? 'sent' : 'pending',
    'invite.messageId': result.messageId || '',
    'invite.sentAt': result.success ? new Date() : task.invite.sentAt,
  };

  await Task.updateOne({ _id: taskId, merchantId: mongoose.Types.ObjectId(merchantId) }, { $set: inviteUpdates });

  await ActivityLog.create({
    merchantId: mongoose.Types.ObjectId(merchantId),
    action: result.success ? 'TASK_INVITE_SENT' : 'TASK_INVITE_FAILED',
    entityType: 'Task',
    entityId: taskId,
    details: {
      taskTitle: task.title,
      inviteChannel: task.invite.channel,
      recipient: task.invite.channel === 'whatsapp' ? task.invite.recipientPhone : task.invite.recipientChatId,
      messageId: result.messageId || null,
      error: result.success ? null : result.error,
    },
    status: result.success ? 'Success' : 'Failure',
  });

  return await Task.findById(taskId).lean();
}

async function updateDeliveryStatus(merchantId, taskId, deliveryUpdates = {}) {
  const allowedStatuses = ['pending', 'dispatched', 'enroute', 'delivered', 'failed'];
  const update = {};
  if (deliveryUpdates.status && allowedStatuses.includes(deliveryUpdates.status)) {
    update['delivery.status'] = deliveryUpdates.status;
    if (deliveryUpdates.status === 'delivered') {
      update['delivery.completedAt'] = new Date();
    }
  }
  if (deliveryUpdates.address) update['delivery.address'] = deliveryUpdates.address;
  if (deliveryUpdates.partner) update['delivery.partner'] = deliveryUpdates.partner;
  if (deliveryUpdates.pickupLocation) update['delivery.pickupLocation'] = deliveryUpdates.pickupLocation;
  if (deliveryUpdates.expectedDeliveryDate) update['delivery.expectedDeliveryDate'] = new Date(deliveryUpdates.expectedDeliveryDate);
  if (deliveryUpdates.notes) update['delivery.notes'] = deliveryUpdates.notes;
  if (deliveryUpdates.status === 'delivered') update.status = 'completed';

  const task = await Task.findOneAndUpdate(
    { _id: taskId, merchantId: mongoose.Types.ObjectId(merchantId) },
    { $set: update },
    { new: true }
  ).lean();

  return task;
}

function normalizePhoneText(text) {
  return (text || '').toString().replace(/[^\d]/g, '');
}

async function processTaskResponseFromText(messageData, merchantId) {
  const text = (messageData.text || '').trim().toLowerCase();
  const match = text.match(/^(accept|decline)\s+task\s+([0-9a-fA-F]{24})/);
  if (!match) {
    return false;
  }

  const action = match[1];
  const taskId = match[2];

  const task = await Task.findOne({ _id: taskId, merchantId: mongoose.Types.ObjectId(merchantId) });
  if (!task) {
    return false;
  }

  const channel = messageData.source === 'telegram' ? 'telegram' : 'whatsapp';
  const contactMatches =
    channel === 'whatsapp'
      ? normalizePhoneText(messageData.from) === normalizePhoneText(task.assignedTo.phone)
      : String(messageData.chatId || messageData.recipientChatId || '') === String(task.assignedTo.telegramChatId);

  if (!contactMatches && channel === 'whatsapp' && task.invite.channel === 'whatsapp' && normalizePhoneText(task.invite.recipientPhone) !== normalizePhoneText(messageData.from)) {
    return false;
  }
  if (!contactMatches && channel === 'telegram' && task.invite.channel === 'telegram' && String(task.invite.recipientChatId) !== String(messageData.chatId || messageData.recipientChatId)) {
    return false;
  }

  const newStatus = action === 'accept' ? 'accepted' : 'declined';
  const updatedTask = await Task.findByIdAndUpdate(
    taskId,
    {
      $set: {
        'invite.status': newStatus,
        'invite.respondedAt': new Date(),
        'invite.responseText': messageData.text || action,
        status: action === 'accept' ? 'in_progress' : 'cancelled',
      },
    },
    { new: true }
  ).lean();

  await ActivityLog.create({
    merchantId: mongoose.Types.ObjectId(merchantId),
    action: 'TASK_INVITE_RESPONSE',
    entityType: 'Task',
    entityId: taskId,
    details: {
      taskTitle: task.title,
      response: newStatus,
      responder: messageData.from || messageData.chatId,
      source: messageData.source || channel,
      rawText: messageData.text,
    },
    status: 'Success',
  });

  const replyText = action === 'accept'
    ? `✅ Task *${task.title}* accepted. The merchant will see the task status updated in the dashboard.`
    : `❌ Task *${task.title}* declined. The merchant will see the task status updated in the dashboard.`;

  if (messageData.source === 'telegram') {
    await TelegramService.sendTextMessage(messageData.chatId || messageData.recipientChatId, replyText, merchantId);
  } else {
    await WhatsAppService.sendTextMessage(messageData.from, replyText, merchantId);
  }

  return true;
}

module.exports = {
  createTask,
  listTasks,
  getTaskById,
  updateTask,
  sendTaskInvite,
  updateDeliveryStatus,
  processTaskResponseFromText,
};
