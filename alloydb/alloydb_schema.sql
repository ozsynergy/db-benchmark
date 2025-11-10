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

-- Indexes for text search and filters
CREATE INDEX idx_courses_title ON courses(title);
CREATE INDEX idx_courses_department ON courses(department);
CREATE INDEX idx_courses_instructor_id ON courses(instructor_id);

-- GIN index for trigram similarity search on title and description
CREATE EXTENSION IF NOT EXISTS pg_trgm;
CREATE INDEX idx_courses_title_description_gin ON courses USING GIN ((title || ' ' || COALESCE(description, '')) gin_trgm_ops);

-- GiST index for similarity operator support (%) 
CREATE INDEX idx_courses_title_description_gist ON courses USING GIST ((title || ' ' || COALESCE(description, '')) gist_trgm_ops);

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
