-- CineMatch: real-time couple recommendation sessions
CREATE TABLE match_sessions (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  code         char(6) NOT NULL UNIQUE,
  leader_id    uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  partner_id   uuid REFERENCES profiles(id) ON DELETE SET NULL,
  status       text NOT NULL DEFAULT 'waiting'
               CHECK (status IN ('waiting', 'active', 'matched', 'ended')),
  current_movie jsonb,
  leader_vote  text CHECK (leader_vote IN ('yes', 'no')),
  partner_vote text CHECK (partner_vote IN ('yes', 'no')),
  shown_ids    int[] NOT NULL DEFAULT '{}',
  created_at   timestamptz DEFAULT now()
);

ALTER TABLE match_sessions ENABLE ROW LEVEL SECURITY;

-- Anyone authenticated can read a waiting session (needed to join by code)
CREATE POLICY "match_read" ON match_sessions FOR SELECT TO authenticated
  USING (
    auth.uid() = leader_id OR
    auth.uid() = partner_id OR
    (status = 'waiting' AND partner_id IS NULL)
  );

-- Only leader can insert
CREATE POLICY "match_insert" ON match_sessions FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = leader_id);

-- Leader can always update; partner can update their vote;
-- unmatched person can join (set themselves as partner)
CREATE POLICY "match_update" ON match_sessions FOR UPDATE TO authenticated
  USING (
    auth.uid() = leader_id OR
    auth.uid() = partner_id OR
    (partner_id IS NULL AND status = 'waiting')
  )
  WITH CHECK (
    auth.uid() = leader_id OR
    auth.uid() = partner_id
  );

CREATE POLICY "match_delete" ON match_sessions FOR DELETE TO authenticated
  USING (auth.uid() = leader_id);

-- Enable realtime for this table
ALTER PUBLICATION supabase_realtime ADD TABLE match_sessions;
