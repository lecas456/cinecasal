CREATE TABLE swipes (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id    uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  movie_id   int  NOT NULL,
  media_type text NOT NULL CHECK (media_type IN ('movie', 'tv')),
  direction  text NOT NULL CHECK (direction IN ('like', 'dislike', 'unseen')),
  created_at timestamptz DEFAULT now(),
  UNIQUE (user_id, movie_id, media_type)
);

ALTER TABLE swipes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "swipes_own" ON swipes
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);
