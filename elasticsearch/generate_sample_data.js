const { Client } = require('@elastic/elasticsearch');
const fs = require('fs');
const csv = require('csv-parser');

// Sample data sizes for dev machine: loading full movie dataset
const NUM_USERS = 20000;
const NUM_COURSES = 45000;
const NUM_ENROLLMENTS = 450000; // scaled up proportionally

// Departments
const departments = ['Computer Science', 'Mathematics', 'Physics', 'Biology', 'Chemistry', 'History', 'English', 'Economics'];

// Generate users
function generateUsers() {
  const users = [];
  for (let i = 1; i <= NUM_USERS; i++) {
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
async function generateCourses() {
  const courses = [];
  const movieData = [];

  return new Promise((resolve, reject) => {
    fs.createReadStream('data/movies_metadata.csv')
      .pipe(csv())
      .on('data', (row) => {
        if (movieData.length < NUM_COURSES) {
          movieData.push({
            title: row.original_title,
            description: row.overview
          });
        }
      })
      .on('end', () => {
        for (let i = 0; i < movieData.length; i++) {
          const deptIndex = Math.floor(Math.random() * departments.length);
          courses.push({
            id: i + 1,
            title: movieData[i].title,
            description: movieData[i].description,
            department: departments[deptIndex],
            instructor_id: Math.floor(Math.random() * 100) + 1, // 1-100 instructors
            created_at: new Date(Date.now() - Math.random() * 31536000000).toISOString()
          });
        }
        resolve(courses);
      })
      .on('error', reject);
  });
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
        enrolled_at: new Date(Date.now() - Math.random() * 31536000000).toISOString()
      });
      id++;
    }
  }
  return enrollments;
}

async function bulkInsert(data, index, client) {
  const operations = data.flatMap(doc => [{ index: { _index: index } }, doc]);
  const bulkResponse = await client.bulk({ refresh: true, operations });
  if (bulkResponse.errors) {
    console.error('Bulk errors:', bulkResponse);
  } else {
    console.log(`Inserted ${data.length} documents into ${index}`);
  }
}

async function waitForConnection() {
  const maxRetries = 30;
  const client = new Client({ node: 'http://localhost:9200' });
  for (let i = 0; i < maxRetries; i++) {
    try {
      await client.ping();
      console.log('Connected to Elasticsearch');
      return client;
    } catch (err) {
      console.log(`Waiting for Elasticsearch connection... (${i + 1}/${maxRetries})`);
      await new Promise(resolve => setTimeout(resolve, 1000));
    }
  }
  throw new Error('Failed to connect to Elasticsearch after 30 retries');
}

async function main() {
  let client;
  try {
    client = await waitForConnection();

    const users = generateUsers();
    const courses = await generateCourses();
    const enrollments = generateEnrollments();

    console.log(`Generating ${NUM_USERS} users, ${NUM_COURSES} courses, ${NUM_ENROLLMENTS} enrollments`);

    await bulkInsert(users, 'users', client);
    await bulkInsert(courses, 'courses', client);
    await bulkInsert(enrollments, 'enrollments', client);
  } finally {
    if (client) await client.close();
  }
}

main().catch(console.error);
