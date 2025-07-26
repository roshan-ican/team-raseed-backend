import { v4 as uuidv4 } from "uuid";
import { allModel } from "../services/userPrompt";
import NodeCache from "node-cache";

// In-memory cache: key = userId
const chatCache = new NodeCache({ stdTTL: 3600 }); // TTL = 1 hour

export async function getOrCreateChatSession({
  userId,
  question,
  chatId,
  type,
}: {
  userId: string;
  question: string;
  chatId?: string;
  type?: "user" | "bot";
}): Promise<{
  userId: string;
  chatId: string;
  chatName: string;
  startedAt: Date;
  lastActive: Date;
  history: {
    type: "user" | "bot";
    context: string;
    timestamp: Date;
  }[];
}> {
  const now = new Date();

  // Generate new chatId if missing
  const effectiveChatId = chatId ?? uuidv4().toString();
  
  const existing = chatCache.get<{
    userId: string;
    chatId: string;
    chatName: string;
    startedAt: Date;
    history: {
      type: "user" | "bot";
      context: string;
      timestamp: Date;
    }[];
    lastActive: Date;
  }>(effectiveChatId);

  // if not existing = new chat
  if (!existing) {
    // const chatId = uuidv4().toString();
    const chatName =
      (await generateChatName(question)) ||
      `newchat-${Math.floor(Math.random() * 10000)}`; // Your existing function
    chatCache.set(effectiveChatId, {
      userId,
      chatId: effectiveChatId,
      chatName,
      startedAt: now,
      lastActive: now,
      history: [
        // { type, context: question, timestamp: now }
      ],
    });

    return {
      userId,
      chatId: effectiveChatId,
      chatName,
      startedAt: now,
      lastActive: now,
      history: [
        // { type, context: question, timestamp: now }
      ],
    };
  }

  existing.lastActive = now;
  return {
    userId: existing.userId,
    chatId: existing.chatId,
    chatName: existing.chatName,
    startedAt: existing.startedAt,
    history: existing.history,
    lastActive: now
  };
}

export const generateChatName = async (prompt: string) => {
  try {
    const namePrompt = `Give a short, clear name for a chat where the user asked: "${prompt}". Don't give options, give one name only`;
    const nameResult = await allModel.generateContent(namePrompt);
    const nameResponse = await nameResult.response;
    const chatName = nameResponse.text().trim();

    return chatName;
  } catch (error) {
    return null;
  }
};

//////////////////////////////////////////////////////////////////
// ADD TO CHAT HISTORY
//////////////////////////////////////////////////////////////////
export function addToChatHistory({
  chatId,
  question,
  type,
}: {
  chatId?: string;
  question?: string;
  type:  "user" | "bot";
}) {
   if(chatId === undefined || chatId === null) chatId = "";
  const chat = chatCache.get<{
    userId: string;
    chatId: string;
    chatName: string;
    startedAt: Date;
    history: {
      type: "user" | "bot";
      context: string;
      timestamp: Date;
    }[];
    lastActive: Date;
  }>(chatId);
  if (!chat) return {status: false, chat: null};

  const timestamp = new Date();
  if (question) chat.history.push({ type, context: question, timestamp });

  chat.lastActive = timestamp;
  chatCache.set(chatId, chat);

  return {status: true, chat: chat};
}

//////////////////////////////////////////////////////////////////
// DELETE CHAT FROM CACHE
//////////////////////////////////////////////////////////////////
export function deleteChatFromCache(chatId: string) {
  const existed = chatCache.del(chatId);
  if (existed) {
    console.log(`🗑️ Deleted chat with ID ${chatId} from cache.`);
    return true;
  } else {
    console.warn(`⚠️ Chat with ID ${chatId} not found in cache.`);
    return false;
  }
}
