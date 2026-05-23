const dns = require("node:dns");
dns.setServers(["8.8.8.8", "8.8.4.4"]);

const dotenv = require("dotenv");
const express = require("express");
const cors = require("cors");
const app = express();

app.use(cors());
app.use(express.json());

const { MongoClient, ServerApiVersion } = require("mongodb");
dotenv.config();

const uri = process.env.MONGODB_URI;
const PORT = process.env.PORT;

const client = new MongoClient(uri, {
  serverApi: {
    version: ServerApiVersion.v1,
    strict: true,
    deprecationErrors: true,
  },
});

async function run() {
  try {
    // Connect the client to the server	(optional starting in v4.7)
    await client.connect();

    const db = client.db("mediqueue");
    const tutorCollection = db.collection("tutors");

    // Tutors
    app.get("/tutor/all", async (req, res) => {
      const { tutorName, hourlyFee, sessionStartDate } = req.query;
      let query = {};

      if (tutorName) {
        query.tutorName = {
          $regex: tutorName,
          $options: "i",
        };
      }
      if (hourlyFee) {
        query.hourlyFee = {
          $lte: parseInt(hourlyFee),
        };
      }
      if (sessionStartDate) {
        query.sessionStartDate = sessionStartDate;
      }

      const result = await tutorCollection.find(query).limit(6).toArray();

      res.json(result);
    });

    // Add tutor
    app.post("/tutor", async (req, res) => {
      const tutorData = req.body;
      const result = await tutorCollection.insertOne(tutorData);

      res.json(result);
    });

    // Send a ping to confirm a successful connection
    await client.db("admin").command({ ping: 1 });
    console.log(
      "Pinged your deployment. You successfully connected to MongoDB!",
    );
  } finally {
    // Ensures that the client will close when you finish/error
    // await client.close();
  }
}
run().catch(console.dir);

app.get("/", async (req, res) => {
  res.send("Server is running");
});

app.listen(PORT, () => {
  console.log(`Server running on Port ${PORT}`);
});
