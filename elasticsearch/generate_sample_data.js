const fs = require('fs');
// Using built-in fetch (Node.js 18+)

// Sample data sizes for dev machine: adequate for testing without overloading
const NUM_USERS = 1000;
const NUM_COURSES = 100;
const NUM_ENROLLMENTS = 2000; // avg ~2 per user

// Departments
const departments = ['Computer Science', 'Mathematics', 'Physics', 'Biology', 'Chemistry', 'History', 'English', 'Economics'];

// Generate users
function generateUsers() {
  const users = [];
  for (let i = 1; i <= NUM_USERS; i++) {
    users.push({
      index: { _index: 'users', _id: i.toString() }
    });
    users.push({
      id: i,
      email: `user${i}@example.com`,
      name: `User ${i}`,
      created_at: new Date(Date.now() - Math.random() * 31536000000).toISOString() // Random within 1 year
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
      index: { _index: 'courses', _id: i.toString() }
    });
    courses.push({
      id: i,
      title: `Course ${i}`,
      description: `Description for course ${i} in ${departments[deptIndex]}.`,
      department: departments[deptIndex],
      instructor_id: Math.floor(Math.random() * 100) + 1, // 1-100 instructors
      created_at: new Date(Date.now() - Math.random() * 31536000000).toISOString()
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
        index: { _index: 'enrollments', _id: id.toString() }
      });
      enrollments.push({
        id: id,
        user_id: userId,
        course_id: courseId,
        enrolled_at: new Date(Date.now() - Math.random() * 31536000000).toISOString()
      });
      id++;
    }
  }
  return enrollments;
}

// Bulk insert function
async function bulkInsert(data) {
  const body = data.map(doc => JSON.stringify(doc)).join('\n') + '\n';
  const response = await fetch('http://localhost:9200/_bulk', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-ndjson' },
    body: body
  });
  if (!response.ok) {
    console.error('Bulk insert failed:', await response.text());
  } else {
    console.log('Data inserted successfully');
  }
}

async function main() {
  const users = generateUsers();
  const courses = generateCourses();
  const enrollments = generateEnrollments();

  console.log(`Generating ${NUM_USERS} users, ${NUM_COURSES} courses, ${NUM_ENROLLMENTS} enrollments`);

  await bulkInsert([...users, ...courses, ...enrollments]);
}

main().catch(console.error);
