# PostgreSQL local + SQLite fallback — рецепт

## Когда нужно
- backend сохраняет состояние между рестартами
- множественные пользователи / концурентность
- relational queries (joins, aggregations)

## SQLite (по умолчанию для smoke)
SQLite уже доступен через python (`import sqlite3`) и Node (`better-sqlite3`). Для большинства smoke-тестов и MVP этого достаточно.

```python
import sqlite3
con = sqlite3.connect("/workspace/app.db")
con.execute("CREATE TABLE IF NOT EXISTS items(id INTEGER PRIMARY KEY, name TEXT)")
con.execute("INSERT INTO items(name) VALUES (?)", ("hello",))
con.commit()
```

## PostgreSQL local в pod'е (когда SQLite мало)
```bash
apt-get update -qq && apt-get install -y -qq postgresql >/tmp/apt.log 2>&1
# pg_lsclusters покажет уже созданные кластеры
pg_lsclusters
# если кластера нет:
pg_createcluster --start 15 main || pg_createcluster --start 14 main
service postgresql start
```

`timeout_sec >= 120` для apt-get install (большой ставит 200+MB).

## Создать DB и пользователя
```bash
su - postgres -c "psql -c \"CREATE DATABASE app;\""
su - postgres -c "psql -c \"CREATE USER app WITH PASSWORD 'app';\""
su - postgres -c "psql -c \"GRANT ALL PRIVILEGES ON DATABASE app TO app;\""
su - postgres -c "psql -d app -c \"GRANT ALL ON SCHEMA public TO app;\""
```

DATABASE_URL для приложения: `postgres://app:app@localhost/app`.

## SQLAlchemy (Python ORM)
```python
from sqlalchemy import create_engine, Column, Integer, String
from sqlalchemy.orm import declarative_base, sessionmaker

engine = create_engine("postgresql://app:app@localhost/app")
Base = declarative_base()
class Item(Base):
    __tablename__ = "items"
    id = Column(Integer, primary_key=True)
    name = Column(String)
Base.metadata.create_all(engine)
Session = sessionmaker(bind=engine)
```

## Common pitfalls
- **`peer authentication failed`**: дефолт pg_hba.conf требует unix-сокет + peer-auth. Для TCP подключения (`@localhost`) поправь `/etc/postgresql/<v>/main/pg_hba.conf`: добавь `host all all 127.0.0.1/32 md5` И перезапусти.
- **`role "root" does not exist`**: psql под root по умолчанию. Используй `su - postgres -c "psql ..."` или `PGUSER=app psql ...`.
- **PG не стартует**: проверь `service postgresql status`. Логи: `tail /var/log/postgresql/postgresql-*.log`.
- **schema permission missing**: после CREATE DATABASE дополнительно даёт права на `public` schema (см. выше `GRANT ALL ON SCHEMA public`).
