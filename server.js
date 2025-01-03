const express = require('express');
const dotenv = require('dotenv');
const multer = require('multer');//for proccessing image files
var cors = require('cors');
const bcrypt = require('bcrypt');
const http = require('http');
const WebSocket = require('ws');
const {MongoClient, ServerApiVersion, ObjectId} = require('mongodb');
const nunjucks = require('nunjucks');

dotenv.config();

// database configurations
const uri = process.env.URI;

const client = new MongoClient(uri);

// initialize connection to database
const initDB = async()=>{
  try {
    await client.connect();
    const db = client.db('restrodb');
    return db;
  }catch(e){
    console.log('Error initializing database: ',e);
  }
};

const restroDb = initDB();

// restroDb.then(async(db)=>{
//   await db.createCollection('users');
//   await db.createCollection('restaurants');
//   await db.createCollection('menu');
//   await db.createCollection('food_item');
//   await db.createCollection('bookings');
//   await db.createCollection('reviews');
// });


var port = process.env.PORT;

const app = express();

app.set('view engine', 'html')

var corsOptions = {
  methods: 'GET,POST',
  credentials: true,
  optionsSuccessStatus:200
};
app.use(cors(corsOptions));

app.options('*', cors());

app.use(express.static('public'));
app.use(express.static('uploads'));
app.use(express.static('chat-files'));

app.use(express.json());
app.use(express.urlencoded({extended:true}));

const server = http.createServer(app);

//file storage
const storage = multer.diskStorage({
  destination: function(req,file,cb){
    cb(null,'uploads/');
  },
  filename:function(req,file,cb){
    var food = req.body;
    if(file){ 
      //rename the file to avoid conflict
      cb(null,food.food_item.replaceAll(' ','-')+'-'+food._id+'.'+file.originalname.split('.')[1]);
    }
  }
});

const upload = multer({storage: storage});



// root site
app.get('/', function(req,res){
    res.sendFile(__dirname + '/public/home.html');
});
// clock site
app.get('/clock', function(req,res){
  res.sendFile(__dirname + '/public/clock.html');
});

app.get('/chat', function(req,res){
  res.sendFile(__dirname + '/public/chat.html');
});

app.get('/admin/:id',function(req,res){
  const id = req.params.id;
  var file = __dirname + '/public/restaurant.html';
  nunjucks.configure(file, {autoescape: true,express: app});
  restroDb.then(async(db)=>{
    const result = await db.collection('menu').find({'restaurant_id':req.params.id}).toArray();
    if(result){
      res.render(file,{'name':'tushar','menuList':result});
    }else{
      res.status(500).json({
        'status': false,
        'message':'Unexpected error occured'
      });
    }
  });

});

//user login api with form data (mobile and password)
app.post("/api/login", (req, res) => {
  const mobile = req.body.mobile;
  const plainPassword = req.body.password;

  if(!mobile){
    res.status(401).json({
      'status':false,
      'message':'Enter Mobile'
    });
  }else if(!plainPassword){
    res.status(401).json({
      'status':false,
      'message':'Enter Password'
    });
  }else{
  restroDb.then(async(db)=>{
    const result = await db.collection('users').findOne({'mobile':mobile});
    if(result){
      if(bcrypt.compareSync(plainPassword,result.password)){//compare user password with bcrypt password
        if(result.user_type=='owner'){
          const restaurant = await db.collection('restaurants').find({'owner':result._id.toHexString()}).toArray();
          res.status(200).json({
            'status':true,
            'user':result,
            'restaurant':restaurant
          });
        }else{
          res.status(200).json({
            'status':true,
            'user':result,
          });
        }
      }else{ // for incorrect password
        res.status(401).json({
          'status':false,
          'message':'Incorrect Password'
        });
      }
    }else{ //for mobile not found
      res.status(200).json({
        'status':false,
        'message':'Mobile Number not found'
      });
    }
  });

}
});


//register user with the values (first_name, last_name, address, mobile, email, user_type('customer'), password)
app.post("/api/register-user", (req,res)=>{
  const data = req.body;

  if(!data.mobile){
    res.status(401).json({
      'status':false,
      'message':'Enter Mobile'
    });
  }else if(!data.password){
    res.status(401).json({
      'status':false,
      'message':'Enter Password'
    });
  }else{
  //converts user's plain password to hashed password
  const hashedPassword = bcrypt.hashSync(data?.password,8);
  data.password = hashedPassword;

  restroDb.then(async(db)=>{
    const result = await db.collection('users').find({mobile:data.mobile}).toArray();
    if(result.length < 1){
      const result = await db.collection('users').insertOne(data);
      res.status(200).json({'status':true,'result':result});
    }else{
      res.status(200).json({
        'status':false,
        'message':'Mobile number already exists'
      });
    }
  });
}
});

// update user info required mobile and password
app.post('/api/update-user',function(req,res){
  const data = req.body;
  //converts user's plain password to hashed password
  if(!data.mobile){
    res.status(200).json({'messsage':'Mobile number required'});
  }else if(!data.password){
    res.status(200).json({'messsage':'Password required'});
  }else{
    restroDb.then(async(db)=>{
      const result = await db.collection('users').findOne({'_id':data.id});
      if(result){
        if(bcrypt.compareSync(data.password,result.password)){//compare password
          // const hashedPassword = bcrypt.hashSync(data.password,8);
          data.password = hashedPassword;
          const query = {$set : {
            first_name: data.first_name,
            last_name: data.last_name,
            address: data.address,
            email: data.email,
            user_type: data.user_type
          }};
          restroDb.then(async(db)=>{
            const result = await db.collection('users').updateOne({'_id':data.id},query);
            if(result){
              res.status(200).json({
                'status':true,
                'message':'Profile Updated'
              });
            }
          });
        }else{
          res.status(401).json({
            'status':true,
            'message':'Password is incorrect'
          });
        }
      }
   });
  }
});

//fetch all users in the database
app.get('/api/all-users', (req,res)=>{
  restroDb.then(async(db)=>{
    const result = await db.collection('users').find({}).toArray();
    if(result){
      res.status(200).json({
        'status':true,
        'result':result
      });
    }
  });
});

// this api expects (user_id, restaurant (name*,address*,city*,phone1*,phone2,type*,ethnicity*,table_capacity*,service_type*,location))
// user_type should be 'owner' to register a restaurant
app.post("/api/register-restaurant", (req,res)=>{
  const data = req.body;

  restroDb.then(async(db)=>{
    const result = await db.collection('restaurants').insertOne(data);
    if(result){
      res.status(200).json({
        'status':true,
        'message':'Restaurant added'
      });
    }else{
      res.status(500).json({
        'status':false,
        'message':'Unexpected error occured'
      });
    }
  });

});

// update restaurant information
app.post('/api/update-restaurant', (req,res)=>{
  const data = req.body;

  const query = {$set: {
    name: data.name,
    address: data.address,
    city: data.city,
    state: data.state,
    phone1: data.phone1,
    phone2: data.phone2,
    type: data.type,
    ethnicity: data.ethnicity,
    table_capacity: data.table_capacity,
    service_type: data.service_type,
    location: data.location,
  }};
  restroDb.then(async(db)=>{
    const result = await db.collection('restaurants').updateOne({'_id':new ObjectId(data.user_id)},query);
    if(result){
      res.status(200).json({
        'status':true,
        'message':'Restaurant updated successfully'
      });
    }else{
      res.status(500).json({
        'status': false,
        'message':'Unexpected error occured'
      });
    }
  });
});

// get restaurant by id
app.get('/api/get-restaurant/:id',(req,res)=>{
  restroDb.then(async(db)=>{
    const result = await db.collection('restaurants').findOne({'_id':new ObjectId(req.params.id)});
    if(result){
      res.status(200).json({
        'status':true,
        'result':result
      });
    }else{
      res.status(500).json({
        'status': false,
        'message':'Unexpected error occured'
      });
    }
  });
});

//to fetch restaurants for owners
app.post('/api/show-restaurants',(req,res)=>{
  restroDb.then(async(db)=>{
    const restaurants = await db.collection('restaurants').find({'owner':req.id}).toArray();
    if(restaurants){
      res.status(200).json({
        'status':true,
        'restaurants':restaurants
      });
    }
  });
});


// post restaurants list based on filter
app.post("/api/restaurants", (req, res) => {
  const filter = req.body;
  const qName = filter.name ? new RegExp(filter.name, 'gi') : null;
  const qCity = filter.city ? new RegExp(filter.city, 'gi') : null;
  const qEthnicity = filter.ethnicity ? new RegExp(filter.ethnicity, 'gi') : null;

  const query = {
    $and: [
      qName ? { name: qName } : {},
      qCity ? { city: qCity } : {},
      qEthnicity ? { ethnicity: qEthnicity } : {}
    ]
  };

  if (filter.type || filter.table_capacity || filter.service_type) {
    query.$or = [];
  
    if (filter.type) {
      query.$or.push({ type: filter.type });
    }
  
    if (filter.table_capacity) {
      query.$or.push({ table_capacity: { $gte: filter.table_capacity } });
    }
  
    if (filter.service_type) {
      query.$or.push({ service_type: filter.service_type });
    }
  }

  restroDb.then(async(db)=>{
    const result = await db.collection("restaurants").find(query).toArray();
    if(result){
      res.status(200).json({
        'status':true,
        'result':result
      });
    }else{
      res.status(500).json({
        'error':'Error in fetching restaurants'
      });
    }
  });
  });

// get all restaurants
app.get('/api/all-restaurants',(req,res)=>{
  restroDb.then(async(db)=>{
    const result = await db.collection('restaurants').find({}).toArray();
    if(result){
      res.status(200).json({
        'status':true,
        'result':result
      });
    }else{
      res.status(500).json({
        'status': false,
        'message':'Unexpected error occured'
      });
    }
  });
});

//create menu item for a particular restaurant
app.post('/api/create-menu', upload.single('image'),(req,res)=>{
  const formdata = req.body;
  const image = req.file;

  restroDb.then(async(db)=>{
    const result = await db.collection('menu').insertOne(formdata);
    if(result){
      res.status(200).json({
        'status':true,
        'message':'Menu Item created'
      });
    }else{
      res.status(500).json({
        'status': false,
        'message':'Unexpected error occured'
      });
    }
  });
});

// get menu list from the restaurant id
app.get('/api/menu/:id',(req,res)=>{
  const id = req.params.id;
  restroDb.then(async(db)=>{
    const result = await db.collection('menu').find({'restaurant_id':req.params.id}).toArray();
    if(result){
      res.status(200).json({
        'status':true,
        'result':result
      });
    }else{
      res.status(500).json({
        'status': false,
        'message':'Unexpected error occured'
      });
    }
  });
});

//update menu item with provided menu id
app.post('/api/update-menu', upload.single('food_image_url'),(req,res)=>{
  const formdata = req.body;
  const foodImage = req.file;

  const query = {$set:{
    food_item: formdata.food_item,
    food_desc: formdata.food_desc,
    type: formdata.type,
    price: formdata.price
  }};
  if(foodImage){
    query.$set.food_image_url = foodImage?.filename;
  }
  restroDb.then(async(db)=>{
    const result = await db.collection('menu').updateOne({'_id':new ObjectId(formdata._id)},query);
    if(result.modifiedCount > 0){
      res.status(200).json({
        'status':true,
        'message':'Menu item updated Successfully'
      });
    }else if(result.modifiedCount==0){
      res.status(500).json({
        'status': false,
        'message':'No records updated'
      });
    }else{
      res.status(500).json({
        'status': false,
        'message':'Unexpected error occured'
      });
    }
  });
});

//bookings by user
app.get('/api/get-bookings/:id',(req,res)=>{
  
  restroDb.then(async(db)=>{
    const result = await db.collection('bookings').aggregate([
      { $match: { user_id: new ObjectId(req.params.id) } },{
        $lookup: {
          from:'restaurants',
          localField: 'restaurant_id',
          foreignField: '_id',
          as:'restaurant'
        }
      },
      {$unwind: '$restaurant'}
    ]).toArray();
    if(result){
      res.status(200).json({
        'status':true,
        'result':result
      });
    }else{
      res.status(500).json({
        'status':false,
        'message':'Error in fetching bookings'
      });
    }
  });
});

//create booking
app.post('/api/booking',(req,res)=>{
  const data = req.body;
  console.log(data);
  restroDb.then(async(db)=>{
    const result = await db.collection('bookings').insertOne(data);
    if(result){
      res.status(200).json({
        'status':true,
        'message':'A table has been booked for you. We welcome your visit.'
      });
    }else{
      res.status(500).json({
        'status': false,
        'message':'Unexpected error occured'
      });
    }
  });

});

//add review for restaurant
app.post('/api/add-review', (req,res)=>{
  const data = req.body;
  restroDb.then(async(db)=>{
    const result = await db.collection('reviews').insertOne(data);
    if(result){
      res.status(200).json({
        'status':true,
        'message':'Your review has been submitted'
      });
    }else{
      res.status(500).json({
        'status': false,
        'message':'Unexpected error occured'
      });
    }
  });
});




// darzo projects apis below //

// new connection to chat database
const connection = async()=>{
  try {
    await client.connect();
    const db = client.db('chat-db');
    return db;
  }catch(e){
    console.log('Error initializing database: ',e)
  }
};

// initialize connection to chat database
const chatDB = connection();


const fs = require('fs');
const path = require('path');

var firebase = require("firebase-admin");

//firebase utility
var serviceAccount = require(process.env.SERVICE_ACCOUNT);

// initialize firebase
firebase.initializeApp({
  credential: firebase.credential.cert(serviceAccount)
});

// send notification to the users on mobile of they appear offline by the websocket
async function sendNotification(mobile, title, body){
  await chatDB.then(async(db)=>{
    const result = await db.collection('fcm-tokens').findOne({'mobile':mobile});
    return result;
  }).then(async(result)=>{
    if(result){
      try{
        await firebase.messaging().send({
          token:result.token,
          notification:{
            title:title,
            body:body
          }
        });
      }catch{
        (error)=>console.log('firebase error: ',error);
      }
    }
  });
}


//file storage
const chatStorage = multer.diskStorage({
  destination: function(req,file,cb){
    cb(null,'chat-files/');
  },
  filename:function(req,files,cb){
    console.log('storage',files);
    if(files){
      //rename the file to avoid conflict
      cb(null,files.originalname);
    }
  }
});

const chatFiles = multer({storage: chatStorage,limits: { fieldSize: 25 * 1024 * 1024 }});

// to register a new user (form data: first_name,last_name,email,mobile,password)
app.post("/api/chat-register", (req,res)=>{
  const data = req.body;
  //converts user's plain password to hashed password
  const hashedPassword = bcrypt.hashSync(data.password,8);
  data.password = hashedPassword;

  chatDB.then(async(db)=>{
    const result = await db.collection('users').find({mobile:data.mobile}).toArray();
    if(result.length < 1){
      const result = await db.collection('users').insertOne(data);
      res.status(200).json({'status':true,'result':result});
    }else{
      res.result(200).json({
        'status':false,
        'message':'Mobile number already exists'
      });
    }
  });
});

//user login api with form data (mobile and password)
app.post("/api/chat-login", (req, res) => {
  const mobile = req.body.mobile;
  const plainPassword = req.body.password;

  chatDB.then(async(db)=>{
    const result = await db.collection('users').findOne({'mobile':mobile});
    if(result){
      if(bcrypt.compareSync(plainPassword,result.password)){//compare user password with bcrypt password
        res.status(200).json({
          'status':true,
          'user':result,
        });
      }else{ // for incorrect password
        res.status(401).json({
          'status':false,
          'message':'Incorrect Password'
        });
      }
    }else{ //for mobile not found
      res.status(200).json({
        'status':false,
        'message':'Mobile Number not found'
      });
    }
  });
});

// to fetch all users in the database
app.get('/api/chat-users',(req,res)=>{
  chatDB.then(async(db)=>{
    const result = await db.collection('users').find().toArray();
    if(result){
      res.status(200).json({
        'status':true,
        'result':result
      });
    }else{
      res.status(500).json({
        'status':false,
        'message':'Unable to fetch users'
      });
    }
  });
});

// store fcm token in the database
app.post('/api/get-token',(req,res)=>{
  const data = req.body;
  chatDB.then(async(db)=>{
    const result = await db.collection('fcm-tokens').findOne({'mobile':data.mobile});
    if(result){
      db.collection('fcm-tokens').updateOne({'mobile':data.mobile},{$set:{token:data.token}}).then((result)=>{
        if(result){
          res.status(200).json({'status':true,'message':'Token updated'});
        }else{
          res.status(500).json({'status':false,'message':'Failed to update token'});
        }
      });
    }else{
      const result = await db.collection('fcm-tokens').insertOne(data);
      if(result){
        res.status(200).json({'status':true,'result':'Token added'});
      }else{
        res.status(500).json({
          'status':false,
          'message':'Unable to submit token'
        });
      }
    }
  });
});

// get messages between two users
app.get('/api/get-messages/:sender/:receiver',(req,res)=>{
  const sender = req.params.sender;
  const receiver = req.params.receiver;
  chatDB.then(async(db)=>{
    const result = await db.collection("messages").find({
        $or: [
          {
            $and: [
              { sender: sender },
              { receiver: receiver },
            ],
          },
          {
            $and: [
              { sender: receiver },
              { receiver: sender },
            ],
          },
        ],
      })
      .toArray();
    if(result){
      res.status(200).json({
        'status':true,
        'messages':result
      });
    }else{
      res.status(404).json({
        'status':false,
        'error':'No messages found'
      });
    }
  });
});

// fetch messages betwen two users (form data: sender and receiver)
app.post('/api/get-messages',(req,res)=>{
  const sender = req.body.sender;
  const receiver = req.body.receiver;
  chatDB.then(async(db)=>{
    const result = await db.collection("messages").find({
        $or: [
          {
            $and: [
              { sender: sender },
              { receiver: receiver },
            ],
          },
          {
            $and: [
              { sender: receiver },
              { receiver: sender },
            ],
          },
        ],
      }).sort({"sent": -1})
      .limit(20)
      .toArray();
    if(result){
      res.status(200).json({
        'status':true,
        'messages':result
      });
    }else{
      res.status(404).json({
        'status':false,
        'error':'No messages found'
      });
    }
  });
});

// delete all messages between two users
app.get('/api/delete-messages/:sender/:receiver',(req,res)=>{
  const {sender,receiver} = req.params;
  chatDB.then(async(db)=>{
    const result = await db.collection('messages').deleteMany({$or:[{$and:[{'sender':sender},{'receiver':receiver}]},{$and:[{'sender':receiver},{'receiver':sender}]}]})
    if(result.acknowledged){
      res.status(200).json({
        'status':true,
        'result':result
      });
    }
  }).catch(e=>{console.log(e.message)});
});

// add a message to the database
app.post('/api/add-message',(req,res)=>{
  const message = req.body.message;
  chatDB.then(async(db)=>{
    const result = await db.collection('messages').insertOne(message);
    if(result){
      res.status(200).json({
        'status':true,
        'result':result,
      });
    }
  });
});
//,chatFiles.array('media')
app.post('/api/send-media',chatFiles.array('media'),(req,res)=>{
  try{
    const media = JSON.parse(req.body.media);
    if(media && media.length){
      media.forEach(file=>{
        const filepath = path.join(__dirname,'chat-files',file.name);
        fs.writeFileSync(filepath,file.blob.split(';base64,').pop(),'base64');
      });
    }
    res.status(200).json({
      'status':true,
      'message':'file saved'
    });

  }catch{e=>{
    res.status(400).json({
      'status':false,
      'message':'Error in saving the file',
      'error':e.message
    });
  }}
});


app.get('*',(req,res)=>{
  res.send('<h2>Ohh!! The page you are looking for is not found on our server, please check the URL.');
});

const ws = new WebSocket.Server({server:server});

const users = {};

ws.on('connection', (socket,req)=>{
  const userId = req.url.split('/').pop();
  users[userId] = socket;
  
  socket.on("message", (msg)=>{
    const data = JSON.parse(msg.toString());
    const receiver = users[data.receiver];
    const sender = users[data.sender];
    if(data.check=='ping'){
      if(receiver?.readyState==WebSocket.OPEN){
        sender.send(JSON.stringify({status:'Connected',user:data.receiver,ping:true}));
      }else{
        sender.send(JSON.stringify({status:'offline',user:data.receiver,ping:false}));
      }
    }else{
      
      chatDB.then(async(db)=>{
        await db.collection('messages').insertOne(data);
      });

      if(receiver){
        if(receiver.readyState === WebSocket.OPEN){
          receiver.send(msg.toString());
        }else if(receiver.readyState != WebSocket.OPEN){
          sender.send(JSON.stringify({status:'offline',user:data.receiver,ping:false}));
          sendNotification(mobile=data.receiver,title=data.name,body=data.msg);
        }
      }else{
        if(sender === socket && sender.readyState === WebSocket.OPEN){
          sender.send(JSON.stringify({status:'Connected',user:data.receiver,ping:false}));
        }
      }
    }
  });
  

  socket.on('error', (error)=>{
    console.log('Websocket error: ',error);
  });

  socket.on('close', (event)=>{
    console.log('websocket closed: ',event);
  });

});


server.listen(port,function(){
    console.log(`Listening on port ${port}`);


});

