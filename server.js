var express = require('express');
var mongojs = require("mongojs");
var bodyPraser = require("body-parser");
var cookiePraser = require("cookie-parser");
var expressSession = require("express-session");
var passport = require('passport');
var passportLocal = require('passport-local').Strategy;
var passportHttp = require("passport-http");
var schedule = require('node-schedule');
var nodemailer = require('nodemailer');

var transporter = nodemailer.createTransport({
    service: 'SendGrid',
    auth: {
      user: process.env.SENDGRID_USERNAME,
      pass: process.env.SENDGRID_PASSWORD
    }
});

var app = express();
var userDb;
var todoDb;

if(process.env.MONGOLAB_URI){
  userDb = mongojs(process.env.MONGOLAB_URI, ['user']);
  todoDb = mongojs(process.env.MONGOLAB_URI, ['todo']);
}else{
  userDb = mongojs('user', ['user']);
  todoDb = mongojs('todo', ['todo']);
}

app.use(express.static(__dirname + "/client"));

app.use(bodyPraser.json());

app.use(cookiePraser());

app.use(expressSession({ 
  secret: 'wishupApp',
  resave: false,
  saveUninitialized: false
}));

app.use(passport.initialize());

app.use(passport.session());

passport.use(new passportLocal(userAuth));

function userAuth(username, password, done){
  userDb.user.findOne({ username: username }, function(err, user) {
    if(err) {
      return done(err);
    }
    if(!user) {
      return done(null, false, { message: 'Incorrect username.' });
    }
    if(user.password!=password) {
      return done(null, false, { message: 'Incorrect password.' });
    }
    return done(null, user);
  });
}

function sendRemainderEmail(task){
  userDb.user.findOne({ _id: mongojs.ObjectId(task.user_id) }, function(err, user) {
    console.log(err);
    
    var body = 'Hi, <br/>You have a task "'+task.task+'" scheduled for '+task.due_date+' at "'+task.location+'" <br/> Regards,<br/>Satya';
    var mailOptions = {
      from: 'Satya <satya9731@gmail.com>',
      to: user.username,
      subject: 'Task Remainder',
      text: '',
      html: body
    };
    transporter.sendMail(mailOptions, function(error, info){
      if(error){
          return console.log(error);
      }
      console.log('Message sent: ' + info.response);
    });
  });
}

passport.serializeUser(function(user,done) {
  done(null, user._id);
});

passport.deserializeUser(function( id, done) {
  userDb.user.find({_id: mongojs.ObjectId(id)}, function(err, doc) {
    done(null, doc);
  })
});

function isAuthenticated(req, res, next){
  if(req.isAuthenticated()){
    next();
  }else{
    res.status(403).json({err: "Forbidden"});
  }
}

app.get('/user', isAuthenticated, function(req,res){
  res.json(req.user[0]._id);
});

app.get('/', isAuthenticated, function(req, res) {
  res.redirect('/');
});

app.post('/login', function(req, res, next) {
  passport.authenticate('local', function(err, user, info) {
    if (err) {
      return res.status(500).json({err: err});
    }
    if (!user) {
      return res.status(401).json({err: info});
    }
    req.logIn(user, function(err) {
      if (err) {
        return res.status(500).json({err: 'Could not log in user'});
      }
      res.status(200).json({status: 'Login successful!'});
    });
  })(req, res, next);
});

app.get('/logout', function(req, res) {
  req.logout();
  res.redirect('/');
});

app.get('/task', isAuthenticated, function(req, res) {
  var userId = ""+req.user[0]._id+"";
  //console.log(userId);
  todoDb.todo.find({ user_id: userId }, function(err, doc) {
    res.json(doc);
  });
});

app.post('/task', isAuthenticated, function(req, res) {
  todoDb.todo.insert(req.body, function(err, doc) {
    var due_time = new Date(doc.due_date);
    var remainder_time = new Date(due_time.setMinutes(due_time.getMinutes()-5));
    var current_time = new Date();
    if((remainder_time.getTime()-current_time.getTime())>60000){
      console.log("Remainder Time", remainder_time);
      var j = schedule.scheduleJob(remainder_time, function(){
        sendRemainderEmail(doc);
      });
    }
    res.json(doc);
  })
});

app.delete('/task/:id', isAuthenticated, function(req, res) {
  var id = req.params.id;
  todoDb.todo.remove({_id: mongojs.ObjectId(id)}, function(err, doc) {
    res.json(doc);
  })
});

app.put('/task/:id', isAuthenticated, function(req, res) {
  var id = req.params.id;
  todoDb.todo.findAndModify({ 
    query: {_id: mongojs.ObjectId(id)},
    update: {$set: {status: req.body.status}},
    new: true
  }, function(err, doc) {
    res.json(doc);
  })
});

var server = app.listen(process.env.PORT || 3000, process.env.IP || "0.0.0.0", function(){
  var addr = server.address();
  console.log("Chat server listening at", addr.address + ":" + addr.port);
});