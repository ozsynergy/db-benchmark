# PostgreSQL and AlloyDB Full-Text Search Optimization

## Overview

This document describes the optimizations made to improve full-text search performance for PostgreSQL and AlloyDB databases in the benchmark project.

## Problem Statement

The original implementation used PostgreSQL's trigram similarity search (`pg_trgm` extension) with the `%` operator, which resulted in slow text search performance:

- **PostgreSQL**: 41.56 ms average
- **AlloyDB**: 22.04 ms average
- **MySQL (for comparison)**: 2.82 ms average (using FULLTEXT index)

The trigram similarity approach, while flexible, has significant overhead due to:
1. Similarity scoring computation
2. Less efficient indexing for exact word matching
3. Ranking all results by similarity score

## Solution

Replaced trigram similarity search with PostgreSQL's **native full-text search** using `tsvector` and `tsquery`:

### Schema Changes

#### Before (Trigram Similarity):
```sql
CREATE EXTENSION IF NOT EXISTS pg_trgm;
CREATE INDEX idx_courses_title_description_gin ON courses 
  USING GIN ((title || ' ' || COALESCE(description, '')) gin_trgm_ops);
CREATE INDEX idx_courses_title_description_gist ON courses 
  USING GIST ((title || ' ' || COALESCE(description, '')) gist_trgm_ops);
```

#### After (Native Full-Text Search):
```sql
-- Add generated tsvector column
ALTER TABLE courses ADD COLUMN tsv_title_description tsvector 
  GENERATED ALWAYS AS (
    to_tsvector('english', COALESCE(title, '') || ' ' || COALESCE(description, ''))
  ) STORED;

-- Create GIN index for full-text search
CREATE INDEX idx_courses_fts ON courses USING GIN (tsv_title_description);

-- Keep trigram indexes as fallback for ILIKE queries
CREATE EXTENSION IF NOT EXISTS pg_trgm;
CREATE INDEX idx_courses_title_trgm ON courses USING GIN (title gin_trgm_ops);
CREATE INDEX idx_courses_description_trgm ON courses USING GIN (description gin_trgm_ops);
```

### Query Changes

#### Before (Trigram Similarity):
```javascript
const result = await client.query(
  'SELECT * FROM courses WHERE (title || \' \' || COALESCE(description, \'\')) % $1 ORDER BY similarity((title || \' \' || COALESCE(description, \'\')), $1) DESC',
  [searchTerm]
);
```

#### After (Native Full-Text Search):
```javascript
const result = await client.query(
  'SELECT * FROM courses WHERE tsv_title_description @@ to_tsquery(\'english\', $1) ORDER BY ts_rank(tsv_title_description, to_tsquery(\'english\', $1)) DESC',
  [searchTerm]
);
```

## Key Benefits

### 1. **Performance Improvement**
- Expected **significant reduction** in search time (estimated 5-15x faster)
- Optimized for word-based matching rather than character-level similarity
- Pre-computed tsvector values (stored generated column) eliminate runtime conversion overhead

### 2. **Better Indexing**
- GIN index on tsvector is highly optimized for full-text search
- Smaller index size compared to trigram indexes
- Faster index lookups for word-based queries

### 3. **Linguistic Features**
- Stemming support (e.g., "running" matches "run")
- Stop word filtering
- Language-specific text processing (using 'english' configuration)
- Better relevance ranking with `ts_rank()`

### 4. **Storage Efficiency**
- Generated column is automatically maintained
- No need for manual updates when title/description changes
- Single tsvector column vs. concatenated string operations

## Technical Details

### tsvector Data Type
- Sorted list of distinct lexemes (normalized words)
- Removes duplicates and stores positions
- Pre-processed for optimal search performance

Example:
```sql
SELECT to_tsvector('english', 'Introduction to Advanced Computer Science');
-- Result: 'advanc':3 'comput':4 'introduct':1 'scienc':5
```

### tsquery Data Type
- Represents a search query with boolean operators
- Supports AND (&), OR (|), NOT (!) operators
- Can use phrase search and proximity operators

### ts_rank Function
- Calculates relevance score based on:
  - Frequency of search terms
  - Proximity of terms
  - Document structure
- Provides better ranking than simple similarity scoring

## Migration Guide

### For Existing Deployments

1. **Stop the database**:
   ```bash
   npm run db:stop
   ```

2. **Remove old database volumes** (if needed):
   ```bash
   docker volume rm db-benchmark_postgres_data
   docker volume rm db-benchmark_alloydb_data
   ```

3. **Start fresh database**:
   ```bash
   npm run db:postgresql  # or npm run db:alloydb
   ```

4. **Seed data**:
   ```bash
   node postgresql/generate_sample_data.js  # or alloydb/generate_sample_data.js
   ```

5. **Run benchmarks**:
   ```bash
   node benchmark.js postgresql  # or alloydb
   ```

### For Development

The schema changes are automatically applied when the database initializes with the new SQL files.

## Comparison with Other Approaches

### vs. Trigram Similarity (pg_trgm)
- ✅ Faster for word-based searches
- ✅ Better linguistic support (stemming, stop words)
- ✅ More efficient indexing
- ❌ Less flexible for partial word matching
- ❌ Doesn't handle typos as well

### vs. ILIKE Pattern Matching
- ✅ Much faster for multi-word searches
- ✅ Better ranking/relevance scoring
- ✅ Language-aware processing
- ❌ More complex query syntax
- ❌ Requires index on tsvector column

### vs. MySQL FULLTEXT
- ✅ More advanced linguistic features
- ✅ Better configurability
- ✅ Support for multiple text search configurations
- ⚖️ Similar performance (both optimized for full-text search)

## Performance Expectations

Based on typical PostgreSQL full-text search benchmarks and comparing to MySQL's FULLTEXT performance:

| Database | Previous (Trigram) | Expected (Full-Text) | Target |
|----------|-------------------|---------------------|---------|
| PostgreSQL | 41.56 ms | **3-8 ms** | 5-10x faster |
| AlloyDB | 22.04 ms | **2-6 ms** | 4-8x faster |
| MySQL (reference) | N/A | 2.82 ms | Competitive |

## Additional Optimization Opportunities

### 1. Custom Text Search Configuration
Create domain-specific dictionaries for better accuracy:
```sql
CREATE TEXT SEARCH CONFIGURATION custom_english (COPY = english);
ALTER TEXT SEARCH CONFIGURATION custom_english
  ALTER MAPPING FOR word WITH custom_dict, english_stem;
```

### 2. Weighted Search
Give more weight to title matches vs. description:
```sql
ALTER TABLE courses ADD COLUMN tsv_weighted tsvector
  GENERATED ALWAYS AS (
    setweight(to_tsvector('english', COALESCE(title, '')), 'A') ||
    setweight(to_tsvector('english', COALESCE(description, '')), 'B')
  ) STORED;
```

### 3. Phrase Search
Support exact phrase matching:
```javascript
// Example: "computer science"
const result = await client.query(
  'SELECT * FROM courses WHERE tsv_title_description @@ phraseto_tsquery(\'english\', $1)',
  [searchPhrase]
);
```

### 4. Highlighting Results
Show matching text excerpts:
```sql
SELECT 
  title,
  ts_headline('english', description, to_tsquery('english', 'search & term'))
FROM courses
WHERE tsv_title_description @@ to_tsquery('english', 'search & term');
```

## Monitoring and Tuning

### Check Index Usage
```sql
SELECT 
  schemaname,
  tablename,
  indexname,
  idx_scan,
  idx_tup_read,
  idx_tup_fetch
FROM pg_stat_user_indexes
WHERE indexname = 'idx_courses_fts';
```

### Analyze Query Performance
```sql
EXPLAIN ANALYZE
SELECT * FROM courses 
WHERE tsv_title_description @@ to_tsquery('english', 'course')
ORDER BY ts_rank(tsv_title_description, to_tsquery('english', 'course')) DESC;
```

## References

- [PostgreSQL Full Text Search Documentation](https://www.postgresql.org/docs/current/textsearch.html)
- [PostgreSQL GIN Indexes](https://www.postgresql.org/docs/current/gin.html)
- [Text Search Functions and Operators](https://www.postgresql.org/docs/current/functions-textsearch.html)
- [Trigram Extension Documentation](https://www.postgresql.org/docs/current/pgtrgm.html)

## Troubleshooting

### Issue: Query returns no results
**Cause**: `to_tsquery` expects formatted search terms (e.g., 'word1 & word2')

**Solution**: Use `plainto_tsquery` for simpler queries:
```javascript
const result = await client.query(
  'SELECT * FROM courses WHERE tsv_title_description @@ plainto_tsquery(\'english\', $1)',
  [searchTerm]
);
```

### Issue: Slow performance despite indexes
**Cause**: Statistics may be outdated

**Solution**: Run ANALYZE:
```sql
ANALYZE courses;
```

### Issue: Index not being used
**Cause**: Query planner may choose sequential scan for small tables

**Solution**: Check with EXPLAIN and adjust `enable_seqscan` if needed:
```sql
SET enable_seqscan = OFF;  -- Force index usage (for testing only)
```

## Conclusion

The migration from trigram similarity to native full-text search provides:
- **Significantly improved performance** (5-10x faster expected)
- **Better linguistic features** (stemming, stop words)
- **More efficient indexing** (smaller, faster GIN indexes)
- **Cost-effective ranking** (ts_rank vs. similarity calculation)

This brings PostgreSQL and AlloyDB text search performance on par with MySQL's FULLTEXT implementation while providing more advanced features.
