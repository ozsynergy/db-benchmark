// MongoDB Schema Setup for Benchmark Project
// Creates indexes to support: keyword text search, lookup by email, lookup by multiple factors, aggregation (top 5 courses)

// Database: benchmark
// Collections: users, courses, enrollments

// Note: Collections are created automatically in MongoDB when documents are inserted
// This script sets up the necessary indexes matching the MySQL schema

// Connect to benchmark database (adjust connection string as needed)
// mongo benchmark < mongo_schema.js

db = db.getSiblingDB('benchmark');

// Users collection indexes
db.users.createIndex({ "email": 1 }, { unique: true });
// MD: remove unused index
// db.users.createIndex({ "created_at": 1 });

// Courses collection indexes
// MD: added compound index for multi-factor lookup
db.courses.createIndex({ "department": 1, "instructor_id": 1  });
// MD: remove unused index
// db.courses.createIndex({ "title": 1 });
// db.courses.createIndex({ "department": 1 });
// db.courses.createIndex({ "instructor_id": 1 });
// db.courses.createIndex({ "created_at": 1 });

// Enrollments collection indexes (to match MySQL unique constraint, use compound unique index)
db.enrollments.createIndex({ "user_id": 1, "course_id": 1 }, { unique: true });
// db.enrollments.createIndex({ "user_id": 1 });
db.enrollments.createIndex({ "course_id": 1 });
// db.enrollments.createIndex({ "enrolled_at": 1 });
// MD: add index on field used for delete and update
db.enrollments.createIndex({ "id": 1 }); 

// Optimized indexes for aggregation performance -- MD: however, the aggregration query is grouped by course_id only. Hence, commended out
// db.enrollments.createIndex({ "course_id": 1, "user_id": 1 }); // Compound index for aggregation queries

// Optimized text search index with weights
db.courses.createIndex(
  { "title": "text", "description": "text" },
  {
    weights: { title: 10, description: 1 },
    name: "courses_text_search"
  }
);
