const { MongoClient } = require('mongodb');
const mysql = require('mysql2/promise');
const { Client } = require('@elastic/elasticsearch');

const serverType = 'mysql'; // change to test different
const requestCount = 1; // small

// Copy config from benchmark.js

const config = {
  mongo: {
    url: 'mongodb://root:root@localhost:27017',
    dbName: 'benchmark'
  },
  mysql: {
    host: 'localhost',
    port: 3306,
    user: 'root',
    password: 'root',
    database: 'benchmark'
  },
  elasticsearch: {
    node: 'http://localhost:9200'
  }
};

async function testQueries() {
  const conf = config[serverType];
  let client, db;

  try {
    switch (serverType) {
      case 'mongo':
        client = new MongoClient(conf.url);
        await client.connect();
        db = client.db(conf.dbName);
        break;
      case 'mysql':
        client = await mysql.createConnection(conf);
        break;
      case 'elasticsearch':
        client = new Client(conf);
        break;
    }

    console.log(`Testing ${serverType}...\n`);

    // Keyword search
    console.log('Keyword Text Search:');
    const searchStart = process.hrtime.bigint();
    const searchResult = await performKeywordSearch(client, db || client);
    const searchEnd = process.hrtime.bigint();
    const searchTime = Number(searchEnd - searchStart) / 1e6;
    console.log(`  Returned ${searchResult ? searchResult.length : 0} results in ${searchTime.toFixed(2)} ms`);

    // Lookup by identifier
    console.log('Lookup by Identifier:');
    const lookupStart = process.hrtime.bigint();
    const lookupResult = await performLookupByIdentifier(client, db || client);
    const lookupEnd = process.hrtime.bigint();
    const lookupTime = Number(lookupEnd - lookupStart) / 1e6;
    console.log(`  Returned ${lookupResult ? (Array.isArray(lookupResult) ? lookupResult.length : 1) : 0} result in ${lookupTime.toFixed(2)} ms`);

    // Multiple factors
    console.log('Lookup by Multiple Factors:');
    const multiStart = process.hrtime.bigint();
    const multiResult = await performLookupByMultipleFactors(client, db || client);
    const multiEnd = process.hrtime.bigint();
    const multiTime = Number(multiEnd - multiStart) / 1e6;
    console.log(`  Returned ${multiResult ? multiResult.length : 0} results in ${multiTime.toFixed(2)} ms`);

    // Aggregation
    console.log('Aggregation Top 5 Courses:');
    const aggStart = process.hrtime.bigint();
    const aggResult = await performTop5Courses(client, db || client);
    const aggEnd = process.hrtime.bigint();
    const aggTime = Number(aggEnd - aggStart) / 1e6;
    console.log(`  Returned ${aggResult ? aggResult.length : 0} results in ${aggTime.toFixed(2)} ms`);
    console.log(aggResult);

  } catch (error) {
    console.error('Error:', error);
  } finally {
    if (client) {
      await client.close();
    }
  }
}

async function performKeywordSearch(client, db) {
  const searchTerm = 'course';

  if (serverType === 'mongo') {
    return db.collection('courses').find({ $text: { $search: searchTerm } }).toArray();
  } else if (serverType === 'mysql') {
    const [rows] = await db.execute('SELECT * FROM courses WHERE MATCH(title, description) AGAINST(? IN NATURAL LANGUAGE MODE)', [searchTerm]);
    return rows;
  } else if (serverType === 'elasticsearch') {
    const result = await db.search({
      index: 'courses',
      body: {
        query: {
          multi_match: {
            query: searchTerm,
            fields: ['title', 'description']
          }
        }
      }
    });
    return result.hits.hits;
  }
}

async function performLookupByIdentifier(client, db) {
  const email = `user1@example.com`; // fixed for test

  if (serverType === 'mongo') {
    return db.collection('users').findOne({ email });
  } else if (serverType === 'mysql') {
    const [rows] = await db.execute('SELECT * FROM users WHERE email = ?', [email]);
    return rows[0];
  } else if (serverType === 'elasticsearch') {
    const result = await db.search({
      index: 'users',
      body: {
        query: { match: { email } }
      }
    });
    return result.hits.hits[0];
  }
}

async function performLookupByMultipleFactors(client, db) {
  const departments = ['Computer Science', 'Mathematics', 'Physics', 'Biology', 'Chemistry', 'History', 'English', 'Economics'];
  const department = departments[Math.floor(Math.random() * departments.length)]; // random dept
  const instructorId = Math.floor(Math.random() * 100) + 1;

  console.log(`  Dept: ${department}, Instructor: ${instructorId}`);

  if (serverType === 'mongo') {
    return db.collection('courses').find({ department, instructor_id: instructorId }).toArray();
  } else if (serverType === 'mysql') {
    const [rows] = await db.execute('SELECT * FROM courses WHERE department = ? AND instructor_id = ?', [department, instructorId]);
    return rows;
  } else if (serverType === 'elasticsearch') {
    const result = await db.search({
      index: 'courses',
      body: {
        query: {
          bool: {
            must: [
              { term: { department } },
              { term: { instructor_id: instructorId } }
            ]
          }
        }
      }
    });
    return result.hits.hits;
  }
}

async function performTop5Courses(client, db) {
  if (serverType === 'mongo') {
    return db.collection('enrollments').aggregate([
      { $group: { _id: '$course_id', count: { $sum: 1 } } },
      { $sort: { count: -1 } },
      { $limit: 5 }
    ]).toArray();
  } else if (serverType === 'mysql') {
    const [rows] = await db.execute(`
      SELECT course_id, COUNT(*) as count
      FROM enrollments
      GROUP BY course_id
      ORDER BY count DESC
      LIMIT 5
    `);
    return rows;
  } else if (serverType === 'elasticsearch') {
    const result = await db.search({
      index: 'enrollments',
      body: {
        size: 0,
        aggs: {
          top_courses: {
            terms: {
              field: 'course_id',
              size: 5,
              order: { _count: 'desc' }
            }
          }
        }
      }
    });
    return result.aggregations.top_courses.buckets;
  }
}

testQueries();
