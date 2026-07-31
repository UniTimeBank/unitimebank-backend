#!/bin/bash
set -e

psql -v ON_ERROR_STOP=1 --username "$POSTGRES_USER" <<-EOSQL
    CREATE DATABASE auth_db;
    CREATE DATABASE user_db;
    CREATE DATABASE booking_db;
    CREATE DATABASE session_db;
    CREATE DATABASE wallet_db;
    CREATE DATABASE moderation_db;
    CREATE DATABASE notification_db;
EOSQL
