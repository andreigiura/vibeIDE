import { useLoaderData, useNavigate, useSearchParams } from '@remix-run/react';
import { useState, useEffect, useCallback } from 'react';
import { atom } from 'nanostores';
import { generateId, type JSONValue, type Message } from 'ai';
import { toast } from 'react-toastify';
import { workbenchStore } from '~/lib/stores/workbench';
import { logStore } from '~/lib/stores/logs'; // Import logStore
import {
  getMessages,
  getNextId,
  getUrlId,
  openDatabase,
  setMessages,
  duplicateChat,
  createChatFromMessages,
  type IChatMetadata,
} from './db';
import type { FileMap } from '~/lib/stores/files';
import type { Snapshot } from './types';
import { webcontainer } from '~/lib/webcontainer';
import { createCommandsMessage, detectProjectCommands } from '~/utils/projectCommands';
import type { ContextAnnotation } from '~/types/context';
import { netlifyConnection } from '~/lib/stores/netlify';

export interface ChatHistoryItem {
  id: string;
  urlId?: string;
  description?: string;
  messages: Message[];
  timestamp: string;
  metadata?: IChatMetadata;
}

const persistenceEnabled = !import.meta.env.VITE_DISABLE_PERSISTENCE;

export const db = persistenceEnabled ? await openDatabase() : undefined;

export const chatId = atom<string | undefined>(undefined);
export const description = atom<string | undefined>(undefined);
export const chatMetadata = atom<IChatMetadata | undefined>(undefined);
export function useChatHistory() {
  const navigate = useNavigate();
  const { id: mixedId } = useLoaderData<{ id?: string }>();
  const [searchParams] = useSearchParams();

  const [archivedMessages, setArchivedMessages] = useState<Message[]>([]);
  const [initialMessages, setInitialMessages] = useState<Message[]>([]);
  const [ready, setReady] = useState<boolean>(false);
  const [urlId, setUrlId] = useState<string | undefined>();

  useEffect(() => {
    if (!db) {
      setReady(true);

      if (persistenceEnabled) {
        const error = new Error('Chat persistence is unavailable');
        logStore.logError('Chat persistence initialization failed', error);
        toast.error('Chat persistence is unavailable');
      }

      return;
    }

    if (mixedId) {
      getMessages(db, mixedId)
        .then(async (storedMessages) => {
          if (storedMessages && storedMessages.messages.length > 0) {
            const snapshotStr = localStorage.getItem(`snapshot:${mixedId}`);
            const snapshot: Snapshot = snapshotStr ? JSON.parse(snapshotStr) : { chatIndex: 0, files: {} };
            const summary = snapshot.summary;

            const rewindId = searchParams.get('rewindTo');
            let startingIdx = -1;
            const endingIdx = rewindId
              ? storedMessages.messages.findIndex((m) => m.id === rewindId) + 1
              : storedMessages.messages.length;
            const snapshotIndex = storedMessages.messages.findIndex((m) => m.id === snapshot.chatIndex);

            if (snapshotIndex >= 0 && snapshotIndex < endingIdx) {
              startingIdx = snapshotIndex;
            }

            if (snapshotIndex > 0 && storedMessages.messages[snapshotIndex].id == rewindId) {
              startingIdx = -1;
            }

            let filteredMessages = storedMessages.messages.slice(startingIdx + 1, endingIdx);
            let newArchivedMessages: Message[] = [];

            if (startingIdx >= 0) {
              newArchivedMessages = storedMessages.messages.slice(0, startingIdx + 1);
            }

            setArchivedMessages(newArchivedMessages);

            if (startingIdx > 0) {
              const files = Object.entries(snapshot?.files || {})
                .map(([key, value]) => {
                  if (value?.type !== 'file') {
                    return null;
                  }

                  return {
                    content: value.content,
                    path: key,
                  };
                })
                .filter((x) => !!x);
              const projectCommands = await detectProjectCommands(files);
              const commands = createCommandsMessage(projectCommands);

              filteredMessages = [
                {
                  id: generateId(),
                  role: 'user',
                  content: `Restore project from snapshot
                  `,
                  annotations: ['no-store', 'hidden'],
                },
                {
                  id: storedMessages.messages[snapshotIndex].id,
                  role: 'assistant',
                  content: ` 📦 Chat Restored from snapshot, You can revert this message to load the full chat history
                  <boltArtifact id="imported-files" title="Project Files Snapshot" type="bundled">
                  ${Object.entries(snapshot?.files || {})
                    .filter((x) => !x[0].endsWith('lock.json'))
                    .map(([key, value]) => {
                      if (value?.type === 'file') {
                        return `
                      <boltAction type="file" filePath="${key}">
${value.content}
                      </boltAction>
                      `;
                      } else {
                        return ``;
                      }
                    })
                    .join('\n')}
                  </boltArtifact>
                  `,
                  annotations: [
                    'no-store',
                    ...(summary
                      ? [
                          {
                            chatId: storedMessages.messages[snapshotIndex].id,
                            type: 'chatSummary',
                            summary,
                          } satisfies ContextAnnotation,
                        ]
                      : []),
                  ],
                },
                ...(commands !== null
                  ? [
                      {
                        id: `${storedMessages.messages[snapshotIndex].id}-2`,
                        role: 'user' as const,
                        content: `setup project`,
                        annotations: ['no-store', 'hidden'],
                      },
                      {
                        ...commands,
                        id: `${storedMessages.messages[snapshotIndex].id}-3`,
                        annotations: [
                          'no-store',
                          ...(commands.annotations || []),
                          ...(summary
                            ? [
                                {
                                  chatId: `${storedMessages.messages[snapshotIndex].id}-3`,
                                  type: 'chatSummary',
                                  summary,
                                } satisfies ContextAnnotation,
                              ]
                            : []),
                        ],
                      },
                    ]
                  : []),
                ...filteredMessages,
              ];
              restoreSnapshot(mixedId);
            }

            setInitialMessages(filteredMessages);

            setUrlId(storedMessages.urlId);
            description.set(storedMessages.description);
            chatId.set(storedMessages.id);
            chatMetadata.set(storedMessages.metadata);
          } else {
            navigate('/', { replace: true });
          }

          setReady(true);
        })
        .catch((error) => {
          console.error(error);

          logStore.logError('Failed to load chat messages', error);
          toast.error(error.message);
        });
    }
  }, [mixedId]);

  const takeSnapshot = useCallback(
    async (chatIdx: string, files: FileMap, _chatId?: string | undefined, chatSummary?: string) => {
      const id = _chatId || chatId;

      if (!id) {
        return;
      }

      const snapshot: Snapshot = {
        chatIndex: chatIdx,
        files,
        summary: chatSummary,
      };
      localStorage.setItem(`snapshot:${id}`, JSON.stringify(snapshot));
    },
    [chatId],
  );

  const restoreSnapshot = useCallback(async (id: string) => {
    const snapshotStr = localStorage.getItem(`snapshot:${id}`);
    const container = await webcontainer;

    // if (snapshotStr)setSnapshot(JSON.parse(snapshotStr));
    const snapshot: Snapshot = snapshotStr ? JSON.parse(snapshotStr) : { chatIndex: 0, files: {} };

    if (!snapshot?.files) {
      return;
    }

    Object.entries(snapshot.files).forEach(async ([key, value]) => {
      if (key.startsWith(container.workdir)) {
        key = key.replace(container.workdir, '');
      }

      if (value?.type === 'folder') {
        await container.fs.mkdir(key, { recursive: true });
      }
    });
    Object.entries(snapshot.files).forEach(async ([key, value]) => {
      if (value?.type === 'file') {
        if (key.startsWith(container.workdir)) {
          key = key.replace(container.workdir, '');
        }

        await container.fs.writeFile(key, value.content, { encoding: value.isBinary ? undefined : 'utf8' });
      } else {
      }
    });

    // workbenchStore.files.setKey(snapshot?.files)
  }, []);

  const getNetlifyUrl = useCallback((): string | undefined => {
    const currentChatId = chatId.get();

    if (!currentChatId) {
      return undefined;
    }

    const deployedSite = netlifyConnection
      .get()
      .stats?.sites?.find((site) => site.name.includes(`vibe-${currentChatId?.toLocaleLowerCase()}`));

    return deployedSite?.url || deployedSite?.ssl_url;
  }, []);

  const prepareExportChat = async (id = urlId): Promise<string | undefined> => {
    const currentChatId = chatId.get();

    if (!db || !currentChatId) {
      return undefined;
    }

    const persistedChat = await getMessages(db, currentChatId);

    if (!id) {
      id = persistedChat?.urlId;
    }

    if (!db || !id) {
      return undefined;
    }

    const chat = await getMessages(db, id);

    const chatData = {
      messages: chat.messages,
      description: chat.description,
      exportDate: new Date().toISOString(),
    };

    return JSON.stringify(chatData, null, 2);
  };

  const exportChat = async (id = urlId) => {
    if (!db || !id) {
      return;
    }

    const chatJson = await prepareExportChat(id);

    if (!chatJson) {
      return;
    }

    const blob = new Blob([chatJson], { type: 'application/json' });

    if (!blob) {
      return;
    }

    const url = URL.createObjectURL(blob);

    const a = document.createElement('a');
    a.href = url;
    a.download = `chat-${new Date().toISOString()}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  return {
    ready: !mixedId || ready,
    initialMessages,
    getNetlifyUrl,
    updateChatMestaData: async (metadataToSet: IChatMetadata) => {
      const id = chatId.get();
      const currentDescription = description.get();

      if (!db || !id) {
        console.warn('[updateChatMetadata] DB or Chat ID missing.');
        return;
      }

      try {
        const currentChat = await getMessages(db, id);

        if (!currentChat) {
          console.error(`[updateChatMetadata] Chat not found for ID: ${id}. Cannot update metadata.`);
          toast.error('Failed to update chat metadata: Chat not found.');

          return;
        }

        await setMessages(
          db,
          id,
          currentChat.messages,
          currentChat.urlId,
          currentDescription,
          currentChat.timestamp,
          metadataToSet,
        );
        chatMetadata.set(metadataToSet);
      } catch (error) {
        toast.error('Failed to update chat metadata');
        console.error('[updateChatMetadata] Error during save:', error);
      }
    },
    storeMessageHistory: async (messages: Message[]) => {
      if (!db) {
        console.warn('[storeMessageHistory] DB not available');
        return;
      }

      // Filter out messages marked as 'no-store' right away
      const incomingMessages = messages.filter((m) => !m.annotations?.includes('no-store'));

      // If filtering removed all messages, it might mean there's nothing new to save.
      if (incomingMessages.length === 0 && messages.length > 0) {
        // Let's return here to avoid saving an empty meaningful array
        return;
      }

      let currentChatId = chatId.get();
      let currentDescription = description.get(); // Use let as it might be updated by artifact title
      const currentMetadata = chatMetadata.get();
      let currentUrlId = urlId; // Use state variable, allow updates

      // --- Start: Handle new chat creation (ensures chatId is set) --- //
      if (initialMessages.length === 0 && !currentChatId) {
        const nextId = await getNextId();
        chatId.set(nextId);
        currentChatId = nextId; // Update local variable for this execution

        // Also try to generate and set urlId immediately if possible
        const { firstArtifact } = workbenchStore;

        if (!currentUrlId && firstArtifact?.id) {
          // Check if needed and possible
          const newUrlId = await getUrlId(db, firstArtifact.id);
          currentUrlId = newUrlId; // Update local variable

          setUrlId(newUrlId); // Update state hook
        }

        if (!currentUrlId) {
          // Fallback navigation if urlId couldn't be set
          navigateChat(nextId);
        }
      }

      // --- End: Handle new chat creation --- //

      if (!currentChatId) {
        console.error('[storeMessageHistory] No valid chatId found after checking for new chat. Aborting save.');
        toast.error('Cannot save messages: Chat ID is missing.');

        return;
      }

      // --- Start: Robust Message Handling --- //
      let finalMessagesToSave: Message[] = [];
      let persistedChat: ChatHistoryItem | null = null;
      let fetchError: Error | null = null;

      try {
        persistedChat = await getMessages(db, currentChatId);
      } catch (error) {
        fetchError = error as Error;
        console.error('[storeMessageHistory] Error fetching persisted messages:', fetchError);
      }

      const persistedMessages = persistedChat?.messages || [];

      // Core recovery logic
      if (!fetchError && incomingMessages.length < persistedMessages.length && persistedMessages.length > 0) {
        // Suspicious: incoming is shorter AND fetch succeeded.
        console.warn('[storeMessageHistory] RECOVERY TRIGGERED: Incoming shorter than persisted.');

        const lastPersistedId = persistedMessages[persistedMessages.length - 1].id;
        const lastPersistedIndexInIncoming = incomingMessages.findIndex((m) => m.id === lastPersistedId);
        let newMessages: Message[] = [];

        if (lastPersistedIndexInIncoming !== -1) {
          newMessages = incomingMessages.slice(lastPersistedIndexInIncoming + 1);
        } else {
          console.warn(
            '[storeMessageHistory] Recovery: Last persisted ID not found in incoming. Appending ALL incoming messages as new.',
          );
          newMessages = incomingMessages; // Append all incoming as they might be a new branch
        }

        finalMessagesToSave = [...archivedMessages, ...persistedMessages, ...newMessages];
      } else {
        // Incoming seems valid OR fetch failed (in which case we trust incoming)
        if (fetchError) {
          console.warn('[storeMessageHistory] Using incoming messages because fetching persisted messages failed.');
        }

        finalMessagesToSave = [...archivedMessages, ...incomingMessages];
      }

      // Ensure no duplicates from joining archived + rest (simple check)
      if (finalMessagesToSave.length > 0) {
        const uniqueMessages = finalMessagesToSave.reduce((acc, current) => {
          if (!acc.some((item) => item.id === current.id)) {
            acc.push(current);
          }

          return acc;
        }, [] as Message[]);

        if (uniqueMessages.length < finalMessagesToSave.length) {
          console.warn('[storeMessageHistory] Removed duplicate message IDs during final save prep.');
          finalMessagesToSave = uniqueMessages;
        }
      }

      // --- End: Robust Message Handling --- //

      // --- Start: Snapshot Logic (Run AFTER determining finalMessagesToSave) --- //
      if (finalMessagesToSave.length > archivedMessages.length) {
        // Ensure there's at least one non-archived message
        const { firstArtifact } = workbenchStore;

        // Attempt to set description from artifact title IF description is currently unset
        if (!currentDescription && firstArtifact?.title) {
          description.set(firstArtifact.title);
          currentDescription = description.get(); // Update local variable for save
        }

        // Ensure urlId is set if possible (might have been set during new chat creation)
        if (!currentUrlId && firstArtifact?.id && currentChatId === firstArtifact.id) {
          // Re-check generation condition more specific
          const newUrlId = await getUrlId(db, firstArtifact.id);
          currentUrlId = newUrlId;

          setUrlId(newUrlId);
        }

        const lastMessageToSave = finalMessagesToSave[finalMessagesToSave.length - 1];
        let chatSummary: string | undefined = undefined;

        if (lastMessageToSave.role === 'assistant') {
          const annotations = lastMessageToSave.annotations as JSONValue[];
          const filteredAnnotations = (annotations?.filter(
            (annotation: JSONValue) =>
              annotation && typeof annotation === 'object' && Object.keys(annotation).includes('type'),
          ) || []) as { type: string; value: any; summary?: string; [key: string]: any }[]; // Added summary type hint
          const summaryAnnotation = filteredAnnotations.find((annotation) => annotation.type === 'chatSummary');

          if (summaryAnnotation) {
            chatSummary = summaryAnnotation.summary;
          }
        }

        if (currentUrlId) {
          // Check if urlId is available before taking snapshot
          takeSnapshot(lastMessageToSave.id, workbenchStore.files.get(), currentUrlId, chatSummary);
        } else {
          console.warn('[storeMessageHistory] Cannot take snapshot without urlId.');
        }
      }

      // --- End: Snapshot Logic --- //

      await setMessages(
        db,
        currentChatId,
        finalMessagesToSave, // Use the robustly determined array
        currentUrlId,
        currentDescription,
        undefined, // Timestamp handled by setMessages
        currentMetadata, // Read earlier
      );
    },
    duplicateCurrentChat: async (listItemId: string) => {
      if (!db || (!mixedId && !listItemId)) {
        return;
      }

      try {
        const newId = await duplicateChat(db, mixedId || listItemId);
        navigate(`/chat/${newId}`);
        toast.success('Chat duplicated successfully');
      } catch (error) {
        toast.error('Failed to duplicate chat');
      }
    },
    importChat: async (description: string, messages: Message[], metadata?: IChatMetadata) => {
      if (!db) {
        return;
      }

      try {
        const newId = await createChatFromMessages(db, description, messages, metadata);
        window.location.href = `/chat/${newId}`;
        toast.success('Chat imported successfully');
      } catch (error) {
        if (error instanceof Error) {
          toast.error('Failed to import chat: ' + error.message);
        } else {
          toast.error('Failed to import chat');
        }
      }
    },
    prepareExportChat,
    exportChat,
  };
}

function navigateChat(nextId: string) {
  /**
   * FIXME: Using the intended navigate function causes a rerender for <Chat /> that breaks the app.
   *
   * `navigate(`/chat/${nextId}`, { replace: true });`
   */
  const url = new URL(window.location.href);
  url.pathname = `/chat/${nextId}`;

  window.history.replaceState({}, '', url);
}
