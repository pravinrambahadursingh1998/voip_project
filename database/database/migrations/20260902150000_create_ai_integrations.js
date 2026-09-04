/**
 * Migration to create ai_integrations table for storing third-party API credentials
 * (e.g. OpenDental) scoped by company and linked to gateway extensions.
 */
exports.up = async function (knex) {
  const exists = await knex.schema.hasTable('ai_integrations');
  if (exists) return;

  await knex.schema.createTable('ai_integrations', (table) => {
    table.increments('id').primary();
    table.integer('company_id').nullable().index();
    table.string('provider', 100).notNullable().defaultTo('opendental');
    table.text('api_key').notNullable();
    table.text('headers').nullable();
    table.string('content_type', 100).notNullable().defaultTo('application/json');
    table.string('base_url', 255).notNullable().defaultTo('https://api.opendental.com/api/v1');
    table.string('extension', 100).nullable().index();
    table.boolean('is_active').notNullable().defaultTo(true);
    table.integer('created_by').nullable();
    table.integer('updated_by').nullable();
    table.timestamps(true, true); // created_at and updated_at
  });
};

exports.down = async function (knex) {
  const exists = await knex.schema.hasTable('ai_integrations');
  if (!exists) return;

  await knex.schema.dropTable('ai_integrations');
};
