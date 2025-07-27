import { Router } from 'express';
import * as MessageController from '../controllers/message.controller';
import { authenticateUser } from '../middlewares/auth.middleware';
import {
    validateSendMessage,
    validateCreateConversation,
    validateMarkMessagesRead // You'll create these validation middlewares
} from '../middlewares/validate.middleware'; // Assuming a shared validate.middleware.ts

const router = Router();

/**
 * @route GET /api/conversations
 * @description Fetch all conversations for the authenticated user.
 * @access Private
 */
router.get('/conversations', authenticateUser, MessageController.fetchConversations);

/**
 * @route GET /api/conversations/:conversationId/messages
 * @description Fetch messages for a specific conversation.
 * @access Private
 */
router.get('/conversations/:conversationId/messages', authenticateUser, MessageController.fetchMessages);

/**
 * @route POST /api/messages
 * @description Send a new message within an existing conversation.
 * @access Private
 * @body SendMessageRequestDTO
 */
router.post('/messages', authenticateUser, validateSendMessage, MessageController.sendMessage);

/**
 * @route POST /api/conversations
 * @description Create a new conversation.
 * @access Private
 * @body CreateConversationRequestDTO
 */
router.post('/conversations', authenticateUser, validateCreateConversation, MessageController.createConversation);

/**
 * @route PATCH /api/conversations/:conversationId/read
 * @description Mark all messages in a specific conversation as read for the authenticated user.
 * @access Private
 * @body MarkMessagesReadRequestDTO (optional, can be empty if userId is from token)
 */
router.patch('/conversations/:conversationId/read', authenticateUser, validateMarkMessagesRead, MessageController.markAsRead);

/**
 * @route PATCH /api/messages/mark-all-read
 * @description Mark all messages across all conversations as read for the authenticated user.
 * @access Private
 */
router.patch('/messages/mark-all-read', authenticateUser, MessageController.markAllAsRead);

export default router;