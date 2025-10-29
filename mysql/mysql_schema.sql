-- MySQL Database Schema for Benchmark Project
-- Supports queries: keyword text search, lookup by email, lookup by multiple factors, aggregation (top 5 courses)

CREATE DATABASE IF NOT EXISTS benchmark;
USE benchmark;

-- Users table
CREATE TABLE users (
    id INT PRIMARY KEY AUTO_INCREMENT,
    email VARCHAR(255) NOT NULL UNIQUE,
    name VARCHAR(255) NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Index for email lookups
CREATE INDEX idx_users_email ON users(email);

-- Courses table
CREATE TABLE courses (
    id INT PRIMARY KEY AUTO_INCREMENT,
    title VARCHAR(255) NOT NULL,
    description TEXT,
    department VARCHAR(100),
    instructor_id INT NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (instructor_id) REFERENCES users(id)
);

-- Indexes for text search and filters
CREATE INDEX idx_courses_title ON courses(title);
CREATE FULLTEXT INDEX idx_courses_title_description ON courses(title, description);
CREATE INDEX idx_courses_department ON courses(department);
CREATE INDEX idx_courses_instructor_id ON courses(instructor_id);

-- Enrollments table for tracking student-course relationships
CREATE TABLE enrollments (
    id INT PRIMARY KEY AUTO_INCREMENT,
    user_id INT NOT NULL,
    course_id INT NOT NULL,
    enrolled_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id),
    FOREIGN KEY (course_id) REFERENCES courses(id),
    UNIQUE KEY unique_enrollment (user_id, course_id) -- Prevent duplicate enrollments
);

-- Indexes for aggregations
CREATE INDEX idx_enrollments_course_id ON enrollments(course_id);
CREATE INDEX idx_enrollments_user_id ON enrollments(user_id);
