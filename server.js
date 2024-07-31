const express = require('express');
const http = require('http');
const WebSocket = require('ws');
const {MongoClient, ServerApiVersion, ObjectId} = require('mongodb');

const uri = "mongodb+srv://test_user:Tushar172001@my-cluster.snudrh9.mongodb.net/?retryWrites=true&w=majority&appName=my-cluster";

const client = new MongoClient(uri);

const initDB = async()=>{
  try {
    await client.connect();
    const db = client.db('restrodb');
    console.log('Connected to database.')
    return db;
  }catch(e){
    console.log('Error initializing database: ',e)
  }
};

// initDB().then(async(db)=>{
//   await db.createCollection('users');
//   await db.createCollection('restaurants');
//   await db.createCollection('menu');
//   await db.createCollection('food_item');
//   await db.createCollection('bookings');
//   await db.createCollection('reviews');
// });

const multer = require('multer');//for proccessing image files
var cors = require('cors');
const dotenv = require('dotenv');
const bcrypt = require('bcrypt');

dotenv.config();

var port = process.env.PORT;

const app = express();
const bodyParser = require('body-parser');

var corsOptions = {
  methods: 'GET,POST',
  credentials: true,
  optionsSuccessStatus:200
};
app.use(cors(corsOptions));

app.options('*', cors())

app.use('/static', express.static('public'));
app.use('/uploads', express.static('uploads'));

app.use(express.json());
app.use(bodyParser.urlencoded({extended:false}));
app.use(bodyParser.json());

const server = http.createServer(app);

//file storage
const storage = multer.diskStorage({
  destination: function(req,file,cb){
    cb(null,'uploads/');
  },
  filename:function(req,file,cb){
    var food = req.body;
    //rename the file to avoid conflict
    cb(null,food.id+'-'+food.food_item.replaceAll(' ','-')+'.'+file.originalname.split('.')[1]);
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

//user login api with form data (mobile and password)
app.post("/api/login", (req, res) => {
  const mobile = req.body.mobile;
  const plainPassword = req.body.password;

  initDB().then(async(db)=>{
    const result = await db.collection('users').findOne({'mobile':mobile});
    if(result){
      console.log(result);
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


//register user with the values (first_name, last_name, address, mobile, email, user_type('customer'), password)
app.post("/api/register-user", (req,res)=>{
  const data = req.body;
  //converts user's plain password to hashed password
  const hashedPassword = bcrypt.hashSync(data.password,8);
  data.password = hashedPassword;

  initDB().then(async(db)=>{
    const result = await db.collection('users').insertOne(data);
    res.status(200).json({'status':true,'result':result});
  });
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
    initDB().then(async(db)=>{
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
          initDB().then(async(db)=>{
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
  initDB().then(async(db)=>{
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

  initDB().then(async(db)=>{
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
  initDB().then(async(db)=>{
    const result = await db.collection('restaurants').updateOne({'_id':data.user_id},data);
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
  initDB().then(async(db)=>{
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
  initDB().then(async(db)=>{
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

  initDB().then(async(db)=>{
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
  initDB().then(async(db)=>{
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

  initDB().then(async(db)=>{
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
  initDB().then(async(db)=>{
    const result = await db.collection('menu').find({'_id':req.params.id}).toArray();
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
app.post('/api/update-menu', upload.single('image'),(req,res)=>{
  const formdata = req.body;
  const foodImage = req.file;

  const query = {$set:{
    food_item: formdata.food_item,
    food_desc: formdata.food_desc,
    type: formdata.type,
    price: formdata.price,
    food_image_url:foodImage.path,
  }};

  initDB().then(async(db)=>{
    const result = db.collection('menu').updateOne({'_id':formdata.id},query);
    if(result){
      res.status(200).json({
        'status':true,
        'message':'Menu item updated Successfully'
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
  
  initDB().then(async(db)=>{
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
  initDB().then(async(db)=>{
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
  initDB().then(async(db)=>{
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

const chatDB = async()=>{
  try {
    await client.connect();
    const db = client.db('chat-db');
    return db;
  }catch(e){
    console.log('Error initializing database: ',e)
  }
};

app.get('/api/chat-users',(req,res)=>{
  chatDB().then(async(db)=>{
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
app.get('/api/get-messages/:sender/:receiver',(req,res)=>{
  const sender = req.params.sender;
  const receiver = req.params.receiver;
  chatDB().then(async(db)=>{
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

app.post('/api/get-messages',(req,res)=>{
  const sender = req.body.sender;
  const receiver = req.body.receiver;
  chatDB().then(async(db)=>{
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

app.post('/api/add-message',(req,res)=>{
  const message = req.body.message;
  chatDB().then(async(db)=>{
    const result = await db.collection('messages').insertOne(message);
    if(result){
      res.status(200).json({
        'status':true,
        'result':result,
      });
    }
  });
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

    chatDB().then(async(db)=>{
      await db.collection('messages').insertOne(data);
    });

    if(receiver !== undefined){
      if(receiver == socket && receiver.readyState === WebSocket.OPEN){
        receiver.send(JSON.stringify(msg.toString()));
      }else if(receiver == socket && receiver.readyState != WebSocket.OPEN){
        sender.send(JSON.stringify({status:'offline',user:data.receiver}));
      }
    }else{
      if(sender === socket && sender.readyState === WebSocket.OPEN){
        sender.send(JSON.stringify({status:'Not connected',user:data.receiver}));
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