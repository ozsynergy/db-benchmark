# Database Benchmark Project

## Goals

The goal of this project is to benchmark three database engines against each other:
- Elasticsearch
- MongoDB
- MySQL

Each database will contain the same schema and dataset, allowing for direct performance comparisons.

The benchmark performs three different query types:
- Keyword text search  
    - find word in string 
    - find word at start of string
- Lookup by identifier (e.g., email address)
- Lookup by multiple factors (department and status)
- Aggregation (top 5 courses)

## Dataset

The databases contain the following tables/collections:
- **Users**: id, email, name, created_at
- **Courses**: id, title, description, department, instructor_id, created_at
- **Enrollments**: id, user_id, course_id, enrolled_at

Sample data generated: 1000 users, 100 courses, 2000 enrollments.

## Usage

### Starting a Database Server

Select one database server to benchmark:

```bash
npm run db:mongo   # Starts MongoDB
npm run db:mysql   # Starts MySQL
npm run db:elasticsearch  # Starts Elasticsearch
```

### Running Benchmarks

Execute the benchmark script:

```bash
node benchmark.js <server type> <request count>
```

- `<server type>`: mongo, mysql, elasticsearch
- `<request count>`: number of requests per test (optional, default not specified)

### Cleanup

Stop all database containers:

```bash
npm run db:stop
```
