# Database Benchmark Project

## Goals

The goal of this project is to benchmark five database engines against each other:
- AlloyDB
- Elasticsearch
- MongoDB
- MySQL
- PostgreSQL

Each database contains the same schema and dataset, allowing for direct performance comparisons.

The benchmark performs six different query types:
- Keyword text search
    - find word in string
    - find word at start of string
- Lookup by identifier (e.g., email address)
- Lookup by multiple factors (department and status)
- Aggregation (top 5 courses)
- Update enrollment (update enrolled_at timestamp)
- Delete enrollment

## Dataset

The databases contain the following tables/collections:
- **Users**: id, email, name, created_at
- **Courses**: id, title, description, department, instructor_id, created_at
- **Enrollments**: id, user_id, course_id, enrolled_at

Sample data generated: 1000 users, 100 courses, 2000 enrollments.

## Install

cd data
wget https://huggingface.co/spaces/Kamand/Movie_Recommendation/resolve/main/movies_metadata.csv

## Usage

### Starting a Database Server

Select one database server to benchmark:

```bash
npm run db:alloydb  # Starts AlloyDB
npm run db:mongo   # Starts MongoDB
npm run db:mysql   # Starts MySQL
npm run db:postgresql  # Starts PostgreSQL
npm run db:elasticsearch  # Starts Elasticsearch
```

### Seeding the Databases

After starting a database server, seed it with sample data by running the corresponding script. The scripts will wait for the database connection to be established before inserting data.

```bash
node alloydb/generate_sample_data.js
node mysql/generate_sample_data.js
node postgresql/generate_sample_data.js
node mongo/generate_sample_data.js
node elasticsearch/generate_sample_data.js
```

Note: The PostgreSQL and AlloyDB scripts check for existing data and only inserts if the tables are empty.

### Running Benchmarks

Execute the benchmark script:

```bash
node benchmark.js [--debug] <server type> [request count]
```

- `--debug`: run in debug mode (single request per query with detailed output)
- `<server type>`: alloydb, mongo, mysql, postgresql, elasticsearch
- `<request count>`: number of requests per test (optional, default 100, ignored in debug mode)

Alternatively, use the convenience scripts that start the database, seed data, run benchmarks, and stop the database:

```bash
npm run benchmark:alloydb
npm run benchmark:mongo
npm run benchmark:mysql
npm run benchmark:postgresql
npm run benchmark:elasticsearch
```

### Cleanup

Stop all database containers:

```bash
npm run db:stop
```

It is recommended to to run only 1 database at a time to prevent biasing the results by giving the databases unequal resources.
