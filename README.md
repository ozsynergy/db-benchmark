# Goals
The goal of this project is to benchmark 3 database engines against each other.
The 3 database servers are elasticseach,  mongo and mysql.

Each database will contain the same schema and dataset.

The benchmark will perform 3 different query types.
The most common scenarios are a keyword text search
Lookup by identifier (like an email address)
Lookup by multiple factors
Aggregation (top 5 courses)

# Usage:
Start one database server you wish to benchmark
npm run db:mongo
npm run db:mysql
npm run db:elasticseach

node benchmark <server type> <request count>   

# Clean up:
Stops all database docker containers
npm run db:stop
