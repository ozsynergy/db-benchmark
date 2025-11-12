const { MongoClient } = require('mongodb');
const mysql = require('mysql2/promise');
const { Client: PgClient } = require('pg');
const { Client } = require('@elastic/elasticsearch');

class DatabaseConnector {
  constructor(serverType, config) {
    this.serverType = serverType;
    this.config = config;
    this.client = null;
    this.db = null;
  }

  async connect() {
    const conf = this.config[this.serverType];
    switch (this.serverType) {
      case 'mongo':
        this.client = new MongoClient(conf.url);
        await this.client.connect();
        this.db = this.client.db(conf.dbName);
        break;
      case 'mysql':
        this.client = await mysql.createConnection(conf);
        break;
      case 'postgresql':
      case 'alloydb':
        this.client = new PgClient(conf);
        await this.client.connect();
        break;
      case 'elasticsearch':
        this.client = new Client(conf);
        break;
    }
  }

  async disconnect() {
    if (this.client) {
      if (['mysql', 'postgresql', 'alloydb'].includes(this.serverType)) {
        await this.client.end();
      } else if (['mongo', 'elasticsearch'].includes(this.serverType)) {
        await this.client.close();
      }
    }
  }

  getClient() {
    return this.db || this.client;
  }
}

class QueryRunner {
  constructor(serverType, connector) {
    this.serverType = serverType;
    this.connector = connector;
  }

  async performKeywordSearch(searchTerm = 'course') {
    const client = this.connector.getClient();

    if (this.serverType === 'mongo') {
      return client.collection('courses').find({ $text: { $search: searchTerm } }).toArray();
    } else if (this.serverType === 'mysql') {
      const [rows] = await client.execute('SELECT * FROM courses WHERE MATCH(title, description) AGAINST(? IN NATURAL LANGUAGE MODE)', [searchTerm]);
      return rows;
    } else if (['postgresql', 'alloydb'].includes(this.serverType)) {
      // Use similarity search with GIN trigram index for better performance
      const result = await client.query(
        'SELECT * FROM courses WHERE (title || \' \' || COALESCE(description, \'\')) % $1 ORDER BY similarity((title || \' \' || COALESCE(description, \'\')), $1) DESC',
        [searchTerm]
      );
      return result.rows;
    } else if (this.serverType === 'elasticsearch') {
      const result = await client.search({
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

  async performLookupByIdentifier(email) {
    const client = this.connector.getClient();

    if (this.serverType === 'mongo') {
      return client.collection('users').findOne({ email });
    } else if (this.serverType === 'mysql') {
      const [rows] = await client.execute('SELECT * FROM users WHERE email = ?', [email]);
      return rows[0];
    } else if (['postgresql', 'alloydb'].includes(this.serverType)) {
      const result = await client.query('SELECT * FROM users WHERE email = $1', [email]);
      return result.rows[0];
    } else if (this.serverType === 'elasticsearch') {
      // Use term query for exact match on keyword field
      const result = await client.search({
        index: 'users',
        body: {
          query: { term: { email } }
        }
      });
      return result.hits.hits[0];
    }
  }

  async performLookupByMultipleFactors(department, instructorId) {
    const client = this.connector.getClient();

    if (this.serverType === 'mongo') {
      return client.collection('courses').find({ department, instructor_id: instructorId }).toArray();
    } else if (this.serverType === 'mysql') {
      const [rows] = await client.execute('SELECT * FROM courses WHERE department = ? AND instructor_id = ?', [department, instructorId]);
      return rows;
    } else if (['postgresql', 'alloydb'].includes(this.serverType)) {
      const result = await client.query('SELECT * FROM courses WHERE department = $1 AND instructor_id = $2', [department, instructorId]);
      return result.rows;
    } else if (this.serverType === 'elasticsearch') {
      const result = await client.search({
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

  async performTop5Courses() {
    const client = this.connector.getClient();

    if (this.serverType === 'mongo') {
      return client.collection('enrollments').aggregate([
        { $group: { _id: '$course_id', count: { $sum: 1 } } },
        { $sort: { count: -1 } },
        { $limit: 5 }
      ],
      {
          hint: { "course_id": 1 }
      }).toArray();
    } else if (this.serverType === 'mysql') {
      const [rows] = await client.execute(`
        SELECT course_id, COUNT(*) as count
        FROM enrollments
        GROUP BY course_id
        ORDER BY count DESC
        LIMIT 5
      `);
      return rows;
    } else if (['postgresql', 'alloydb'].includes(this.serverType)) {
      const result = await client.query(`
        SELECT course_id, COUNT(*) as count
        FROM enrollments
        GROUP BY course_id
        ORDER BY count DESC
        LIMIT 5
      `);
      return result.rows;
    } else if (this.serverType === 'elasticsearch') {
      const result = await client.search({
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

  async performInsertEnrollment(id, userId, courseId, enrolledAt) {
    const client = this.connector.getClient();

    if (this.serverType === 'mongo') {
      return client.collection('enrollments').insertOne({ id, user_id: userId, course_id: courseId, enrolled_at: enrolledAt });
    } else if (this.serverType === 'mysql') {
      const mysqlDateTime = enrolledAt.slice(0, 19).replace('T', ' ');
      return client.execute('INSERT INTO enrollments (id, user_id, course_id, enrolled_at) VALUES (?, ?, ?, ?)', [id, userId, courseId, mysqlDateTime]);
    } else if (['postgresql', 'alloydb'].includes(this.serverType)) {
      return client.query('INSERT INTO enrollments (id, user_id, course_id, enrolled_at) VALUES ($1, $2, $3, $4)', [id, userId, courseId, enrolledAt]);
    } else if (this.serverType === 'elasticsearch') {
      return client.index({
        index: 'enrollments',
        id: id.toString(),
        body: { id, user_id: userId, course_id: courseId, enrolled_at: enrolledAt }
      });
    }
  }

  async performUpdateEnrollment(enrollmentId, newEnrolledAt) {
    const client = this.connector.getClient();

    if (this.serverType === 'mongo') {
      return client.collection('enrollments').updateOne({ id: enrollmentId }, { $set: { enrolled_at: newEnrolledAt } });
    } else if (this.serverType === 'mysql') {
      const mysqlDateTime = newEnrolledAt.slice(0, 19).replace('T', ' ');
      return client.execute('UPDATE enrollments SET enrolled_at = ? WHERE id = ?', [mysqlDateTime, enrollmentId]);
    } else if (['postgresql', 'alloydb'].includes(this.serverType)) {
      return client.query('UPDATE enrollments SET enrolled_at = $1 WHERE id = $2', [newEnrolledAt, enrollmentId]);
    } else if (this.serverType === 'elasticsearch') {
      return client.update({
        index: 'enrollments',
        id: enrollmentId.toString(),
        body: {
          doc: { enrolled_at: newEnrolledAt }
        }
      });
    }
  }

  async performDeleteEnrollment(enrollmentId) {
    const client = this.connector.getClient();

    if (this.serverType === 'mongo') {
      return client.collection('enrollments').deleteOne({ id: enrollmentId });
    } else if (this.serverType === 'mysql') {
      return client.execute('DELETE FROM enrollments WHERE id = ?', [enrollmentId]);
    } else if (['postgresql', 'alloydb'].includes(this.serverType)) {
      return client.query('DELETE FROM enrollments WHERE id = $1', [enrollmentId]);
    } else if (this.serverType === 'elasticsearch') {
      return client.delete({
        index: 'enrollments',
        id: enrollmentId.toString()
      });
    }
  }

  async getDataCounts() {
    const client = this.connector.getClient();
    if (['postgresql', 'alloydb'].includes(this.serverType)) {
      const userCount = await client.query('SELECT COUNT(*) FROM users');
      const courseCount = await client.query('SELECT COUNT(*) FROM courses');
      const enrollmentCount = await client.query('SELECT COUNT(*) FROM enrollments');
      return {
        users: userCount.rows[0].count,
        courses: courseCount.rows[0].count,
        enrollments: enrollmentCount.rows[0].count
      };
    }
    return null;
  }

  async getDatabaseSize() {
    const client = this.connector.getClient();

    if (this.serverType === 'mongo') {
      const stats = await client.stats();
      return {
        dataSize: stats.dataSize,
        storageSize: stats.storageSize,
        indexSize: stats.indexSize,
        totalSize: stats.storageSize + stats.indexSize,
        formatted: this.formatBytes(stats.storageSize + stats.indexSize)
      };
    } else if (this.serverType === 'mysql') {
      const [rows] = await client.execute(`
        SELECT 
          SUM(data_length + index_length) as total_size,
          SUM(data_length) as data_size,
          SUM(index_length) as index_size
        FROM information_schema.TABLES
        WHERE table_schema = 'benchmark'
      `);
      const totalSize = parseInt(rows[0].total_size || 0);
      return {
        dataSize: parseInt(rows[0].data_size || 0),
        indexSize: parseInt(rows[0].index_size || 0),
        totalSize: totalSize,
        formatted: this.formatBytes(totalSize)
      };
    } else if (['postgresql', 'alloydb'].includes(this.serverType)) {
      const result = await client.query(`
        SELECT pg_database_size('benchmark') as total_size
      `);
      const totalSize = parseInt(result.rows[0].total_size);
      return {
        totalSize: totalSize,
        formatted: this.formatBytes(totalSize)
      };
    } else if (this.serverType === 'elasticsearch') {
      const stats = await client.indices.stats({ index: '_all' });
      const totalSize = stats._all.primaries.store.size_in_bytes;
      return {
        totalSize: totalSize,
        formatted: this.formatBytes(totalSize)
      };
    }
    return null;
  }

  formatBytes(bytes) {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  }
}

class Benchmark {
  constructor(serverType, requestCount = 100, debug = false, showQueryPlan = false) {
    this.serverType = serverType;
    this.requestCount = requestCount;
    this.debug = debug;
    this.showQueryPlan = showQueryPlan;
    this.enrollmentIdCounter = 500001;

    this.config = {
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
      postgresql: {
        host: 'localhost',
        port: 5432,
        user: 'postgres',
        password: 'root',
        database: 'benchmark'
      },
      alloydb: {
        host: 'localhost',
        port: 5432,
        user: 'postgres',
        password: 'root',
        database: 'benchmark'
      },
      elasticsearch: {
        node: 'http://localhost:9200'
      }
    };

    this.connector = new DatabaseConnector(serverType, this.config);
    this.queryRunner = new QueryRunner(serverType, this.connector);

    this.queries = [
      { name: 'Keyword Text Search', func: () => this.queryRunner.performKeywordSearch() },
      { name: 'Lookup by Identifier', func: () => this.queryRunner.performLookupByIdentifier(`user${Math.floor(Math.random() * 1000) + 1}@example.com`) },
      { name: 'Lookup by Multiple Factors', func: () => this.queryRunner.performLookupByMultipleFactors('Computer Science', Math.floor(Math.random() * 100) + 1) },
      { name: 'Aggregation Top 5 Courses', func: () => this.queryRunner.performTop5Courses() },
      { name: 'Insert Enrollment', func: () => this.queryRunner.performInsertEnrollment(this.enrollmentIdCounter++, Math.floor(Math.random() * 19900) + 101, Math.floor(Math.random() * 45000) + 1, new Date().toISOString()) },
      { name: 'Update Enrollment', func: () => this.queryRunner.performUpdateEnrollment(Math.floor(Math.random() * 450000) + 1, new Date().toISOString()) },
      { name: 'Delete Enrollment', func: () => this.queryRunner.performDeleteEnrollment(Math.floor(Math.random() * 450000) + 1) }
    ];
  }

  async run() {
    try {
      await this.connector.connect();

      // Run query plans if requested
      if (this.showQueryPlan) {
        await explainAllMongoQueries(this.connector.getClient(), this.serverType, this.showQueryPlan);
      }

      if (this.debug) {
        await this.runDebug();
      } else {
        await this.runBenchmark();
      }
    } catch (error) {
      console.error('Error running benchmarks:', error);
    } finally {
      await this.connector.disconnect();
    }
  }

  async runBenchmark() {
    console.log(`Running benchmarks for ${this.serverType} with ${this.requestCount} requests per query...\n`);

    for (const query of this.queries) {
      const times = [];
      for (let i = 0; i < this.requestCount; i++) {
        const start = process.hrtime.bigint();
        await query.func();
        const end = process.hrtime.bigint();
        const time = Number(end - start) / 1e6; // ms
        times.push(time);
      }
      const avg = times.reduce((a, b) => a + b, 0) / times.length;
      console.log(`${query.name}: Average time per request: ${avg.toFixed(2)} ms`);
    }

    // Display database size at the end
    console.log();
    const dbSize = await this.queryRunner.getDatabaseSize();
    if (dbSize) {
      console.log(`Database Size: ${dbSize.formatted}`);
      if (dbSize.dataSize !== undefined) {
        console.log(`  Data: ${this.queryRunner.formatBytes(dbSize.dataSize)}, Index: ${this.queryRunner.formatBytes(dbSize.indexSize)}`);
      }
    }
  }

  async runDebug() {
    console.log(`Testing ${this.serverType}...\n`);

    const counts = await this.queryRunner.getDataCounts();
    if (counts) {
      console.log('Data counts:');
      console.log(`  Users: ${counts.users}, Courses: ${counts.courses}, Enrollments: ${counts.enrollments}`);
      console.log();
    }

    // Keyword search
    console.log('Keyword Text Search:');
    const searchStart = process.hrtime.bigint();
    const searchResult = await this.queryRunner.performKeywordSearch();
    const searchEnd = process.hrtime.bigint();
    const searchTime = Number(searchEnd - searchStart) / 1e6;
    console.log(`  Returned ${searchResult ? searchResult.length : 0} results in ${searchTime.toFixed(2)} ms`);

    // Lookup by identifier
    console.log('Lookup by Identifier:');
    const lookupStart = process.hrtime.bigint();
    const lookupResult = await this.queryRunner.performLookupByIdentifier('user1@example.com');
    const lookupEnd = process.hrtime.bigint();
    const lookupTime = Number(lookupEnd - lookupStart) / 1e6;
    console.log(`  Returned ${lookupResult ? (Array.isArray(lookupResult) ? lookupResult.length : 1) : 0} result in ${lookupTime.toFixed(2)} ms`);

    // Multiple factors
    console.log('Lookup by Multiple Factors:');
    const departments = ['Computer Science', 'Mathematics', 'Physics', 'Biology', 'Chemistry', 'History', 'English', 'Economics'];
    const department = departments[Math.floor(Math.random() * departments.length)];
    const instructorId = Math.floor(Math.random() * 100) + 1;
    console.log(`  Dept: ${department}, Instructor: ${instructorId}`);
    const multiStart = process.hrtime.bigint();
    const multiResult = await this.queryRunner.performLookupByMultipleFactors(department, instructorId);
    const multiEnd = process.hrtime.bigint();
    const multiTime = Number(multiEnd - multiStart) / 1e6;
    console.log(`  Returned ${multiResult ? multiResult.length : 0} results in ${multiTime.toFixed(2)} ms`);

    // Aggregation
    console.log('Aggregation Top 5 Courses:');
    const aggStart = process.hrtime.bigint();
    const aggResult = await this.queryRunner.performTop5Courses();
    const aggEnd = process.hrtime.bigint();
    const aggTime = Number(aggEnd - aggStart) / 1e6;
    console.log(`  Returned ${aggResult ? aggResult.length : 0} results in ${aggTime.toFixed(2)} ms`);
    console.log(aggResult);

    // Update Enrollment
    console.log('Update Enrollment:');
    const updateStart = process.hrtime.bigint();
    await this.queryRunner.performUpdateEnrollment(Math.floor(Math.random() * 450000) + 1, new Date().toISOString());
    const updateEnd = process.hrtime.bigint();
    const updateTime = Number(updateEnd - updateStart) / 1e6;
    console.log(`  Update completed in ${updateTime.toFixed(2)} ms`);

    // Delete Enrollment
    console.log('Delete Enrollment:');
    const deleteStart = process.hrtime.bigint();
    await this.queryRunner.performDeleteEnrollment(Math.floor(Math.random() * 450000) + 1);
    const deleteEnd = process.hrtime.bigint();
    const deleteTime = Number(deleteEnd - deleteStart) / 1e6;
    console.log(`  Delete completed in ${deleteTime.toFixed(2)} ms`);
  }
}

// Function to run all MongoDB query plans once
async function explainAllMongoQueries(db, serverType, showQueryPlan) {
  if (serverType !== 'mongo' || !showQueryPlan) {
    return;
  }

  console.log('\n=== MongoDB Query Execution Plans ===\n');

  try {
    // 1. Keyword Text Search
    const searchTerm = 'course';
    const keywordExplain = await db.collection('courses').find({ $text: { $search: searchTerm } }).explain('executionStats');
    console.log('1. Keyword Text Search Explain:');
    console.log(JSON.stringify(keywordExplain.executionStats, null, 2));
    console.log('---\n');

    // 2. Lookup by Identifier
    const email = 'user500@example.com'; // Fixed email for consistent explain
    const identifierExplain = await db.collection('users').find({ email }).explain('executionStats');
    console.log('2. Lookup by Identifier Explain:');
    console.log(JSON.stringify(identifierExplain.executionStats, null, 2));
    console.log('---\n');

    // 3. Lookup by Multiple Factors
    const department = 'Computer Science';
    const instructorId = 50; // Fixed instructor for consistent explain
    const multiFactorExplain = await db.collection('courses').find({ department, instructor_id: instructorId }).explain('executionStats');
    console.log('3. Lookup by Multiple Factors Explain:');
    console.log(JSON.stringify(multiFactorExplain.executionStats, null, 2));
    console.log('---\n');

    // 4. Top 5 Courses Aggregation (Atlas Search Facet)
   const aggregationExplain = await db.collection('enrollments').aggregate([
        { $group: { _id: '$course_id', count: { $sum: 1 } } },
        { $sort: { count: -1 } },
        { $limit: 5 }
      ],
      {
            hint: { "course_id": 1 }
      }).explain('executionStats');
    console.log('4. Top 5 Courses Aggregation Explain:');
    // For aggregation, the structure might be different - check multiple possible locations
    if (aggregationExplain.executionStats) {
      console.log(JSON.stringify(aggregationExplain.executionStats, null, 2));
    } else if (aggregationExplain.stages) {
      console.log(JSON.stringify(aggregationExplain.stages, null, 2));
    } else {
      console.log(JSON.stringify(aggregationExplain, null, 2));
    }
    console.log('---\n');

    // 5. Update Enrollment (explain the find part)
    const updateId = 12345; // Fixed ID for consistent explain
    const updateExplain = await db.collection('enrollments').find({ id: updateId }).explain('executionStats');
    console.log('5. Update Enrollment (filter) Explain:');
    console.log(JSON.stringify(updateExplain.executionStats, null, 2));
    console.log('---\n');

    // 6. Delete Enrollment (explain the find part)
    const deleteId = 12345; // Fixed ID for consistent explain
    const deleteExplain = await db.collection('enrollments').find({ id: deleteId }).explain('executionStats');
    console.log('6. Delete Enrollment (filter) Explain:');
    console.log(JSON.stringify(deleteExplain.executionStats, null, 2));
    console.log('---\n');

    console.log('=== End of Query Plans ===\n');

  } catch (error) {
    console.error('Error explaining queries:', error.message);
  }
}

// Parse command line arguments
const args = process.argv.slice(2);
let debug = false;
let showQueryPlan = false;
let serverTypeIndex = 0;

if (args.includes('--debug')) {
  debug = true;
}
if (args.includes('--explain')) {
  showQueryPlan = true;
}

// Find the server type index (first non-flag argument)
for (let i = 0; i < args.length; i++) {
  if (!args[i].startsWith('--')) {
    serverTypeIndex = i;
    break;
  }
}

const serverType = args[serverTypeIndex];
const requestCount = debug ? 1 : parseInt(args[serverTypeIndex + 1]) || 100;

if (!serverType || !['mongo', 'mysql', 'postgresql', 'alloydb', 'elasticsearch'].includes(serverType)) {
  console.error('Usage: node benchmark.js [--debug] [--explain] <server type> [request count]');
  console.error('server type: mongo, mysql, postgresql, alloydb, elasticsearch');
  console.error('request count: number of requests per test (default: 100, ignored in debug mode)');
  console.error('--debug: run in debug mode (single request per query with detailed output)');
  console.error('--explain: show MongoDB query execution plans (MongoDB only)');
  process.exit(1);
}

const benchmark = new Benchmark(serverType, requestCount, debug, showQueryPlan);
benchmark.run();
