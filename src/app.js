//Importações necessárias

import express from "express";
import cors from "cors";
import { MongoClient, ObjectId } from "mongodb";
import dotenv from "dotenv";
import joi from "joi";
import dayjs from "dayjs";

//Configurações do Express

const app = express();
app.use(cors());
app.use(express.json());

dotenv.config();

//Dayjs

const realTime = dayjs().format("HH:mm:ss");

//Configurações do MongoDB

const mongoClient = new MongoClient(process.env.DATABASE_URL);
let db;
mongoClient.connect()
    .then(() => db = mongoClient.db())
    .catch(err => console.log(err.message));

//Post na rota participants

app.post('/participants', async (req,res) => {
    const { name } = req.body;
    
    const schemaName = joi.object({ name: joi.string().required() });
    const validation = schemaName.validate(req.body, { abortEarly: false });
    if(validation.error) {
        const errors = validation.error.details.map(detail => detail.message);
        return res.status(422).send(errors);
    }
    
    try{
        const nameUse = await db.collection('participants').findOne({name});
        if(nameUse) return res.status(409).send({message: "Este nome já existe!"});

        const bodyParticipants = { name, lastStatus: Date.now() };
        await db.collection('participants').insertOne(bodyParticipants);

        const bodyMessages = { 
            from: name,
            to: 'Todos',
            text: 'entra na sala...',
            type: 'status',
            time: realTime
        }

        await db.collection('messages').insertOne(bodyMessages);

        res.sendStatus(201);
    } catch (err) {
        res.status(500).send(err.message);
    }
})

app.get('/participants', async (req, res) => {
    try {
        const participants = await db.collection('participants').find().toArray();
        res.status(200).send(participants);
    } catch (err) {
        return res.status(500).send(err.message);
    }
})

app.post('/messages', async (req, res) => {
    const { to, text, type } = req.body;
    const from = req.headers.user;
    console.log(from)

    try{
        const isOnline = await db.collection('participants').findOne({name: from});
        if( !isOnline ) return res.status(422).send("Usuário não está logado!")
    } catch (err) {
        return res.status(500).send(err.message)
    }
    
    const message = {to, text, type, from, time: realTime};

    const schemaMessage = joi.object({
        to: joi.string().required(),
        text: joi.string().required(),
        type: joi.valid('message', 'private_message').required(),
        from: joi.required(),
        time: joi.any()
    });
    const validation = schemaMessage.validate(message, { abortEarly: false });
    if(validation.error) {
        const errors = validation.error.details.map(detail => detail.message);
        return res.status(422).send(errors);
    }

    try{
        await db.collection('messages').insertOne(message)
        res.sendStatus(201);
    } catch (err){
        return res.status(500).send(err.message)
    }
})

app.get('/messages', async (req,res) => {
    const { user } = req.headers;
    let { limit } = req.query;
    limit = Number(limit);

    try{
        const isOnline = await db.collection('participants').findOne({name: user});
        if( !isOnline ) return res.status(422).send("Usuário não está logado!")
    } catch (err) {
        return res.status(500).send(err.message)
    }

    try {
        let messages = await db.collection('messages').find({ $or: [{to: "Todos"}, {to: user}, {from: user}]}).toArray();
        messages = messages.reverse();
        
        if( limit || limit === 0 || isNaN(limit) ){
            if(limit < 0 || limit === 0 || isNaN(limit) ) return res.status(422).send("Valor inválido para o limit");
            if(limit >= messages.length)  return res.status(200).send(messages);
            messages = messages.slice(0, limit);
            return res.status(200).send(messages);
        }

        return res.status(200).send(messages);

    } catch (err) {
        return res.status(500).send(err.message);
    }
});

app.post('/status', async (req, res) => {
    const { user } = req.headers;
    
    if( !user ) return res.sendStatus(404);

    try{
        const isOnline = await db.collection('participants').findOne({name: user});
        if( !isOnline ) return res.sendStatus(404);

        await db.collection('participants').findOneAndUpdate({ name: user }, { $set: { lastStatus: Date.now() } });

        res.sendStatus(200);

    } catch (err) {
        return res.status(500).send(err.message);
    }
});

app.delete('/messages/:id', async (req, res) => {
    const { id } = req.params;
    const { user } = req.headers;

    try {

        const message = await db.collection('messages').findOne( { _id: new ObjectId(id) } );
        if( !message )  return res.sendStatus(404);
        if( message.from !== user ) return res.sendStatus(401);

        const result = await db.collection('messages').deleteOne( { _id: new ObjectId(id) } );
        if( result.deletedCount > 0) return res.sendStatus(200);

    } catch (err) {
        return res.status(500).send(err.message);
    }

})

setInterval( async () => {
    const timeLess = Date.now() - 10000;
    try {
        let users = await db.collection('participants').find( { lastStatus: { $lt:timeLess } } ).toArray();
        
        users.forEach( async user => {
            try{
                await db.collection('participants').deleteOne( { _id: new ObjectId(user._id) } );
                const messageExit = {
                    from: user.name,
                    to: 'Todos',
                    text: 'sai da sala...',
                    type: 'status',
                    time: realTime
                }
                await db.collection('messages').insertOne(messageExit);
            } catch {
                return res.status(500).send(err.message);
            }
        })

    } catch (err) {
        return res.status(500).send(err.message);
    }
    
}, 15000)



const PORT = 5000;
app.listen(PORT, () => console.log(`Servidor rodando na Porta ${PORT}`));