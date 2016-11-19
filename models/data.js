var mongoose = require('mongoose');
var Schema = mongoose.Schema;

module.exports = mongoose.model('Data', new Schema({
    type: String,
    data: {},
    client_id: String,
    timestamp: Number
}, {
    collection: 'rasp_sensor'
}));
