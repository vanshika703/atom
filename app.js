const express = require('express')
const app = express()

const { loginValidation,registerValidation } = require('./validation')

const dotenv = require('dotenv')
dotenv.config()

const bcrypt = require('bcryptjs')

const mongoClient = require('mongodb').MongoClient
const objectId = require('mongodb').ObjectId

const nodemailer = require('nodemailer')

const jwt = require('jsonwebtoken')

const ejs = require('ejs')
app.set('view engine','ejs')

app.use(express.urlencoded({extended:false}))
app.use(express.json())

app.get('/', (req,res)=>{
    res.render('register')
})

let host;

app.post('/register', (req,res)=>{

    let { error } = registerValidation(req.body)
    if(error) return res.status(400).json({msg:error.details[0].message})

    mongoClient.connect(process.env.DB_CONNECT, { useUnifiedTopology: true }, (err,db)=>{
        if(err) throw err

        let dbo = db.db("atom")

        dbo.collection('users').findOne({email : req.body.email}, async(dbErr, user)=>{
            if(dbErr) throw dbErr

            //if user exists
            if(user) return res.status(400).json({msg:"Email already registered"})
            //hashing password
            const salt = await bcrypt.genSalt(10)
            const hashedPassword = await bcrypt.hash(req.body.password, salt)

            //new user info
            let userInfo = {
                name : req.body.name,
                email : req.body.email,
                regno : req.body.regno,
                dept : req.body.dept,
                year : req.body.year,
                domain : req.body.domain,
                password : hashedPassword,
                userType : 0,
                verified : 0
            }

            dbo.collection('users').insertOne(userInfo, (dbError,result)=>{
                if(dbError) throw dbError

                host = req.get('host')
                rand = result.insertedId
                link = "http://"+req.get('host')+"/verify?id="+rand;

                let transporter = nodemailer.createTransport({
                    service: 'gmail',
                    auth: {
                        user: process.env.EMAIL,
                        pass: process.env.EMAIL_PASS
                    },
                    tls:{
                        rejectUnauthorized:false
                    }
                });
                    
                let mailOptions = {
                    from: process.env.EMAIL,
                    to: req.body.email,
                    subject: 'Confirmation email for Atom',
                    html: "<p>link is...<a href="+link+">Click here to verify....</a></p>"
                };
                    
                transporter.sendMail(mailOptions, function(error, info){
                    if (error) throw error
                    
                    console.log('Email sent: ' + info.response);
                    res.json({msg:"Registered. Check email for verification link"})
                });

            })
        })
    })    
})
  
app.get('/verify', (req,res) => {

    console.log("link :"+req.protocol+":/"+req.get('host'))

    if((req.protocol+"://"+req.get('host'))==("http://"+host))
    {
        console.log("Domain matched")

        mongoClient.connect(process.env.DB_CONNECT,{useUnifiedTopology : true},(err,db)=>{
            if(err) throw err

            console.log("db connected")

            let dbo = db.db('atom')
            dbo.collection('users').findOne({_id : req.query.id}, (dbErr, user)=>{
                if(dbErr) throw dbErr
                
                    console.log("user found")

                    dbo.collection('users').updateOne({"_id" : objectId(req.query.id) }, { $set: {verified : 1} }, async(dbErr, result)=>{
 
                        if(dbErr) throw dbErr
                        console.log(result)
                        console.log("User verified in database")
                        res.redirect('/login')
                    })
                }) 
        })
        
    } 
    else {
        res.send("request from unknown source")
    }
})

app.get('/login', (req,res)=>{
    res.render('login')
})

app.post('/login', (req,res) =>{

    let { error } = loginValidation(req.body)
    if(error) return res.status(400).json({msg:error.details[0].message})

    mongoClient.connect(process.env.DB_CONNECT, {useUnifiedTopology : true}, (err,db) => {
        
        if(err) throw err
        
        let dbo = db.db('atom')

        dbo.collection('users').findOne({email : req.body.email}, (dbErr, user)=>{

            if(dbErr) throw dbErr
            
            if(!user) return res.status(400).json({msg:"Email is not registered"})

            if(!user.verified) return res.status(400).json({msg:"User is not verified..please check email for verification link"})
            
            if(!bcrypt.compareSync(req.body.password,user.password)) return res.status(400).json({msg:"Password does not match"})
            
            let token = jwt.sign({id:user._id,type:user.userType},process.env.TOKEN_SECRET,{expiresIn:3600})
            res.json({token,msg:"logged in"})
        })
    })
})

app.get('/dash', (req,res) =>{

    mongoClient.connect(process.env.DB_CONNECT, { useUnifiedTopology: true }, (err,db) =>{
        if(err) throw err

        let dbo = db.db("atom")
        dbo.collection("events").find({}).toArray((dbErr,result)=>{
            if(dbErr) throw dbErr
            let today = new Date()
            res.render('dash', {result , user : app.get('loggedUser'), today})
        })
    })

})

app.get('/profile', (req,res) =>{
    res.render('profile', {user : app.get('loggedUser')})
})

var PORT = process.env.PORT || 3000
app.listen(PORT, (err)=>{
    if(err) throw err
    console.log(`App running on http://localhost:${PORT}`) 
})

