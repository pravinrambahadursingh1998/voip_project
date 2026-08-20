const bookshelf = require("../config/bookshelf");

const AiSetting = bookshelf.model("AiSetting", {
  tableName: "ai_settings",
});

module.exports = AiSetting;