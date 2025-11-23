const mysql = require('mysql2');
const fs = require('fs');
const csv = require('csv-parser');
const util = require('util');

// Sample data sizes for dev machine: loading full movie dataset
const NUM_USERS = 20000;
const NUM_COURSES = 45000;
const NUM_ENROLLMENTS = 450000; // scaled up proportionally

// Departments
const departments = ['Computer Science', 'Mathematics', 'Physics', 'Biology', 'Chemistry', 'History', 'English', 'Economics'];

async function waitForConnection() {
  const maxRetries = 60;
  let connection;
  for (let i = 0; i < maxRetries; i++) {
    connection = mysql.createConnection({
      host: 'localhost',
      user: 'root',
      password: 'root',
      database: 'benchmark'
    });
    try {
      await new Promise((resolve, reject) => {
        connection.connect((err) => {
          if (err) reject(err);
          else resolve();
        });
      });
      // Test if DB is ready by running a simple query
      await new Promise((resolve, reject) => {
        connection.query('SELECT 1', (err) => {
          if (err) reject(err);
          else resolve();
        });
      });
      console.log('Connected to MySQL');
      return connection;
    } catch (err) {
      console.log(`Waiting for MySQL connection... (${i + 1}/${maxRetries})`);
      await new Promise(resolve => setTimeout(resolve, 1000));
    }
  }
  throw new Error('Failed to connect to MySQL after 60 retries');
}

// Generate users
function generateUsers() {
  const users = [];
  for (let i = 1; i <= NUM_USERS; i++) {
    users.push([
      i,
      `user${i}@example.com`,
      `User ${i}`,
      new Date(Date.now() - Math.random() * 31536000000).toISOString().slice(0, 19).replace('T', ' ')
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
            new Date(Date.now() - Math.random() * 31536000000).toISOString().slice(0, 19).replace('T', ' ')
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
        new Date(Date.now() - Math.random() * 31536000000).toISOString().slice(0, 19).replace('T', ' ')
      ]);
      id++;
    }
  }
  return enrollments;
}

async function insertBatch(connection, table, columns, data) {
  const batchSize = 5000;
  for (let i = 0; i < data.length; i += batchSize) {
    const batch = data.slice(i, i + batchSize);
    const query = `INSERT INTO ${table} (${columns.join(', ')}) VALUES ?`;
    await new Promise((resolve, reject) => {
      connection.query(query, [batch], (error, results) => {
        if (error) reject(error);
        else resolve(results);
      });
    });
  }
}

async function main() {
  let connection;
  try {
    connection = await waitForConnection();

    const users = generateUsers();
    const courses = await generateCourses();
    const enrollments = generateEnrollments();

    console.log(`Inserting ${NUM_USERS} users, ${NUM_COURSES} courses, ${NUM_ENROLLMENTS} enrollments into MySQL`);

    await insertBatch(connection, 'users', ['id', 'email', 'name', 'created_at'], users);
    await insertBatch(connection, 'courses', ['id', 'title', 'description', 'department', 'instructor_id', 'created_at'], courses);
    await insertBatch(connection, 'enrollments', ['id', 'user_id', 'course_id', 'enrolled_at'], enrollments);

    console.log('Data inserted successfully');
  } catch (error) {
    console.error('Error inserting data:', error);
  } finally {
    if (connection) connection.end();
  }
}

main().catch(console.error);
