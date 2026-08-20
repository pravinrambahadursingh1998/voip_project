const bookshelf = require('../config/bookshelf');

const AiFunctionParameter = bookshelf.model('AiFunctionParameter', {
    tableName: 'ai_function_parameters',

    function() {
        return this.belongsTo(
            require('./ai_function_modal'),
            'function_id'
        );
    }
});

module.exports = AiFunctionParameter;