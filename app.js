var express = require('express');
var mongoClient = require('mongodb').MongoClient;
var mqtt = require('mqtt');
var subscriber_config = require('./node_subscriber_config');
var bodyParser = require('body-parser');
var morgan = require('morgan');
var mongoose = require('mongoose');
var jwt = require('jsonwebtoken');
var User = require('./models/user');
var Data = require('./models/data');

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

var client = mqtt.connect("mqtt://" + subscriber_config.broker_info.url + ":" + subscriber_config.broker_info.port.toString(), subscriber_config.broker_info.options);

client.on('connect', function() {
  client.subscribe(subscriber_config.broker_info.topic);
  connection_status = true;
});

client.on('message', function(topic, message) {
  if (connection_status && sensorDB) {
    data = JSON.parse(message.toString());
    insertSensorData(sensorDB, data, function(result) {});
  } else {
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

app.use(bodyParser.urlencoded({extended: false}));
app.use(bodyParser.json());

app.use(morgan('dev'));

app.get('/', function(req, res) {
  res.write('NodeJS eHealth secure API \n');
  res.write('Authentication required to retrieve a temporary token. \n');
  res.write('Documentation : \n');
  res.write('\t - Get all users : /api/users/\n');
  res.write('\t - Get one user : /api/users/<userID>\n');

  res.end();
});

app.listen(port);
console.log('Connected');

app.get('/setup', function(req, res) {

  var nick = new User({client_id: 'test', password: 'password', admin: false, token: ''});

  nick.save(function(err) {
    if (err)
      throw err;

    console.log('User saved successfully');
    res.json({success: true});
  });
});

var router = express.Router();

router.post('/authenticate', function(req, res) {

  User.findOne({
    client_id: req.body.client_id
  }, function(err, user) {

    if (err)
      throw err;

    if (!user) {
      res.json({success: false, message: 'Authentication failed. Client ID not found.'});
    } else if (user) {

      if (user.password != req.body.password) {
        res.json({success: false, message: 'Authentication failed. Wrong password.'});
      } else {
        var token = '';
        token = jwt.sign(user, app.get('superSecret'), {expiresIn: 1});
        user.token = token;
        user.save();
        res.json({success: true, message: 'Token sent !', token: token});
      }

    }

  });
});

router.use(function(req, res, next) {

  var token = req.body.token || req.query.token || req.headers['x-access-token'];

  if (token) {

    jwt.verify(token, app.get('superSecret'), function(err, decoded) {
      if (err) {
        return res.json({success: false, message: 'Failed to authenticate token.'});
      } else {
        req.decoded = decoded;
        next();
      }
    });

  } else {

    return res.status(403).send({success: false, message: 'No token provided.'});

  }
});

router.get('/', function(req, res) {
  res.json({message: 'Authentication successful.'});
});

router.get('/users', function(req, res) {
  User.find({}, function(err, users) {
    res.json(users);
  });
});

router.get('/users/:username', function(req, res) {
  User.find({
    name: req.params.username
  }, function(err, users) {
    res.json(users);
  });
});

// Retrieve all the data
router.get('/data', function(req, res) {
  Data.find({}, function(err, datalist) {
    res.json(datalist);
  });
});

// Retrieve data from a given client_id
router.get('/data/:client_id', function(req, res) {
  verifyToken(req, function(cb) {
    if (cb) {
      Data.find({
        client_id: req.params.client_id
      }, function(err, data) {
        res.json(data);
      });
    } else {
      res.json({success: false, message: 'You do not have the permission to access such data.'})
    }
  });

});

// Retrieve data from a given client_id and data type
router.get('/data/:client_id/:type', function(req, res) {
  verifyToken(req, function(cb) {
    if (cb) {
      Data.find({
        client_id: req.params.client_id,
        type: req.params.type
      }, function(err, data) {
        res.json(data);
      });
    } else {
      res.json({success: false, message: 'You do not have the permission to access such data.'})
    }
  });
});

// Retrieve data from a given client_id and data type, starting from start
router.get('/data/:client_id/:type/:start', function(req, res) {
  verifyToken(req, function(cb) {
    if (cb) {
      Data.find({
        client_id: req.params.client_id,
        type: req.params.type,
        timestamp: {
          $gte: req.params.start
        }
      }, function(err, data) {
        res.json(data);
      });
    } else {
      res.json({success: false, message: 'You do not have the permission to access such data.'})
    }
  });

});

// Retrieve data from a given client_id and data type, ranging from start to end
router.get('/data/:client_id/:type/:start/:end', function(req, res) {
  verifyToken(req, function(cb) {
    if (cb) {
      Data.find({
        client_id: req.params.client_id,
        type: req.params.type,
        timestamp: {
          $gte: req.params.start,
          $lte: req.params.end
        }
      }, function(err, data) {
        res.json(data);
      });
    } else {
      res.json({success: false, message: 'You do not have the permission to access such data.'})
    }
  });
});

// Returns true if the user has the permission to access the required data, else returns false
function verifyToken(req, cb) {
  var token = req.body.token || req.query.token || req.headers['x-access-token'];
  var client_id = req.params.client_id;

  if (token) {
    User.findOne({
      $or: [
        {
          token: token,
          admin: true
        }, {
          token: token,
          client_id: client_id
        }
      ]
    }, function(err, user) {
      if (err)
        throw err;
      if (!user) {
        cb(false);
      } else if (user) {
        cb(true);
      }

    });

  } else {
    cb(false);
  }
}

app.use('/api', router);
