//Importações necessárias

import express from "express";
import cors from "cors";
import { MongoClient } from "mongodb";
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
        type: joi.valid('message', 'private-message'),
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
    const { limit } = req.query;

    try{
        const isOnline = await db.collection('participants').findOne({name: user});
        if( !isOnline ) return res.status(422).send("Usuário não está logado!")
    } catch (err) {
        return res.status(500).send(err.message)
    }

    try {
        let messages = await db.collection('messages').find({ $or: [{to: "Todos"}, {to: user}, {from: user}]}).toArray();
        messages = messages.reverse();
        
        if( limit ){
            if(typeof limit !== "Number" || limit <= 0) return res.status(422).send("Valor inválido para o limit");
            messages = messages.slice(-limit);
            return res.status(200).send(messages);
        }

        return res.status(200).send(messages);

    } catch (err) {
        return res.status(500).send(err.message)
    }
});





const PORT = 5000;
app.listen(PORT, () => console.log(`Servidor rodando na Porta ${PORT}`));