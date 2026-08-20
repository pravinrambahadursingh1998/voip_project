const bookshelf = require("../config/bookshelf");

const User = bookshelf.model("User", {
  tableName: "v_users",

  // Relation with company
  company: function () {
    return this.belongsTo("Company", "company_id");
  },

  // Relation with role
  role: function () {
    return this.belongsTo("Role", "role_id");
  },
});
module.exports = User;
