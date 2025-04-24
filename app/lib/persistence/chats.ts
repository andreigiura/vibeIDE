/**
 * Functions for managing chat data in IndexedDB
 */

import type { Message } from 'ai';
import { createChatFromMessages, type IChatMetadata } from './db'; // Import IChatMetadata

export interface ChatMessage {
  id: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  timestamp: number;
}

export interface Chat {
  id: string;
  description?: string;
  messages: Message[];
  timestamp: string;
  urlId?: string;
  metadata?: IChatMetadata;
}

/**
 * Get all chats from the database
 * @param db The IndexedDB database instance
 * @returns A promise that resolves to an array of chats
 */
export async function getAllChats(db: IDBDatabase): Promise<Chat[]> {
  console.log(`getAllChats: Using database '${db.name}', version ${db.version}`);

  return new Promise((resolve, reject) => {
    try {
      const transaction = db.transaction(['chats'], 'readonly');
      const store = transaction.objectStore('chats');
      const request = store.getAll();

      request.onsuccess = () => {
        const result = request.result || [];
        console.log(`getAllChats: Found ${result.length} chats in database '${db.name}'`);
        resolve(result);
      };

      request.onerror = () => {
        console.error(`getAllChats: Error querying database '${db.name}':`, request.error);
        reject(request.error);
      };
    } catch (err) {
      console.error(`getAllChats: Error creating transaction on database '${db.name}':`, err);
      reject(err);
    }
  });
}

/**
 * Get a chat by ID
 * @param db The IndexedDB database instance
 * @param id The ID of the chat to get
 * @returns A promise that resolves to the chat or null if not found
 */
export async function getChatById(db: IDBDatabase, id: string): Promise<Chat | null> {
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(['chats'], 'readonly');
    const store = transaction.objectStore('chats');
    const request = store.get(id);

    request.onsuccess = () => {
      resolve(request.result || null);
    };

    request.onerror = () => {
      reject(request.error);
    };
  });
}

/**
 * Save a chat to the database
 * @param db The IndexedDB database instance
 * @param chat The chat to save
 * @returns A promise that resolves when the chat is saved
 */
export async function saveChat(db: IDBDatabase, chat: Chat): Promise<void> {
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(['chats'], 'readwrite');
    const store = transaction.objectStore('chats');
    const request = store.put(chat);

    request.onsuccess = () => {
      resolve();
    };

    request.onerror = () => {
      reject(request.error);
    };
  });
}

/**
 * Delete a chat by ID
 * @param db The IndexedDB database instance
 * @param id The ID of the chat to delete
 * @returns A promise that resolves when the chat is deleted
 */
export async function deleteChat(db: IDBDatabase, id: string): Promise<void> {
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(['chats'], 'readwrite');
    const store = transaction.objectStore('chats');
    const request = store.delete(id);

    request.onsuccess = () => {
      resolve();
    };

    request.onerror = () => {
      reject(request.error);
    };
  });
}

/**
 * Delete all chats
 * @param db The IndexedDB database instance
 * @returns A promise that resolves when all chats are deleted
 */
export async function deleteAllChats(db: IDBDatabase): Promise<void> {
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(['chats'], 'readwrite');
    const store = transaction.objectStore('chats');
    const request = store.clear();

    request.onsuccess = () => {
      resolve();
    };

    request.onerror = () => {
      reject(request.error);
    };
  });
}

/**
 * Imports a chat fetched based on a remixId (currently uses hardcoded data).
 * @param db The IndexedDB database instance
 * @param remixId The ID used to fetch the chat (placeholder for now)
 * @returns A promise that resolves to the imported chat object or null on error
 */
export async function importChatFromRemixId(db: IDBDatabase, remixId: string): Promise<string> {
  console.log(`importChatFromRemixId: Importing chat for remixId: ${remixId}`);

  const apiUrl = `https://tools.multiversx.com/vibe-passport/applications/${remixId}/chat`;

  try {
    const response = await fetch(apiUrl, {
      method: 'GET',
      headers: {
        Accept: 'application/json',
      },
    });

    if (!response.ok) {
      console.error(
        `importChatFromRemixId: Failed to fetch chat from API. Status: ${response.status} ${response.statusText}`,
      );

      // Attempt to read error body if available
      try {
        const errorBody = await response.json();
        console.error('API Error Body:', errorBody);
      } catch {
        // Ignore error if parsing error body fails
        console.error('Could not parse error body from failed API response.');
      }

      return '';
    }

    const fetchedData = (await response.json()) as any; // Use any for now, refine if schema is known

    // Validate fetched data structure (basic check)
    if (!fetchedData || typeof fetchedData !== 'object' || !Array.isArray(fetchedData.messages)) {
      console.error('importChatFromRemixId: Invalid data structure received from API', fetchedData);
      return '';
    }

    // Map fetched data to local Chat structure
    const newChat: Chat = {
      // Generate unique local IDs, potentially incorporating remixId to avoid collisions
      id: `imported_${remixId}_${Date.now()}`,
      urlId: `imported_${remixId}_${Date.now() + 1}`, // Ensure urlId is unique too
      description: fetchedData.description || `Imported Chat (${remixId})`, // Use fetched description or default
      timestamp: fetchedData.timestamp || new Date().toISOString(), // Use fetched timestamp or current time
      // Map messages, ensuring they fit the `Message` type from `ai`
      messages: fetchedData.messages.map((msg: any) => ({
        id: msg.id || `msg_${Date.now()}_${Math.random()}`, // Ensure each message has an ID
        role: msg.role, // Assume role matches ('user', 'assistant', etc.)
        content: msg.content,
        createdAt: msg.createdAt ? new Date(msg.createdAt) : new Date(), // Ensure createdAt is a Date object
        // Add other fields if necessary and available from API
      })),

      // metadata: fetchedData.metadata, // Add if metadata is provided by API
    };

    const urlId = createChatFromMessages(
      db,
      `${newChat.description} (remix)` || 'New APP (remix)',
      newChat.messages,
      newChat.metadata,
    );
    console.log(`importChatFromRemixId: Successfully fetched and saved chat`);

    return urlId;
  } catch (error) {
    console.error(`importChatFromRemixId: Error fetching or processing chat for remixId ${remixId}:`, error);
    return '';
  }
}
