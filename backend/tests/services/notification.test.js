/**
 * Tests for notification.service.js
 * Tests: email, SMS, push, in-app notifications.
 */

const mockInsert = jest.fn().mockResolvedValue({ data: {}, error: null });

jest.mock('../../config/supabase.js', () => ({
  __esModule: true,
  default: {
    from: jest.fn(() => ({
      insert: mockInsert,
      select: jest.fn().mockReturnThis(),
      eq: jest.fn().mockReturnThis(),
      single: jest.fn().mockResolvedValue({ data: { id: 'notif-1' }, error: null }),
    })),
  },
}));

// Mock email service
jest.mock('../../services/email.service.js', () => ({
  __esModule: true,
  sendWelcomeEmail: jest.fn().mockResolvedValue({}),
  sendOrderConfirmationEmail: jest.fn().mockResolvedValue({}),
  sendPasswordResetEmail: jest.fn().mockResolvedValue({}),
  sendAccountVerificationEmail: jest.fn().mockResolvedValue({}),
}));

// Mock SMS service
jest.mock('../../services/sms.service.js', () => ({
  __esModule: true,
  sendSms: jest.fn().mockResolvedValue({ success: true }),
  sendOtpSms: jest.fn().mockResolvedValue({ success: true }),
}));

import {
  createNotification,
  createBulkNotifications,
  notifyOrderStatus,
} from '../../services/notification.service.js';

import supabase from '../../config/supabase.js';

describe('Notification Service', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockInsert.mockResolvedValue({ data: {}, error: null });
  });

  describe('createNotification', () => {
    it('should insert a notification record into the database', async () => {
      await createNotification({
        user_id: 'user-1',
        title: 'Test Notification',
        message: 'Hello!',
        type: 'info',
      });

      expect(supabase.from).toHaveBeenCalledWith('notifications');
      expect(mockInsert).toHaveBeenCalledWith(
        expect.objectContaining({
          user_id: 'user-1',
          title: 'Test Notification',
          message: 'Hello!',
          type: 'info',
          read: false,
        })
      );
    });

    it('should default type to "info" when not provided', async () => {
      await createNotification({
        user_id: 'user-2',
        title: 'Default Type',
        message: 'Test message',
      });

      expect(mockInsert).toHaveBeenCalledWith(
        expect.objectContaining({ type: 'info' })
      );
    });

    it('should include optional link when provided', async () => {
      await createNotification({
        user_id: 'user-3',
        title: 'Link Notification',
        message: 'Click here',
        link: '/orders/order-123',
      });

      expect(mockInsert).toHaveBeenCalledWith(
        expect.objectContaining({ link: '/orders/order-123' })
      );
    });

    it('should handle database error gracefully (not throw)', async () => {
      mockInsert.mockResolvedValue({ data: null, error: { message: 'DB error' } });

      await expect(
        createNotification({ user_id: 'user-err', title: 'Error Test', message: 'Test' })
      ).resolves.not.toThrow();
    });

    it('should set read to false by default', async () => {
      await createNotification({
        user_id: 'user-4',
        title: 'Unread',
        message: 'This is unread',
      });

      expect(mockInsert).toHaveBeenCalledWith(
        expect.objectContaining({ read: false })
      );
    });
  });

  describe('createBulkNotifications', () => {
    it('should insert notifications for all provided user IDs', async () => {
      const userIds = ['user-a', 'user-b', 'user-c'];
      const payload = { title: 'Bulk Notification', message: 'Hello everyone!', type: 'info' };

      await createBulkNotifications(userIds, payload);

      expect(mockInsert).toHaveBeenCalledWith(
        expect.arrayContaining([
          expect.objectContaining({ user_id: 'user-a', title: 'Bulk Notification' }),
          expect.objectContaining({ user_id: 'user-b' }),
          expect.objectContaining({ user_id: 'user-c' }),
        ])
      );
    });

    it('should handle empty user list without throwing', async () => {
      await expect(
        createBulkNotifications([], { title: 'Empty', message: 'Test' })
      ).resolves.not.toThrow();
    });

    it('should handle DB error gracefully for bulk insert', async () => {
      mockInsert.mockResolvedValue({ data: null, error: { message: 'Bulk insert failed' } });

      await expect(
        createBulkNotifications(['user-err'], { title: 'Error', message: 'Test' })
      ).resolves.not.toThrow();
    });
  });

  describe('notifyOrderStatus', () => {
    it('should create a notification for order confirmed status', async () => {
      await notifyOrderStatus('buyer-1', 'order-abc', 'confirmed');

      expect(mockInsert).toHaveBeenCalledWith(
        expect.objectContaining({
          user_id: 'buyer-1',
          type: 'order',
        })
      );
    });

    it('should create a notification for order shipped status', async () => {
      await notifyOrderStatus('buyer-2', 'order-def', 'shipped');

      expect(mockInsert).toHaveBeenCalledWith(
        expect.objectContaining({ user_id: 'buyer-2' })
      );
    });

    it('should create a notification for order delivered status', async () => {
      await notifyOrderStatus('buyer-3', 'order-ghi', 'delivered');
      expect(mockInsert).toHaveBeenCalled();
    });

    it('should create a notification for order cancelled status', async () => {
      await notifyOrderStatus('buyer-4', 'order-jkl', 'cancelled');
      expect(mockInsert).toHaveBeenCalled();
    });

    it('should handle unknown order status gracefully', async () => {
      await expect(
        notifyOrderStatus('buyer-5', 'order-mno', 'unknown_status')
      ).resolves.not.toThrow();
    });
  });
});
