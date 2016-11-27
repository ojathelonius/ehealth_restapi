var express = require('express');
var mongodb_config = require('./mongodb_config');
var bodyParser = require('body-parser');
var morgan = require('morgan');
var mongoose = require('mongoose');
var jwt = require('jsonwebtoken');
var User = require('./models/user');
var Data = require('./models/data');
var cors = require('cors');

// Init app
var app = express();

// Set port to listen
// Insteading of listening to port 80, use port 3000 instead and set a reverse proxy like nginx on the server
var port = process.env.PORT || 3000;

// Declare db
var sensorDB = false;

var connection_status;

app.use(cors());

mongoose.connect(mongodb_config.url); // connect to database
app.set('superSecret', mongodb_config.secret); // secret variable

app.use(bodyParser.urlencoded({extended: false}));
app.use(bodyParser.json());

app.use(morgan('dev'));

app.get('/', function(req, res) {
  res.write('NodeJS eHealth secure API \n');
  res.end();
});

app.listen(port);

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
        var token = jwt.sign({
          client_id: user.client_id,
          admin: user.admin
        }, app.get('superSecret'), {expiresIn: 24000});
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
    client_id: req.params.username
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
  if (req.decoded.admin) {
    cb(true);
  } else {
    cb(req.decoded.client_id == req.params.client_id);
  }
}

app.use('/', router);
