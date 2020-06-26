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
                subject: 'Confirmation email for Tdian register',
                html: "<p>link is...<a href="+link+">Click here to verify....</a></p>"
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

Router.post('/userRegister',auth,(req,res) => {
    res.render('user/userRegister',{msg:''})
})

Router.post('/registerInfo', async(req,res) =>{

    let {token} = req.body 

    if(!token) return res.status(401).json({msg:'not authorized'})
    
    try {
        let user = jwt.verify(token,process.env.TOKEN_SECRET)
    
        if(!user) return res.status(401).json({msg:'not authorized'})
    
        delete req.body.token
    
        let { error } = registerInfoValidation(req.body)
        if(error) return res.render('user/userRegister',{msg:error.details[0].message})
    
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
    
        await dbo.collection('users').updateOne({_id:new ObjectId(user.id)},  { $set: userInfo })
        if(!user.type) return res.redirect(`/user/primarydash/`) //add token in the url
        else return res.redirect('/user/dashboard') //add token in the url
        
    } catch (error) {
        console.error(error)
        res.render('error')
    }
})

Router.post('/primaryDash',auth,(req,res) => res.send(`you're a regsitered user`))

Router.post('/dashboard', auth, async(req,res) => {
    let user = {
        name:'Arindam',
        id:'5ebfd0562f97d128fcb82780'
    }
    
    let db = req.app.locals.db

    try {
        //all tasks the user is involved in
        let tasks = await db.db('atom').collection('tasks').find({'members.id':user.id}).toArray()

        res.render('user/memberdashboard',{tasks,user})
    } catch (error) {
        console.error(error)
        return res.render('error')
    }
})

Router.get('/project/:id',async(req,res) => {
    let user = {
        name:'Arindam',
        id:'5ebfd0562f97d128fcb82780'
    }
    let { id } = req.params

    let db = req.app.locals.db

    try {
        //finding the task that is requested
        let task = await db.db('atom').collection('tasks').findOne({_id:new ObjectId(id)})

        //subtasks of the user in that task
        let subtasks = await db.db('atom').collection('subtasks').find({project:id,member:user.id}).toArray()

        let completed = 0

        subtasks.forEach(subtask => {
            if(subtask.complete) completed++
        })

        task.subtasks = subtasks
        task.percentage = Math.round((completed/subtasks.length)*100)

        res.render('user/memberproject',{task,user})

    } catch (error) {
        console.error(error)
        res.render('error')
    }
})

Router.put('/update/:id',async(req,res) => {
    let { id } = req.params

    let db = req.app.locals.db

    try {
        await db.db('atom').collection('subtasks').updateOne({_id:new ObjectId(id)},{$set:{complete:true}})
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

module.exports = Router