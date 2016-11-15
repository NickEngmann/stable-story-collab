 "use strict";
//initialize firebase
var firebase = require("firebase");
var config = {
    apiKey: "AIzaSyCk147Q-MQKikvWVIOO4shXd8C0UKiBKpA",
    authDomain: "story-collab.firebaseapp.com",
    databaseURL: "https://story-collab.firebaseio.com",
    storageBucket: "story-collab.appspot.com",
    messagingSenderId: "814622369840"
  };

firebase.initializeApp(config);

const express = require('express');
const app = express();

const server = require('http').Server(app);
const io = require('socket.io')(server);
const path = require('path');

const port = process.env.PORT || 3000;

const authors = [];
var messages = [];


let areTyping = 0;
var titles = [];
var uniqueIDs = [];
var uniqueStories = [];
var storyNumber = 0;
var currentStoryID = 0;
// var messageNumber = 0;
var oldstory = [];
var firstime = 0;
//checked
//Gets an object array filled with the unique stories. 
function getUniqueStories(){
  firebase.database().ref('Storys/').once('value').then(function(snapshot){
    var storys = snapshot.val();
    storyNumber =(Object.keys(storys).length); //updates the global containing the number of different stories
    uniqueStories = Object.keys(storys).map(function(key) {
       return storys[key];
      });
    });
    console.log(uniqueStories);  
}
getUniqueStories();



// Set view engine to EJS and locate views
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, '/views'));

// Set up static files directory
app.use('/public', express.static(path.join(__dirname, 'client/public')));

app.get('/', (request, response) => {
  response.render('index', {stories: uniqueStories});
});

app.get('/story', (request, response) => {
  //generates a new unique story ID key and redirects to that page
  currentStoryID = guidGenerator();
  response.redirect(`/story/${currentStoryID}`);
  response.redirect(request.get('referer'));
});

app.get('/story/:id', (request, response) => {
  currentStoryID = request.params.id;
      firebase.database().ref('message/'+currentStoryID).once('value').then(function(snapshot){
      var pastStory = snapshot.val();
      messages = [];
      if (pastStory == null){
        response.render('story', {messages: messages});
      }
      else{
        for(var i = pastStory.length - 1; i >= 0; i--) {
            messages[i] = pastStory[i].contents
          };
        response.render('story', {messages: messages});
        }
      });
});

app.get('/favicon.ico', (request, response) => {
  response.sendStatus(200)
    .end();
});

// Always send the index.html
app.get('*', (request, response) => {
  response.redirect('/');
});

io.on('connection', (socket) => {
  const authorId = authors.length;
  authors.push(socket);
  console.log(`New author #${authorId} connected :D`);

  // Disconnect event
  socket.on('disconnect', () => {
    console.log(`Author #${authorId} left :(`)
  });

  // When this socket adds a new message
  socket.on('add message', (data) => {
    console.log(`New message from #${authorId}: ${data.message}`);
    console.log('message array:' + messages);
    // Broadcast new message to all other sockets
    socket.broadcast.emit('new message', data);
    // send to Firebase to store ONLY IF ENDED IS CURRENTLY FALSE
    writeMessageContent(messages, data.message, authorId, currentStoryID);
  });

  // Notify all authors that this author is typing
  socket.on('start typing', () => {
    console.log(`Author #${authorId} is typing.`);
    socket.emit('other typing', ++areTyping);
  });

  // Notify all authors that this author stopped typing
  socket.on('stop typing', () => {
    console.log(`Author #${authorId} stopped typing.`);
    if (areTyping!=0){
    socket.emit('other typing', --areTyping);
  }
  });
});

server.listen(port, () => {
  console.log(`Listening on port http://localhost:${port}/`);
});

function writeMessageContent(messages, message, authorId, currentStoryID){
    //if this is the first message to hit the firebase database it creates the "Story"
    var messageNumber = 0;
     firebase.database().ref('message/'+currentStoryID).once('value').then(function(snapshot){
       var messageJson = snapshot.val();
       if(messageJson != null){
       messageNumber =(Object.keys(messageJson).length);
      }
      else{
        messageNumber = 0;
      }
    if(messageNumber == 0){
      //updates the message array
      messages.push(message);
      //creates the timestamp
      var date = new Date().toISOString().replace(/T/, ' ').replace(/\..+/, '');
      //writes the message data to the firebase database
        firebase.database().ref('message/'+currentStoryID+'/'+ messageNumber).set({
          author: authorId,
          contents : message,
          timestamp: date,
          upvote : 0,
          downvote: 0
        });      
      var endTime = Math.round(new Date().getTime()/1000);
      endTime = (endTime + 1800);
      firebase.database().ref('Storys/'+currentStoryID).set({
        authors: { 
          0:authorId },
        Title : message,
        timestamp: date,
        id: currentStoryID,
        endTime: endTime,
        active: true 
      });
      getUniqueStories();
      messageNumber + 1;
        //updates the total number of messages for that specific story
        firebase.database().ref('Storys/'+currentStoryID).update({
          Total: messageNumber+1
        });
    }
    else{
          messages.push(message);
          //creates the timestamp
          var date = new Date().toISOString().replace(/T/, ' ').replace(/\..+/, '');
          //writes the message data to the firebase database
            firebase.database().ref('message/'+currentStoryID+'/'+ messageNumber).update({
              author: authorId,
              contents : message,
              timestamp: date,
              upvote : 0,
              downvote: 0
            });
        //updates the total number of messages for that specific story
        firebase.database().ref('Storys/'+currentStoryID).update({
          Total: messageNumber+1
        });
       }

       });
}


function guidGenerator() {
    var S4 = function() {
       return (((1+Math.random())*0x10000)|0).toString(16).substring(1);
    };
    return S4();
}

