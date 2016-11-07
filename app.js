var express = require('express');
var mongoClient = require('mongodb').MongoClient;
var mqtt = require('mqtt');
var config = require('./node_subscriber_config');

// Init app
var app = express();

// Set port to listen
var port = process.env.PORT || 3000;

// Declare db
var sensorDB = false;

var connection_status;

//Mongolab URL
var mongodbUrl = 'mongodb://ehealth:ehealth@ds063856.mlab.com:63856/ojathelonius';

//Connect to db
mongoClient.connect(config.mongodb_info.url, function(err, db) {
    if (!err) {
        console.log('MongoDB connected');
        mongoCollection = db.createCollection(config.mongodb_info.collection, {
            strict: true
        }, function(err, collection) {});
        sensorDB = db;
    }
});

var client = mqtt.connect("mqtt://"+config.broker_info.url+":"+config.broker_info.port.toString(), config.broker_info.options);


client.on('connect', function() {
    client.subscribe(config.broker_info.topic);
    connection_status = true;
});

client.on('message', function(topic, message) {
    if(connection_status && sensorDB) {
        data = JSON.parse(message.toString());
        insertSensorData(sensorDB, data, function(result) {});
    }else{
      console.log('Connection or collection not ready yet.')
    }

});

var insertSensorData = function(db, data, cb) {
    db.collection('rasp_sensor').insertOne(data, function(err, result) {
        if (!err) {
            console.log('Insert data to db succeeded');
        } else {
            console.log('Failed to insert data.')
        }
    });
};

app.listen(port, function() {
    console.log('Listening on port 3000');
});
