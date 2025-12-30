const User = require('./User');
const Booking = require('./Booking');
const Service = require('./Service');
const Gallery = require('./Gallery');
const GalleryReaction = require('./GalleryReaction');
const Event = require('./Event');
const Payment = require('./Payment');
const PricingRule = require('./PricingRule');
const PaymentMethodConfig = require('./PaymentMethodConfig');
const Notification = require('./Notification');
const AuditLog = require('./AuditLog');

// User Associations
User.hasMany(Booking, { foreignKey: 'userId', as: 'bookings' });
User.hasMany(Payment, { foreignKey: 'userId', as: 'payments' });
User.hasMany(Notification, { foreignKey: 'userId', as: 'notifications' });
User.hasMany(AuditLog, { foreignKey: 'userId', as: 'auditLogs' });
User.hasMany(GalleryReaction, { foreignKey: 'userId', as: 'galleryReactions' });

// Booking Associations
Booking.belongsTo(User, { foreignKey: 'userId', as: 'user' });
Booking.belongsTo(Service, { foreignKey: 'serviceId', as: 'service' });
Booking.hasOne(Payment, { foreignKey: 'bookingId', as: 'payment' });

// Service Associations
Service.hasMany(Booking, { foreignKey: 'serviceId', as: 'bookings' });

// Payment Associations
Payment.belongsTo(Booking, { foreignKey: 'bookingId', as: 'booking' });
Payment.belongsTo(Event, { foreignKey: 'eventId', as: 'event' });
Payment.belongsTo(User, { foreignKey: 'userId', as: 'user' });

// Event Associations
Event.hasMany(Payment, { foreignKey: 'eventId', as: 'payments' });

// Notification Associations
Notification.belongsTo(User, { foreignKey: 'userId', as: 'user' });

// AuditLog Associations
AuditLog.belongsTo(User, { foreignKey: 'userId', as: 'user' });

// Gallery Reaction Associations
GalleryReaction.belongsTo(User, { foreignKey: 'userId', as: 'user' });
Gallery.hasMany(GalleryReaction, { foreignKey: 'galleryId', as: 'reactions' });
GalleryReaction.belongsTo(Gallery, { foreignKey: 'galleryId', as: 'gallery' });

module.exports = {
  User,
  Booking,
  Service,
  Gallery,
  GalleryReaction,
  Event,
  Payment,
  PricingRule,
  PaymentMethodConfig,
  Notification,
  AuditLog,
};