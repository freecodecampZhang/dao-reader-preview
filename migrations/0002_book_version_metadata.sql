ALTER TABLE library_books ADD COLUMN dynasty TEXT NOT NULL DEFAULT '';
ALTER TABLE library_books ADD COLUMN text_form TEXT NOT NULL DEFAULT '' CHECK (text_form IN ('', '简体', '繁体'));
ALTER TABLE library_books ADD COLUMN edition_type TEXT NOT NULL DEFAULT '' CHECK (edition_type IN ('', '古籍 TXT', '校勘本', '原版影印'));
ALTER TABLE library_books ADD COLUMN base_edition TEXT NOT NULL DEFAULT '';
ALTER TABLE library_books ADD COLUMN full_text_confirmed INTEGER NOT NULL DEFAULT 0 CHECK (full_text_confirmed IN (0, 1));
ALTER TABLE library_books ADD COLUMN original_source TEXT NOT NULL DEFAULT '';
ALTER TABLE library_books ADD COLUMN public_license TEXT NOT NULL DEFAULT '';
