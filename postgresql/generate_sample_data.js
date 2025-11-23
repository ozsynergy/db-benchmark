const { Client } = require('pg');
const fs = require('fs');
const csv = require('csv-parser');

// Sample data sizes for dev machine: loading full movie dataset
const NUM_USERS = 20000;
const NUM_COURSES = 45000;
const NUM_ENROLLMENTS = 450000; // scaled up proportionally

// Departments
const departments = ['Computer Science', 'Mathematics', 'Physics', 'Biology', 'Chemistry', 'History', 'English', 'Economics'];

// Client will be created in waitForConnection

// Generate users
function generateUsers() {
  const users = [];
  for (let i = 1; i <= NUM_USERS; i++) {
    users.push([
      i,
      `user${i}@example.com`,
      `User ${i}`,
      new Date(Date.now() - Math.random() * 31536000000).toISOString()
    ]);
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
          courses.push([
            i + 1,
            movieData[i].title,
            movieData[i].description,
            departments[deptIndex],
            Math.floor(Math.random() * 100) + 1, // 1-100 instructors
            new Date(Date.now() - Math.random() * 31536000000).toISOString()
          ]);
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
      enrollments.push([
        id,
        userId,
        courseId,
        new Date(Date.now() - Math.random() * 31536000000).toISOString()
      ]);
      id++;
    }
  }
  return enrollments;
}

async function insertBatch(client, table, columns, data) {
  const batchSize = 5000;
  for (let i = 0; i < data.length; i += batchSize) {
    const batch = data.slice(i, i + batchSize);
    const placeholders = batch.map((_, j) => `(${columns.map((_, k) => `$${(j * columns.length) + k + 1}`).join(', ')})`).join(', ');
    const values = batch.flat();
    const query = `INSERT INTO ${table} (${columns.join(', ')}) VALUES ${placeholders}`;
    await client.query(query, values);
  }
}

async function waitForConnection() {
  const maxRetries = 30;
  let client;
  for (let i = 0; i < maxRetries; i++) {
    client = new Client({
      host: 'localhost',
      port: 5432,
      user: 'postgres',
      password: 'root',
      database: 'benchmark'
    });
    try {
      await client.connect();
      console.log('Connected to PostgreSQL');
      return client;
    } catch (err) {
      console.log(`Waiting for PostgreSQL connection... (${i + 1}/${maxRetries})`);
      await new Promise(resolve => setTimeout(resolve, 1000));
    }
  }
  throw new Error('Failed to connect to PostgreSQL after 30 retries');
}

async function main() {
  let client;
  try {
    client = await waitForConnection();

    // Check existing data
    const userCount = await client.query('SELECT COUNT(*) FROM users');
    const courseCount = await client.query('SELECT COUNT(*) FROM courses');
    const enrollmentCount = await client.query('SELECT COUNT(*) FROM enrollments');

    console.log(`Existing data: ${userCount.rows[0].count} users, ${courseCount.rows[0].count} courses, ${enrollmentCount.rows[0].count} enrollments`);

    // Only insert missing data
    if (parseInt(userCount.rows[0].count) === 0) {
      console.log('Inserting users...');
      const users = generateUsers();
      await insertBatch(client, 'users', ['id', 'email', 'name', 'created_at'], users);
    }

    if (parseInt(courseCount.rows[0].count) === 0) {
      console.log('Inserting courses...');
      const courses = await generateCourses();
      await insertBatch(client, 'courses', ['id', 'title', 'description', 'department', 'instructor_id', 'created_at'], courses);
    }

    if (parseInt(enrollmentCount.rows[0].count) === 0) {
      console.log('Inserting enrollments...');
      const enrollments = generateEnrollments();
      await insertBatch(client, 'enrollments', ['id', 'user_id', 'course_id', 'enrolled_at'], enrollments);
    }

    console.log('Data insertion completed');
  } catch (error) {
    console.error('Error inserting data:', error);
  } finally {
    await client.end();
  }
}

main().catch(console.error);
