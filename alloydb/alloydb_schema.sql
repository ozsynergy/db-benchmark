-- PostgreSQL Database Schema for Benchmark Project
-- Supports queries: keyword text search, lookup by email, lookup by multiple factors, aggregation (top 5 courses)

-- Note: Database creation is handled by docker-compose, we just need to create tables

-- Users table
CREATE TABLE users (
    id SERIAL PRIMARY KEY,
    email VARCHAR(255) NOT NULL UNIQUE,
    name VARCHAR(255) NOT NULL,
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

-- Index for email lookups
CREATE INDEX idx_users_email ON users(email);

-- Courses table
CREATE TABLE courses (
    id SERIAL PRIMARY KEY,
    title VARCHAR(255) NOT NULL,
    description TEXT,
    department VARCHAR(100),
    instructor_id INTEGER NOT NULL REFERENCES users(id),
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

-- Indexes for filters
CREATE INDEX idx_courses_department ON courses(department);
CREATE INDEX idx_courses_instructor_id ON courses(instructor_id);

-- Add tsvector column for optimized full-text search
ALTER TABLE courses ADD COLUMN tsv_title_description tsvector 
  GENERATED ALWAYS AS (
    to_tsvector('english', COALESCE(title, '') || ' ' || COALESCE(description, ''))
  ) STORED;

-- GIN index for full-text search (much faster than trigram similarity)
CREATE INDEX idx_courses_fts ON courses USING GIN (tsv_title_description);


-- Enrollments table for tracking student-course relationships
CREATE TABLE enrollments (
    id SERIAL PRIMARY KEY,
    user_id INTEGER NOT NULL REFERENCES users(id),
    course_id INTEGER NOT NULL REFERENCES courses(id),
    enrolled_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    UNIQUE (user_id, course_id) -- Prevent duplicate enrollments
);

-- Indexes for aggregations
CREATE INDEX idx_enrollments_course_id ON enrollments(course_id);
CREATE INDEX idx_enrollments_user_id ON enrollments(user_id);
