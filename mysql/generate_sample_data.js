const mysql = require('mysql2');
const fs = require('fs');
const csv = require('csv-parser');

// Sample data sizes for dev machine: loading full movie dataset
const NUM_USERS = 20000;
const NUM_COURSES = 45000;
const NUM_ENROLLMENTS = 450000; // scaled up proportionally

// Departments
const departments = ['Computer Science', 'Mathematics', 'Physics', 'Biology', 'Chemistry', 'History', 'English', 'Economics'];

const connection = mysql.createConnection({
  host: 'localhost',
  user: 'root',
  password: 'root',
  database: 'benchmark'
});

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
    fs.createReadStream('../data/movies_metadata.csv')
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

async function insertBatch(table, columns, data) {
  const query = `INSERT INTO ${table} (${columns.join(', ')}) VALUES ?`;
  return new Promise((resolve, reject) => {
    connection.query(query, [data], (error, results) => {
      if (error) reject(error);
      else resolve(results);
    });
  });
}

async function main() {
  try {
    connection.connect();

    const users = generateUsers();
    const courses = await generateCourses();
    const enrollments = generateEnrollments();

    console.log(`Inserting ${NUM_USERS} users, ${NUM_COURSES} courses, ${NUM_ENROLLMENTS} enrollments into MySQL`);

    await insertBatch('users', ['id', 'email', 'name', 'created_at'], users);
    await insertBatch('courses', ['id', 'title', 'description', 'department', 'instructor_id', 'created_at'], courses);
    await insertBatch('enrollments', ['id', 'user_id', 'course_id', 'enrolled_at'], enrollments);

    console.log('Data inserted successfully');
  } catch (error) {
    console.error('Error inserting data:', error);
  } finally {
    connection.end();
  }
}

main().catch(console.error);
