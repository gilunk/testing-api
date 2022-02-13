var createError = require('http-errors');
var express = require('express');
var path = require('path');
var cookieParser = require('cookie-parser');
var logger = require('morgan');
var { MongoClient, ObjectId } = require('mongodb');
var bodyParser = require('body-parser');
var multer = require('multer');
var upload = multer();
var { body, validationResult } = require('express-validator');

var indexRouter = require('./routes/index');
var usersRouter = require('./routes/users');

var app = express();

// view engine setup
app.set('views', path.join(__dirname, 'views'));
app.set('view engine', 'jade');

app.use(logger('dev'));
app.use(express.json());
app.use(express.urlencoded({ extended: false }));
app.use(bodyParser.json());

const http = require('http');
const res = require('express/lib/response');
const hostname = '127.0.0.1';
const port = 3000;

const server = http.createServer((req, res) => {
  res.statusCode = 200;
  res.setHeader('Content-Type', 'text/plain');
  res.end('Hello World');
});

// DB Configuration
const uri = `mongodb://${hostname}:27017`;
const dbName = 'test_hospital';
const client = new MongoClient(uri, {
  useNewUrlParser: true,
  useUnifiedTopology: true,
})

client.connect((error, client) => {
  if (error) {
    return console.log('Connection Failed');
  }
})

server.listen(port, hostname, () => {
  console.log(`Server running at http://${hostname}:${port}/`);
});

app.use(cookieParser());
app.use(express.static(path.join(__dirname, 'public')));
app.use(upload.array());

// Global Functions
getLatestVisitor = function(callback) {
  const db = client.db(dbName);
  db.collection('visitors').find().limit(1).sort({created_at: -1}).toArray((err, result) => {
    if (err) {
      callback(err, null);
    } else {
      callback(null, result);
    }
  });
}

getDateNow = function(withTime = true) {
  let now = new Date().toISOString();
  const date = now.split('T')[0];
  const time = now.split('T')[1].split('.')[0];

  return withTime ? `${date} ${time}` : `${date}`;
}

generateQueueNumber = function(stringNumber) {
  let newQueueNumber = parseInt(stringNumber.substr(stringNumber.length - 3)) + 1;

  if (newQueueNumber > 99) {
    return `A${newQueueNumber}`;
  } else if (newQueueNumber > 9) {
    return `A0${newQueueNumber}`;
  } else {
    return `A00${newQueueNumber}`;
  }
}

// Routes
app.use('/', indexRouter);
app.use('/users', usersRouter);

app.get('/visitors', function(req, res, next) {
  try {
    const db = client.db(dbName);
    db.collection('visitors').find().toArray((error, result) => {
      res.status(200).json({
        status: true,
        message: 'Berhasil mengambil data',
        data: result
      });
    });
  } catch (error) {
    res.status(404).json({
      status: false,
      message: error
    });
  }
});

app.get('/visitors/:id', function(req, res, next) {
  try {
    const db = client.db(dbName);
    db.collection('visitors').findOne({ _id : ObjectId(req.params.id) }, function(error, result) {
      res.status(200).json({
        status: true,
        message: 'Berhasil mengambil data',
        data: result
      });
    });
  } catch (error) {
    res.status(404).json({
      status: false,
      message: error
    });
  }
});

app.get('/visitors/:id/print', function(req, res, next) {
  try {
    const db = client.db(dbName);
    db.collection('visitors').findOne({ _id : ObjectId(req.params.id) }, function(error, result) {
      if (!result) {
        res.status(404).json({
          status: false,
          message: 'Data not found',
        });
      }

      result.message = "Budayakan antri untuk kenyamanan bersama \n Terima kasih atas kunjungan Anda";
      res.status(200).json({
        status: true,
        message: 'Berhasil mengambil data',
        data: result
      });
    });
  } catch (error) {
    res.status(404).json({
      status: false,
      message: error
    });
  }
});

app.post(
  '/visitors/store',
  body('name').isString(), 
  body('email').isEmail(), 
  body('phone_number').isLength({ max: 15 }).isNumeric(), 
  function(req, res, next) {
  try {
    const errors = validationResult(req);

    if (!errors.isEmpty()) {
      res.status(422).json({
        status: false,
        message: 'Invalid given data',
        errors: errors.array(),
      })
    }

    getLatestVisitor(function(err, result) {
      let currentQueueNumber = "0";

      if (result.length) {
        const latestVisitor = result[0];
        const dateNow = getDateNow(false);

        // Check latest data with now date, if same then continue the queue number from highest, otherwise start over from beginning
        if (dateNow === latestVisitor.created_at.split(" ")[0]) {
          currentQueueNumber = latestVisitor.queue_number;
        }
      } 

      const db = client.db(dbName);
      db.collection('visitors').insertOne(
        {
          queue_number: generateQueueNumber(currentQueueNumber),
          name: req.body.name,
          email: req.body.email,
          phone_number: req.body.phone_number,
          created_at: getDateNow(),
          updated_at: getDateNow(),
        },
        (error, result) => {
          if (error) {
            res.status(422).json({
              status: false,
              message: error
            })
          }
    
          res.status(201).json({
            status: true,
            message: 'Data pengunjung berhasil dibuat',
            data: result
          });
        }
      );
    });
  } catch (error) {
    res.status(422).json({
      status: false,
      message: error
    });
  }
});

app.put(
  '/visitors/:id', 
  body('name').isString(), 
  body('email').isEmail(), 
  body('phone_number').isLength({ max: 15 }).isNumeric(), 
  function(req, res, next) {
  try {
    const errors = validationResult(req);

    if (!errors.isEmpty()) {
      res.status(422).json({
        status: false,
        message: 'Invalid given data',
        errors: errors.array(),
      })
    }

    const db = client.db(dbName);
    db.collection('visitors').findOneAndUpdate(
    {
      _id: ObjectId(req.params.id)
    },
    { $set: 
      {
        name: req.body.name,
        email: req.body.email,
        phone_number: req.body.phone_number,
        updated_at: getDateNow(),
      }
    }).then((result) => {
      console.log(result);
      res.status(204).json({
        status: true,
        message: 'Berhasil update data pengunjung',
        data: result
      });
    }).catch((error) => {
      res.status(422).json({
        status: false,
        message: error
      });
    });
  } catch (error) {
    res.status(422).json({
      status: false,
      message: error
    });
  }
});

app.delete('/visitors/:id', function(req, res, next) {
  try { 
    const db = client.db(dbName);
    db.collection('visitors').deleteOne({
      _id: ObjectId(req.params.id)
    }).then((result) => {
      console.log(result);
      res.status(204).json({
        status: true,
        message: 'Berhasil hapus data pengunjung',
        data: []
      });
    }).catch((error) => {
      res.status(422).json({
        status: false,
        message: error
      });
    });
  } catch (error) {
    res.status(422).json({
      status: false,
      message: error
    });
  }
});

// catch 404 and forward to error handler
app.use(function (req, res, next) {
  next(createError(404));
});

// error handler
app.use(function (err, req, res, next) {
  // set locals, only providing error in development
  res.locals.message = err.message;
  res.locals.error = req.app.get('env') === 'development' ? err : {};

  // render the error page
  res.status(err.status || 500);
  res.render('error');
});

module.exports = app;
