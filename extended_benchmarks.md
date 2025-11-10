## Updated Benchmark Results Summary (UNBIASED - After Fixes)

### Performance Comparison (Average time per request in milliseconds)

| Operation | MySQL | PostgreSQL | AlloyDB | MongoDB | Elasticsearch |
|-----------|-------|------------|---------|---------|---------------|
| __Keyword Text Search__ | __2.82__ | 41.56 | 22.04 | 6.33 | 6.22 |
| __Lookup by Identifier__ | 0.26 | 0.38 | __0.27__ | 0.54 | 2.26 |
| __Lookup by Multiple Factors__ | 1.31 | 0.95 | __0.84__ | 1.59 | 2.51 |
| __Aggregation Top 5 Courses__ | 70.49 | 63.23 | 69.75 | 200.95 | __3.73__ |
| __Insert Enrollment__ | 9.69 | 3.27 | 4.01 | __0.52__ | 13.81 |
| __Update Enrollment__ | 9.15 | __3.34__ | 7.46 | 125.29 | 14.90 |
| __Delete Enrollment__ | 9.47 | __2.84__ | 5.15 | 111.23 | 13.62 |

## Key Changes From Previous Biased Results

### What Was Fixed:
1. **PostgreSQL/AlloyDB Text Search**: Changed from `ILIKE '%term%'` to proper trigram similarity search with GiST index
2. **Elasticsearch Email Lookup**: Changed from `match` query to `term` query for keyword fields  
3. **MongoDB Memory**: Removed 1GB cache limit - now has unlimited memory
4. **Elasticsearch Memory**: Changed from 512MB to 2GB heap (balanced, not unlimited to prevent OOM)

### Performance Changes After Fixes:

**PostgreSQL Text Search:**
- **Before (ILIKE)**: 4.43 ms
- **After (Trigram Similarity)**: 41.56 ms
- **WORSE** - The trigram similarity operator is actually slower than ILIKE for this use case. This reveals that PostgreSQL's pattern matching with ILIKE was actually reasonably efficient, and the GIN index helped. The similarity search with scoring is more computationally expensive.

**AlloyDB Text Search:**
- **Before (ILIKE)**: 4.53 ms
- **After (Trigram Similarity)**: 22.04 ms
- **WORSE** - Similar to PostgreSQL, the similarity scoring adds overhead

**Elasticsearch Email Lookup:**
- **Before (match query)**: 3.99 ms
- **After (term query)**: 2.26 ms
- **43% FASTER** - Using proper exact matching improved performance

**MongoDB Updates/Deletes:**
- **Before (1GB cache)**: Update 102.47 ms, Delete 111.36 ms
- **After (unlimited)**: Update 125.29 ms, Delete 111.23 ms
- **SIMILAR/SLIGHTLY WORSE** - Removing memory constraint didn't help as expected. This suggests the issue is elsewhere (possibly indexing, write amplification, or query patterns)

**Elasticsearch Overall:**
- Generally improved with more heap space
- Term query optimization helps identifier lookups

## Updated Key Findings & Analysis

### 1. __Performance Rankings by Operation__

__Fastest Text Search:__
- __MySQL__: 2.82ms (FULLTEXT index dominates)
- Elasticsearch: 6.22ms (optimized for search)
- MongoDB: 6.33ms (text index)

__Fastest Point Lookups:__
- __MySQL__: 0.26ms
- __AlloyDB__: 0.27ms (cloud-native excellence)
- PostgreSQL: 0.38ms

__Fastest Complex Queries:__
- __AlloyDB__: 0.84ms (impressive)
- PostgreSQL: 0.95ms
- MySQL: 1.31ms

__Fastest Aggregations:__
- __Elasticsearch__: 3.73ms (designed for analytics - 17x faster!)
- PostgreSQL: 63.23ms
- AlloyDB: 69.75ms

__Fastest Inserts:__
- __MongoDB__: 0.52ms (document model excels)
- PostgreSQL: 3.27ms
- AlloyDB: 4.01ms

__Fastest Writes (Updates/Deletes):__
- __PostgreSQL__: Update 3.34ms, Delete 2.84ms
- AlloyDB: Update 7.46ms, Delete 5.15ms
- MySQL: Update 9.15ms, Delete 9.47ms

### 2. __Database Rankings by Overall Performance__

__1. PostgreSQL__ - Most balanced performance across all workloads
- Excellent writes (2.84-3.34ms)
- Good reads (0.38-0.95ms)
- Solid aggregations (63.23ms)

__2. AlloyDB__ - Best for cloud-native read-heavy workloads
- Fastest complex queries (0.84ms)
- Competitive point lookups (0.27ms)
- Good writes (5.15-7.46ms)

__3. MySQL__ - Best for text search workloads
- Dominant text search (2.82ms with FULLTEXT)
- Excellent point lookups (0.26ms)
- Moderate writes (9.15-9.47ms)

__4. Elasticsearch__ - Unmatched for analytics/aggregations
- Exceptional aggregations (3.73ms - 17x faster than SQL databases)
- Good text search (6.22ms)
- Moderate writes (13.62-14.90ms)

__5. MongoDB__ - Specialized performance profile
- Exceptional inserts (0.52ms)
- Poor updates/deletes (111-125ms) - needs investigation
- Slow aggregations (200.95ms)

### 3. __Surprising Findings__

**PostgreSQL Trigram Similarity is Slower:**
- The "fix" to use similarity search made text search 9x slower
- ILIKE pattern matching was actually more efficient for this use case
- **Recommendation**: Revert to ILIKE or use full-text search (to_tsvector/to_tsquery) instead

**MongoDB Update/Delete Performance Still Poor:**
- Removing memory constraints didn't help
- 111-125ms for updates/deletes suggests deeper issues:
  - Possible lack of proper indexes on `id` field
  - Write amplification
  - Journal/durability overhead
  - Need to investigate with explain plans

**Elasticsearch Needs Memory:**
- 512MB heap caused OOM (exit code 137)
- 2GB heap works but still constrained compared to unlimited for other DBs
- Consider matching memory allocation across all databases for fairness

### 4. __Text Search Analysis__

| Database | Time | Implementation | Notes |
|----------|------|----------------|-------|
| MySQL | 2.82ms | FULLTEXT index | Purpose-built, highly optimized |
| Elasticsearch | 6.22ms | Inverted index | Search engine, full features |
| MongoDB | 6.33ms | Text index | Weighted fields |
| AlloyDB | 22.04ms | Trigram similarity | Scoring overhead |
| PostgreSQL | 41.56ms | Trigram similarity | Scoring overhead |

**Key Insight**: The trigram similarity operator `%` with scoring is significantly slower than simple pattern matching for this workload. PostgreSQL/AlloyDB should either use:
1. ILIKE with GIN index (fast pattern matching)
2. Full-text search with `to_tsvector`/`to_tsquery` (semantic search)

### 5. __MongoDB Performance Issues to Investigate__

Despite removing memory constraints, MongoDB still shows:
- **Update**: 125.29ms (37x slower than PostgreSQL)
- **Delete**: 111.23ms (39x slower than PostgreSQL)  
- **Aggregation**: 200.95ms (53x slower than Elasticsearch, 3x slower than PostgreSQL)

**Possible causes:**
1. Missing index on `id` field in enrollments collection
2. Using `id` field instead of `_id` for lookups (not using primary key)
3. Write concern settings causing synchronization overhead
4. WiredTiger storage engine configuration needs tuning

### 6. __Workload-Specific Recommendations__

__High-Performance OLTP:__
- __PostgreSQL__ (best balanced writes/reads)
- __AlloyDB__ (cloud-native alternative)

__Text Search:__
- __MySQL__ (2.82ms with FULLTEXT)
- __Elasticsearch__ (6.22ms with full search features)

__Analytics/Aggregations:__
- __Elasticsearch__ (3.73ms - no competition)

__Cloud-Native:__
- __AlloyDB__ (excellent read performance, Google Cloud optimized)

__High-Volume Writes:__
- __MongoDB__ (0.52ms inserts, but fix update/delete issues)
- __PostgreSQL__ (balanced 2.84-3.34ms)

### 7. __Resource Allocation Notes__

**Current Setup:**
- PostgreSQL, MySQL, AlloyDB: Unlimited Docker resources
- MongoDB: Unlimited Docker resources (1GB cache limit removed)
- Elasticsearch: 2GB heap (was 512MB, caused OOM when unlimited)

**For Fairness:**
All databases should ideally have equal resource constraints. Consider setting:
- 4GB memory limit for all containers
- Equal CPU allocation
- This would provide more realistic production-like comparison

## Recommendations for Further Investigation

1. **Revert PostgreSQL/AlloyDB text search** to ILIKE or implement proper full-text search with to_tsvector
2. **Investigate MongoDB** update/delete performance - check indexes, explain plans, write concern
3. **Set equal memory limits** for all databases (e.g., 4GB each) for fairer comparison
4. **Add warm-up phase** to benchmark to eliminate cold-start effects
5. **Verify MongoDB** is using `_id` for primary key operations instead of custom `id` field
6. **Consider connection pooling** for all databases to reflect production patterns

## Conclusion

After removing the major biases:
- **MySQL** remains the text search champion with purpose-built FULLTEXT indexing
- **PostgreSQL** shows the most balanced performance across all operation types
- **AlloyDB** demonstrates excellent cloud-native read performance
- **Elasticsearch** is unmatched for aggregations (17x faster than SQL databases)
- **MongoDB** needs configuration investigation for update/delete operations
- **PostgreSQL trigram similarity** proved slower than expected - ILIKE or full-text search recommended
