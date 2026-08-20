/**
 * Adds call direction scope to AI functions:
 * inbound | outbound | both (default both — keeps existing tools available everywhere)
 */
exports.up = async function (knex) {
  const hasColumn = await knex.schema.hasColumn("ai_functions", "direction");
  if (hasColumn) return;

  await knex.schema.alterTable("ai_functions", (table) => {
    table.string("direction", 20).notNullable().defaultTo("both");
  });
};

exports.down = async function (knex) {
  const hasColumn = await knex.schema.hasColumn("ai_functions", "direction");
  if (!hasColumn) return;

  await knex.schema.alterTable("ai_functions", (table) => {
    table.dropColumn("direction");
  });
};
