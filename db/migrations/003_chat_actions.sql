-- Що помічник зробив у базі за цю відповідь (для показу в чаті)
ALTER TABLE chat_messages ADD COLUMN actions_json TEXT NOT NULL DEFAULT '[]';
CREATE INDEX chat_messages_thread ON chat_messages(client_id, id);
