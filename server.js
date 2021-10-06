const express = require('express');
const bodyparser = require('body-parser');
const bcrypt = require('bcryptjs');
const { v4: uuidv4 } = require('uuid');
const http = require('http')
const url = require('url')
const path = require('path')
const fs = require('fs');
const multer  = require('multer');
const multerUpload = multer({ dest: 'uploads/' });
const router = express.Router();

const app = express();
app.use('/',router);
const port = process.env.PORT || 3000

app.use(bodyparser.json());

const passport = require('passport');
const { Passport } = require('passport');
const { query, response } = require('express');
const { json } = require('body-parser');
const { Console } = require('console');
const BasicStrategy = require('passport-http').BasicStrategy;

passport.use(new BasicStrategy(
    function(username, password, done) {
  
        const user = users.find(u => u.username == username);
        if(user == undefined) {
            console.log("HTTP Basic username not found" );
            return done(null, false);
        }
  
        if(bcrypt.compareSync(password, user.password) == false) {
            console.log("HTTP Basic password not matching username");
            return done(null, false);
        }
        
        let apikey = validateApiKey(username)
        console.log("Apikey " + apikey + " send to user "  + username);
        return done(null, {username: username, apikey: apikey });
    }
));

function validateApiKey (username) {
    let apikey = null;
    const user = users.find(u => u.username == username);
    if(user === undefined){
        apikey = false
    }else {
        apikey = user.apikey;
    }
    if(apikey === false)
    {
        console.log("HTTP Basic ApiKey not found");
    }
    if(apikey === null)
    {
        if(user === undefined)
        {
            return false
        }else{
            user.apikey = uuidv4();
            apikey = user.apikey;
        }
        console.log("HTTP Basic ApiKey is null");
        console.log("Generating ApiKey...");
    }

    return apikey
}


function checkForApiKey(req, res, next)
{
  const receivedKey = req.get('apikey');
  if(receivedKey === undefined) {
    return res.status(401).json({Unauthorized: "Missing Api Key"});
  }

  const user = users.find(u => u.apikey == receivedKey);
  if(user === undefined) {
    return res.status(400).json({ BadRequest: "Incorrect Api Key"});
  }

  req.user = user;


  next();
}


app.get('/apikeytest', checkForApiKey, (req, res) => {
    res.status(200).json({ApiKeyTest: "ApiKey OK"})
});


app.get('/user', (req, res) => {
    res.json({users})
})


app.post('/register', (req, res) => {

    if('username' in req.body == false) {
        res.status(400);
        res.json({BadRequest: "Missing username"});
        return;
    }
    if('email' in req.body == false) {
        res.status(400);
        res.json({BadRequest: "Missing email"});
        return;
    }
    if('password' in req.body == false) {
        res.status(400);
        res.json({BadRequest: "Missing password"});
        return;
    }

    const hashedPassword = bcrypt.hashSync(req.body.password, 6);
    users.push({
        id: uuidv4(),
        username: req.body.username,
        email: req.body.email,
        password: hashedPassword,
        apikey: null
    });
    
    res.status(201).json({Created: "User successfully created"});
})



app.get('/login', passport.authenticate('basic', { session: false }), (req, res) => {
    
    res.json({apikey: req.user.apikey});
});



app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname+"/index.html"))
})

app.get('/items', (req, res) => {
    res.json({result: items})
})



function img(req){
    var array = []
    try{
       
        req.files.forEach(f => {
            fs.renameSync(f.path, './uploads/' + f.originalname);
            array.push('./uploads/' + f.originalname);
        })
    }catch{
        
    }
    
    for (i = array.length; i < 4; i++){
        array[i] = null;
    }
    return array
}


const validateEmpty = (req, res, next) => {
    const result = req.body
    for(key in req.body){
        if(req.body[key] === "" || req.body[key] === undefined || req.body[key] === null){
            return res.status(400).json({ BadRequest: "Missing properties"})
        }
    }
    next();
}


app.post('/items', checkForApiKey, multerUpload.array('img', 4), validateEmpty, (req, res) => {
    var imgArray = img(req);
    
    const newItem = {
        id: uuidv4(),
        title:  req.body.title,
        description: req.body.description,
        category: req.body.category,
        location: req.body.location,
        images: {
            image1: imgArray[0],
            image2: imgArray[1],
            image3: imgArray[2],
            image4: imgArray[3]
        },
        price: req.body.price,
        postDate: req.body.postDate,
        deliverType: req.body.deliverType,
        contactInfo: req.body.contactInfo
    }
    items.push(newItem)
    res.status(201).json({Created: "Item successfully created"})
})



app.put('/items/:id', checkForApiKey, multerUpload.array('img', 4),  (req, res) => {
    const result = items.find(t => t.id == req.params.id)
    if(result !== undefined) {
        for(const key in req.body) {
            result[key] = req.body[key]
        }
        var imgCount = 0
        var imgArray = img(req);
        for(const img in result["images"]){
            result["images"][img] = imgArray[imgCount]
            imgCount += 1
        }
        res.status(200).json({Modify: "Changes saved"})
    } else {
        res.status(404).json({NotFound: "Item with this id does not exist"})
    }
    
})


app.delete('/items/:id', checkForApiKey, (req, res) => {
    const result = items.findIndex(t => t.id == req.params.id)
    if(result !== -1) {
        items.splice(result, 1)
        res.status(200).json({Deleted: "Item has been deleted"})
    } else {
        res.status(404).json({NotFound: "Item with this id does not exist"})
    }
})



app.get('/items/search', (req, res) => {
    var qs = url.parse(req.url, true).query
    var search_items = []

    for(const param in qs) {
        if(search_items.length === 0) {
            search_items = items.filter(item => item[param] === qs[param])
        } else {
            search_items = search_items.filter(item => item[param] === qs[param])
        }
    }

    if(search_items.length > 0) {
        res.status(200).json({results: search_items})
    } else {
        res.status(404).json({NotFound: "Item with this id does not exist"})
    }
})


let apiInstance = null;
exports.start = () => {
    apiInstance = app.listen(port, () => {
        console.log(`[API]: Example app listening at http://localhost:${port}`)
    })
}

exports.stop = () => {
    apiInstance.close();
    console.log("[API]: Api closed");
}

let users = [
    {
        id: "55eaec5b-d638-48ad-a679-2ccd3ee8f1e0",
        username: "Jari Myyrä",
        email: "Jari.myyrä@email.com",
        password: "$2b$06$2sFvJIiEh/prhBXCbQDeRurvb6blx4yK2N8O4do6zUxiG/cLDABuC", //S4l4s4n4
        apikey: "28003bf1-d64e-4bce-800a-19d76c96ea4e"
    }
];

let items = [
    {
        id: "testid",
        title: "Test title",
        description: "Test description",
        category: "test category",
        location: "test location",
        images: {
            image1: "Phat/test",
            image2: null,
            image3: null,
            image4: null
        },
        price: 100.00,
        postDate: "2021-10-01",
        deliverType: true,
        contactInfo: "test@test.com"
    },
    {
        id: uuidv4(),
        title: "Jarin mankka",
        description: "basso rikki",
        category: "jenkka mankat",
        location: "Ankkalinna",
        images: {
            image1: null,
            image2: null,
            image3: null,
            image4: null
        },
        price: 100.00,
        postDate: "2021-10-01",
        deliverType: true,
        contactInfo: "Jari@Ankkamankka.com"
    }
]

