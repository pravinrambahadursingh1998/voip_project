/**
 * Adds od_slots_path to ai_settings so the appointments/Slots endpoint
 * path can be configured per tenant instead of being hardcoded.
 */
exports.up = async function (knex) {
  const hasColumn = await knex.schema.hasColumn("ai_settings", "od_slots_path");
  if (hasColumn) return;

  await knex.schema.alterTable("ai_settings", (table) => {
    table.string("od_slots_path", 255).nullable().defaultTo(null);
  });
};

exports.down = async function (knex) {
  const hasColumn = await knex.schema.hasColumn("ai_settings", "od_slots_path");
  if (!hasColumn) return;

  await knex.schema.alterTable("ai_settings", (table) => {
    table.dropColumn("od_slots_path");
  });
};
