## Updated Benchmark Results Summary (UNBIASED - After Fixes)

### Performance Comparison (Average time per request in milliseconds)

| Operation | MySQL | PostgreSQL | AlloyDB | MongoDB | Elasticsearch |
|-----------|-------|------------|---------|---------|---------------|
| __Keyword Text Search__ | __2.82__ | 4.32 | 4.24 | 6.19 | 6.22 |
| __Lookup by Identifier__ | __0.26__ | 0.30 | 0.23 | 0.59 | 2.26 |
| __Lookup by Multiple Factors__ | __0.84__ | 1.00 | 0.89 | 1.05 | 2.51 |
| __Aggregation Top 5 Courses__ | 70.49 | 63.35 | 69.38 | 208.56 | __3.73__ |
| __Insert Enrollment__ | 9.69 | 3.44 | 3.72 | __0.50__ | 13.81 |
| __Update Enrollment__ | 9.15 | 2.99 | 5.24 | __0.53__ | 14.90 |
| __Delete Enrollment__ | 9.47 | 2.88 | 4.50 | __0.52__ | 13.62 |
| __Database Size__ | 78.22 MB | 158.7 MB | 183.31 MB | __67.89 MB__ | __60.01 MB__ |


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
- PostgreSQL: 4.32ms (full-text search optimized)
- AlloyDB: 4.24ms (full-text search optimized)
- Elasticsearch: 6.22ms (optimized for search)
- MongoDB: 6.19ms (text index)

__Fastest Point Lookups:__
- __AlloyDB__: 0.23ms (cloud-native excellence)
- __MySQL__: 0.26ms
- PostgreSQL: 0.30ms

__Fastest Complex Queries:__
- __MySQL__: 0.84ms
- __AlloyDB__: 0.89ms (impressive)
- PostgreSQL: 1.00ms

__Fastest Aggregations:__
- __Elasticsearch__: 3.73ms (designed for analytics - 17x faster!)
- PostgreSQL: 63.35ms
- AlloyDB: 69.38ms

__Fastest Inserts:__
- __MongoDB__: 0.50ms (document model excels)
- PostgreSQL: 3.44ms
- AlloyDB: 3.72ms

__Fastest Writes (Updates/Deletes):__
- __MongoDB__: Update 0.53ms, Delete 0.52ms (after optimization)
- __PostgreSQL__: Update 2.99ms, Delete 2.88ms
- AlloyDB: Update 5.24ms, Delete 4.50ms
- MySQL: Update 9.15ms, Delete 9.47ms

### 2. __Database Rankings by Overall Performance__

__1. MongoDB__ - Best for high-volume write workloads (after optimization)
- **Exceptional writes** (0.50-0.53ms inserts/updates/deletes)
- Good reads (0.59-1.05ms)
- Good text search (6.19ms)
- Slow aggregations (208.56ms - needs further optimization)

__2. PostgreSQL__ - Most balanced performance across all workloads
- Excellent writes (2.88-2.99ms)
- Good reads (0.30-1.00ms)
- Solid aggregations (63.35ms)

__3. AlloyDB__ - Best for cloud-native read-heavy workloads
- Fastest point lookups (0.23ms)
- Competitive complex queries (0.89ms)
- Good writes (4.50-5.24ms)

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
| PostgreSQL | 4.32ms | Full-text search (tsvector) | Optimized with GIN index |
| AlloyDB | 4.24ms | Full-text search (tsvector) | Optimized with GIN index |
| Elasticsearch | 6.22ms | Inverted index | Search engine, full features |
| MongoDB | 6.19ms | Text index | Weighted fields |

**Key Insight**: PostgreSQL and AlloyDB full-text search optimization brought performance on par with other databases, using `to_tsvector` and `to_tsquery` with GIN indexes for efficient word-based searching.


### 5. __Workload-Specific Recommendations__

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

### 6. __Database Size Analysis__

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
