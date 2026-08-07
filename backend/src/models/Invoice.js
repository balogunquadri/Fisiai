const mongoose = require('mongoose');
const { v4: uuidv4 } = require('uuid');

const invoiceSchema = new mongoose.Schema(
  {
    invoiceId: {
      type: String,
      default: () => uuidv4(),
      unique: true,
      index: true,
    },
    invoiceNumber: {
      type: String,
      unique: true,
      required: true,
      index: true,
    },
    merchantId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Merchant',
      required: true,
      index: true,
    },
    customerId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Contact',
      index: true,
    },
    customerName: {
      type: String,
      required: true,
      trim: true,
    },
    customerPhone: {
      type: String,
      trim: true,
    },
    customerEmail: {
      type: String,
      trim: true,
    },
    items: [
      {
        itemId: String,
        productName: String,
        description: String,
        quantity: {
          type: Number,
          required: true,
          min: 1,
        },
        unitPrice: {
          type: Number,
          required: true,
          min: 0,
        },
        totalPrice: {
          type: Number,
          required: true,
          min: 0,
        },
        _id: false,
      },
    ],
    subtotal: {
      type: Number,
      required: true,
      default: 0,
      min: 0,
    },
    tax: {
      type: Number,
      default: 0,
      min: 0,
    },
    taxRate: {
      type: Number,
      default: 0,
      min: 0,
      max: 100,
    },
    discount: {
      type: Number,
      default: 0,
      min: 0,
    },
    discountPercentage: {
      type: Number,
      default: 0,
      min: 0,
      max: 100,
    },
    total: {
      type: Number,
      required: true,
      min: 0,
    },
    currency: {
      type: String,
      default: 'USD',
      enum: ['USD', 'EUR', 'GBP', 'NGN', 'KES', 'UGX', 'ZAR', 'GHS'],
    },
    status: {
      type: String,
      enum: ['draft', 'sent', 'paid', 'partially_paid', 'overdue', 'cancelled'],
      default: 'draft',
      index: true,
    },
    paymentStatus: {
      type: String,
      enum: ['unpaid', 'partially_paid', 'paid'],
      default: 'unpaid',
    },
    amountPaid: {
      type: Number,
      default: 0,
      min: 0,
    },
    dueDate: {
      type: Date,
    },
    issuedDate: {
      type: Date,
      default: Date.now,
    },
    paidDate: {
      type: Date,
    },
    notes: {
      type: String,
      trim: true,
    },
    terms: {
      type: String,
      trim: true,
    },
    sentVia: {
      type: [String],
      enum: ['whatsapp', 'email', 'sms', 'print', 'direct'],
      default: [],
    },
    sentAt: {
      type: Date,
    },
    pdfUrl: String,
    source: {
      type: String,
      enum: ['manual', 'whatsapp', 'api', 'system'],
      default: 'manual',
    },
    metadata: {
      type: Map,
      of: String,
    },
    activityLog: [
      {
        action: String,
        timestamp: { type: Date, default: Date.now },
        details: String,
        _id: false,
      },
    ],
  },
  {
    timestamps: true,
    collection: 'invoices',
  }
);

// Indexes for performance
invoiceSchema.index({ merchantId: 1, createdAt: -1 });
invoiceSchema.index({ merchantId: 1, status: 1 });
invoiceSchema.index({ customerId: 1, merchantId: 1 });
invoiceSchema.index({ dueDate: 1, status: 1 });

// Auto-calculate total if subtotal or tax changes
invoiceSchema.pre('save', function (next) {
  if (this.isModified('subtotal') || this.isModified('tax') || this.isModified('discount')) {
    this.total = this.subtotal + this.tax - this.discount;
  }
  next();
});

// Add activity log entry
invoiceSchema.methods.addActivityLog = function (action, details) {
  this.activityLog.push({
    action,
    details,
    timestamp: new Date(),
  });
};

// Mark as sent
invoiceSchema.methods.markAsSent = function (method = 'direct') {
  this.status = 'sent';
  this.sentAt = new Date();
  if (!this.sentVia.includes(method)) {
    this.sentVia.push(method);
  }
  this.addActivityLog('sent', `Invoice sent via ${method}`);
};

// Record payment
invoiceSchema.methods.recordPayment = function (amount) {
  this.amountPaid += amount;
  if (this.amountPaid >= this.total) {
    this.paymentStatus = 'paid';
    this.status = 'paid';
    this.paidDate = new Date();
    this.addActivityLog('paid', `Full payment received: ${amount}`);
  } else {
    this.paymentStatus = 'partially_paid';
    this.status = 'partially_paid';
    this.addActivityLog('payment_received', `Partial payment received: ${amount}`);
  }
};

module.exports = mongoose.model('Invoice', invoiceSchema);
