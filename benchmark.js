const { MongoClient } = require('mongodb');
const mysql = require('mysql2/promise');
const { Client } = require('@elastic/elasticsearch');

// Parse command line arguments
const args = process.argv.slice(2);
const serverType = args[0];
const requestCount = parseInt(args[1]) || 100;

if (!serverType || !['mongo', 'mysql', 'elasticsearch'].includes(serverType)) {
  console.error('Usage: node benchmark.js <server type> [request count]');
  console.error('server type: mongo, mysql, elasticsearch');
  console.error('request count: number of requests per test (default: 100)');
  process.exit(1);
}

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

async function runBenchmarks() {
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

    // Define queries
    const queries = [
      { name: 'Keyword Text Search', func: () => performKeywordSearch(client, db || client) },
      { name: 'Lookup by Identifier', func: () => performLookupByIdentifier(client, db || client) },
      { name: 'Lookup by Multiple Factors', func: () => performLookupByMultipleFactors(client, db || client) },
      { name: 'Aggregation Top 5 Courses', func: () => performTop5Courses(client, db || client) }
    ];

    console.log(`Running benchmarks for ${serverType} with ${requestCount} requests per query...\n`);

    for (const query of queries) {
      const times = [];
      for (let i = 0; i < requestCount; i++) {
        const start = process.hrtime.bigint();
        await query.func();
        const end = process.hrtime.bigint();
        const time = Number(end - start) / 1e6; // ms
        times.push(time);
      }
      const avg = times.reduce((a, b) => a + b, 0) / times.length;
      console.log(`${query.name}: Average time per request: ${avg.toFixed(2)} ms`);
    }

  } catch (error) {
    console.error('Error running benchmarks:', error);
  } finally {
    if (client) {
      if (serverType === 'mongo' || serverType === 'mysql') {
        await client.close();
      } else if (serverType === 'elasticsearch') {
        await client.close();
      }
    }
  }
}

async function performKeywordSearch(client, db) {
  const searchTerm = 'course'; // Simple keyword

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
  const email = `user${Math.floor(Math.random() * 1000) + 1}@example.com`; // Random email

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
  const department = 'Computer Science'; // Fixed for simplicity
  const instructorId = Math.floor(Math.random() * 100) + 1; // Random instructor

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

runBenchmarks();
