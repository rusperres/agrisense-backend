import { Response, NextFunction } from 'express';
import { AuthenticatedRequest } from '../types/express'; // Your custom authenticated request type

// Import DTOs for request bodies
import {
    SendMessageRequestDTO,
    CreateConversationRequestDTO,
    MarkMessagesReadRequestDTO // Although validation is on param, it's good to keep track
} from '../types/dtos/message.dto';

// Import the MessageService (we'll implement this next)
import * as MessageService from '../services/message.service';

/**
 * @description Fetch all conversations for the authenticated user.
 * @route GET /api/conversations
 * @access Private
 */
export const fetchConversations = async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    try {
        const userId = req.user!.id; // Authenticated user ID from middleware
        const conversations = await MessageService.fetchConversations(userId);
        res.status(200).json(conversations);
    } catch (error) {
        next(error); // Pass error to global error handler
    }
};

/**
 * @description Fetch messages for a specific conversation.
 * @route GET /api/conversations/:conversationId/messages
 * @access Private
 */
export const fetchMessages = async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    try {
        const userId = req.user!.id; // Authenticated user ID
        const { conversationId } = req.params; // Get conversationId from URL parameters

        const messages = await MessageService.fetchMessages(userId, conversationId);
        res.status(200).json(messages);
    } catch (error) {
        next(error);
    }
};

/**
 * @description Send a new message within an existing conversation.
 * @route POST /api/messages
 * @access Private
 */
export const sendMessage = async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    try {
        const senderId = req.user!.id; // Authenticated user ID (the sender)
        // The request body contains conversationId, receiverId, content, type
        const messageData: SendMessageRequestDTO = req.body;

        const newMessage = await MessageService.sendMessage(senderId, messageData);
        res.status(201).json(newMessage); // 201 Created for a new resource
    } catch (error) {
        next(error);
    }
};

/**
 * @description Create a new conversation.
 * @route POST /api/conversations
 * @access Private
 */
export const createConversation = async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    try {
        const currentUserId = req.user!.id; // Authenticated user ID (one of the participants)
        // The request body contains participantId, productId, productName
        const conversationData: CreateConversationRequestDTO = req.body;

        const newConversation = await MessageService.createConversation(currentUserId, conversationData);
        res.status(201).json(newConversation); // 201 Created
    } catch (error) {
        next(error);
    }
};

/**
 * @description Mark all messages in a specific conversation as read for the authenticated user.
 * @route PATCH /api/conversations/:conversationId/read
 * @access Private
 */
export const markAsRead = async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    try {
        const userId = req.user!.id; // Authenticated user ID
        const { conversationId } = req.params; // Get conversationId from URL parameters

        await MessageService.markMessagesAsRead(userId, conversationId);
        res.status(204).send(); // 204 No Content is appropriate for a successful update that returns no body
    } catch (error) {
        next(error);
    }
};

/**
 * @description Mark all messages across all conversations as read for the authenticated user.
 * @route PATCH /api/messages/mark-all-read
 * @access Private
 */
export const markAllAsRead = async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    try {
        const userId = req.user!.id; // Authenticated user ID

        await MessageService.markAllMessagesAsRead(userId);
        res.status(204).send(); // 204 No Content
    } catch (error) {
        next(error);
    }
};