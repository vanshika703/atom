const Router = require('express').Router()
const mongodb = require('mongodb')
const ObjectId = mongodb.ObjectId

Router.get('/dash',async(req,res) => {
    let user = {
        name:'Vanshika',
        id:'5ebd06df12899630eccdd23e'
    }
    
    let db = req.app.locals.db

    try {
        //all tasks the user is involved in
        let tasks = await db.db('atom').collection('tasks').find({'members.id':user.id}).toArray()

        res.render('user/userdashboard',{tasks,user})
    } catch (error) {
        console.error(error)
        return res.render('error')
    }
})

Router.get('/project/:id',async(req,res) => {
    let user = {
        name:'Vanshika',
        id:'5ebd06df12899630eccdd23e'
    }
    let { id } = req.params

    let db = req.app.locals.db

    try {
        //finding the task that is requested
        let task = await db.db('atom').collection('tasks').findOne({_id:new ObjectId(id)})

        //subtasks of the user in that task
        let subtasks = await db.db('atom').collection('subtasks').find({project:id,member:user.id}).toArray()

        task.subtasks = subtasks

        res.render('user/userproject',{task,user})

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

module.exports = Router