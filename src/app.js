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
    const from = req.header.User;

})

const PORT = 5000;
app.listen(PORT, () => console.log(`Servidor rodando na Porta ${PORT}`));