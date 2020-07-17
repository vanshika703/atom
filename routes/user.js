const Router = require('express').Router()
const jwt = require('jsonwebtoken')

const mongodb = require('mongodb')
const ObjectId = mongodb.ObjectId

const bcrypt = require('bcryptjs')
const nodemailer = require('nodemailer')
const fetch = require('node-fetch')

const {OAuth2Client} = require('google-auth-library')
const client = new OAuth2Client("523384873779-e29ttamvfnbfkhb650ppufoas5qmr328.apps.googleusercontent.com")

const { loginValidation, registerInfoValidation } = require('../validation')

let host
let rand

Router.get('/', (req,res)=>{
    res.render('user/register')
})

Router.post('/register', async(req,res)=>{

    const { email,password,captcha } = req.body

    if(!captcha){
        return res.status(400).json({"msg":"Please select captcha"})
    }

    const secretKey = '6Lfie_kUAAAAAAYZM0z0uetf7cs8pFQ4_e567GmN'

    const verifyUrl = `https://google.com/recaptcha/api/siteverify?secret=${secretKey}&response=${captcha}&remoteip=${req.connection.remoteAddress}`

    let result = await fetch(verifyUrl)
    let data = await result.json()

    if(!data.success) return res.status(400).json({"msg":"Failed captcha verification! Please reload the page and try again"})

    let { error } = loginValidation({ email,password })
    if(error) return res.status(400).json({msg:error.details[0].message})

    let db = req.app.locals.db
    let dbo = db.db("atom")

    dbo.collection('users').findOne({email}, async(err, user)=>{
        if(err) return res.render('error')

        //if user exists
        if(user) return res.status(400).json({msg:"This email is already registered!"})
        
        //hashing password
        const salt = await bcrypt.genSalt(10)
        const hashedPassword = await bcrypt.hash(password, salt)

        //new user info
        let userInfo = {
            email,
            password : hashedPassword,
            userType : 0, //0 for non-member, 1 for member
            verified : 0,
            registered : 0,
            registrationType: 0 //0 for normal registration, 1 for google log in
        }

        dbo.collection('users').insertOne(userInfo, (dbErr,result)=>{
            if(dbErr) return res.render('error')

            host = req.get('host')
            rand = result.insertedId
            link = "http://"+req.get('host')+"/user/verify?id="+rand;

            let transporter = nodemailer.createTransport({
                service: 'gmail',
                auth: {
                    user: process.env.EMAIL,
                    pass: process.env.PASSWORD
                },
                tls:{
                    rejectUnauthorized:false
                }
            });
            
            let mailOptions = {
                from: process.env.EMAIL,
                to: email,
                subject: 'Think Digital Registeration Email',
                html: "<h2>Welcome to Think Digital</h2><br><p>Click<a href="+link+">here</a>to verify your email</p>"
            };
            
            transporter.sendMail(mailOptions, function(error, info){
                if (error) {
                    console.error(error);
                } else {
                    console.log('Email sent: ' + info.response);
                }
            });

            res.json({msg:"Check email for verification link"})
        })
    })    
})

Router.get('/verify', (req,res) => {

    console.log("link :"+req.protocol+":/"+req.get('host'))

    if((req.protocol+"://"+req.get('host'))==("http://"+host)) {
        console.log("Domain matched")

        let db = req.app.locals.db
        let dbo = db.db('atom')

        dbo.collection('users').findOne({_id : new ObjectId(req.query.id)}, (dbErr, user)=>{
            if(dbErr) return res.render('error')
            
            if(!user) return res.send('No such user found')

            dbo.collection('users').updateOne({_id : new ObjectId(req.query.id)}, { $set: {verified : 1} }, async(err, result)=>{
                if(err) return res.render('error')

                console.log(result.modifiedCount)
                res.redirect('/user/login')
            })
            console.log('object')
        }) 
    } 
    else {
        res.status(404).send('Error 404')
    }
})

Router.get('/login', (req,res)=>{
    res.render('user/login')
})

//Normal Email Login
Router.post('/login', (req,res) =>{

    let {email,password} = req.body

    let { error } = loginValidation({ email,password })
    if(error) return res.status(400).json({msg:error.details[0].message})

    let db = req.app.locals.db
    let dbo = db.db('atom')

    dbo.collection('users').findOne({email,registrationType:0}, (dbErr, user)=>{
        if(dbErr) return res.render('error')

        if(!user) return res.status(400).json({msg:"Incorrect credentials!"})

        if(!user.verified) return res.status(400).json({msg:"Email has not been verified yet. Please check email for verification link"})
        
        if(!bcrypt.compareSync(password,user.password)) return res.status(400).json({msg:"Incorrect credentials!"})
        
        let token = jwt.sign({id:user._id,type:user.userType},process.env.TOKEN_SECRET,{expiresIn:3600})
        if(!user.registered) return res.status(200).json({token,msg:"proceed to register info"})
        if(user.userType) return res.status(201).json({token,msg:"proceed to member dashboard"})
        else if (!user.userType) return res.status(202).json({token,msg:"proceed to user dashboard"})
    })
})

Router.post('/googleLogIn', async(req,res) => {

    try {
        const ticket = await client.verifyIdToken({
            idToken: req.body.id_token,
            audience: "523384873779-e29ttamvfnbfkhb650ppufoas5qmr328.apps.googleusercontent.com"
        })
        const payload = ticket.getPayload()
        const email = payload['email']
        
        let db = req.app.locals.db
        let dbo = db.db('atom')
    
        let user = await dbo.collection('users').findOne({email})

        if(!user) {
            let userInfo = {
                email,
                userType : 0,
                registered : 0,
                registrationType: 1 //0 for normal registration, 1 for google log in
            }
            let result = await dbo.collection('users').insertOne(userInfo)
            let token = jwt.sign({id:result.insertedId,type:0},process.env.TOKEN_SECRET,{expiresIn:3600})
            return res.status(200).json({token,msg:"proceed to register info"})

        } else if(!user.registrationType) {
            return res.status(400).json({msg:'This email is already registered. Please proceed to login!'})
        } else {

            let token = jwt.sign({id:user._id,type:user.userType},process.env.TOKEN_SECRET,{expiresIn:3600})

            if(!user.registered) return res.status(200).json({token,msg:"proceed to register info"})
            if(user.userType) return res.status(201).json({token,msg:"proceed to member dashboard"})
            else if (!user.userType) return res.status(202).json({token,msg:"proceed to user dashboard"})
            
        }
    } catch (error) {
        console.error(error)
        return res.status(400).json({msg:'Server error occured! Please refresh and try again!'})
    }
})

Router.get('/forgotpassword', (req,res) => {
    res.render('user/forgotpassword')
})

Router.post('/forgotpassword', async(req,res) => {

    let db = req.app.locals.db

    try {
        
        let dbo = db.db("atom")
        let user = await dbo.collection('users').findOne({email : req.body.email,registrationType:0 })
        if(!user) return res.json({msg:"No such user found!"})
    
        host = req.get('host')
        rand = user._id
        link = "http://"+req.get('host')+"/user/verifypasswordlink?id="+rand;
    
        let transporter = nodemailer.createTransport({
            service: 'gmail',
            auth: {
              user: process.env.EMAIL,
              pass: process.env.PASSWORD
            },
            tls:{
              rejectUnauthorized:false
            }
        });
          
        let mailOptions = {
            from: process.env.EMAIL,
            to: req.body.email,
            subject: 'Change password link for TD Atom',
            html: "<p>password reset link is...<a href="+link+">Click here to reset....</a></p>"
        };
          
        transporter.sendMail(mailOptions, function(error, info){
            if(!error) return res.json({msg:"Please check your email"});

            console.error(error)
            res.json({msg:'Server Error!'})
        })
    } catch (error) {
        console.error(error)
        res.json({msg:'Server error'})
    }
})

Router.get('/verifypasswordlink', (req,res) => {

    if((req.protocol+"://"+req.get('host'))==("http://"+host))
        res.render('user/changepassword', {id: req.query.id})
     
    else {
        res.send("Some error occured. Please try again!")
    }
})

Router.post('/changepassword', async(req,res) => {

    let password = req.body.newPassword

    if(password.length<8) return res.json({msg:'Password length must atleast be 8'})
    
    let db = req.app.locals.db

    try {
        
    } catch (error) {
        console.error(error)
        res.json({msg:'Server error'})
    }

    let dbo = db.db('atom')
    let user = await dbo.collection('users').findOne({_id : new ObjectId(req.body.id)}) 
    if(!user) return res.json({msg:"no such user found"})

    const salt = await bcrypt.genSalt(10)
    const hashedPassword = await bcrypt.hash(password, salt)

    await dbo.collection('users').updateOne({_id : new ObjectId(req.body.id) }, { $set: {password : hashedPassword} })

    res.json({msg:"Password updated succesfully"})
})

Router.post('/userRegister',auth,(req,res) => {
    res.render('user/userRegister',{msg:''})
})

Router.post('/registerInfo', auth, async(req,res) =>{
    
    let { token } = req.body 
    delete req.body.token
    let { error } = registerInfoValidation(req.body)
    if(error) return res.render('user/userRegister',{msg:error.details[0].message})
    try {
    
        let db = req.app.locals.db
        let dbo = db.db("atom")
    
        let userInfo = {
            name : req.body.name,
            regno : req.body.regno,
            dept : req.body.dept,
            year : req.body.year,
            batch : req.body.batch,
            contactno : req.body.contactno,
            whatsappno : req.body.whatsappno,
            domain1 : req.body.domain1,
            domain2 : req.body.domain2,
            registered : 1
        }
    
        await dbo.collection('users').updateOne({_id:new ObjectId(req.userId)},{ $set: userInfo })
        if(!req.userType) return res.redirect(`/user/primarydash/${token}`)
        else return res.redirect(`/user/dashboard/${token}`)
        
    } catch (error) {
        console.error(error)
        res.render('error')
    }
})

Router.get('/profile/:token', authParams, async(req,res) => {
    
    try {

        let db = req.app.locals.db
        let dbo = db.db("atom")
        let user = await dbo.collection('users').findOne({_id:new ObjectId(req.userId)})

        res.render('user/profile', {user})
        
    } catch (error) {
        console.error(error)
        res.render('error')
    }
})

Router.post('/primaryDash',auth, async(req,res) => {
    try {

        let db = req.app.locals.db
        let dbo = db.db("atom")
        let loggedUser = await dbo.collection('users').findOne({_id:new ObjectId(req.userId)})

        let query = { domain : loggedUser.domain1 }

        let result = await dbo.collection("events").find(query).toArray()
        let today = new Date()

        res.render('user/primary', {result , today})
        
    } catch (error) {
        console.error(error)
        res.render('error')
    }
})

Router.get('/primarydash/:token', authParams, async(req,res) => {
    
    try {

        let db = req.app.locals.db
        let dbo = db.db("atom")
        let user = await dbo.collection('users').findOne({_id:new ObjectId(req.userId)})

        let query = { domain : user.domain1 }

        let result = await dbo.collection("events").find(query).toArray()
        let today = new Date()

        res.render('user/primary', {result , today})
        
    } catch (error) {
        console.error(error)
        res.render('error')
    }
})

Router.get('/secondarydash/:token', authParams, async(req,res) => {
    
    try {

        let db = req.app.locals.db
        let dbo = db.db("atom")
        let user = await dbo.collection('users').findOne({_id:new ObjectId(req.userId)})

        let query = { domain : user.domain2 }

        let result = await dbo.collection("events").find(query).toArray()
        let today = new Date()

        res.render('user/secondary', {result , today})
        
    } catch (error) {
        console.error(error)
        res.render('error')
    }
})

Router.post('/attendance', authHeader, async(req,res) => {

    let db = req.app.locals.db

    try {
        
        let user = await db.db('atom').collection('users').findOne({_id:new ObjectId(req.userId)})
        let { name,email } = user
        
        let dbo = db.db("atom")
        let result = await dbo.collection('events').findOne({_id : new ObjectId(req.body.id) })
        if(result.attendance){
            for(let i=0; i<result.attendance.length; i++){
                if(email === result.attendance[i].email)
                {
                    console.log("given atn")
                    return res.json({msg:"already marked attendance"})
                    break
                }
            }
        }
        
        let attendInfo = {
            name,
            email,
            willAttend : req.body.attendance
        }
    
        await dbo.collection('events').updateOne({_id : new ObjectId(req.body.id) },  { $push :{ attendance:  attendInfo }})
        res.json({msg : "Thankyou for response of attendance"})

    } catch (error) {
        console.error(error)
        res.json({msg:'Server error'})
    }
})

Router.post('/feedback', authHeader, async(req,res) => {

    let db = req.app.locals.db

    try {
        
        let user = await db.db('atom').collection('users').findOne({_id:new ObjectId(req.userId)})
        let { name,email } = user
        let dbo = db.db("atom")
        let feedbackInfo = {
            name,
            email,
            environment : req.body.env,
            speaker : req.body.speaker,
            understanding : req.body.understanding,
            suggestion : req.body.suggestion
        }
    
        await dbo.collection('events').updateOne({_id : new ObjectId(req.body.id) },  { $push :{ feedback:  feedbackInfo }})
        res.json({msg : "Thankyou for giving feedback"})

    } catch (error) {
        console.error(error)
        res.json({msg:'Server error'})
    }


})

Router.get('/memberprofile/:token', authParams, async(req,res) => {
    
    try {

        let db = req.app.locals.db
        let dbo = db.db("atom")
        let user = await dbo.collection('users').findOne({_id:new ObjectId(req.userId)})

        res.render('user/memberprofile', {user})
        
    } catch (error) {
        console.error(error)
        res.render('error')
    }
})

Router.post('/dashboard', auth, async(req,res) => {
    
    let db = req.app.locals.db

    try {
        let user = await db.db('atom').collection('users').findOne({_id:new ObjectId(req.userId)})
        //all tasks the user is involved in
        let tasks = await db.db('atom').collection('tasks').find({'members.id':req.userId}).toArray()

        res.render('user/memberdashboard',{tasks,user})
    } catch (error) {
        console.error(error)
        return res.render('error')
    }
})

Router.get('/dashboard/:token', authParams, async(req,res) => {
    
    let db = req.app.locals.db

    try {
        let user = await db.db('atom').collection('users').findOne({_id:new ObjectId(req.userId)})
        //all tasks the user is involved in
        let tasks = await db.db('atom').collection('tasks').find({'members.id':req.userId}).toArray()

        res.render('user/memberdashboard',{tasks,user})
    } catch (error) {
        console.error(error)
        return res.render('error')
    }
})

Router.get('/project/:id/:token', authParams, async(req,res) => {

    let { id } = req.params

    let db = req.app.locals.db

    try {

        let user = await db.db('atom').collection('users').findOne({_id:new ObjectId(req.userId)})

        //finding the task that is requested
        let task = await db.db('atom').collection('tasks').findOne({_id:new ObjectId(id)})

        //subtasks of the user in that task
        let subtasks = await db.db('atom').collection('subtasks').find({project:id,member:req.userId}).toArray()
        
        //bugs of the user in that task
        let bugs = await db.db('atom').collection('bugs').find({project:id,member:req.userId}).toArray()
        
        let completed = 0
        let total = subtasks.length+bugs.length

        subtasks.forEach(subtask => {
            if(subtask.complete) completed++
        })
        
        bugs.forEach(bug => {
            if(bug.complete) completed++
        })

        task.subtasks = subtasks
        task.bugs = bugs
        task.percentage = Math.round((completed/total)*100)

        res.render('user/memberproject',{task,user})

    } catch (error) {
        console.error(error)
        res.render('error')
    }
})

Router.put('/update/:id',authHeader,async(req,res) => {
    let { id } = req.params

    let db = req.app.locals.db

    try {
        let subtask = await db.db('atom').collection('subtasks').findOne({_id:new ObjectId(id)})
        if(!subtask) return res.render('error')
        if(subtask.member !== req.userId) return res.send('Not authorised!')

        await db.db('atom').collection('subtasks').updateOne({_id:new ObjectId(id)},{$set:{complete:true}})
        res.json({msg:'Updated'})
    } catch (error) {
        console.error(error)
        return res.status(500).json({msg:'Server Error!'})
    }
})

Router.put('/updateBug/:id',authHeader,async(req,res) => {
    let { id } = req.params

    let db = req.app.locals.db

    try {
        let bug = await db.db('atom').collection('bugs').findOne({_id:new ObjectId(id)})
        if(!bug) return res.render('error')
        if(bug.member !== req.userId) return res.send('Not authorised!')

        await db.db('atom').collection('bugs').updateOne({_id:new ObjectId(id)},{$set:{complete:true}})
        res.json({msg:'Updated'})
    } catch (error) {
        console.error(error)
        return res.status(500).json({msg:'Server Error!'})
    }
})

function auth(req,res,next){
    let token = req.body.token

    if(!token) return res.status(401).json({msg:'not authorized'})

    jwt.verify(token,process.env.TOKEN_SECRET,(err,user) => {
        if(err) return res.status(400).json({msg:'token does not match'})

        req.userId = user.id
        req.userType = user.type
        next()
    })
}

function authParams(req,res,next){
    let {token} = req.params

    if(!token) return res.status(401).json({msg:'not authorized'})

    jwt.verify(token,process.env.TOKEN_SECRET,(err,user) => {
        if(err) return res.status(400).json({msg:'token does not match. Please login again'})

        req.userId = user.id
        req.userType = user.type
        next()
    })
}

function authHeader(req,res,next){
    let token = req.headers['x-auth-token']

    if(!token) return res.status(401).json({msg:'not authorized'})

    jwt.verify(token,process.env.TOKEN_SECRET,(err,user) => {
        if(err) return res.status(400).json({msg:'token does not match'})

        req.userId = user.id
        req.userType = user.type
        next()
    })
}

module.exports = Router