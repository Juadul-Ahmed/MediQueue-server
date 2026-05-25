const dns = require("node:dns");
dns.setServers(["8.8.8.8", "8.8.4.4"]);

const dotenv = require("dotenv");
const express = require("express");
const cors = require("cors");
const app = express();

app.use(cors());
app.use(express.json());

const { MongoClient, ServerApiVersion, ObjectId, BSON } = require("mongodb");
const { createRemoteJWKSet, jwtVerify } = require("jose-cjs");
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
const  JWKS = createRemoteJWKSet(
  new URL("http://localhost:3000/api/auth/jwks")
)
const verifyToken = async (req,res,next) => {
  const authHeader = req?.headers.authorization
  if(!authHeader){
    return res.status(401).json({message: "Unauthorized"})
  }
  const token = authHeader.split(" ")[1];
  if(!token){
    return res.status(401).json({message: "Unauthorized"})
  }
  
  try{
    const {payload} = await jwtVerify(token,JWKS)
  
    console.log(payload);
    next()
  }catch (error) {
return res.status(403).json({message: "Forbidden"})
  }
 
}

async function run() {
  try {
    // Connect the client to the server	(optional starting in v4.7)
    await client.connect();

    const db = client.db("mediqueue");
    const tutorCollection = db.collection("tutors");
    const bookingCollection = db.collection("bookings");

    // user bookings
    app.post("/booking", async (req, res) => {
      const bookingData = req.body;

      const updateResult = await tutorCollection.updateOne(
        {
          _id: new ObjectId(bookingData.tutorId),
          totalSlots: { $gt: 0 },
        },
        {
          $inc: { totalSlots: -1 },
        },
      );

      if (updateResult.modifiedCount === 0) {
        return res.status(400).json({ message: "No slots available" });
      }

      const bookingResult = await bookingCollection.insertOne(bookingData);

      res.json({
        success: true,
        bookingResult,
      });
    });

    // My bookings
    app.get("/booking/:userId", async (req, res) => {
      const { userId } = req.params;
      const result = await bookingCollection.find({ userId: userId }).toArray();
      res.json(result);
    });

    // Delete Bookings
    app.delete("/booking/:bookingId", async (req, res) => {
      const { bookingId } = req.params;

      const booking = await bookingCollection.findOne({
        _id: new ObjectId(bookingId),
      });

      if (!booking) {
        return res.status(404).json({ message: "Booking not found" });
      }

      const result = await bookingCollection.deleteOne({
        _id: new ObjectId(bookingId),
      });

      await tutorCollection.updateOne(
        { _id: new ObjectId(booking.tutorId) },
        { $inc: { totalSlots: 1 } },
      );

      res.json(result);
    });

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

    // Tutors Details Page
    app.get("/tutor/:id", verifyToken,  async (req, res) => {
      const { id } = req.params;

      const result = await tutorCollection.findOne({ _id: new ObjectId(id) });
      res.json(result);
    });

    // Add tutor
    app.post("/tutor", async (req, res) => {
      const tutorData = req.body;
      const result = await tutorCollection.insertOne(tutorData);

      res.json(result);
    });
    // My tutors
    app.get("/my-tutors/:userId", async (req, res) => {
      const { userId } = req.params;
      const result = await tutorCollection.find({ userId: userId }).toArray();
      res.json(result);
    });

    // Delete Tutors
    app.delete("/tutor/:id", async (req, res) => {
      const { id } = req.params;
      const result = await tutorCollection.deleteOne({ _id: new ObjectId(id) });
      res.json(result);
    });

    // Edit Tutors
    app.patch("/tutor/:id", async (req, res) => {
      const { id } = req.params;
      const updatedData = req.body;

      const result = await tutorCollection.updateOne(
        { _id: new ObjectId(id) },
        {
          $set: updatedData,
        },
      );

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
