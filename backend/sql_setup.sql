-- ============================================
-- KMUTT Teaching Assessment System Database
-- ============================================

-- 1. Users Table (แล้วมี ให้ปรับปรุง)
CREATE TABLE IF NOT EXISTS users (
  id BIGINT PRIMARY KEY GENERATED ALWAYS AS IDENTITY,
  student_id VARCHAR(20) UNIQUE NOT NULL,
  password VARCHAR(255) NOT NULL,
  email VARCHAR(255) UNIQUE,
  first_name VARCHAR(255),
  last_name VARCHAR(255),
  twofa_secret VARCHAR(255),
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- 2. Instructors Table (ข้อมูลอาจารย์)
CREATE TABLE IF NOT EXISTS instructors (
  id BIGINT PRIMARY KEY GENERATED ALWAYS AS IDENTITY,
  instructor_name_th VARCHAR(255) NOT NULL,
  instructor_name_en VARCHAR(255),
  email VARCHAR(255) UNIQUE,
  phone VARCHAR(20),
  department VARCHAR(255),
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- 3. Subjects Table (ข้อมูลรายวิชา)
CREATE TABLE IF NOT EXISTS subjects (
  id BIGINT PRIMARY KEY GENERATED ALWAYS AS IDENTITY,
  subject_code VARCHAR(20) UNIQUE NOT NULL,
  subject_name_th VARCHAR(255) NOT NULL,
  subject_name_en VARCHAR(255),
  credits INT,
  semester INT NOT NULL, -- 1 or 2
  academic_year INT NOT NULL, -- 2568, 2567, etc.
  department VARCHAR(255),
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- 4. Subject Instructors Table (เชื่อมระหว่าง subjects และ instructors)
CREATE TABLE IF NOT EXISTS subject_instructors (
  id BIGINT PRIMARY KEY GENERATED ALWAYS AS IDENTITY,
  subject_id BIGINT NOT NULL REFERENCES subjects(id) ON DELETE CASCADE,
  instructor_id BIGINT NOT NULL REFERENCES instructors(id) ON DELETE CASCADE,
  created_at TIMESTAMP DEFAULT NOW(),
  UNIQUE(subject_id, instructor_id)
);

-- 5. Enrollments Table (ลงทะเบียนเรียน)
CREATE TABLE IF NOT EXISTS enrollments (
  id BIGINT PRIMARY KEY GENERATED ALWAYS AS IDENTITY,
  student_id BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  subject_id BIGINT NOT NULL REFERENCES subjects(id) ON DELETE CASCADE,
  semester INT NOT NULL,
  academic_year INT NOT NULL,
  enrolled_at TIMESTAMP DEFAULT NOW(),
  created_at TIMESTAMP DEFAULT NOW(),
  UNIQUE(student_id, subject_id, semester, academic_year)
);

-- 6. Evaluations/Assessments Table (ประเมินการสอน)
CREATE TABLE IF NOT EXISTS evaluations (
  id BIGINT PRIMARY KEY GENERATED ALWAYS AS IDENTITY,
  student_id BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  instructor_id BIGINT NOT NULL REFERENCES instructors(id) ON DELETE CASCADE,
  subject_id BIGINT NOT NULL REFERENCES subjects(id) ON DELETE CASCADE,
  semester INT NOT NULL,
  academic_year INT NOT NULL,
  -- Evaluation Score Fields
  score_teaching_quality INT, -- 1-5
  score_instructor_knowledge INT, -- 1-5
  score_communication INT, -- 1-5
  score_student_engagement INT, -- 1-5
  score_assessment INT, -- 1-5
  comments TEXT,
  status VARCHAR(50) DEFAULT 'pending', -- pending, submitted, completed
  submitted_at TIMESTAMP,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),
  UNIQUE(student_id, instructor_id, subject_id, semester, academic_year)
);

-- 7. OTP Codes Table (สำหรับ 2FA ของการประเมิน)
CREATE TABLE IF NOT EXISTS otp_codes (
  id BIGINT PRIMARY KEY GENERATED ALWAYS AS IDENTITY,
  email VARCHAR(255) NOT NULL,
  otp VARCHAR(6) NOT NULL,
  is_used BOOLEAN DEFAULT FALSE,
  expires_at TIMESTAMP NOT NULL,
  created_at TIMESTAMP DEFAULT NOW(),
  UNIQUE(email, is_used, expires_at)
);

-- ============================================
-- Indexes for better query performance
-- ============================================
CREATE INDEX IF NOT EXISTS idx_users_student_id ON users(student_id);
CREATE INDEX IF NOT EXISTS idx_subjects_code ON subjects(subject_code);
CREATE INDEX IF NOT EXISTS idx_subjects_semester_year ON subjects(semester, academic_year);
CREATE INDEX IF NOT EXISTS idx_enrollments_student ON enrollments(student_id);
CREATE INDEX IF NOT EXISTS idx_enrollments_subject ON enrollments(subject_id);
CREATE INDEX IF NOT EXISTS idx_evaluations_student ON evaluations(student_id);
CREATE INDEX IF NOT EXISTS idx_evaluations_instructor ON evaluations(instructor_id);
CREATE INDEX IF NOT EXISTS idx_evaluations_subject ON evaluations(subject_id);
CREATE INDEX IF NOT EXISTS idx_evaluations_status ON evaluations(status);
CREATE INDEX IF NOT EXISTS idx_otp_student ON otp_codes(student_id);
CREATE INDEX IF NOT EXISTS idx_otp_expires ON otp_codes(expires_at);

-- ============================================
-- Sample Data for Testing
-- ============================================

-- Insert sample instructors
INSERT INTO instructors (instructor_name_th, instructor_name_en, email, department)
VALUES 
  ('อาจารย์ดังสัม ปิ่นธิพ', 'Dr. Dungsam Pinthip', 'dungsam@kmutt.ac.th', 'Computer Engineering'),
  ('อาจารย์ Mosiur Rahaman', 'Dr. Mosiur Rahaman', 'mosiur@kmutt.ac.th', 'Computer Engineering'),
  ('อาจารย์ดร.พิมพ์วรา วัฒนวิลาสา', 'Dr. Pimwara Wattanavilas', 'pimwara@kmutt.ac.th', 'General Studies')
ON CONFLICT DO NOTHING;

-- Insert sample subjects
INSERT INTO subjects (subject_code, subject_name_th, subject_name_en, credits, semester, academic_year, department)
VALUES 
  ('CPE 393', 'หัวข้อพิเศษที่ 3: พื้นฐานความปลอดภัยไซเบอร์', 'SPECIAL TOPIC III: FUNDAMENTALS OF CYBERSECURITY', 3, 1, 2568, 'Computer Engineering'),
  ('GEN 412', 'ศาสตร์และศิลป์ของการมีชีวิตและการทำงาน', 'SCIENCE AND ART OF LIVING AND WORKING', 2, 1, 2568, 'General Studies')
ON CONFLICT DO NOTHING;

-- Insert sample users for testing
INSERT INTO users (student_id, password, email, first_name, last_name)
VALUES 
  ('65070507212', 'password123', 'student1@kmutt.ac.th', 'นกศึกษา', 'ทดสอบ')
ON CONFLICT DO NOTHING;

-- Insert sample enrollments (link students to subjects)
INSERT INTO enrollments (student_id, subject_id, semester, academic_year)
SELECT 
  u.id,
  s.id,
  1,
  2568
FROM users u
CROSS JOIN subjects s
WHERE u.student_id = '65070507212'
  AND s.semester = 1
  AND s.academic_year = 2568
ON CONFLICT DO NOTHING;

-- Insert subject instructors (many-to-many relationship)
INSERT INTO subject_instructors (subject_id, instructor_id)
SELECT s.id, i.id
FROM subjects s
CROSS JOIN instructors i
WHERE (s.subject_code = 'CPE 393' AND i.instructor_name_th IN ('อาจารย์ดังสัม ปิ่นธิพ', 'อาจารย์ Mosiur Rahaman'))
   OR (s.subject_code = 'GEN 412' AND i.instructor_name_th = 'อาจารย์ดร.พิมพ์วรา วัฒนวิลาสา')
ON CONFLICT DO NOTHING;

-- Insert sample evaluations (for testing)
INSERT INTO evaluations (student_id, instructor_id, subject_id, semester, academic_year, score_teaching_quality, score_instructor_knowledge, score_communication, score_student_engagement, score_assessment, comments, status, submitted_at)
SELECT 
  u.id,
  i.id,
  s.id,
  1,
  2568,
  5,
  5,
  4,
  5,
  4,
  'อาจารย์สอนดีมากค่ะ',
  'completed',
  NOW()
FROM users u
CROSS JOIN subjects s
CROSS JOIN instructors i
CROSS JOIN subject_instructors si
WHERE u.student_id = '65070507212'
  AND s.semester = 1
  AND s.academic_year = 2568
  AND si.subject_id = s.id
  AND si.instructor_id = i.id
ON CONFLICT DO NOTHING;
