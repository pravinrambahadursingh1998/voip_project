const bookshelf = require('../config/bookshelf');

const AiFunction = bookshelf.model('AiFunction', {
    tableName: 'ai_functions',

    parameters() {
        return this.hasMany(
            require('./ai_function_parameter_modal'),
            'function_id'
        );
    }
});

module.exports = AiFunction;