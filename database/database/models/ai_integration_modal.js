const bookshelf = require('../config/bookshelf');

const AiIntegration = bookshelf.model('AiIntegration', {
  tableName: 'ai_integrations',
});

module.exports = AiIntegration;
