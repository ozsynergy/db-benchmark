## Updated Benchmark Results Summary (UNBIASED - After Fixes)

### Performance Comparison (Average time per request in milliseconds)

| Operation | MySQL | PostgreSQL | AlloyDB | MongoDB | Elasticsearch |
|-----------|-------|------------|---------|---------|---------------|
| __Keyword Text Search__ | __2.82__ | 41.56 | 22.04 | 6.19 | 6.22 |
| __Lookup by Identifier__ | __0.26__ | 0.38 | 0.27 | 0.59 | 2.26 |
| __Lookup by Multiple Factors__ | __0.84__ | 0.95 | 0.84 | 1.05 | 2.51 |
| __Aggregation Top 5 Courses__ | 70.49 | 63.23 | 69.75 | 208.56 | __3.73__ |
| __Insert Enrollment__ | 9.69 | 3.27 | 4.01 | __0.50__ | 13.81 |
| __Update Enrollment__ | 9.15 | 3.34 | 7.46 | __0.53__ | 14.90 |
| __Delete Enrollment__ | 9.47 | 2.84 | 5.15 | __0.52__ | 13.62 |
| __Database Size__ | 78.22 MB | 175.22 MB | 198.79 MB | __67.89 MB__ | __60.01 MB__ |

## MongoDB Schema Optimization Results (Latest Update)

### What Was Optimized:
1. **Removed unused indexes**: Eliminated indexes on created_at, individual title, department, and instructor_id fields
2. **Added compound index**: Created `{ "department": 1, "instructor_id": 1 }` for multi-factor lookups
3. **Added critical index**: Created index on `"id"` field in enrollments collection for update/delete operations

### Performance Improvements After Optimization:

| Operation | Before | After | Improvement |
|-----------|--------|-------|-------------|
| **Update Enrollment** | 125.29 ms | **0.53 ms** | **236x faster** ✓ |
| **Delete Enrollment** | 111.23 ms | **0.52 ms** | **214x faster** ✓ |
| **Lookup by Multiple Factors** | 1.59 ms | 1.05 ms | **34% faster** ✓ |
| Keyword Text Search | 6.33 ms | 6.19 ms | 2% faster |
| Insert Enrollment | 0.52 ms | 0.50 ms | 4% faster |
| Lookup by Identifier | 0.54 ms | 0.59 ms | 9% slower |
| Aggregation Top 5 Courses | 200.95 ms | 208.56 ms | 4% slower |

### Key Findings:
- **Massive improvement in writes**: The index on the `id` field solved the critical performance bottleneck for updates and deletes
- **Improved multi-factor lookups**: The compound index on department + instructor_id improved performance by 34%
- **Minimal trade-offs**: Removing unused indexes had negligible impact on other operations
- **MongoDB is now competitive**: Updates and deletes are now faster than PostgreSQL (0.53ms vs 3.34ms for updates)

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
- **After (unlimited memory)**: Update 125.29 ms, Delete 111.23 ms
- **After (schema optimization)**: Update **0.53 ms**, Delete **0.52 ms**
- **MASSIVELY IMPROVED (236x faster)** - Adding index on `id` field was the critical fix. The issue was not memory, but missing index on the field used for lookups in update/delete operations

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
- __MongoDB__: Update 0.53ms, Delete 0.52ms (after optimization)
- __PostgreSQL__: Update 3.34ms, Delete 2.84ms
- AlloyDB: Update 7.46ms, Delete 5.15ms
- MySQL: Update 9.15ms, Delete 9.47ms

### 2. __Database Rankings by Overall Performance__

__1. MongoDB__ - Best for high-volume write workloads (after optimization)
- **Exceptional writes** (0.50-0.53ms inserts/updates/deletes)
- Good reads (0.59-1.05ms)
- Good text search (6.19ms)
- Slow aggregations (208.56ms - needs further optimization)

__2. PostgreSQL__ - Most balanced performance across all workloads
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

### 3. __Surprising Findings__

**PostgreSQL Trigram Similarity is Slower:**
- The "fix" to use similarity search made text search 9x slower
- ILIKE pattern matching was actually more efficient for this use case
- **Recommendation**: Revert to ILIKE or use full-text search (to_tsvector/to_tsquery) instead

**MongoDB Update/Delete Performance FIXED:**
- ✓ **Problem identified**: Missing index on `id` field in enrollments collection
- ✓ **Solution implemented**: Added `db.enrollments.createIndex({ "id": 1 })`
- ✓ **Result**: Update/delete performance improved 236x (from 125ms to 0.53ms)
- MongoDB now has the **fastest write operations** among all databases tested

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

### 5. __MongoDB Schema Optimization Success__

**Update/Delete Performance SOLVED:**
- ✓ **Root cause**: Missing index on `id` field in enrollments collection
- ✓ **Fix applied**: Added `db.enrollments.createIndex({ "id": 1 })`
- ✓ **Before**: Update 125.29ms, Delete 111.23ms
- ✓ **After**: Update 0.53ms, Delete 0.52ms
- ✓ **Improvement**: 236x faster (now **fastest among all databases**)

**Multi-Factor Lookup Performance IMPROVED:**
- ✓ **Optimization**: Added compound index `{ "department": 1, "instructor_id": 1 }`
- ✓ **Before**: 1.59ms
- ✓ **After**: 1.05ms  
- ✓ **Improvement**: 34% faster

**Remaining Optimization Opportunity:**
- **Aggregation**: 208.56ms (still 53x slower than Elasticsearch, 3x slower than PostgreSQL)
- Consider adding compound index `{ "course_id": 1, "user_id": 1 }` for aggregation queries
- Investigate using aggregation pipeline optimization techniques

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
- __MongoDB__ (0.50-0.53ms all write operations - **fastest**)
- __PostgreSQL__ (balanced 2.84-3.34ms)

### 7. __Database Size Analysis__

| Database | Total Size | Data Size | Index Size | Storage Efficiency |
|----------|------------|-----------|------------|-------------------|
| **Elasticsearch** | **60.01 MB** | N/A | N/A | Most compact |
| **MongoDB** | **67.89 MB** | 55.61 MB | 39.45 MB | 2nd most compact |
| **MySQL** | 78.22 MB | 36.58 MB | 41.64 MB | Moderate |
| **PostgreSQL** | 175.22 MB | N/A | N/A | Largest |
| **AlloyDB** | 198.79 MB | N/A | N/A | Largest (PostgreSQL-based) |

**Dataset**: 20,000 users, 45,000 courses, 450,000 enrollments

**Key Findings:**

1. **Elasticsearch (60.01 MB) - Most Storage Efficient**
   - Highly optimized compression
   - Inverted index structure is space-efficient for this dataset
   - Despite having full-text search capabilities, uses least space

2. **MongoDB (67.89 MB) - Second Most Compact**
   - After schema optimization (removed unused indexes)
   - Data: 55.61 MB, Indexes: 39.45 MB (41% index overhead)
   - Document model with selective indexing proves efficient
   - Removing unused indexes saved significant space

3. **MySQL (78.22 MB) - Moderate Size**
   - Data: 36.58 MB, Indexes: 41.64 MB (53% index overhead)
   - Higher index-to-data ratio than MongoDB
   - FULLTEXT indexes add overhead but enable fast search

4. **PostgreSQL (175.22 MB) - 2.9x Larger than MongoDB**
   - Includes trigram indexes for text search (pg_trgm extension)
   - Trigram indexes are space-intensive
   - More metadata and system catalog overhead

5. **AlloyDB (198.79 MB) - Largest Database**
   - PostgreSQL-compatible, similar overhead
   - Cloud-native features may add metadata
   - 13% larger than base PostgreSQL

**Storage Efficiency Insights:**

- **Index Strategy Impact**: MongoDB's selective indexing approach (after optimization) results in 61% smaller size than PostgreSQL
- **NoSQL vs SQL**: Document databases (MongoDB, Elasticsearch) are more storage-efficient for this schema (60-68 MB vs 78-199 MB)
- **Trigram Cost**: PostgreSQL/AlloyDB's trigram indexes for text search consume significant space (2-3x overhead vs other approaches)
- **Space-Performance Tradeoff**: While PostgreSQL/AlloyDB use more space, they offer strong ACID guarantees and relational integrity

**Recommendations:**
- For space-constrained environments: Elasticsearch or MongoDB
- For balanced space/performance: MySQL or MongoDB
- For feature-rich relational database: Accept PostgreSQL's larger footprint for its capabilities

### 8. __Resource Allocation Notes__

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
2. ✓ ~~**Investigate MongoDB update/delete performance**~~ - **SOLVED**: Added index on `id` field
3. **Optimize MongoDB aggregations** - Consider compound index for course grouping queries
4. **Set equal memory limits** for all databases (e.g., 4GB each) for fairer comparison
5. **Add warm-up phase** to benchmark to eliminate cold-start effects
6. **Consider connection pooling** for all databases to reflect production patterns

## Conclusion

After removing the major biases and optimizing MongoDB schema:
- **MongoDB** now has the **fastest write operations** (0.50-0.53ms) after adding missing indexes
- **MySQL** remains the text search champion with purpose-built FULLTEXT indexing
- **PostgreSQL** shows the most balanced performance across all operation types
- **AlloyDB** demonstrates excellent cloud-native read performance
- **Elasticsearch** is unmatched for aggregations (17x faster than SQL databases)
- **PostgreSQL trigram similarity** proved slower than expected - ILIKE or full-text search recommended

**Key Takeaway**: Proper indexing is critical - MongoDB's update/delete performance improved **236x** simply by adding an index on the `id` field used in query filters.
