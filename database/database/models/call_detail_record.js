const bookshelf = require("../config/bookshelf");

const CDR= bookshelf.model("CDR", {
  tableName: "v_call_detail_record",
});

module.exports = CDR;
