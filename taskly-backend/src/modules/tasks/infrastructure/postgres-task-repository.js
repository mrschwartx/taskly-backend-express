import { generateEntityId } from '../../../shared/domain/entity-id.js';
import { Task } from '../domain/task.js';
import { TaskRepository } from '../domain/task-repository.js';

const COLUMNS =
  'id, owner_id, name, description, priority, due, status, created_at, updated_at';

const SORT_COLUMNS = Object.freeze({
  name: 'name',
  description: 'description',
  priority: 'priority',
  due: 'due',
  status: 'status',
  createdAt: 'created_at',
  updatedAt: 'updated_at',
});

const toEntity = (row) =>
  Task.restore({
    id: row.id,
    ownerId: row.owner_id,
    name: row.name,
    description: row.description,
    priority: row.priority,
    due: row.due.toISOString(),
    status: row.status,
    createdAt: row.created_at.toISOString(),
    updatedAt: row.updated_at.toISOString(),
  });

const resolveOrderBy = (orderBy) => {
  const column = Object.hasOwn(SORT_COLUMNS, orderBy)
    ? SORT_COLUMNS[orderBy]
    : undefined;
  return column
    ? `${column} ASC, created_at ASC, id ASC`
    : 'created_at ASC, id ASC';
};

export class PostgresTaskRepository extends TaskRepository {
  #pool;

  constructor({ pool }) {
    super();
    this.#pool = pool;
  }

  nextId() {
    return generateEntityId();
  }

  async add(task) {
    const snapshot = task.toSnapshot();
    await this.#pool.query(
      `INSERT INTO tasks (${COLUMNS})
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)`,
      [
        snapshot.id,
        snapshot.ownerId,
        snapshot.name,
        snapshot.description,
        snapshot.priority,
        snapshot.due,
        snapshot.status,
        snapshot.createdAt,
        snapshot.updatedAt,
      ]
    );
  }

  async update(task) {
    const snapshot = task.toSnapshot();
    const result = await this.#pool.query(
      `UPDATE tasks
          SET name = $2,
              description = $3,
              priority = $4,
              due = $5,
              status = $6,
              updated_at = $7
        WHERE id = $1`,
      [
        snapshot.id,
        snapshot.name,
        snapshot.description,
        snapshot.priority,
        snapshot.due,
        snapshot.status,
        snapshot.updatedAt,
      ]
    );
    return result.rowCount === 1;
  }

  async findById(id) {
    const { rows } = await this.#pool.query(
      `SELECT ${COLUMNS} FROM tasks WHERE id = $1`,
      [id]
    );
    return rows[0] ? toEntity(rows[0]) : null;
  }

  async findByOwner({ ownerId, status, orderBy, page, pageSize }) {
    const filterValues = [ownerId];
    let where = 'owner_id = $1';
    if (status) {
      filterValues.push(status);
      where += ` AND status = $${filterValues.length}`;
    }

    const limitIndex = filterValues.length + 1;
    const offsetIndex = filterValues.length + 2;

    const [list, count] = await Promise.all([
      this.#pool.query(
        `SELECT ${COLUMNS} FROM tasks
          WHERE ${where}
          ORDER BY ${resolveOrderBy(orderBy)}
          LIMIT $${limitIndex} OFFSET $${offsetIndex}`,
        [...filterValues, pageSize, (page - 1) * pageSize]
      ),
      this.#pool.query(
        `SELECT COUNT(*)::int AS total FROM tasks WHERE ${where}`,
        filterValues
      ),
    ]);

    return { tasks: list.rows.map(toEntity), total: count.rows[0].total };
  }

  async deleteById(id) {
    const result = await this.#pool.query('DELETE FROM tasks WHERE id = $1', [
      id,
    ]);
    return result.rowCount === 1;
  }

  async deleteByOwner(ownerId) {
    const result = await this.#pool.query(
      'DELETE FROM tasks WHERE owner_id = $1',
      [ownerId]
    );
    return result.rowCount;
  }
}
