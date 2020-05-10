const Joi = require('@hapi/joi')

const registerValidation = data => {
    const schema = Joi.object({
        name : Joi.string().min(3).required(),
        email : Joi.string().required().email(),
        regno : Joi.string().required().min(15).max(15),
        password : Joi.string().min(8).required(),
        dept : Joi.string().min(3).required(),
        year : Joi.required(),
        domain : Joi.required()
    })

    return schema.validate(data)
}

const loginValidation = data => {
    const schema = Joi.object({
        email:Joi.string().required().email(),
        password:Joi.string().min(8).required()
    })

    return schema.validate(data)
}

module.exports.registerValidation = registerValidation
module.exports.loginValidation = loginValidation
