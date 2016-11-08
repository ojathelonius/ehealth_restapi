var express = require('express');
var mongoClient = require('mongodb').MongoClient;
var mqtt = require('mqtt');
var subscriber_config = require('./node_subscriber_config');
var bodyParser  = require('body-parser');
var morgan      = require('morgan');
var mongoose    = require('mongoose');
var jwt    = require('jsonwebtoken');
var User   = require('./models/user');
var Data   = require('./models/data');

// Init app
var app = express();

// Set port to listen
var port = process.env.PORT || 3000;

// Declare db
var sensorDB = false;

var connection_status;

//Connect to db
mongoClient.connect(subscriber_config.mongodb_info.url, function(err, db) {
    if (!err) {
        console.log('MongoDB connected');
        mongoCollection = db.createCollection(subscriber_config.mongodb_info.collection, {
            strict: true
        }, function(err, collection) {});
        sensorDB = db;
    }
});

var client = mqtt.connect("mqtt://"+subscriber_config.broker_info.url+":"+subscriber_config.broker_info.port.toString(), subscriber_config.broker_info.options);


client.on('connect', function() {
    client.subscribe(subscriber_config.broker_info.topic);
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


mongoose.connect(subscriber_config.mongodb_info.url); // connect to database
app.set('superSecret', subscriber_config.mongodb_info.secret); // secret variable

app.use(bodyParser.urlencoded({ extended: false }));
app.use(bodyParser.json());

app.use(morgan('dev'));

app.get('/', function(req, res) {
    res.send('API route : http://localhost:' + port + '/api');
});

app.listen(port);
console.log('Connected');


app.get('/setup', function(req, res) {

  var nick = new User({
    name: 'user',
    password: 'password',
    admin: true
  });

  nick.save(function(err) {
    if (err) throw err;

    console.log('User saved successfully');
    res.json({ success: true });
  });
});

var apiRoutes = express.Router();


apiRoutes.post('/authenticate', function(req, res) {

  User.findOne({
    name: req.body.name
  }, function(err, user) {

    if (err) throw err;

    if (!user) {
      res.json({ success: false, message: 'Authentication failed. User not found.' });
    } else if (user) {

      if (user.password != req.body.password) {
        res.json({ success: false, message: 'Authentication failed. Wrong password.' });
      } else {


        var token = jwt.sign(user, app.get('superSecret'), {
          expiresIn: 1440
        });

        res.json({
          success: true,
          message: 'Enjoy your token!',
          token: token
        });
      }

    }

  });
});

// Temporary disabled
// apiRoutes.use(function(req, res, next) {
//
//   var token = req.body.token || req.query.token || req.headers['x-access-token'];
//
//   if (token) {
//
//     jwt.verify(token, app.get('superSecret'), function(err, decoded) {
//       if (err) {
//         return res.json({ success: false, message: 'Failed to authenticate token.' });
//       } else {
//         req.decoded = decoded;
//         next();
//       }
//     });
//
//   } else {
//
//     return res.status(403).send({
//         success: false,
//         message: 'No token provided.'
//     });
//
//   }
// });


apiRoutes.get('/', function(req, res) {
  res.json({ message: 'Welcome to the coolest API on earth!' });
});

apiRoutes.get('/users', function(req, res) {
  User.find({}, function(err, users) {
    res.json(users);
  });
});

apiRoutes.get('/data', function(req, res) {
  Data.find({}, function(err, datalist) {
    console.log(datalist);
    res.json(datalist);
  });
});


app.use('/api', apiRoutes);
