const bookshelf = require("../config/bookshelf");

const Extension = bookshelf.model("Extension", {
  tableName: "extensions",
});

module.exports = Extension;
