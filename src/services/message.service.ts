import { PoolClient } from 'pg';
import { pool } from '../config/db';
import { v4 as uuidv4 } from 'uuid';
import { io, connectedUsers } from '../index';

import {
    MessageDTO,
    ConversationDTO,
    SendMessageRequestDTO,
    CreateConversationRequestDTO,
    FetchConversationsResponseDTO,
    FetchMessagesResponseDTO,
    ConversationCreatedResponseDTO,
} from '../types/dtos/message.dto';

import {
    MessageEntity,
    ConversationEntity
} from '../types/entities/message.entity';

import { MessageType } from '../types/enums';

import { UserEntity } from '../types/entities/user.entity';

// --- Helper Functions for Mapping ---

/**
 * Maps a MessageEntity from the database to a MessageDTO for the frontend.
 * Converts snake_case to camelCase and ISO string date to Date object.
 * @param entity The MessageEntity from the database.
 * @returns The mapped MessageDTO.
 */
function mapMessageEntityToDTO(entity: MessageEntity): MessageDTO {
    return {
        id: entity.id,
        conversationId: entity.conversation_id,
        senderId: entity.sender_id,
        receiverId: entity.receiver_id,
        content: entity.content,
        type: entity.type,
        isRead: entity.is_read,
        createdAt: new Date(entity.created_at),
    };
}

/**
 * Maps a ConversationEntity from the database to a ConversationDTO for the frontend.
 * Converts snake_case to camelCase and ISO string date to Date object.
 * Includes optional lastMessage and unreadCount, which might be fetched separately.
 * @param entity The ConversationEntity from the database.
 * @param lastMessage Optional: The last MessageDTO associated with this conversation.
 * @param unreadCount Optional: The unread count for the specific requesting user.
 * @returns The mapped ConversationDTO.
 */
function mapConversationEntityToDTO(
    entity: ConversationEntity,
    lastMessage?: MessageDTO,
    unreadCount: number = 0
): ConversationDTO {
    return {
        id: entity.id,
        participants: entity.participants,
        productId: entity.product_id || undefined,
        productName: entity.product_name || undefined,
        lastMessage: lastMessage,
        unreadCount: unreadCount,
        createdAt: new Date(entity.created_at),
        updatedAt: new Date(entity.updated_at),
    };
}

// --- Service Functions ---

/**
 * Fetches all conversations for a given user, including last message and unread count.
 * @param userId The ID of the authenticated user.
 * @returns A FetchConversationsResponseDTO containing conversations and total unread count.
 */
export const fetchConversations = async (userId: string): Promise<FetchConversationsResponseDTO> => {
    let client: PoolClient | null = null;
    try {
        client = await pool.connect();

        const conversationsResult = await client.query<ConversationEntity>(
            `SELECT * FROM conversations WHERE participants ? $1 ORDER BY updated_at DESC`,
            [userId]
        );

        const conversations: ConversationDTO[] = [];
        let totalUnreadCount = 0;

        for (const convEntity of conversationsResult.rows) {
            let lastMessage: MessageDTO | undefined;
            let unreadCount = 0;

            if (convEntity.last_message_id) {
                const lastMessageResult = await client.query<MessageEntity>(
                    `SELECT * FROM messages WHERE id = $1`,
                    [convEntity.last_message_id]
                );
                if (lastMessageResult.rows.length > 0) {
                    lastMessage = mapMessageEntityToDTO(lastMessageResult.rows[0]);
                }
            }

            const unreadCountResult = await client.query<{ count: string }>(
                `SELECT COUNT(*) FROM messages
         WHERE conversation_id = $1 AND receiver_id = $2 AND is_read = FALSE`,
                [convEntity.id, userId]
            );
            unreadCount = parseInt(unreadCountResult.rows[0].count, 10);

            const conversationDTO = mapConversationEntityToDTO(convEntity, lastMessage, unreadCount);
            conversations.push(conversationDTO);
            totalUnreadCount += unreadCount;
        }

        return { conversations, totalUnreadCount };

    } catch (error) {
        console.error('Error fetching conversations:', error);
        throw new Error('Failed to fetch conversations.');
    } finally {
        if (client) {
            client.release();
        }
    }
};

/**
 * Fetches messages for a specific conversation for a given user.
 * Ensures the user is a participant of the conversation.
 * @param userId The ID of the authenticated user.
 * @param conversationId The ID of the conversation.
 * @returns A FetchMessagesResponseDTO containing the messages.
 */
export const fetchMessages = async (userId: string, conversationId: string): Promise<FetchMessagesResponseDTO> => {
    let client: PoolClient | null = null;
    try {
        client = await pool.connect();

        const conversationCheck = await client.query<ConversationEntity>(
            `SELECT id FROM conversations WHERE id = $1 AND participants ? $2`,
            [conversationId, userId]
        );

        if (conversationCheck.rows.length === 0) {
            throw new Error('Conversation not found or user is not a participant.');
        }

        const messagesResult = await client.query<MessageEntity>(
            `SELECT * FROM messages WHERE conversation_id = $1 ORDER BY created_at ASC`,
            [conversationId]
        );

        const messages = messagesResult.rows.map(mapMessageEntityToDTO);

        return { messages };

    } catch (error) {
        console.error('Error fetching messages:', error);
        throw new Error('Failed to fetch messages.');
    } finally {
        if (client) {
            client.release();
        }
    }
};

/**
 * Sends a new message within an existing conversation.
 * @param senderId The ID of the user sending the message.
 * @param messageData The message data (conversationId, receiverId, content, type).
 * @returns The newly created MessageDTO.
 */
export const sendMessage = async (senderId: string, messageData: SendMessageRequestDTO): Promise<MessageDTO> => {
    let client: PoolClient | null = null;
    try {
        client = await pool.connect();
        await client.query('BEGIN');

        const { conversationId, receiverId, content, type } = messageData;

        // 1. Verify conversation exists and participants are valid
        const conversationResult = await client.query<ConversationEntity>(
            `SELECT * FROM conversations WHERE id = $1 AND participants ?& ARRAY[$2, $3]::text[]`,
            [conversationId, senderId, receiverId]
        );

        if (conversationResult.rows.length === 0) {
            throw new Error('Conversation not found or participants are invalid.');
        }
        const conversationEntity = conversationResult.rows[0];


        // 2. Create new message entity
        const newMessageId = uuidv4();
        const createdAt = new Date().toISOString();

        const messageInsertResult = await client.query<MessageEntity>(
            `INSERT INTO messages (id, conversation_id, sender_id, receiver_id, content, type, is_read, created_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
       RETURNING *`,
            [newMessageId, conversationId, senderId, receiverId, content, type, false, createdAt]
        );
        const newMessageEntity = messageInsertResult.rows[0];

        // 3. Update conversation's last_message_id and updated_at
        await client.query(
            `UPDATE conversations
       SET last_message_id = $1, updated_at = NOW()
       WHERE id = $2`,
            [newMessageId, conversationId]
        );

        await client.query('COMMIT');

        const newMessageDTO = mapMessageEntityToDTO(newMessageEntity);

        // --- WebSocket Emission for New Message ---
        // Emit the new message to the receiver(s) and potentially the sender (for consistency)
        const participants = conversationEntity.participants; // Get participants from the fetched conversation
        for (const participantId of participants) {
            const sockets = connectedUsers.get(participantId);
            if (sockets) {
                sockets.forEach(socketId => {
                    io.to(socketId).emit('newMessage', newMessageDTO);
                    console.log(`Emitted 'newMessage' to ${participantId} (socket: ${socketId}) for conversation ${conversationId}`);
                });
            }
        }


        return newMessageDTO;

    } catch (error) {
        if (client) {
            await client.query('ROLLBACK');
        }
        console.error('Error sending message:', error);
        throw new Error('Failed to send message.');
    } finally {
        if (client) {
            client.release();
        }
    }
};

export const createConversation = async (
    currentUserId: string,
    conversationData: CreateConversationRequestDTO
): Promise<ConversationCreatedResponseDTO> => {
    let client: PoolClient | null = null;
    try {
        client = await pool.connect();
        await client.query('BEGIN');

        const { participantId, productId, productName } = conversationData;

        const usersExist = await client.query<UserEntity>(
            `SELECT id FROM users WHERE id = $1 OR id = $2`,
            [currentUserId, participantId]
        );
        if (usersExist.rows.length !== 2) {
            throw new Error('One or both participants do not exist.');
        }

        const existingConversationQuery = `
      SELECT id FROM conversations
      WHERE participants ?& ARRAY[$1, $2]::text[]
      ${productId ? 'AND product_id = $3' : 'AND product_id IS NULL'}
    `;
        const existingConversationParams = productId ? [currentUserId, participantId, productId] : [currentUserId, participantId];

        const existingConvResult = await client.query<ConversationEntity>(
            existingConversationQuery,
            existingConversationParams
        );

        if (existingConvResult.rows.length > 0) {
            await client.query('ROLLBACK');
            const existingConvId = existingConvResult.rows[0].id;

            // --- WebSocket Emission for Existing Conversation ---]
            const participants = [currentUserId, participantId];
            for (const pId of participants) {
                const sockets = connectedUsers.get(pId);
                if (sockets) {
                    sockets.forEach(socketId => {
                        io.to(socketId).emit('conversationUpdated', { conversationId: existingConvId, message: 'Conversation already exists and has been updated.' });
                        console.log(`Emitted 'conversationUpdated' to ${pId} (socket: ${socketId}) for existing conversation ${existingConvId}`);
                    });
                }
            }

            return { conversationId: existingConvId };
        }

        const newConversationId = uuidv4();
        const participantsArray = [currentUserId, participantId].sort();
        const createdAt = new Date().toISOString();
        const updatedAt = createdAt;

        const conversationInsertResult = await client.query<ConversationEntity>(
            `INSERT INTO conversations (id, participants, product_id, product_name, created_at, updated_at)
       VALUES ($1, $2, $3, $4, $5, $6)
       RETURNING *`,
            [
                newConversationId,
                JSON.stringify(participantsArray),
                productId || null,
                productName || null,
                createdAt,
                updatedAt,
            ]
        );
        const newConversationEntity = conversationInsertResult.rows[0];

        await client.query('COMMIT');

        const newConversationDTO = mapConversationEntityToDTO(newConversationEntity);

        // --- WebSocket Emission for New Conversation ---
        for (const pId of participantsArray) {
            const sockets = connectedUsers.get(pId);
            if (sockets) {
                sockets.forEach(socketId => {
                    io.to(socketId).emit('newConversation', newConversationDTO);
                    console.log(`Emitted 'newConversation' to ${pId} (socket: ${socketId}) for conversation ${newConversationDTO.id}`);
                });
            }
        }

        return { conversationId: newConversationDTO.id, conversation: newConversationDTO };

    } catch (error) {
        if (client) {
            await client.query('ROLLBACK');
        }
        console.error('Error creating conversation:', error);
        throw new Error('Failed to create conversation.');
    } finally {
        if (client) {
            client.release();
        }
    }
};


export const markMessagesAsRead = async (userId: string, conversationId: string): Promise<void> => {
    let client: PoolClient | null = null;
    try {
        client = await pool.connect();

        const conversationCheck = await client.query<ConversationEntity>(
            `SELECT id, participants FROM conversations WHERE id = $1 AND participants ? $2`,
            [conversationId, userId]
        );

        if (conversationCheck.rows.length === 0) {
            throw new Error('Conversation not found or user is not a participant.');
        }
        const conversationParticipants = conversationCheck.rows[0].participants;

        const updateResult = await client.query(
            `UPDATE messages
       SET is_read = TRUE
       WHERE conversation_id = $1 AND receiver_id = $2 AND is_read = FALSE
       RETURNING id`,
            [conversationId, userId]
        );

        // --- WebSocket Emission for Read Receipts ---
        if (updateResult.rows.length > 0) {
            const messageIdsMarkedRead = updateResult.rows.map(row => row.id);
            for (const participantId of conversationParticipants) {
                const sockets = connectedUsers.get(participantId);
                if (sockets) {
                    sockets.forEach(socketId => {
                        io.to(socketId).emit('messagesRead', {
                            conversationId: conversationId,
                            readerId: userId,
                            messageIds: messageIdsMarkedRead
                        });
                        console.log(`Emitted 'messagesRead' to ${participantId} (socket: ${socketId}) for conversation ${conversationId}`);
                    });
                }
            }
        }

    } catch (error) {
        console.error('Error marking messages as read:', error);
        throw new Error('Failed to mark messages as read.');
    } finally {
        if (client) {
            client.release();
        }
    }
};


export const markAllMessagesAsRead = async (userId: string): Promise<void> => {
    let client: PoolClient | null = null;
    try {
        client = await pool.connect();

        const updateResult = await client.query(
            `UPDATE messages
       SET is_read = TRUE
       WHERE receiver_id = $1 AND is_read = FALSE
       RETURNING conversation_id, id`,
            [userId]
        );

        // --- WebSocket Emission for Mark All Read ---
        if (updateResult.rows.length > 0) {
            const conversationsAffected = new Map<string, string[]>();
            updateResult.rows.forEach(row => {
                if (!conversationsAffected.has(row.conversation_id)) {
                    conversationsAffected.set(row.conversation_id, []);
                }
                conversationsAffected.get(row.conversation_id)!.push(row.id);
            });

            for (const [convId, msgIds] of conversationsAffected.entries()) {
                const userSockets = connectedUsers.get(userId);
                if (userSockets) {
                    userSockets.forEach(socketId => {
                        io.to(socketId).emit('messagesRead', {
                            conversationId: convId,
                            readerId: userId,
                            messageIds: msgIds
                        });
                    });
                }

            }
            console.log(`Emitted 'messagesRead' for multiple conversations marked as read by user ${userId}.`);
        }

    } catch (error) {
        console.error('Error marking all messages as read:', error);
        throw new Error('Failed to mark all messages as read.');
    } finally {
        if (client) {
            client.release();
        }
    }
};