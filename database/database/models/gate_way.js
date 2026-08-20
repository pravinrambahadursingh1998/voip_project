const bookshelf = require("../config/bookshelf");

const Gateway = bookshelf.model("Gateway", {
  tableName: "v_gateways",
});

module.exports = Gateway;
