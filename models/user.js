var mongoose = require('mongoose');
var Schema = mongoose.Schema;

module.exports = mongoose.model('User', new Schema({
  client_id: String,
  password: String,
  admin: Boolean,
  firstname: String,
  lastname: String,
  age: Number,
  email: String
}));
