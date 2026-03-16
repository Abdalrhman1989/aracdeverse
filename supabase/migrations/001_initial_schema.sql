-- ArcadeVerse Initial Schema
-- Run this in your Supabase SQL editor

-- ========== PROFILES ==========
CREATE TABLE IF NOT EXISTS public.profiles (
  id           UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  username     TEXT UNIQUE,
  avatar_url   TEXT,
  total_score  BIGINT DEFAULT 0,
  games_played INT DEFAULT 0,
  created_at   TIMESTAMPTZ DEFAULT NOW(),
  updated_at   TIMESTAMPTZ DEFAULT NOW()
);

-- ========== SCORES ==========
CREATE TABLE IF NOT EXISTS public.scores (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id    UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  game_id    TEXT NOT NULL,
  score      BIGINT NOT NULL CHECK (score >= 0),
  created_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS scores_game_score_idx ON public.scores(game_id, score DESC);
CREATE INDEX IF NOT EXISTS scores_user_idx ON public.scores(user_id);

-- ========== FAVORITES ==========
CREATE TABLE IF NOT EXISTS public.favorites (
  user_id    UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  game_id    TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  PRIMARY KEY (user_id, game_id)
);

-- ========== ROOMS (online multiplayer) ==========
CREATE TABLE IF NOT EXISTS public.rooms (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  code       TEXT UNIQUE NOT NULL,
  game_id    TEXT NOT NULL,
  host_id    UUID REFERENCES public.profiles(id),
  guest_id   UUID REFERENCES public.profiles(id),
  status     TEXT DEFAULT 'waiting' CHECK (status IN ('waiting', 'playing', 'finished')),
  created_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS rooms_code_idx ON public.rooms(code);

-- ========== AUTO-CREATE PROFILE ON SIGNUP ==========
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles(id, username)
  VALUES (NEW.id, split_part(NEW.email, '@', 1))
  ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- ========== INCREMENT SCORE HELPER ==========
CREATE OR REPLACE FUNCTION public.increment_profile_score(uid UUID, pts BIGINT)
RETURNS VOID AS $$
BEGIN
  UPDATE public.profiles
  SET total_score = total_score + pts,
      games_played = games_played + 1,
      updated_at = NOW()
  WHERE id = uid;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ========== BEST SCORES VIEW ==========
CREATE OR REPLACE VIEW public.best_scores AS
SELECT DISTINCT ON (user_id, game_id)
  s.user_id, s.game_id, s.score, s.created_at,
  p.username, p.avatar_url
FROM public.scores s
JOIN public.profiles p ON s.user_id = p.id
ORDER BY user_id, game_id, score DESC;

-- ========== ROW LEVEL SECURITY ==========
ALTER TABLE public.profiles  ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.scores    ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.favorites ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.rooms     ENABLE ROW LEVEL SECURITY;

-- Profiles
DROP POLICY IF EXISTS "Public profiles readable" ON public.profiles;
CREATE POLICY "Public profiles readable" ON public.profiles FOR SELECT USING (true);
DROP POLICY IF EXISTS "Own profile updatable" ON public.profiles;
CREATE POLICY "Own profile updatable" ON public.profiles FOR UPDATE USING (auth.uid() = id);

-- Scores
DROP POLICY IF EXISTS "Scores are public" ON public.scores;
CREATE POLICY "Scores are public" ON public.scores FOR SELECT USING (true);
DROP POLICY IF EXISTS "Users insert own scores" ON public.scores;
CREATE POLICY "Users insert own scores" ON public.scores FOR INSERT WITH CHECK (auth.uid() = user_id);

-- Favorites
DROP POLICY IF EXISTS "Favorites by owner" ON public.favorites;
CREATE POLICY "Favorites by owner" ON public.favorites FOR ALL USING (auth.uid() = user_id);

-- Rooms
DROP POLICY IF EXISTS "Rooms are public" ON public.rooms;
CREATE POLICY "Rooms are public" ON public.rooms FOR SELECT USING (true);
DROP POLICY IF EXISTS "Host creates room" ON public.rooms;
CREATE POLICY "Host creates room" ON public.rooms FOR INSERT WITH CHECK (auth.uid() = host_id);
DROP POLICY IF EXISTS "Participants update room" ON public.rooms;
CREATE POLICY "Participants update room" ON public.rooms FOR UPDATE USING (auth.uid() = host_id OR auth.uid() = guest_id);

-- ========== REALTIME ==========
-- Enable realtime for rooms (for online lobby)
ALTER PUBLICATION supabase_realtime ADD TABLE public.rooms;