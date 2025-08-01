import { Request, Response, NextFunction } from 'express';

import {
    SendMessageRequestDTO,
    CreateConversationRequestDTO,
    MarkMessagesReadRequestDTO
} from '../types/dtos/message.dto';

import * as MessageService from '../services/message.service';

/**
 * @description Fetch all conversations for the authenticated user.
 * @route GET /api/conversations
 * @access Private
 */
export const fetchConversations = async (req: Request, res: Response, next: NextFunction) => {
    try {
        const userId = req.user!.id;
        const conversations = await MessageService.fetchConversations(userId);
        res.status(200).json(conversations);
    } catch (error) {
        next(error);
    }
};

/**
 * @description Fetch messages for a specific conversation.
 * @route GET /api/conversations/:conversationId/messages
 * @access Private
 */
export const fetchMessages = async (req: Request, res: Response, next: NextFunction) => {
    try {
        const userId = req.user!.id;
        const { conversationId } = req.params;

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
export const sendMessage = async (req: Request, res: Response, next: NextFunction) => {
    try {
        const senderId = req.user!.id;
        const messageData: SendMessageRequestDTO = req.body;

        const newMessage = await MessageService.sendMessage(senderId, messageData);
        res.status(201).json(newMessage);
    } catch (error) {
        next(error);
    }
};

/**
 * @description Create a new conversation.
 * @route POST /api/conversations
 * @access Private
 */
export const createConversation = async (req: Request, res: Response, next: NextFunction) => {
    try {
        const currentUserId = req.user!.id;
        const conversationData: CreateConversationRequestDTO = req.body;

        const newConversation = await MessageService.createConversation(currentUserId, conversationData);
        res.status(201).json(newConversation);
    } catch (error) {
        next(error);
    }
};

/**
 * @description Mark all messages in a specific conversation as read for the authenticated user.
 * @route PATCH /api/conversations/:conversationId/read
 * @access Private
 */
export const markAsRead = async (req: Request, res: Response, next: NextFunction) => {
    try {
        const userId = req.user!.id;
        const { conversationId } = req.params;

        await MessageService.markMessagesAsRead(userId, conversationId);
        res.status(204).send();
    } catch (error) {
        next(error);
    }
};

/**
 * @description Mark all messages across all conversations as read for the authenticated user.
 * @route PATCH /api/messages/mark-all-read
 * @access Private
 */
export const markAllAsRead = async (req: Request, res: Response, next: NextFunction) => {
    try {
        const userId = req.user!.id;

        await MessageService.markAllMessagesAsRead(userId);
        res.status(204).send();
    } catch (error) {
        next(error);
    }
};