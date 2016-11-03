var express = require('express');
var mongoClient = require('mongodb').MongoClient;
var mqtt = require('mqtt');

//Init app
var app = express();

//Set pot to listen t
var port = process.env.PORT || 3000;

//Declare db
var sensorDB;

//Mongolab URL
var mongodbUrl = 'mongodb://admin:admin@ds143767.mlab.com:43767/esante';

//Connect to db
mongoClient.connect(mongodbUrl, function(err, db) {
  if(!err) {
    console.log('MongoDB connected');
    mongoCollection = db.createCollection('rasp_sensor', {strict:true}, function(err, collection) {});
    sensorDB = db;
  }
});

//Set the IP
var client = mqtt.connect('mqtt://ip_cible');


client.on('connect', function () {
  client.subscribe('presence');
});

client.on('message', function (topic, message) {
  // message is Buffer
  data = message.toString();
  dataObj = {
    measure: data
  };

  insertSensorData(sensorDB, dataObj, function(result) {});
    console.log(message.toString());
});

//Push data to db function
var insertSensorData = function(db, data, cb) {
  db.collection('rasp_sensor').insertOne(data, function(err, result) {
    if (!err) {
      console.log('Insert data to db succeeded');
    } else {
      console.log('Failed to insert data.')
    }
  });
};

app.listen(port, function () {
  console.log('Listenning on port 3000');
});
