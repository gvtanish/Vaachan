-- Supabase Schema for Vaachan Reading Fluency Platform

-- Enable UUID extension if not enabled
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- PROFILES (Admin / Teacher details linked to Auth users)
CREATE TABLE public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  role TEXT NOT NULL CHECK (role IN ('admin', 'teacher')),
  name TEXT NOT NULL,
  employee_id TEXT UNIQUE,
  phone TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Enable RLS on profiles
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

-- Classes table (3A to 5E)
CREATE TABLE public.classes (
  id SERIAL PRIMARY KEY,
  class_num INT NOT NULL CHECK (class_num BETWEEN 3 AND 5),
  section CHAR(1) NOT NULL CHECK (section IN ('A','B','C','D','E')),
  teacher_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL, -- class teacher allotment
  UNIQUE(class_num, section)
);

ALTER TABLE public.classes ENABLE ROW LEVEL SECURITY;

-- Subject teachers allotment
CREATE TABLE public.class_subject_teachers (
  class_id INT REFERENCES public.classes(id) ON DELETE CASCADE,
  subject TEXT NOT NULL,
  teacher_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE,
  PRIMARY KEY (class_id, subject)
);

ALTER TABLE public.class_subject_teachers ENABLE ROW LEVEL SECURITY;

-- Students table
CREATE TABLE public.students (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  class_id INT NOT NULL REFERENCES public.classes(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  roll_no TEXT NOT NULL,
  gender CHAR(1) CHECK (gender IN ('M','F','O')),
  dob DATE,
  guardian_name TEXT,
  guardian_phone TEXT,
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(class_id, roll_no)
);

ALTER TABLE public.students ENABLE ROW LEVEL SECURITY;

-- Passages Table
CREATE TABLE public.passages (
  id SERIAL PRIMARY KEY,
  class_num INT NOT NULL CHECK (class_num BETWEEN 3 AND 5),
  lang TEXT NOT NULL CHECK (lang IN ('english','hindi')),
  title TEXT NOT NULL,
  text TEXT NOT NULL,
  cwpm_lo INT NOT NULL,
  cwpm_hi INT NOT NULL,
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE public.passages ENABLE ROW LEVEL SECURITY;

-- Sessions / Fluency checks Table
CREATE TABLE public.sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  student_id UUID NOT NULL REFERENCES public.students(id) ON DELETE CASCADE,
  teacher_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE RESTRICT,
  passage_id INT NOT NULL REFERENCES public.passages(id) ON DELETE RESTRICT,
  lang TEXT NOT NULL CHECK (lang IN ('english','hindi')),
  session_date DATE NOT NULL DEFAULT CURRENT_DATE,
  duration_sec NUMERIC(6,1),
  cwpm NUMERIC(5,1),
  accuracy_pct NUMERIC(5,2),
  accuracy_score NUMERIC(4,2),
  speed_score   NUMERIC(4,2),
  phrasing_score NUMERIC(4,2),
  expression_score NUMERIC(4,2),
  overall_score NUMERIC(4,2),
  naep_level    INT CHECK (naep_level BETWEEN 1 AND 4),
  grade         TEXT,
  transcript    TEXT,
  diff_json     JSONB,
  teacher_notes TEXT,
  hesitation_count INT DEFAULT 0,
  created_at    TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE public.sessions ENABLE ROW LEVEL SECURITY;

-- Audit Logs Table
CREATE TABLE public.audit_log (
  id BIGSERIAL PRIMARY KEY,
  user_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  action TEXT NOT NULL,
  details JSONB,
  created_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE public.audit_log ENABLE ROW LEVEL SECURITY;


--------------------------------------------------------------------------------
-- ROW LEVEL SECURITY (RLS) POLICIES
--------------------------------------------------------------------------------

-- Helper function to check if the current auth user is an admin
CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS BOOLEAN AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM public.profiles
    WHERE id = auth.uid() AND role = 'admin'
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Profiles Policies
CREATE POLICY "Public read for profiles" ON public.profiles
  FOR SELECT USING (true);

CREATE POLICY "Admin can update profiles" ON public.profiles
  FOR ALL TO authenticated USING (public.is_admin()) WITH CHECK (public.is_admin());

CREATE POLICY "Users can update their own phone or name" ON public.profiles
  FOR UPDATE TO authenticated
  USING (id = auth.uid())
  WITH CHECK (id = auth.uid());

-- Classes Policies
CREATE POLICY "Public classes read" ON public.classes
  FOR SELECT USING (true);

CREATE POLICY "Admin manage classes" ON public.classes
  FOR ALL TO authenticated USING (public.is_admin()) WITH CHECK (public.is_admin());

-- Class Subject Teachers Policies
CREATE POLICY "Public subject teachers read" ON public.class_subject_teachers
  FOR SELECT USING (true);

CREATE POLICY "Admin manage subject teachers" ON public.class_subject_teachers
  FOR ALL TO authenticated USING (public.is_admin()) WITH CHECK (public.is_admin());

-- Students Policies
CREATE POLICY "All authenticated users read students" ON public.students
  FOR SELECT TO authenticated USING (true);

CREATE POLICY "Admin manage students" ON public.students
  FOR ALL TO authenticated USING (public.is_admin()) WITH CHECK (public.is_admin());

-- Passages Policies
CREATE POLICY "All users read passages" ON public.passages
  FOR SELECT USING (true);

CREATE POLICY "Admin manage passages" ON public.passages
  FOR ALL TO authenticated USING (public.is_admin()) WITH CHECK (public.is_admin());

-- Sessions Policies
CREATE POLICY "All authenticated users read sessions" ON public.sessions
  FOR SELECT TO authenticated USING (true);

CREATE POLICY "Teachers can insert sessions" ON public.sessions
  FOR INSERT TO authenticated WITH CHECK (teacher_id = auth.uid());

CREATE POLICY "Teachers can update/delete their own sessions" ON public.sessions
  FOR ALL TO authenticated
  USING (teacher_id = auth.uid())
  WITH CHECK (teacher_id = auth.uid());

CREATE POLICY "Admin manage all sessions" ON public.sessions
  FOR ALL TO authenticated USING (public.is_admin()) WITH CHECK (public.is_admin());

-- Audit Log Policies
CREATE POLICY "Admin view logs" ON public.audit_log
  FOR SELECT TO authenticated USING (public.is_admin());

CREATE POLICY "Users insert logs" ON public.audit_log
  FOR INSERT TO authenticated WITH CHECK (user_id = auth.uid());


--------------------------------------------------------------------------------
-- DEFAULT DATA SEEDING
--------------------------------------------------------------------------------

-- Trigger to automatically create a profile after auth signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (id, name, role, employee_id)
  VALUES (
    new.id,
    COALESCE(new.raw_user_meta_data->>'name', 'New Teacher'),
    COALESCE(new.raw_user_meta_data->>'role', 'teacher'),
    new.raw_user_meta_data->>'employee_id'
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE OR REPLACE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- Seed standard classes (3A-E, 4A-E, 5A-E)
-- Run this block once classes table is created:
DO $$
DECLARE
  c int;
  sec text;
BEGIN
  FOR c IN 3..5 LOOP
    FOR sec IN SELECT unnest(ARRAY['A','B','C','D','E']) LOOP
      INSERT INTO public.classes (class_num, section)
      VALUES (c, sec)
      ON CONFLICT (class_num, section) DO NOTHING;
    END LOOP;
  END LOOP;
END $$;

-- Seed initial passages (taken from original code)
INSERT INTO public.passages (class_num, lang, title, text, cwpm_lo, cwpm_hi) VALUES
(3, 'english', 'Chintu the Squirrel', 'Once there was a little squirrel named Chintu. He lived in a big oak tree in the park. Every morning, Chintu jumped from branch to branch, looking for nuts. One day, he found a shiny red apple on the ground. He was very happy. Chintu carried the apple up to his nest. He shared it with his friend, a small bird named Mithu. They ate the apple together and became the best of friends.', 45, 70),
(3, 'hindi', 'चिंटू गिलहरी', 'एक बार की बात है, चिंटू नाम की एक छोटी गिलहरी पार्क के एक बड़े पेड़ पर रहती थी। हर सुबह चिंटू एक डाल से दूसरी डाल पर कूदती और मेवे ढूंढती थी। एक दिन उसे जमीन पर एक चमकीला लाल सेब मिला। वह बहुत खुश हुई। चिंटू सेब को अपने घोंसले तक ले गई। उसने वह सेब अपनी दोस्त, मिठू नाम की एक छोटी चिड़िया के साथ बाँटा। दोनों ने मिलकर सेब खाया और अच्छे दोस्त बन गए।', 40, 65),
(4, 'english', 'A Story on a Rainy Night', 'Meera loved rainy days more than anything else. Every time dark clouds gathered in the sky, she would run to the window and watch the raindrops race down the glass. One evening, the rain grew very heavy, and the lights in her house suddenly went out. Meera was scared for a moment, but her grandmother lit a candle and sat beside her. Grandmother told an old story about a brave little boat that sailed through a stormy river to save its village. Meera listened closely, forgetting all about the darkness. When the lights finally came back, she smiled and said that stories were brighter than any lamp. From that night, Meera always asked for a story whenever it rained.', 60, 90),
(4, 'hindi', 'बारिश की एक रात की कहानी', 'मीरा को बारिश के दिन सबसे ज्यादा पसंद थे। जब भी आसमान में काले बादल छा जाते, वह खिड़की के पास दौड़ जाती और शीशे पर गिरती बूंदों को देखती रहती। एक शाम बारिश बहुत तेज हो गई और अचानक घर की बिजली चली गई। मीरा थोड़ा डर गई, लेकिन उसकी दादी ने एक मोमबत्ती जलाई और उसके पास बैठ गईं। दादी ने एक पुरानी कहानी सुनाई, जिसमें एक छोटी सी नाव तूफानी नदी को पार करके अपने गाँव को बचाती है। मीरा कहानी सुनते-सुनते अंधेरा भूल गई। जब बिजली वापस आई, तो उसने मुस्कुराकर कहा कि कहानियाँ किसी भी दीये से ज्यादा उजाला देती हैं। उस रात के बाद, मीरा जब भी बारिश होती, दादी से एक कहानी जरूर माँगती।', 55, 85),
(5, 'english', 'The Boy Who Drew on Walls', 'In a small village near the mountains, there lived a boy named Arjun who loved to draw. He had no proper paper, so he sketched on old newspapers, walls, and even in the sand near the river. The villagers often laughed and said drawing would never help him earn a living. Arjun never argued, but he never stopped drawing either. One winter, a traveller passing through the village saw Arjun''s sketches on a wall near the temple. He was amazed by the detail and life in each picture. The traveller turned out to be an art teacher from the city, and he offered Arjun a scholarship to study at a proper school. Years later, Arjun returned to his village as a well-known artist and painted a huge, colourful mural on the school wall, so every child who once laughed could learn to dream too.', 70, 110),
(5, 'hindi', 'वह लड़का जो दीवारों पर चित्र बनाता था', 'पहाड़ों के पास एक छोटे से गाँव में अर्जुन नाम का एक लड़का रहता था, जिसे चित्र बनाना बहुत पसंद था। उसके पास ठीक से कागज़ नहीं था, इसलिए वह पुराने अखबारों, दीवारों और यहाँ तक कि नदी के किनारे रेत पर भी चित्र बनाता था। गाँव वाले अक्सर हँसते और कहते कि चित्रकारी से उसका पेट कभी नहीं भरेगा। अर्जुन कभी बहस नहीं करता था, लेकिन उसने चित्र बनाना कभी नहीं छोड़ा। एक सर्दी में, गाँव से गुजर रहे एक यात्री ने मंदिर के पास दीवार पर अर्जुन के बनाए चित्र देखे। वह उनकी बारीकी और जीवंतता देखकर हैरान रह गया। वह यात्री असल में शहर का एक कला शिक्षक था, और उसने अर्जुन को एक अच्छे स्कूल में पढ़ने के लिए छात्रवृत्ति दिलवाई। कई सालों बाद, अर्जुन एक जाने-माने कलाकार बनकर अपने गाँव लौटा और स्कूल की दीवार पर एक विशाल, रंगीन चित्र बनाया, ताकि हर वह बच्चा जो कभी हँसा था, अब सपने देखना सीख सके।', 65, 100);
