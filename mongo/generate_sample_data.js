const { MongoClient } = require('mongodb');

// Sample data sizes for dev machine: adequate for testing without overloading
const NUM_USERS = 10000;
const NUM_COURSES = 1000;
const NUM_ENROLLMENTS = 20000; // avg ~2 per user

// Departments
const departments = ['Computer Science', 'Mathematics', 'Physics', 'Biology', 'Chemistry', 'History', 'English', 'Economics'];

const url = 'mongodb://root:root@localhost:27017';
const dbName = 'benchmark';

const client = new MongoClient(url);

// Generate users
function generateUsers() {
  const users = [];
  for (let i = 1; i <= NUM_USERS; i++) {
    users.push({
      id: i,
      email: `user${i}@example.com`,
      name: `User ${i}`,
      created_at: new Date(Date.now() - Math.random() * 31536000000) // Random within 1 year
    });
  }
  return users;
}

// Generate courses (instructors 1-100)
function generateCourses() {
  const courses = [];
  for (let i = 1; i <= NUM_COURSES; i++) {
    const deptIndex = Math.floor(Math.random() * departments.length);
    courses.push({
      id: i,
      title: `Course ${i}`,
      description: `Description for course ${i} in ${departments[deptIndex]}.`,
      department: departments[deptIndex],
      instructor_id: Math.floor(Math.random() * 100) + 1, // 1-100 instructors
      created_at: new Date(Date.now() - Math.random() * 31536000000)
    });
  }
  return courses;
}

// Generate enrollments (avoid duplicates)
function generateEnrollments() {
  const enrollments = [];
  const seen = new Set();
  let id = 1;
  while (id <= NUM_ENROLLMENTS) {
    const userId = Math.floor(Math.random() * (NUM_USERS - 100)) + 101; // 101-1000 students
    const courseId = Math.floor(Math.random() * NUM_COURSES) + 1;
    const key = `${userId}-${courseId}`;
    if (!seen.has(key)) {
      seen.add(key);
      enrollments.push({
        id: id,
        user_id: userId,
        course_id: courseId,
        enrolled_at: new Date(Date.now() - Math.random() * 31536000000)
      });
      id++;
    }
  }
  return enrollments;
}

async function main() {
  try {
    await client.connect();
    const db = client.db(dbName);

    const users = generateUsers();
    const courses = generateCourses();
    const enrollments = generateEnrollments();

    console.log(`Inserting ${NUM_USERS} users, ${NUM_COURSES} courses, ${NUM_ENROLLMENTS} enrollments into MongoDB`);

    await db.collection('users').insertMany(users);
    await db.collection('courses').insertMany(courses);
    await db.collection('enrollments').insertMany(enrollments);

    console.log('Data inserted successfully');
  } catch (error) {
    console.error('Error inserting data:', error);
  } finally {
    await client.close();
  }
}

main().catch(console.error);
