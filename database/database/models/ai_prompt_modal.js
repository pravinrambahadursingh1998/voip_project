const bookshelf = require('../config/bookshelf');

const AiPrompt = bookshelf.model('AiPrompt', {
  tableName: 'ai_prompts',
});

module.exports = AiPrompt;
