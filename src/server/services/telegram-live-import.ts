import "server-only";

import { writeTelegramImportContent } from "@/server/services/telegram-import-content";

type TelegramLiveMessage = {
  message_id: number;
  date?: number;
  text?: string;
  caption?: string;
  media_group_id?: string | number;
  document?: {
    file_name?: string;
    mime_type?: string;
    file_id?: string;
  };
  video?: {
    file_name?: string;
    mime_type?: string;
    duration?: number;
    file_id?: string;
  };
  audio?: {
    file_name?: string;
    mime_type?: string;
    duration?: number;
    file_id?: string;
  };
  photo?: Array<{
    file_id?: string;
  }>;
};

function getMediaDetails(message: TelegramLiveMessage) {
  if (message.document) {
    return {
      mediaType: "document",
      mimeType: message.document.mime_type ?? null,
      fileName: message.document.file_name ?? null,
      durationSeconds: null,
      mediaRefs: [message.document.file_id].filter((value): value is string => Boolean(value))
    };
  }

  if (message.video) {
    return {
      mediaType: "video",
      mimeType: message.video.mime_type ?? null,
      fileName: message.video.file_name ?? null,
      durationSeconds: message.video.duration ?? null,
      mediaRefs: [message.video.file_id].filter((value): value is string => Boolean(value))
    };
  }

  if (message.audio) {
    return {
      mediaType: "audio",
      mimeType: message.audio.mime_type ?? null,
      fileName: message.audio.file_name ?? null,
      durationSeconds: message.audio.duration ?? null,
      mediaRefs: [message.audio.file_id].filter((value): value is string => Boolean(value))
    };
  }

  if (message.photo?.length) {
    return {
      mediaType: "photo",
      mimeType: "image/jpeg",
      fileName: null,
      durationSeconds: null,
      mediaRefs: message.photo.map((entry) => entry.file_id).filter((value): value is string => Boolean(value))
    };
  }

  return {
    mediaType: null,
    mimeType: null,
    fileName: null,
    durationSeconds: null,
    mediaRefs: []
  };
}

export function buildTelegramLiveImportContent(
  message: TelegramLiveMessage,
  channelName?: string | null
) {
  const summary = message.caption?.trim() || message.text?.trim() || "Telegram channel message";
  const media = getMediaDetails(message);

  return writeTelegramImportContent({
    source: "telegram-webhook",
    channelName: channelName ?? null,
    messageId: message.message_id,
    summary,
    text: message.text?.trim() ?? null,
    caption: message.caption?.trim() ?? null,
    postedAt: typeof message.date === "number" ? new Date(message.date * 1000).toISOString() : null,
    postedAtUnix: typeof message.date === "number" ? String(message.date) : null,
    mediaType: media.mediaType,
    mimeType: media.mimeType,
    fileName: media.fileName,
    groupedId: message.media_group_id ?? null,
    durationSeconds: media.durationSeconds,
    mediaRefs: media.mediaRefs
  });
}
